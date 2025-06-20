import { createSSR, SSRContext } from './index';
import { extname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { AddressInfo } from 'net';

export async function startServer(options: { port?: number } = {}) {
  const ssr = createSSR({ baseDir: process.cwd() });
  const port = options.port ?? (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Serve static files from dist/client, src/app, and src/routes
    if (/\.(css|js|png|jpg|jpeg|gif|svg)$/.test(path)) {
      // Try dist/client first
      let filePath = join(process.cwd(), 'dist', path);
      if (!existsSync(filePath)) {
        // Try src/app
        filePath = join(process.cwd(), 'src', 'app', path.split('/').pop()!);
        if (!existsSync(filePath)) {
          // Try src/routes/<...> for /routes/...
          const parts = path.split('/');
          if (parts[1] === 'routes' && parts.length > 2) {
            filePath = join(process.cwd(), 'src', ...parts.slice(1));
          }
        }
      }
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        const contentType =
          ext === '.css' ? 'text/css'
          : ext === '.js' ? 'application/javascript'
          : ext === '.png' ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
          : ext === '.gif' ? 'image/gif'
          : ext === '.svg' ? 'image/svg+xml'
          : 'application/octet-stream';
        return new Response(readFileSync(filePath), {
          headers: { 'Content-Type': contentType }
        });
      }
    }

    try {
      // Parse query parameters
      const query: Record<string, string> = {};
      url.searchParams.forEach((value, key) => {
        query[key] = value;
      });

      // Create context
      const context: SSRContext = {
        params: {},
        query,
        headers: Object.fromEntries(request.headers.entries())
      };

      // Render the page
      let html = await ssr.render(path, context);

      // Determine possible client bundle path
      let clientScriptPath = null;
      if (path === '/' || path === '/app' || path === '/app/') {
        // Main app page
        if (existsSync(join(process.cwd(), 'dist', 'client', 'app', 'app.client.js'))) {
          clientScriptPath = '/client/app/app.client.js';
        }
      } else {
        // Try to match /routes/<route>
        const parts = path.split('/').filter(Boolean);
        if (parts[0] === 'counter' && existsSync(join(process.cwd(), 'dist', 'client', 'routes', 'counter', 'counter.client.js'))) {
          clientScriptPath = '/client/routes/counter/counter.client.js';
        }
        // Add more route checks here as needed
      }
      if (clientScriptPath) {
        html = html.replace('</body>', `<script src="${clientScriptPath}"></script>\n</body>`);
      }

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    } catch (error) {
      console.error('Error rendering page:', error);
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Error - Zyte SSR</title>
        </head>
        <body>
          <h1>500 - Internal Server Error</h1>
          <p>An error occurred while rendering the page.</p>
          <pre>${error instanceof Error ? error.message : String(error)}</pre>
        </body>
        </html>
      `, {
        status: 500,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }
  }

  // --- Bun ---
  // @ts-ignore
  const server = Bun.serve({
    port,
    async fetch(request: Request) {
      return handler(request);
    }
  });
  const host = server.hostname || '0.0.0.0';
  console.log(`🚀 Zyte SSR server running on Bun at http://${host}:${port}`);
} 