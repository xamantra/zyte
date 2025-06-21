import { describe, it, expect } from 'bun:test';
import { ZyteSSR } from '../src/index';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { createSSR } from '../src/index';
import { setTimeout as delay } from 'timers/promises';

const TMP_DIR = join(process.cwd(), 'tests', 'tmp');
const APP_DIR = join(TMP_DIR, 'src', 'app');
const ROUTES_DIR = join(TMP_DIR, 'src', 'routes');
const APP_TS = join(APP_DIR, 'app.ts');
const APP_HTML = join(APP_DIR, 'app.html');
const APP_CSS = join(APP_DIR, 'app.css');
const ROUTE_DIR = join(ROUTES_DIR, 'foo');
const ROUTE_TS = join(ROUTE_DIR, 'foo.ts');
const ROUTE_HTML = join(ROUTE_DIR, 'foo.html');
const ROUTE_CSS = join(ROUTE_DIR, 'foo.css');
const DIST_CLIENT_ROUTE_DIR = join(TMP_DIR, 'dist', 'client', 'routes', 'foo');
const CLIENT_JS = join(DIST_CLIENT_ROUTE_DIR, 'foo.client.js');

function setupAppFiles() {
  if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
  writeFileSync(APP_TS, `export function appPage() { return '<h1>Hello SSR</h1>'; }`);
  writeFileSync(APP_HTML, `<!DOCTYPE html>\n<html><head></head><body>{{ appPage() }}</body></html>`);
}
function setupRouteFiles() {
  if (!existsSync(ROUTE_DIR)) mkdirSync(ROUTE_DIR, { recursive: true });
  writeFileSync(ROUTE_TS, `export function fooPage() { return '<div>Foo Route</div>'; }`);
  writeFileSync(ROUTE_HTML, `<!DOCTYPE html>\n<html><head><title>Foo</title></head><body>{{ fooPage() }}</body></html>`);
}
function setupRouteFilesWithCSS() {
  setupRouteFiles();
  writeFileSync(ROUTE_CSS, 'body { background: #abc; }');
}
function setupAppFilesWithCSS() {
  setupAppFiles();
  writeFileSync(APP_CSS, 'body { color: red; }');
}
function setupClientBundle() {
  if (!existsSync(DIST_CLIENT_ROUTE_DIR)) mkdirSync(DIST_CLIENT_ROUTE_DIR, { recursive: true });
  writeFileSync(CLIENT_JS, 'console.log("client bundle loaded");');
}
function cleanupAll() {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
}

// Import the handler logic from src/server.ts
async function serverHandlerForTest(baseDir: string, url: string) {
  // Inline the handler logic from src/server.ts, but allow baseDir override
  const ssr = createSSR({ baseDir });
  const request = new Request('http://localhost' + url, {
    headers: { 'accept': 'text/html' }
  });
  const parsedUrl = new URL(request.url);
  const path = parsedUrl.pathname;
  // Simulate the handler logic
  // (copy-paste from src/server.ts, but with baseDir override)
  // Serve static files (skip for this test)
  try {
    const query: Record<string, string> = {};
    parsedUrl.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    const context = {
      params: {},
      query,
      headers: Object.fromEntries(request.headers.entries())
    };
    let html = await ssr.render(path, context);
    // Determine possible client bundle path dynamically
    let clientScriptPath: string | null = null;
    const routeParts = path.split('/').filter(Boolean);
    if (routeParts.length === 0 || path === '/app' || path === '/app/') {
      if (existsSync(join(baseDir, 'dist', 'client', 'app', 'app.client.js'))) {
        clientScriptPath = '/client/app/app.client.js';
      }
    } else {
      let routePath = routeParts.join('/');
      let routeName = routeParts[routeParts.length - 1];
      let candidate = join(baseDir, 'dist', 'client', 'routes', ...routeParts, `${routeName}.client.js`);
      if (existsSync(candidate)) {
        clientScriptPath = `/client/routes/${routePath}/${routeName}.client.js`;
      }
    }
    if (clientScriptPath) {
      html = html.replace('</body>', `<script src="${clientScriptPath}"></script>\n</body>`);
    }
    return html;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

describe('SSR Framework', () => {
  it('renders a simple SSR template', async () => {
    setupAppFiles();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<h1>Hello SSR</h1>');
    cleanupAll();
  });

  it('throws if template is missing', async () => {
    cleanupAll();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    await expect(ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } }))
      .rejects.toThrow('HTML template not found');
  });

  it('discovers and renders a route in src/routes/', async () => {
    setupAppFiles();
    setupRouteFiles();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/foo', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<div>Foo Route</div>');
    cleanupAll();
  });

  it('processes template expressions', async () => {
    setupAppFiles();
    writeFileSync(APP_HTML, `<!DOCTYPE html>\n<html><body>{{ appPage() }}</body></html>`);
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<h1>Hello SSR</h1>');
    cleanupAll();
  });

  it('injects CSS for app', async () => {
    setupAppFilesWithCSS();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<link rel="stylesheet" href="/app/app.css">');
    cleanupAll();
  });

  it('injects CSS for a route', async () => {
    setupAppFiles();
    setupRouteFilesWithCSS();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/foo', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<link rel="stylesheet" href="/routes/foo/foo.css">');
    cleanupAll();
  });

  it('returns 404 for missing route', async () => {
    setupAppFiles();
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/notfound', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('404 - Page Not Found');
    cleanupAll();
  });

  it('injects client script for a route if bundle exists (server logic)', async () => {
    setupAppFiles();
    setupRouteFiles();
    setupClientBundle();
    const html = await serverHandlerForTest(TMP_DIR, '/foo');
    expect(html).toContain('<script src="/client/routes/foo/foo.client.js"></script>');
    cleanupAll();
  });

  it('renders an async SSR component', async () => {
    // Setup async SSR component in app
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(APP_TS, `export async function appPage() { await (new Promise(r => setTimeout(r, 10))); return '<h1>Async SSR</h1>'; }`);
    writeFileSync(APP_HTML, `<!DOCTYPE html>\n<html><head></head><body>{{ appPage() }}</body></html>`);
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<h1>Async SSR</h1>');
    cleanupAll();
  });

  it('supports multiple exports in templates', async () => {
    // Setup multiple exports component
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(APP_TS, `
export function header() {
  return '<header>Navigation</header>';
}

export function mainContent() {
  return '<main>Main content</main>';
}

export function footer() {
  return '<footer>Footer</footer>';
}

export function getTitle() {
  return 'Test Page';
}

export const pageData = {
  author: 'John Doe',
  date: '2024-01-01'
};
`);
    writeFileSync(APP_HTML, `<!DOCTYPE html>
<html>
<head>
  <title>{{ getTitle() }}</title>
</head>
<body>
  {{ header() }}
  {{ mainContent() }}
  <p>By {{ pageData.author }} on {{ pageData.date }}</p>
  {{ footer() }}
</body>
</html>`);
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<header>Navigation</header>');
    expect(html).toContain('<main>Main content</main>');
    expect(html).toContain('<footer>Footer</footer>');
    expect(html).toContain('<title>Test Page</title>');
    expect(html).toContain('By John Doe on 2024-01-01');
    cleanupAll();
  });

  it('supports function calls with arguments', async () => {
    // Setup component with function arguments
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(APP_TS, `
export function greet(name: string) {
  return \`<h1>Hello, \${name}!</h1>\`;
}

export function formatDate(date: string) {
  return \`<p>Date: \${date}</p>\`;
}

export function getCount(count: number) {
  return \`<span>Count: \${count}</span>\`;
}
`);
    writeFileSync(APP_HTML, `<!DOCTYPE html>
<html>
<body>
  {{ greet('World') }}
  {{ formatDate('2024-01-01') }}
  {{ getCount(42) }}
</body>
</html>`);
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const html = await ssr.render('/', { params: {}, query: {}, headers: { accept: 'text/html' } });
    expect(html).toContain('<h1>Hello, World!</h1>');
    expect(html).toContain('<p>Date: 2024-01-01</p>');
    expect(html).toContain('<span>Count: 42</span>');
    cleanupAll();
  });

  it('supports query parameters in templates', async () => {
    // Setup component with query parameter access
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(APP_TS, `
export function searchPage(context?: any) {
  const query = context?.query || {};
  const q = query.q || '';
  return \`<h1>Search: \${q}</h1>\`;
}

export function getTitle(context?: any) {
  const query = context?.query || {};
  const q = query.q || 'Search';
  return \`Search: \${q}\`;
}
`);
    writeFileSync(APP_HTML, `<!DOCTYPE html>
<html>
<head>
  <title>{{ getTitle() }}</title>
</head>
<body>
  {{ searchPage() }}
  <p>Query: {{ query.q || 'None' }}</p>
  <p>Page: {{ query.page || '1' }}</p>
</body>
</html>`);
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const context = {
      params: {},
      query: { q: 'typescript', page: '2' },
      headers: { accept: 'text/html' }
    };
    const html = await ssr.render('/', context);
    expect(html).toContain('<title>Search: typescript</title>');
    expect(html).toContain('<h1>Search: typescript</h1>');
    expect(html).toContain('<p>Query: typescript</p>');
    expect(html).toContain('<p>Page: 2</p>');
    cleanupAll();
  });

  it('supports query parameters in function arguments', async () => {
    // Setup component with query parameters in function arguments
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(APP_TS, `
export function displayUser(userId: string) {
  return \`<div>User ID: \${userId}</div>\`;
}

export function showPage(page: string) {
  return \`<div>Page: \${page}</div>\`;
}
`);
    writeFileSync(APP_HTML, `<!DOCTYPE html>
<html>
<body>
  {{ displayUser(query.userId) }}
  {{ showPage(query.page) }}
</body>
</html>`);
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const context = {
      params: {},
      query: { userId: '123', page: '5' },
      headers: { accept: 'text/html' }
    };
    const html = await ssr.render('/', context);
    expect(html).toContain('<div>User ID: 123</div>');
    expect(html).toContain('<div>Page: 5</div>');
    cleanupAll();
  });

  it('injects client-side navigation script for HTML requests', async () => {
    // Setup app files
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(APP_TS, `export function appPage() { return '<h1>Home</h1>'; }`);
    writeFileSync(APP_HTML, `<!DOCTYPE html>\n<html><head></head><body>{{ appPage() }}</body></html>`);
    
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const context = {
      params: {},
      query: {},
      headers: { accept: 'text/html' }
    };
    const html = await ssr.render('/', context);
    
    // Should contain the client-side navigation script
    expect(html).toContain('Zyte SSR Interactivity Script');
    expect(html).toContain('navigateTo');
    expect(html).toContain('window.zyteNavigate');
    cleanupAll();
  });

  it('does not inject client-side navigation script for non-HTML requests', async () => {
    // Setup app files
    if (!existsSync(APP_DIR)) mkdirSync(APP_DIR, { recursive: true });
    writeFileSync(APP_TS, `export function appPage() { return '<h1>Home</h1>'; }`);
    writeFileSync(APP_HTML, `<!DOCTYPE html>\n<html><head></head><body>{{ appPage() }}</body></html>`);
    
    const ssr = new ZyteSSR({ baseDir: TMP_DIR });
    const context = {
      params: {},
      query: {},
      headers: { accept: 'application/json' }
    };
    const html = await ssr.render('/', context);
    
    // Should not contain the client-side navigation script
    expect(html).not.toContain('Zyte SSR Interactivity Script');
    expect(html).not.toContain('navigateTo');
    cleanupAll();
  });
}); 