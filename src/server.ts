import { createSSR, SSRContext } from './index';
import { extname, join } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';

const ssrCache = new Map<string, { content: string; timestamp: number }>();

export interface ServerOptions {
  port?: number;
  onStart?: (server: { port: number; host: string; url: string }) => void | Promise<void>;
  cacheMaxAge?: number; // in milliseconds
  cacheEnabled?: boolean;
  sitemap?: {
    enabled?: boolean; // Default: true
    baseUrl?: string; // Auto-detected if not provided
    excludePaths?: string[]; // Paths to exclude from sitemap
    customUrls?: Array<{
      url: string;
      lastmod?: string;
      changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
      priority?: number; // 0.0 to 1.0
    }>;
    defaultChangefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    defaultPriority?: number; // 0.0 to 1.0
  };
  robots?: {
    enabled?: boolean; // Default: true
    baseUrl?: string; // Auto-detected if not provided
    userAgents?: Array<{
      name: string; // '*' for all robots, or specific bot name
      allow?: string[]; // Paths to allow
      disallow?: string[]; // Paths to disallow
      crawlDelay?: number; // Crawl delay in seconds
    }>;
    sitemap?: boolean; // Include sitemap reference (default: true)
    customRules?: string[]; // Custom robots.txt rules
  };
}

function injectClientScript(path: string, html: string): string {
  let clientScriptPath = null;
  const routeParts = path.split('/').filter(Boolean);
  if (routeParts.length === 0 || path === '/app' || path === '/app/') {
    // Home/app page
    if (existsSync(join(process.cwd(), 'dist', 'client', 'app', 'app.client.js'))) {
      clientScriptPath = '/client/app/app.client.js';
    }
  } else {
    // For /routes/xyz or /xyz, look for /client/routes/xyz/xyz.client.js
    // Support nested routes: /foo/bar -> /client/routes/foo/bar/bar.client.js
    let routePath = routeParts.join('/');
    let routeName = routeParts[routeParts.length - 1];
    let candidate = join(process.cwd(), 'dist', 'client', 'routes', ...routeParts, `${routeName}.client.js`);
    if (existsSync(candidate)) {
      clientScriptPath = `/client/routes/${routePath}/${routeName}.client.js`;
    }
  }
  if (clientScriptPath) {
    return html.replace('</body>', `<script src="${clientScriptPath}"></script>\n</body>`);
  }
  return html;
}

function injectLazyLoading(html: string): string {
  // Add loading="lazy" to all <img> tags that don't already have a loading attribute.
  // This is a simple, non-breaking performance enhancement.
  return html.replace(/<img(?![^>]*loading=)/gi, '<img loading="lazy" ');
}

export async function startServer(options: ServerOptions = {}) {
  // Try to load server configuration from project root or src directory
  let projectConfig: ServerOptions = {};
  const rootConfigPath = join(process.cwd(), 'server.config.ts');
  const srcConfigPath = join(process.cwd(), 'src', 'server.config.ts');

  let configPath: string | null = null;
  if (existsSync(rootConfigPath)) {
    configPath = rootConfigPath;
  } else if (existsSync(srcConfigPath)) {
    configPath = srcConfigPath;
  }

  if (configPath) {
    try {
      const configModule = await import(configPath);
      projectConfig = configModule.default || configModule;
    } catch (error) {
      console.warn(`Failed to load server config from ${configPath}:`, error);
    }
  }

  // Merge project config with passed options (passed options take precedence)
  const finalOptions: ServerOptions = {
    ...projectConfig,
    ...options
  };

  const ssr = createSSR({ baseDir: process.cwd() });
  const port = finalOptions.port ?? (process.env.PORT ? parseInt(process.env.PORT) : 3000);

  // --- Cache Warming ---
  const CACHE_ENABLED_FOR_WARMING = finalOptions.cacheEnabled ?? true;
  if (CACHE_ENABLED_FOR_WARMING) {
    console.log('🔥 Warming up the cache...');
    const routesToCache = ssr.getRoutesMap();
    // Add the root route if it's not already in the list from discovery
    if (!routesToCache.has('/')) {
      routesToCache.set('/', { path: '/', component: 'src/app/app.ts' });
    }

    for (const path of routesToCache.keys()) {
      try {
        const context: SSRContext = { params: {}, query: {}, headers: {} };
        let html = await ssr.render(path, context);
        html = injectClientScript(path, html);
        html = injectLazyLoading(html);
        ssrCache.set(path, { content: html, timestamp: Date.now() });
        console.log(`  - Cached: ${path}`);
      } catch (error) {
        // Suppress benign errors for routes that can't be pre-rendered (e.g. require context)
        // A more robust solution would check if a route is static.
      }
    }
    console.log('✅ Cache warmed up.');
  }

  async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Magic keep-alive route for free cloud services
    if (path === '/__zyte_keepalive' || path === '/__zyte_keepalive/') {
      return new Response(JSON.stringify({
        status: 'alive',
        timestamp: new Date().toISOString(),
        framework: 'zyte',
        version: process.env.npm_package_version
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
    }

    // Dynamic sitemap.xml generation
    if (path === '/sitemap.xml') {
      const sitemapConfig = finalOptions.sitemap || {};
      const sitemapEnabled = sitemapConfig.enabled !== false; // Default to true
      
      if (!sitemapEnabled) {
        return new Response('Sitemap disabled', { status: 404 });
      }
      
      const baseUrl = sitemapConfig.baseUrl || `${url.protocol}//${url.host}`;
      const routes = ssr.getRoutesMap();
      const currentDate = new Date().toISOString();
      const excludePaths = sitemapConfig.excludePaths || [];
      const defaultChangefreq = sitemapConfig.defaultChangefreq || 'weekly';
      const defaultPriority = sitemapConfig.defaultPriority || 0.8;
      
      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
      
      // Add custom URLs first
      if (sitemapConfig.customUrls) {
        for (const customUrl of sitemapConfig.customUrls) {
          sitemap += `
  <url>
    <loc>${customUrl.url.startsWith('http') ? customUrl.url : `${baseUrl}${customUrl.url.startsWith('/') ? '' : '/'}${customUrl.url}`}</loc>
    <lastmod>${customUrl.lastmod || currentDate}</lastmod>
    <changefreq>${customUrl.changefreq || defaultChangefreq}</changefreq>
    <priority>${customUrl.priority || defaultPriority}</priority>
  </url>`;
        }
      }
      
      // Add root URL
      sitemap += `
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`;
      
      // Add all discovered routes (excluding specified paths)
      for (const [routePath, routeConfig] of routes) {
        if (excludePaths.includes(routePath)) continue;
        
        sitemap += `
  <url>
    <loc>${baseUrl}/${routePath}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${defaultChangefreq}</changefreq>
    <priority>${defaultPriority}</priority>
  </url>`;
      }
      
      sitemap += `
</urlset>`;
      
      return new Response(sitemap, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    }

    // Dynamic robots.txt generation
    if (path === '/robots.txt') {
      const robotsConfig = finalOptions.robots || {};
      const robotsEnabled = robotsConfig.enabled !== false; // Default to true
      
      if (!robotsEnabled) {
        return new Response('Robots.txt disabled', { status: 404 });
      }
      
      const baseUrl = robotsConfig.baseUrl || `${url.protocol}//${url.host}`;
      const includeSitemap = robotsConfig.sitemap !== false; // Default to true
      
      let robots = '';
      
      // Add custom rules first
      if (robotsConfig.customRules) {
        robots += robotsConfig.customRules.join('\n') + '\n\n';
      }
      
      // Add user agent rules
      if (robotsConfig.userAgents && robotsConfig.userAgents.length > 0) {
        for (const userAgent of robotsConfig.userAgents) {
          robots += `User-agent: ${userAgent.name}\n`;
          
          if (userAgent.allow && userAgent.allow.length > 0) {
            for (const path of userAgent.allow) {
              robots += `Allow: ${path}\n`;
            }
          }
          
          if (userAgent.disallow && userAgent.disallow.length > 0) {
            for (const path of userAgent.disallow) {
              robots += `Disallow: ${path}\n`;
            }
          }
          
          if (userAgent.crawlDelay) {
            robots += `Crawl-delay: ${userAgent.crawlDelay}\n`;
          }
          
          robots += '\n';
        }
      } else {
        // Default robots.txt content
        robots += `User-agent: *\n`;
        robots += `Allow: /\n`;
        robots += `Disallow: /admin/\n`;
        robots += `Disallow: /private/\n`;
        robots += `Disallow: /__zyte_keepalive\n`;
        robots += `\n`;
      }
      
      // Add sitemap reference
      if (includeSitemap) {
        robots += `Sitemap: ${baseUrl}/sitemap.xml\n`;
      }
      
      return new Response(robots, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    }

    // Serve static files from dist/client, src/app, and src/routes
    if (!/\.(ts|html)$/.test(path)) {
      // Try dist/client first
      let filePath = join(process.cwd(), 'dist', path);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        // Try src/app
        filePath = join(process.cwd(), 'src', 'app', path.split('/').pop()!);
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          // Try src/routes/<...> for /routes/...
          const parts = path.split('/');
          if (parts[1] === 'routes' && parts.length > 2) {
            filePath = join(process.cwd(), 'src', ...parts.slice(1));
          }
        }
      }
      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath);
        const contentType =
          ext === '.css' ? 'text/css'
            : ext === '.js' ? 'application/javascript'
              : ext === '.png' ? 'image/png'
                : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
                  : ext === '.gif' ? 'image/gif'
                    : ext === '.svg' ? 'image/svg+xml'
                      : ext === '.ico' ? 'image/x-icon'
                        : ext === '.txt' ? 'text/plain'
                          : ext === '.xml' ? 'application/xml'
                            : ext === '.json' ? 'application/json'
                              : ext === '.webp' ? 'image/webp'
                                : ext === '.woff' ? 'font/woff'
                                  : ext === '.woff2' ? 'font/woff2'
                                    : ext === '.ttf' ? 'font/ttf'
                                      : ext === '.eot' ? 'application/vnd.ms-fontobject'
                                        : ext === '.pdf' ? 'application/pdf'
                                          : ext === '.zip' ? 'application/zip'
                                            : ext === '.mp4' ? 'video/mp4'
                                              : ext === '.webm' ? 'video/webm'
                                                : ext === '.mp3' ? 'audio/mpeg'
                                                  : ext === '.wav' ? 'audio/wav'
                                                    : 'application/octet-stream';
        return new Response(readFileSync(filePath), {
          headers: { 'Content-Type': contentType }
        });
      }
    }

    // --- Caching Layer ---
    const CACHE_ENABLED = finalOptions.cacheEnabled ?? true; // Default to true
    if (CACHE_ENABLED) {
      const CACHE_MAX_AGE_MS = finalOptions.cacheMaxAge ?? 5 * 60000; // 5 minutes default
      // Only cache GET requests with no query parameters.
      if (request.method === 'GET' && url.search === '') {
        const cached = ssrCache.get(path);
        if (cached) {
          const isStale = Date.now() - cached.timestamp > CACHE_MAX_AGE_MS;
          if (!isStale) {
            return new Response(cached.content, {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          } else {
            // Clean up stale entry
            ssrCache.delete(path);
          }
        }
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

      // Determine possible client bundle path dynamically
      html = injectClientScript(path, html);
      html = injectLazyLoading(html);

      // --- Cache Population ---
      if (CACHE_ENABLED) {
        // If the request was cacheable, store the final HTML in the cache.
        if (request.method === 'GET' && url.search === '') {
          ssrCache.set(path, { content: html, timestamp: Date.now() });
        }
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
      const response = await handler(request);

      if (response.headers.has('Content-Encoding') || !response.body) {
        return response;
      }

      const acceptEncoding = request.headers.get('accept-encoding') || '';
      if (acceptEncoding.includes('gzip')) {
        const body = await response.arrayBuffer();
        if (body.byteLength === 0) {
          return response;
        }
        const compressed = Bun.gzipSync(body);
        const headers = new Headers(response.headers);
        headers.set('Content-Encoding', 'gzip');
        return new Response(compressed, {
          status: response.status,
          headers: headers
        });
      }

      return response;
    },
    error(error: Error) {
      console.error('Server error:', error);
      return new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  });

  const host = server.hostname || '0.0.0.0';
  const url = `http://${host}:${port}`;

  // Call the onStart callback if provided
  if (finalOptions.onStart) {
    try {
      await finalOptions.onStart({ port, host, url });
    } catch (error) {
      console.error('Error in onStart callback:', error);
    }
  } else {
    // Default server start message if no onStart is configured
    console.log(`🚀 Zyte SSR server running on Bun at ${url}`);
  }
} 