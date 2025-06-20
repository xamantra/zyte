import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { readdirSync, statSync } from 'fs';
import { relative } from 'path';

export interface RouteConfig {
  path: string;
  component: string;
  layout?: string;
}

export interface SSRContext {
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
}

export interface ZyteSSROptions {
  baseDir?: string;
  routesDir?: string;
}

export class ZyteSSR {
  private routes: Map<string, RouteConfig> = new Map();
  private baseDir: string;
  private routesDir: string;

  constructor(options: ZyteSSROptions = {}) {
    this.baseDir = options.baseDir || process.cwd();
    this.routesDir = options.routesDir || 'src/routes';
    this.discoverRoutes();
  }

  private discoverRoutes() {
    const routesDir = join(this.baseDir, this.routesDir);
    if (!existsSync(routesDir)) return;

    this.scanRoutesDirectory(routesDir, '');
  }

  private scanRoutesDirectory(dir: string, prefix: string) {
    try {
      const items = readdirSync(dir);
      
      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Check if this directory contains route files
          const routeFiles = readdirSync(fullPath).filter(file => 
            (file.endsWith('.ts') || file.endsWith('.js')) && !file.endsWith('.client.ts')
          );
          
          if (routeFiles.length > 0) {
            const routeName = routeFiles[0].replace(extname(routeFiles[0]), '');
            const routePath = prefix ? `${prefix}/${item}` : item;
            
            this.routes.set(routePath, {
              path: routePath,
              component: join(relative(this.baseDir, fullPath), routeFiles[0])
            });
          }
          
          // Recursively scan subdirectories
          this.scanRoutesDirectory(fullPath, prefix ? `${prefix}/${item}` : item);
        }
      }
    } catch (error) {
      console.error('Error scanning routes directory:', error);
    }
  }

  public async render(path: string, context: SSRContext = { params: {}, query: {}, headers: {} }): Promise<string> {
    // Special case: root path loads app component
    if (path === '/' || path === '') {
      const appComponentPath = join(this.baseDir, 'src', 'app', 'app.ts');
      const appHtmlPath = join(this.baseDir, 'src', 'app', 'app.html');
      if (!existsSync(appHtmlPath)) {
        throw new Error(`HTML template not found for app component: src/app/app.html`);
      }
      let html = readFileSync(appHtmlPath, 'utf-8');
      // Inject CSS if exists
      const appCssPath = join(this.baseDir, 'src', 'app', 'app.css');
      if (existsSync(appCssPath)) {
        html = html.replace('</head>', `<link rel="stylesheet" href="/app/app.css">
</head>`);
      }
      const component = await this.loadComponent(appComponentPath);
      let processedHtml = this.processTemplate(html, component, context);
      if (context.headers['accept']?.includes('text/html')) {
        processedHtml = this.addInteractivityScript(processedHtml, { path: '/', component: 'src/app/app.ts' });
      }
      return processedHtml;
    }

    // Normal route logic
    const route = this.findRoute(path);
    if (!route) {
      return this.render404();
    }

    const componentPath = join(this.baseDir, route.component);
    let htmlPath: string;
    if (extname(componentPath)) {
      htmlPath = componentPath.replace(extname(componentPath), '.html');
    } else {
      htmlPath = componentPath + '.html';
    }
    if (!existsSync(htmlPath)) {
      throw new Error(`HTML template not found for route: ${route.component}`);
    }

    let html = readFileSync(htmlPath, 'utf-8');
    // Inject CSS if exists
    const cssPath = htmlPath.replace(/\.html$/, '.css');
    if (existsSync(cssPath)) {
      // Compute public URL for CSS
      const relCss = relative(join(this.baseDir, 'src'), cssPath).replace(/\\/g, '/');
      html = html.replace('</head>', `<link rel="stylesheet" href="/${relCss}">
</head>`);
    }
    const component = await this.loadComponent(componentPath);
    let processedHtml = this.processTemplate(html, component, context);
    if (context.headers['accept']?.includes('text/html')) {
      processedHtml = this.addInteractivityScript(processedHtml, route);
    }
    return processedHtml;
  }

  private findRoute(path: string): RouteConfig | null {
    // Remove leading slash and normalize path
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    
    // Direct match
    if (this.routes.has(normalizedPath)) {
      return this.routes.get(normalizedPath) || null;
    }
    
    // Handle root path
    if (normalizedPath === '' || normalizedPath === 'index') {
      return this.routes.get('home') || this.routes.get('index') || null;
    }
    
    return null;
  }

  private async loadComponent(componentPath: string): Promise<any> {
    if (extname(componentPath) === '.ts' || extname(componentPath) === '.js') {
      const module = await import(componentPath);
      return module;
    }
    throw new Error(`Unsupported component type: ${extname(componentPath)}`);
  }

  private processTemplate(html: string, component: any, context: SSRContext): string {
    // Simple template processing - replace {{ functionName() }} with actual function calls
    return html.replace(/\{\{\s*(\w+\([^)]*\))\s*\}\}/g, (match, functionCall) => {
      try {
        // Extract function name and arguments
        const funcMatch = functionCall.match(/(\w+)\(([^)]*)\)/);
        if (!funcMatch) return match;

        const [, funcName, argsStr] = funcMatch;
        const func = component[funcName];
        
        if (typeof func === 'function') {
          // Parse arguments if any
          const args = argsStr ? argsStr.split(',').map((arg: string) => arg.trim().replace(/['"]/g, '')) : [];
          return func(...args);
        }
        
        return match;
      } catch (error) {
        console.error(`Error processing template function ${functionCall}:`, error);
        return match;
      }
    });
  }

  private addInteractivityScript(html: string, route: RouteConfig): string {
    const script = `
    <script>
      // Zyte SSR Interactivity Script
      (function() {
        // Handle client-side navigation
        document.addEventListener('click', function(e) {
          const link = e.target.closest('a');
          if (link && link.href && link.href.startsWith(window.location.origin)) {
            e.preventDefault();
            navigateTo(link.href);
          }
        });

        // Handle browser back/forward
        window.addEventListener('popstate', function() {
          navigateTo(window.location.href, false);
        });

        async function navigateTo(url, pushState = true) {
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'text/html',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });
            
            if (response.ok) {
              const html = await response.text();
              
              // Update the page content
              const parser = new DOMParser();
              const newDoc = parser.parseFromString(html, 'text/html');
              const newContent = newDoc.querySelector('body');
              
              if (newContent) {
                document.body.innerHTML = newContent.innerHTML;
                
                // Update title
                const newTitle = newDoc.querySelector('title');
                if (newTitle) {
                  document.title = newTitle.textContent;
                }
                
                // Update URL
                if (pushState) {
                  window.history.pushState({}, '', url);
                }
              }
            }
          } catch (error) {
            console.error('Navigation error:', error);
          }
        }

        // Expose navigation function globally
        window.zyteNavigate = navigateTo;
      })();
    </script>`;

    // Insert script before closing body tag
    return html.replace('</body>', `${script}\n</body>`);
  }

  private render404(): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>404 - Page Not Found</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 2rem; text-align: center; }
          h1 { color: #dc2626; }
        </style>
    </head>
    <body>
        <h1>404 - Page Not Found</h1>
        <p>The requested page could not be found.</p>
        <a href="/">Go back home</a>
    </body>
    </html>
    `;
  }

  public getRoutes(): RouteConfig[] {
    return Array.from(this.routes.values());
  }
}

// Export convenience functions
export function createSSR(options?: ZyteSSROptions): ZyteSSR {
  return new ZyteSSR(options);
}

export function render(path: string, context?: SSRContext): Promise<string> {
  const ssr = new ZyteSSR();
  return ssr.render(path, context);
} 