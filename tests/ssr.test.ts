import { describe, it, expect } from 'bun:test';
import { ZyteSSR } from '../src/index';
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

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
function cleanupAll() {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true, force: true });
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
}); 