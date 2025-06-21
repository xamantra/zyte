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
      let processedHtml = await this.processTemplate(html, component, context);
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
    let processedHtml = await this.processTemplate(html, component, context);
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
      const module = await import(componentPath + `?t=${Date.now()}`);
      return module;
    }
    throw new Error(`Unsupported component type: ${extname(componentPath)}`);
  }

  private async processTemplate(html: string, component: any, context: SSRContext): Promise<string> {
    // Enhanced template processing - support multiple exports and more flexible expressions
    // Supports: {{ functionName() }}, {{ functionName('arg') }}, {{ functionName(arg1, arg2) }}
    // Also supports: {{ query.paramName }}, {{ params.paramName }}, {{ headers.headerName }}
    const regex = /\{\{\s*([^}]+)\s*\}\}/g;
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    
    while ((match = regex.exec(html)) !== null) {
      result += html.slice(lastIndex, match.index);
      const expression = match[1].trim();
      
      try {
        // Handle function calls with or without arguments
        const funcMatch = expression.match(/^(\w+)\s*\(([^)]*)\)$/);
        if (funcMatch) {
          const [, funcName, argsStr] = funcMatch;
          const func = component[funcName];
          
          if (typeof func === 'function') {
            // Parse arguments - support strings, numbers, and simple expressions
            const args = argsStr ? this.parseTemplateArgs(argsStr, context) : [];
            // Pass context as the last argument to functions
            const value = await func(...args, context);
            result += (value ?? ''); // Coalesce null/undefined to empty string
          } else {
            console.warn(`Function ${funcName} not found in component`);
            result += match[0];
          }
        } else {
          // Handle simple property access or expressions
          const value = this.evaluateExpression(expression, component, context);
          result += (value ?? ''); // Coalesce null/undefined to empty string
        }
      } catch (error) {
        console.error(`Error processing template expression ${expression}:`, error);
        result += match[0];
      }
      lastIndex = regex.lastIndex;
    }
    result += html.slice(lastIndex);
    return result;
  }

  private parseTemplateArgs(argsStr: string, context: SSRContext): any[] {
    if (!argsStr.trim()) return [];
    
    return argsStr.split(',').map(arg => {
      arg = arg.trim();
      
      // Handle string literals
      if ((arg.startsWith('"') && arg.endsWith('"')) || 
          (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
      }
      
      // Handle numbers
      if (!isNaN(Number(arg))) {
        return Number(arg);
      }
      
      // Handle booleans
      if (arg === 'true') return true;
      if (arg === 'false') return false;
      
      // Handle null/undefined
      if (arg === 'null') return null;
      if (arg === 'undefined') return undefined;
      
      // Handle context access (query, params, headers)
      if (arg.startsWith('query.') || arg.startsWith('params.') || arg.startsWith('headers.')) {
        return this.evaluateExpression(arg, {}, context);
      }
      
      // Return as string if no other type matches
      return arg;
    });
  }

  private evaluateExpression(expression: string, component: any, context: SSRContext): any {
    // Handle logical OR expressions (e.g., query.q || 'default')
    if (expression.includes('||')) {
      const parts = expression.split('||').map(part => part.trim());
      for (const part of parts) {
        const value = this.evaluateSingleExpression(part, component, context);
        if (value) { // Use JavaScript-like truthiness
          return value;
        }
      }
      // If all parts are falsy, return the evaluated value of the last part.
      return this.evaluateSingleExpression(parts[parts.length - 1], component, context);
    }
    
    return this.evaluateSingleExpression(expression, component, context);
  }

  private evaluateSingleExpression(expression: string, component: any, context: SSRContext): any {
    // Handle context access first (query, params, headers)
    if (expression.startsWith('query.')) {
      const key = expression.slice(6); // Remove 'query.'
      return context.query[key];
    }
    
    if (expression.startsWith('params.')) {
      const key = expression.slice(7); // Remove 'params.'
      return context.params[key];
    }
    
    if (expression.startsWith('headers.')) {
      const key = expression.slice(8); // Remove 'headers.'
      return context.headers[key];
    }
    
    // Handle string literals
    if ((expression.startsWith('"') && expression.endsWith('"')) || 
        (expression.startsWith("'") && expression.endsWith("'"))) {
      return expression.slice(1, -1);
    }
    
    // Handle numbers
    if (!isNaN(Number(expression))) {
      return Number(expression);
    }
    
    // Handle booleans
    if (expression === 'true') return true;
    if (expression === 'false') return false;
    
    // Handle null/undefined
    if (expression === 'null') return null;
    if (expression === 'undefined') return undefined;
    
    // Handle simple property access from component
    if (component[expression] !== undefined) {
      return component[expression];
    }
    
    // Handle nested property access (e.g., data.title) from component
    const parts = expression.split('.');
    let value = component;
    for (const part of parts) {
      if (value && typeof value === 'object' && value[part] !== undefined) {
        value = value[part];
      } else {
        return undefined; // Not found
      }
    }
    return value;
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