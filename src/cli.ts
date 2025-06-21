#!/usr/bin/env bun

import { mkdir, writeFile, copyFile, readdir, stat, watch } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { build as esbuildBuild } from 'esbuild';

const COMMANDS = {
  'new': 'Create a new Zyte SSR project',
  'add-route': 'Add a new route to the project',
  'dev': 'Start development server',
  'build': 'Build the project for production',
  'start': 'Run the built server.js',
  'help': 'Show this help message'
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  switch (command) {
    case 'new':
      await createNewProject(args[1]);
      break;
    case 'add-route':
      await addRoute(args[1]);
      break;
    case 'dev':
      await startDevServer();
      break;
    case 'build':
      await buildProject();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

function showHelp() {
  console.log('Zyte SSR Framework CLI\n');
  console.log('Usage: zyte <command> [options]\n');
  console.log('Commands:');
  Object.entries(COMMANDS).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(12)} ${desc}`);
  });
}

async function createNewProject(projectName?: string) {
  if (!projectName) {
    console.error('Project name is required. Usage: zyte new <project-name>');
    process.exit(1);
  }

  projectName = projectName.replace(/^['"]|['"]$/g, '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(projectName)) {
    console.error('Invalid project name. Only letters, numbers, dashes, and underscores are allowed.');
    process.exit(1);
  }

  const projectDir = join(process.cwd(), projectName);
  
  if (existsSync(projectDir)) {
    console.error(`Project directory ${projectName} already exists.`);
    process.exit(1);
  }

  try {
    await mkdir(projectDir);
    await mkdir(join(projectDir, 'src'));
    await mkdir(join(projectDir, 'src', 'app'));
    await mkdir(join(projectDir, 'src', 'routes'));
    await mkdir(join(projectDir, 'src', 'routes', 'counter'));

    // Create package.json
    const packageJson = {
      name: projectName,
      version: "1.0.0",
      type: "module",
      scripts: {
        "dev": "zyte dev",
        "build": "zyte build",
        "start": "bun dist/server.js"
      },
      dependencies: {
        "zyte": "latest"
      }
    };

    await writeFile(
      join(projectDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        moduleResolution: "bundler",
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true
      }
    };

    await writeFile(
      join(projectDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    // Create src/index.ts
    const indexTs = `import { createSSR } from 'zyte';

const ssr = createSSR();

export default ssr;
`;
    await writeFile(join(projectDir, 'src', 'index.ts'), indexTs);

    // Create src/app/app.ts
    const appTs = `export function appPage() {
  return \`
  <div class="container">
    <h1>Welcome to Zyte SSR!</h1>
    <p>This is your new SSR app. Try the counter example below:</p>
    <button id="to-counter">Go to Counter</button>
  </div>
  \`;
}
`;
    await writeFile(join(projectDir, 'src', 'app', 'app.ts'), appTs);

    // Create src/app/app.html
    const appHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome - Zyte SSR</title>
</head>
<body>
  {{ appPage() }}
</body>
</html>`;
    await writeFile(join(projectDir, 'src', 'app', 'app.html'), appHtml);

    // Create src/app/app.css
    const appCss = `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 2rem;
  background-color: #f3f4f6;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

h1 {
  color: #2563eb;
}
button {
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1.1rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background: #1d4ed8;
}
`;
    await writeFile(join(projectDir, 'src', 'app', 'app.css'), appCss);

    // Create src/app/app.client.ts
    const appClientTs = `document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('to-counter');
  if (btn) {
    btn.addEventListener('click', () => {
      window.location.href = '/counter';
    });
  }
});
`;
    await writeFile(join(projectDir, 'src', 'app', 'app.client.ts'), appClientTs);

    // Create counter route files
    const counterDir = join(projectDir, 'src', 'routes', 'counter');
    // counter.ts
    const counterTs = `export function counterPage() {
  return \`
  <div class="container">
    <h1>Counter Example</h1>
    <p>Current count: <span id="count">0</span></p>
    <button id="increment">Increment</button>
  </div>
  \`;
}
`;
    await writeFile(join(counterDir, 'counter.ts'), counterTs);
    // counter.html
    const counterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Counter - Zyte SSR</title>
</head>
<body>
  {{ counterPage() }}
</body>
</html>`;
    await writeFile(join(counterDir, 'counter.html'), counterHtml);
    // counter.css
    const counterCss = `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 2rem;
  background-color: #f3f4f6;
}

.container {
  max-width: 800px;
  margin: 0 auto;
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}
h1 {
  color: #2563eb;
}
button {
  margin-top: 1.5rem;
  padding: 0.75rem 1.5rem;
  font-size: 1.1rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background: #1d4ed8;
}
#count {
  font-weight: bold;
  font-size: 1.3rem;
  color: #16a34a;
}
`;
    await writeFile(join(counterDir, 'counter.css'), counterCss);
    // counter.client.ts
    const counterClientTs = `document.addEventListener('DOMContentLoaded', () => {
  let count = 0;
  const countSpan = document.getElementById('count');
  const btn = document.getElementById('increment');
  if (btn && countSpan) {
    btn.addEventListener('click', () => {
      count++;
      countSpan.textContent = String(count);
    });
  }
});
`;
    await writeFile(join(counterDir, 'counter.client.ts'), counterClientTs);

    // Create .gitignore
    const gitignore = `# Node/Bun
node_modules/
dist/
build/
.env
*.log
bun.lockb
.cache/
.DS_Store
.idea/
.vscode/
*.swp
`;
    await writeFile(join(projectDir, '.gitignore'), gitignore);

    console.log(`✅ Created new Zyte SSR project: ${projectName}`);
    console.log(`📁 Navigate to the project: cd ${projectName}`);
    console.log(`🚀 Start development: bun run dev`);
  } catch (error) {
    console.error('Failed to create project:', error);
    process.exit(1);
  }
}

async function createExampleRoute(baseDir: string, routeName: string) {
  const routesDir = join(baseDir, 'routes');
  const exampleDir = join(routesDir, routeName);
  
  await mkdir(exampleDir);

  // Create <routeName>.ts
  const routeTs = `export function ${routeName}Page(context?: any) {
    const query = context?.query || {};
    const name = query.name || 'Guest';
    const theme = query.theme || 'light';
    
    return \`
    <div class="container \${theme}-theme">
      <h1>${routeName.charAt(0).toUpperCase() + routeName.slice(1)}</h1>
      <p>Hello, \${name}!</p>
      <p>Current theme: \${theme}</p>
      
      <div class="query-demo">
        <h3>Query Parameters Demo</h3>
        <p>Try these URLs:</p>
        <ul>
          <li><a href="/${routeName}?name=Alice">/?name=Alice</a></li>
          <li><a href="/${routeName}?theme=dark">/?theme=dark</a></li>
          <li><a href="/${routeName}?name=Bob&theme=dark">/?name=Bob&theme=dark</a></li>
        </ul>
      </div>
    </div>
    \`;
  }

  export function header(context?: any) {
    const query = context?.query || {};
    const theme = query.theme || 'light';
    
    return \`
    <header class="page-header \${theme}-theme">
      <nav>
        <a href="/">Home</a>
        <a href="/${routeName}">${routeName.charAt(0).toUpperCase() + routeName.slice(1)}</a>
      </nav>
      <div class="theme-indicator">
        Theme: \${theme}
      </div>
    </header>
    \`;
  }

  export function footer() {
    return \`
    <footer class="page-footer">
      <p>&copy; 2024 Zyte SSR Framework</p>
    </footer>
    \`;
  }

  export function sidebar(context?: any) {
    const query = context?.query || {};
    const name = query.name || 'Guest';
    
    return \`
    <aside class="sidebar">
      <h3>User Info</h3>
      <p>Welcome, \${name}!</p>
      
      <h3>Query Parameters</h3>
      <ul>
        <li>Name: \${query.name || 'Not set'}</li>
        <li>Theme: \${query.theme || 'light'}</li>
        <li>Page: \${query.page || '1'}</li>
      </ul>
      
      <h3>Related Links</h3>
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/${routeName}">${routeName.charAt(0).toUpperCase() + routeName.slice(1)}</a></li>
      </ul>
    </aside>
    \`;
  }

  export function getTitle(context?: any) {
    const query = context?.query || {};
    const name = query.name || 'Guest';
    return \`${routeName.charAt(0).toUpperCase() + routeName.slice(1)} - Welcome \${name}\`;
  }
`;
  await writeFile(join(exampleDir, `${routeName}.ts`), routeTs);

  // Create <routeName>.html
  const routeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ getTitle() }}</title>
</head>
<body>
  {{ header() }}
  
  <main class="main-content">
    {{ ${routeName}Page() }}
    
    <!-- Direct query parameter access in templates -->
    <div class="query-info">
      <h3>Current Query Parameters:</h3>
      <p>Name: {{ query.name || 'Not set' }}</p>
      <p>Theme: {{ query.theme || 'light' }}</p>
      <p>Page: {{ query.page || '1' }}</p>
    </div>
  </main>
  
  {{ sidebar() }}
  
  {{ footer() }}
</body>
</html>`;
  await writeFile(join(exampleDir, `${routeName}.html`), routeHtml);

  // Create <routeName>.css
  const routeCss = `body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f3f4f6;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.page-header {
  background: #2563eb;
  color: white;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.page-header nav {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 2rem;
}

.page-header a {
  color: white;
  text-decoration: none;
  font-weight: 500;
}

.page-header a:hover {
  text-decoration: underline;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 250px;
  gap: 2rem;
}

.container {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.container.dark-theme {
  background: #1f2937;
  color: white;
}

.query-demo {
  margin-top: 2rem;
  padding: 1rem;
  background: #f8fafc;
  border-radius: 6px;
  text-align: left;
}

.container.dark-theme .query-demo {
  background: #374151;
}

.query-demo h3 {
  margin-top: 0;
  color: #2563eb;
}

.query-demo ul {
  list-style: none;
  padding: 0;
}

.query-demo li {
  margin: 0.5rem 0;
}

.query-demo a {
  color: #2563eb;
  text-decoration: none;
  padding: 0.5rem;
  border-radius: 4px;
  display: inline-block;
  transition: background-color 0.2s;
}

.query-demo a:hover {
  background-color: #e5e7eb;
}

.query-info {
  background: #f0f9ff;
  padding: 1rem;
  border-radius: 6px;
  margin-top: 1rem;
  text-align: left;
}

.container.dark-theme .query-info {
  background: #1e3a8a;
}

.query-info h3 {
  margin-top: 0;
  color: #2563eb;
}

.sidebar {
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  height: fit-content;
}

.sidebar h3 {
  margin-top: 0;
  color: #2563eb;
  border-bottom: 2px solid #e5e7eb;
  padding-bottom: 0.5rem;
}

.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar li {
  margin: 0.5rem 0;
}

.sidebar a {
  color: #374151;
  text-decoration: none;
  display: block;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.sidebar a:hover {
  background-color: #f3f4f6;
  color: #2563eb;
}

.page-footer {
  background: #1f2937;
  color: white;
  text-align: center;
  padding: 1rem;
  margin-top: auto;
}

h1 {
  color: #2563eb;
  margin-bottom: 1rem;
}

p {
  color: #6b7280;
  font-size: 1.1rem;
}

.container.dark-theme h1,
.container.dark-theme p {
  color: white;
}

.theme-indicator {
  font-size: 0.9rem;
  opacity: 0.8;
}
`;
  await writeFile(join(exampleDir, `${routeName}.css`), routeCss);
}

async function addRoute(routeName?: string) {
  if (!routeName) {
    console.error('Route name is required. Usage: zyte add-route <route-name>');
    process.exit(1);
  }
  routeName = routeName.replace(/^['"]|['"]$/g, '').trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(routeName)) {
    console.error('Invalid route name. Only letters, numbers, dashes, and underscores are allowed.');
    process.exit(1);
  }

  const routesDir = join(process.cwd(), 'src', 'routes');
  const routeDir = join(routesDir, routeName);

  if (existsSync(routeDir)) {
    console.error(`Route ${routeName} already exists.`);
    process.exit(1);
  }

  try {
    await mkdir(routeDir);

    // Create route.ts
    const routeTs = `export function ${routeName}Page(context?: any) {
    const query = context?.query || {};
    const name = query.name || 'Guest';
    const theme = query.theme || 'light';
    
    return \`
    <div class="container \${theme}-theme">
        <h1>${routeName.charAt(0).toUpperCase() + routeName.slice(1)}</h1>
        <p>Hello, \${name}!</p>
        <p>Current theme: \${theme}</p>
        
        <div class="query-demo">
            <h3>Query Parameters Demo</h3>
            <p>Try these URLs:</p>
            <ul>
                <li><a href="/${routeName}?name=Alice">/?name=Alice</a></li>
                <li><a href="/${routeName}?theme=dark">/?theme=dark</a></li>
                <li><a href="/${routeName}?name=Bob&theme=dark">/?name=Bob&theme=dark</a></li>
            </ul>
        </div>
    </div>
    \`;
}

export function header(context?: any) {
    const query = context?.query || {};
    const theme = query.theme || 'light';
    
    return \`
    <header class="page-header \${theme}-theme">
        <nav>
            <a href="/">Home</a>
            <a href="/${routeName}">${routeName.charAt(0).toUpperCase() + routeName.slice(1)}</a>
        </nav>
        <div class="theme-indicator">
            Theme: \${theme}
        </div>
    </header>
    \`;
}

export function footer() {
    return \`
    <footer class="page-footer">
        <p>&copy; 2024 Zyte SSR Framework</p>
    </footer>
    \`;
}

export function sidebar(context?: any) {
    const query = context?.query || {};
    const name = query.name || 'Guest';
    
    return \`
    <aside class="sidebar">
        <h3>User Info</h3>
        <p>Welcome, \${name}!</p>
        
        <h3>Query Parameters</h3>
        <ul>
            <li>Name: \${query.name || 'Not set'}</li>
            <li>Theme: \${query.theme || 'light'}</li>
            <li>Page: \${query.page || '1'}</li>
        </ul>
        
        <h3>Related Links</h3>
        <ul>
            <li><a href="/">Home</a></li>
            <li><a href="/${routeName}">${routeName.charAt(0).toUpperCase() + routeName.slice(1)}</a></li>
        </ul>
    </aside>
    \`;
}

export function getTitle(context?: any) {
    const query = context?.query || {};
    const name = query.name || 'Guest';
    return \`${routeName.charAt(0).toUpperCase() + routeName.slice(1)} - Welcome \${name}\`;
}`;

    await writeFile(join(routeDir, `${routeName}.ts`), routeTs);

    // Create route.html
    const routeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ getTitle() }}</title>
</head>
<body>
    {{ header() }}
    
    <main class="main-content">
        {{ ${routeName}Page() }}
        
        <!-- Direct query parameter access in templates -->
        <div class="query-info">
            <h3>Current Query Parameters:</h3>
            <p>Name: {{ query.name || 'Not set' }}</p>
            <p>Theme: {{ query.theme || 'light' }}</p>
            <p>Page: {{ query.page || '1' }}</p>
        </div>
    </main>
    
    {{ sidebar() }}
    
    {{ footer() }}
</body>
</html>`;

    await writeFile(join(routeDir, `${routeName}.html`), routeHtml);

    // Create route.css
    const routeCss = `body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f3f4f6;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.page-header {
    background: #2563eb;
    color: white;
    padding: 1rem 2rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.page-header.dark-theme {
    background: #1f2937;
}

.page-header nav {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    gap: 2rem;
    align-items: center;
    justify-content: space-between;
}

.page-header a {
    color: white;
    text-decoration: none;
    font-weight: 500;
}

.page-header a:hover {
    text-decoration: underline;
}

.theme-indicator {
    font-size: 0.9rem;
    opacity: 0.8;
}

.main-content {
    flex: 1;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 250px;
    gap: 2rem;
}

.container {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    text-align: center;
}

.container.dark-theme {
    background: #1f2937;
    color: white;
}

.query-demo {
    margin-top: 2rem;
    padding: 1rem;
    background: #f8fafc;
    border-radius: 6px;
    text-align: left;
}

.container.dark-theme .query-demo {
    background: #374151;
}

.query-demo h3 {
    margin-top: 0;
    color: #2563eb;
}

.query-demo ul {
    list-style: none;
    padding: 0;
}

.query-demo li {
    margin: 0.5rem 0;
}

.query-demo a {
    color: #2563eb;
    text-decoration: none;
    padding: 0.5rem;
    border-radius: 4px;
    display: inline-block;
    transition: background-color 0.2s;
}

.query-demo a:hover {
    background-color: #e5e7eb;
}

.query-info {
    background: #f0f9ff;
    padding: 1rem;
    border-radius: 6px;
    margin-top: 1rem;
    text-align: left;
}

.container.dark-theme .query-info {
    background: #1e3a8a;
}

.query-info h3 {
    margin-top: 0;
    color: #2563eb;
}

.sidebar {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    height: fit-content;
}

.sidebar h3 {
    margin-top: 0;
    color: #2563eb;
    border-bottom: 2px solid #e5e7eb;
    padding-bottom: 0.5rem;
}

.sidebar ul {
    list-style: none;
    padding: 0;
    margin: 0;
}

.sidebar li {
    margin: 0.5rem 0;
}

.sidebar a {
    color: #374151;
    text-decoration: none;
    display: block;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background-color 0.2s;
}

.sidebar a:hover {
    background-color: #f3f4f6;
    color: #2563eb;
}

.page-footer {
    background: #1f2937;
    color: white;
    text-align: center;
    padding: 1rem;
    margin-top: auto;
}

h1 {
    color: #2563eb;
    margin-bottom: 1rem;
}

p {
    color: #6b7280;
    font-size: 1.1rem;
}

.container.dark-theme h1,
.container.dark-theme p {
    color: white;
}
`;

    await writeFile(join(routeDir, `${routeName}.css`), routeCss);

    console.log(`✅ Created new route: ${routeName}`);
    console.log(`📁 Route files created in: src/routes/${routeName}/`);
  } catch (error) {
    console.error('Failed to create route:', error);
    process.exit(1);
  }
}

async function startDevServer() {
  console.log('Starting development server...');
  try {
    // Start the build watcher in-process
    const srcDir = join(process.cwd(), 'src');
    let building = false;
    let pending = false;
    async function triggerBuild() {
      if (building) {
        pending = true;
        return;
      }
      building = true;
      try {
        await buildProject();
        console.log('✅ Build complete. Watching for changes...');
      } catch (e) {
        console.error('❌ Build failed:', e);
      } finally {
        building = false;
        if (pending) {
          pending = false;
          triggerBuild();
        }
      }
    }
    await triggerBuild();
    (async () => {
      const watcher = watch(srcDir, { recursive: true });
      for await (const event of watcher) {
        if (event.eventType === 'change' || event.eventType === 'rename') {
          triggerBuild();
        }
      }
    })();
    // Directly import and call startServer from the framework
    const { startServer } = await import('zyte/server');
    startServer();
  } catch (error) {
    console.error('Failed to start development server:', error);
    process.exit(1);
  }
}

async function copyAndCompileFiles(srcDir: string, destDir: string) {
  const files = await readdir(srcDir);
  for (const file of files) {
    const srcPath = join(srcDir, file);
    const destPath = join(destDir, file);
    const stats = await stat(srcPath);
    if (stats.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
        await mkdir(destPath, { recursive: true });
        await copyAndCompileFiles(srcPath, destPath);
      }
    } else if (file.endsWith('.ts')) {
      await copyFile(srcPath, destPath.replace('.ts', '.js'));
    } else if (file !== 'package.json' && file !== 'tsconfig.json') {
      await copyFile(srcPath, destPath);
    }
  }
}

async function copyDirectory(src: string, dest: string) {
  await mkdir(dest, { recursive: true });
  const files = await readdir(src);
  for (const file of files) {
    const srcPath = join(src, file);
    const destPath = join(dest, file);
    const stats = await stat(srcPath);
    if (stats.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function findClientFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  const files = await readdir(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      results = results.concat(await findClientFiles(fullPath));
    } else if (file.endsWith('.client.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function bundleClientFiles() {
  const clientFiles = await findClientFiles(join(process.cwd(), 'src'));
  const outDir = join(process.cwd(), 'dist', 'client');
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }
  for (const file of clientFiles) {
    const outFile = join(outDir, file.replace(/^.*src[\\\/]/, '').replace(/\.ts$/, '.js'));
    await esbuildBuild({
      entryPoints: [file],
      bundle: true,
      format: 'iife',
      platform: 'browser',
      outfile: outFile,
      minify: true,
      sourcemap: false,
      target: ['es2017'],
    });
    console.log(`Bundled client: ${file} -> ${outFile}`);
  }
}

async function bundleSingleClientFile(file: string) {
  const outDir = join(process.cwd(), 'dist', 'client');
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }
  const outFile = join(outDir, file.replace(/^.*src[\\\/]/, '').replace(/\.ts$/, '.js'));
  await esbuildBuild({
    entryPoints: [file],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    outfile: outFile,
    minify: true,
    sourcemap: false,
    target: ['es2017'],
  });
  console.log(`Re-bundled client: ${file} -> ${outFile}`);
}

async function buildProject() {
  const distDir = join(process.cwd(), 'dist');
  try {
    if (!existsSync(distDir)) {
      await mkdir(distDir);
    }
    await copyAndCompileFiles(process.cwd(), distDir);
    await bundleClientFiles();
    // Create a minimal server entry point for the example project
    const serverEntry =
      "import { startServer } from 'zyte/server';\n" +
      "await startServer();\n";
    await writeFile(join(distDir, 'server.js'), serverEntry);
    const routesDir = join(process.cwd(), 'routes');
    if (existsSync(routesDir)) {
      await copyDirectory(routesDir, join(distDir, 'routes'));
    }
    console.log('✅ Build completed successfully!');
    console.log('📁 Output directory: dist/');
    console.log('🚀 Start production server: bun run dist/server.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}