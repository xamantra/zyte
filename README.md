# Zyte SSR

**Zero-dependency, TypeScript-first SSR framework for Bun.**

[![codecov](https://codecov.io/gh/xamantra/zyte/branch/master/graph/badge.svg?token=X9RLWLHK1B)](https://codecov.io/gh/xamantra/zyte)
[![bun](https://img.shields.io/badge/Bun-powered-blue?logo=bun&logoColor=white)](https://bun.sh)

Zyte SSR is a simple, fast, and modern server-side rendering framework for Bun. It lets you build TypeScript-based SSR apps with seamless client-side interactivity—no config, no boilerplate, just code.

---

## Features
- ⚡️ **Fast builds** with Bun and esbuild
- 🟦 **TypeScript-first**: write both server and client code in TS
- 🧩 **Per-component client code**: colocate `.client.ts` files for interactivity
- 🗂 **File-based routing**: routes are just files in `src/routes/`
- 🧩 **Reusable elements**: create custom components with exported functions
- 🚀 **In-memory Caching**: Automatic in-memory caching for routes to accelerate response times, with pre-warming at server startup.
- 🗜️ **Automatic Gzip Compression**: Compresses responses on-the-fly to reduce page load times.
- ✨ **Automatic Image Lazy Loading**: Automatically adds `loading="lazy"` to all `<img>` tags for faster initial page loads.
- 🛠 **Zero config**: no webpack, no babel, no fuss
- 🧹 **No runtime dependencies** (except esbuild for dev/build)

---

## Quick Start

```sh
# Install Bun (if you haven't)
bun install -g bun
# Install Zyte CLI globally
bun install -g zyte

# Create a new Zyte SSR project
zyte new my-app
cd my-app

# Start development server (with auto-rebuild)
bun run dev

# Build for production
bun run build

# Start production server
bun run start
```

---

## Project Structure

### Required Framework Directories

```
my-app/
  src/
    app/                    # REQUIRED - Root route (/)
    │   ├── app.ts         # REQUIRED - Main component
    │   ├── app.html       # REQUIRED - HTML template
    │   ├── app.css        # Optional - App styles
    │   └── app.client.ts  # Optional - Client-side code
    │
    routes/                 # REQUIRED - All other routes
    │   ├── counter/
    │   │   ├── counter.ts         # SSR component for /counter
    │   │   ├── counter.html       # HTML template for /counter
    │   │   ├── counter.css        # Styles for /counter
    │   │   └── counter.client.ts  # Client-side code for /counter
    │   └── about/
    │       ├── about.ts
    │       └── about.html
    │
    components/             # OPTIONAL - Reusable elements (can be anywhere)
    │   ├── Button.ts
    │   ├── Card.ts
    │   └── Layout.ts
    │
    layouts/                # OPTIONAL - Layout components
    │   ├── Header.ts
    │   └── Footer.ts
    │
    utils/                  # OPTIONAL - Utility components
    │   └── helpers.ts
    │
    index.ts                # SSR entrypoint
  │
  dist/                     # Built output (auto-generated)
  package.json
  tsconfig.json
```

**Framework Requirements:**
- **`src/app/`**: Required and hardcoded - handles the root route (`/`)
- **`src/routes/`**: Required but configurable - contains all route components
- **Other directories**: Optional - organize reusable elements as you prefer

---

## Reusable Elements

Zyte SSR supports reusable elements through exported TypeScript functions. You can create custom components and use them across your application.

### Creating Reusable Elements

#### 1. **Shared Components Directory** (Recommended)
```typescript
// src/components/Button.ts
export function Button(text: string, className: string = 'btn') {
  return `<button class="${className}">${text}</button>`;
}

export function PrimaryButton(text: string) {
  return Button(text, 'btn btn-primary');
}

export function SecondaryButton(text: string) {
  return Button(text, 'btn btn-secondary');
}
```

#### 2. **Using Reusable Elements in Routes**
```typescript
// src/routes/home/home.ts
import { PrimaryButton, SecondaryButton } from '../../components/Button';

export function homePage() {
  return `
  <div class="container">
    <h1>Welcome to Our App</h1>
    <div class="actions">
      ${PrimaryButton('Get Started')}
      ${SecondaryButton('Learn More')}
    </div>
  </div>
  `;
}
```

#### 3. **Complex Reusable Elements with Parameters**
```typescript
// src/components/Card.ts
export function Card(title: string, content: string, imageUrl?: string) {
  const imageHtml = imageUrl ? `<img src="${imageUrl}" alt="${title}" class="card-image">` : '';
  
  return `
  <div class="card">
    ${imageHtml}
    <div class="card-content">
      <h3 class="card-title">${title}</h3>
      <p class="card-text">${content}</p>
    </div>
  </div>
  `;
}

export function ProductCard(name: string, price: number, description: string) {
  return Card(name, `${description}<br><strong>$${price}</strong>`);
}

export function BlogCard(title: string, excerpt: string, author: string, date: string) {
  return Card(title, `${excerpt}<br><small>By ${author} on ${date}</small>`);
}
```

#### 4. **Layout Components**
```typescript
// src/layouts/Header.ts
export function Header(title: string, navItems: string[] = []) {
  const navHtml = navItems.map(item => `<a href="/${item.toLowerCase()}">${item}</a>`).join('');
  
  return `
  <header class="site-header">
    <h1>${title}</h1>
    <nav>${navHtml}</nav>
  </header>
  `;
}

// src/layouts/Footer.ts
export function Footer() {
  return `
  <footer class="site-footer">
    <p>&copy; 2024 Your Company. Built with Zyte SSR.</p>
  </footer>
  `;
}
```

### Where to Place Reusable Elements

You can place reusable elements **anywhere** in your project:

- `src/components/` - Recommended for UI components
- `src/layouts/` - For layout components
- `src/utils/` - For utility functions
- `src/shared/` - For shared components
- Inside route directories - For route-specific components
- Any other directory structure you prefer

The framework doesn't enforce any specific directory structure for reusable elements - use standard ES6 imports:

```typescript
import { Button } from './components/Button';
import { Card } from '../shared/Card';
import { Header } from '../../layouts/Header';
```

---

## HTML Syntax Highlighting

For better developer experience, install the **es6-string-html** VS Code extension and add `/*html*/` before template literals:

```typescript
export function AboutPage() {
  return /*html*/`
    <div class="about-page">
      <h1>About Us</h1>
      <p>Welcome to our company!</p>
    </div>
  `;
}
```

---

## Example: Minimal Counter Route

**src/routes/counter/counter.ts**
```ts
import { Button } from '../../components/Button';

export function counterPage() {
  return `
  <div class="container">
    <h1>Counter Example</h1>
    <p>Current count: <span id="count">0</span></p>
    ${Button('Increment', 'btn-primary')}
  </div>
  `;
}

export function header() {
  return `
  <header class="page-header">
    <nav>
      <a href="/">Home</a>
      <a href="/counter">Counter</a>
    </nav>
  </header>
  `;
}
```

**src/routes/counter/counter.html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Counter - Zyte SSR</title>
</head>
<body>
  {{ header() }}
  
  <main class="main-content">
    {{ counterPage() }}
  </main>
</body>
</html>
```

### Multiple Exports & Template Expressions

Zyte SSR supports multiple exports from your TypeScript components and flexible template expressions:

```ts
// src/routes/about/about.ts
export function aboutPage() {
  return `<div>About page content</div>`;
}

export function header() {
  return `<header>Navigation</header>`;
}

export function sidebar() {
  return `<aside>Sidebar content</aside>`;
}

export function getTitle() {
  return "About Us";
}

export const pageData = {
  author: "John Doe",
  date: "2024-01-01"
};
```

```html
<!-- src/routes/about/about.html -->
<!DOCTYPE html>
<html>
<head>
  <title>{{ getTitle() }}</title>
</head>
<body>
  {{ header() }}
  
  <main>
    {{ aboutPage() }}
    <p>By {{ pageData.author }} on {{ pageData.date }}</p>
  </main>
  
  {{ sidebar() }}
</body>
</html>
```

### Template Expression Support

The framework supports various template expressions:

- **Function calls:** `{{ functionName() }}`, `{{ functionName('arg') }}`, `{{ functionName(arg1, arg2) }}`
- **Property access:** `{{ propertyName }}`, `{{ data.title }}`
- **Query parameters:** `{{ query.paramName }}`, `{{ query.search || 'default' }}`
- **Route parameters:** `{{ params.paramName }}`
- **Headers:** `{{ headers.headerName }}`
- **Async functions:** All function calls are awaited

### Query Parameters Support

Zyte SSR provides easy access to query parameters in both templates and components:

```ts
// src/routes/search/search.ts
export function searchPage(context?: any) {
  const query = context?.query || {};
  const q = query.q || '';
  const page = query.page || '1';
  
  return `
  <div class="search-results">
    <h1>Search Results</h1>
    <p>Query: ${q}</p>
    <p>Page: ${page}</p>
  </div>
  `;
}

export function getTitle(context?: any) {
  const query = context?.query || {};
  const q = query.q || 'Search';
  return `Search: ${q}`;
}
```

```html
<!-- src/routes/search/search.html -->
<!DOCTYPE html>
<html>
<head>
  <title>{{ getTitle() }}</title>
</head>
<body>
  {{ searchPage() }}
  
  <!-- Direct query parameter access in templates -->
  <div class="query-info">
    <p>Search term: {{ query.q || 'None' }}</p>
    <p>Page: {{ query.page || '1' }}</p>
    <p>Sort: {{ query.sort || 'relevance' }}</p>
  </div>
</body>
</html>
```

**Access query parameters:**
- **In templates:** `{{ query.paramName }}`
- **In functions:** Access via the `context` parameter
- **URL examples:** `/search?q=typescript&page=2&sort=date`

### Async SSR Example
```ts
// src/routes/about/about.ts
export async function aboutPage() {
  const data = await fetchSomeData();
  return `<div>Data: ${data}</div>`;
}

export async function loadUserInfo(userId: string) {
  const user = await fetchUser(userId);
  return `<div>User: ${user.name}</div>`;
}
```

```html
<!-- Template with async function calls -->
<body>
  {{ aboutPage() }}
  {{ loadUserInfo('123') }}
</body>
```

---

## Adding Routes

- **Recommended:** Use the CLI to scaffold a new route:

  ```sh
  zyte add-route about
  ```
  This will create `src/routes/about/about.ts`, `about.html`, `about.css`, and optionally you can add `about.client.ts` for client code. If a `.css` file exists, Zyte will automatically inject it into your HTML—no need to add <link rel="stylesheet"> manually.

- **Manual:**
  1. Create a new folder in `src/routes/` (e.g., `src/routes/about/`).
  2. Add a `about.ts` (SSR component), `about.html` (template), and optionally `about.client.ts` (client code). If you add a `about.css`, it will be injected automatically.
  3. The route will be available at `/about`.

---

## Client-Side Interactivity
- Write TypeScript in `.client.ts` files next to your SSR components.
- Zyte will bundle these with esbuild and inject them automatically into your HTML.
- **CSS is also injected automatically if a matching `.css` file exists.**
- No need to manually add `<script>` or `<link rel="stylesheet">` tags.

---

## Development Workflow
- `bun run dev` — Watches for changes, rebuilds, and reloads automatically.
- `bun run build` — Builds for production (bundles client, emits server.js).
- `bun run start` — Runs the production server.

---

> Note: This package is using an Http server from Bun that is not compatible with Node.js.

---

## Server Configuration

Zyte SSR provides a simple way to configure your server through a `server.config.ts` file. You can place this file in your project root or inside the `src` directory. The framework will automatically load it when the server starts.

### Basic Configuration

Create a `server.config.ts` file in your project root or `src/` directory:

```typescript
import type { ServerOptions } from 'zyte/server';

const config: ServerOptions = {
  // Custom port (optional)
  port: 3000,
  
  // Enable or disable SSR caching (default: true)
  cacheEnabled: true,
  
  // Max cache age in milliseconds (default: 300000, i.e., 5 minutes)
  cacheMaxAge: 300000,

  // Sitemap configuration (optional)
  sitemap: {
    enabled: true, // Default: true
    baseUrl: 'https://example.com', // Auto-detected if not provided
    excludePaths: ['admin', 'private'], // Paths to exclude
    customUrls: [
      {
        url: '/special-page',
        changefreq: 'daily',
        priority: 0.9
      }
    ],
    defaultChangefreq: 'weekly', // Default: 'weekly'
    defaultPriority: 0.8 // Default: 0.8
  },

  // Robots.txt configuration (optional)
  robots: {
    enabled: true, // Default: true
    baseUrl: 'https://example.com', // Auto-detected if not provided
    userAgents: [
      {
        name: '*', // All robots
        allow: ['/'],
        disallow: ['/admin/', '/private/', '/__zyte_keepalive'],
        crawlDelay: 1
      }
    ],
    sitemap: true, // Include sitemap reference (default: true)
    customRules: [
      '# Custom robots.txt rules',
      'Disallow: /temp/'
    ]
  },

  // Callback when server starts (optional)
  onStart: async ({ port, host, url }) => {
    console.log(`🎉 Server is ready at ${url}`);
    console.log(`📊 Keep-alive endpoint: ${url}/__zyte_keepalive`);
    console.log(`🗺️ Sitemap available at: ${url}/sitemap.xml`);
    console.log(`🤖 Robots.txt available at: ${url}/robots.txt`);
    
    // You can perform any custom initialization here
    // For example:
    // - Connect to databases
    // - Initialize external services
    // - Set up background tasks
    // - Send notifications
  }
};

export default config;
```

### Caching

Zyte SSR includes an in-memory caching system to improve performance.

- **Enabled by Default**: Caching is on by default to accelerate page loads.
- **Cache Pre-warming**: On server startup, Zyte pre-renders all static routes (routes without parameters) and stores them in the cache. This ensures that the first visit to any page is served instantly from memory.
- **What is Cached**: It caches the final HTML of `GET` requests for routes that do not have any query parameters.
- **Configuration**: You can configure caching via `server.config.ts`:
    - `cacheEnabled`: Set to `false` to disable caching entirely.
    - `cacheMaxAge`: Sets the cache expiration time in milliseconds. The default is 5 minutes.

### Gzip Compression

To improve performance and reduce bandwidth, Zyte SSR automatically compresses server responses with gzip if the client's browser supports it. This happens automatically and requires no configuration. Compression is applied after retrieving a page from the cache, ensuring that both cached and newly rendered pages are served as efficiently as possible.

### Keep-Alive Endpoint

Every Zyte SSR server automatically includes a keep-alive endpoint at `/__zyte_keepalive` that returns:

```json
{
  "status": "alive",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "framework": "zyte",
  "version": "0.3.8"
}
```

This endpoint is useful for:
- **Free cloud services** that require periodic pings to keep the server alive
- **Health checks** and monitoring
- **Load balancers** that need to verify server status

### Advanced Configuration Examples

#### Database Connection
```typescript
import type { ServerOptions } from 'zyte/server';

const config: ServerOptions = {
  onStart: async ({ url }) => {
    console.log(`🚀 Server started at ${url}`);
    
    // Connect to database
    try {
      await connectToDatabase();
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
    }
  }
};

export default config;
```

#### External Service Integration
```typescript
import type { ServerOptions } from 'zyte/server';

const config: ServerOptions = {
  onStart: async ({ url }) => {
    console.log(`🚀 Server started at ${url}`);
    
    // Initialize external services
    await initializeEmailService();
    await setupWebhookEndpoints();
    await startBackgroundTasks();
    
    console.log('✅ All services initialized');
  }
};

export default config;
```

#### Environment-Specific Configuration
```typescript
import type { ServerOptions } from 'zyte/server';

const config: ServerOptions = {
  port: process.env.NODE_ENV === 'production' ? 8080 : 3000,
  
  onStart: async ({ url }) => {
    if (process.env.NODE_ENV === 'production') {
      console.log(`🚀 Production server running at ${url}`);
      // Production-specific initialization
    } else {
      console.log(`🚀 Development server running at ${url}`);
      // Development-specific initialization
    }
  }
};

export default config;
```

---

## Deployment

Zyte SSR apps can be deployed to any platform that supports Bun. Here are the recommended deployment configurations:

### Recommended: Pre-built Deployment

**Include your `dist/` folder in your repository to bypass bundling issues entirely:**

1. **Build locally:** `bun run build`
2. **Commit built files:** `git add dist/ && git commit -m "Add built files"`
3. **Deploy with:**
   - **Build Command:** `bun install`
   - **Start Command:** `bun run dist/server.js`

**Benefits:**
- ✅ No bundling during deployment (faster builds)
- ✅ No esbuild dependency issues
- ✅ Reliable deployment process

### Render.com

1. **Build Command:** `bun install`
2. **Start Command:** `bun run dist/server.js`

### Vercel

1. **Build Command:** `bun install`
2. **Output Directory:** `dist`
3. **Install Command:** `bun install`

### Railway

1. **Build Command:** `bun install`
2. **Start Command:** `bun run dist/server.js`

### Alternative: Build During Deployment

If you prefer to build during deployment:

1. **Build Command:** `bun install && bun run build`
2. **Start Command:** `bun run dist/server.js`

### Environment Variables

Set `PORT` environment variable if needed (defaults to 3000).

### Troubleshooting

If you encounter esbuild bundling errors during deployment, this has been fixed in the framework. The solution includes:
- Framework-level external configuration for esbuild
- Conditional import handling
- Graceful fallback when esbuild is unavailable

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Documentation & Support
- See `context.md` for technical/AI context.
- For questions or issues, open an issue on GitHub.

---

## License
MIT 

---

## Static File Serving

Zyte SSR automatically serves any file that doesn't have a `.ts` or `.html` extension as static content. This provides comprehensive support for all common web assets without any configuration.

### Supported File Types

The framework automatically serves any file type, including:

- **Web Essentials**: `robots.txt`, `sitemap.xml`, `favicon.ico`, `manifest.json`
- **Images**: Any image format (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`, etc.)
- **Fonts**: All font formats (`.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`, etc.)
- **Documents**: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, etc.
- **Archives**: `.zip`, `.tar`, `.gz`, `.rar`, etc.
- **Media**: Any audio/video format (`.mp4`, `.webm`, `.mp3`, `.wav`, etc.)
- **Data Files**: `.json`, `.csv`, `.xml`, `.yaml`, `.yml`, etc.
- **And any other file type** you might need

### File Placement

Place static files in any of these locations:

1. **`src/app/`** - For app-level static files (e.g., `src/app/robots.txt`)
2. **`src/routes/`** - For route-specific static files (e.g., `src/routes/about/logo.png`)
3. **`dist/client/`** - For built assets (auto-generated during build)

### URL Access

Files are accessible at their corresponding URLs:

```bash
# Files in src/app/
src/app/robots.txt          → /robots.txt
src/app/favicon.ico         → /favicon.ico
src/app/sitemap.xml         → /sitemap.xml

# Files in src/routes/
src/routes/about/logo.png   → /routes/about/logo.png
src/routes/blog/header.jpg  → /routes/blog/header.jpg

# Files in dist/client/
dist/client/app.css         → /app.css
dist/client/counter.js      → /counter.js
```

### Example Usage

```bash
# Create a robots.txt file
echo "User-agent: *\nAllow: /" > src/app/robots.txt

# Add a favicon
cp favicon.ico src/app/favicon.ico

# Add route-specific images
cp logo.png src/routes/about/logo.png
```

The files will be automatically served with the correct MIME types and no additional configuration required.

---

## Dynamic Sitemap Generation

Zyte SSR automatically generates a dynamic `sitemap.xml` at `/sitemap.xml` based on your discovered routes. This helps search engines discover and index your pages automatically.

### Automatic Features

- **Route Discovery**: Automatically includes all routes from `src/routes/`
- **Root Page**: Always includes the home page (`/`) with highest priority
- **Auto-detection**: Automatically detects your site's base URL
- **Caching**: Sitemap is cached for 1 hour for performance
- **SEO Optimized**: Follows sitemap protocol standards

### Configuration Options

You can customize the sitemap generation in your `server.config.ts`:

```typescript
import type { ServerOptions } from 'zyte/server';

const config: ServerOptions = {
  sitemap: {
    // Enable/disable sitemap generation (default: true)
    enabled: true,
    
    // Custom base URL (auto-detected if not provided)
    baseUrl: 'https://example.com',
    
    // Routes to exclude from sitemap
    excludePaths: ['admin', 'private', 'temp'],
    
    // Custom URLs to include
    customUrls: [
      {
        url: '/special-page',
        changefreq: 'daily',
        priority: 0.9
      },
      {
        url: 'https://external-site.com/page',
        lastmod: '2024-01-01T00:00:00.000Z',
        changefreq: 'monthly',
        priority: 0.5
      }
    ],
    
    // Default settings for discovered routes
    defaultChangefreq: 'weekly', // 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
    defaultPriority: 0.8 // 0.0 to 1.0
  }
};

export default config;
```

### Example Generated Sitemap

For a site with routes `/about`, `/blog`, and `/contact`, the generated sitemap would look like:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-15T10:30:00.000Z</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-01-15T10:30:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/blog</loc>
    <lastmod>2024-01-15T10:30:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/contact</loc>
    <lastmod>2024-01-15T10:30:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

### Usage

1. **Automatic**: The sitemap is automatically available at `/sitemap.xml`
2. **Search Engines**: Submit the URL to Google Search Console, Bing Webmaster Tools, etc.
3. **robots.txt**: Add `Sitemap: https://example.com/sitemap.xml` to your robots.txt

---

## Dynamic Robots.txt Generation

Zyte SSR automatically generates a dynamic `robots.txt` at `/robots.txt` with configurable rules for search engine crawlers. This helps control how search engines index your site.

### Automatic Features

- **Default Rules**: Provides sensible default rules for all robots
- **Sitemap Integration**: Automatically includes reference to your sitemap
- **Configurable**: Customize rules for different user agents
- **Caching**: Robots.txt is cached for 1 hour for performance
- **SEO Optimized**: Follows robots.txt protocol standards

### Configuration Options

You can customize the robots.txt generation in your `server.config.ts`:

```typescript
import type { ServerOptions } from 'zyte/server';

const config: ServerOptions = {
  robots: {
    // Enable/disable robots.txt generation (default: true)
    enabled: true,
    
    // Custom base URL (auto-detected if not provided)
    baseUrl: 'https://example.com',
    
    // User agent specific rules
    userAgents: [
      {
        name: '*', // All robots
        allow: ['/'],
        disallow: ['/admin/', '/private/', '/__zyte_keepalive'],
        crawlDelay: 1
      },
      {
        name: 'Googlebot',
        allow: ['/'],
        disallow: ['/admin/'],
        crawlDelay: 0.5
      }
    ],
    
    // Include sitemap reference (default: true)
    sitemap: true,
    
    // Custom robots.txt rules
    customRules: [
      '# Custom robots.txt rules',
      'Disallow: /temp/',
      'Disallow: /draft/'
    ]
  }
};

export default config;
```

### Example Generated Robots.txt

With default configuration, the generated robots.txt would look like:

```txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/
Disallow: /__zyte_keepalive

Sitemap: https://example.com/sitemap.xml
```

With custom configuration:

```txt
# Custom robots.txt rules
Disallow: /temp/
Disallow: /draft/

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/
Disallow: /__zyte_keepalive
Crawl-delay: 1

User-agent: Googlebot
Allow: /
Disallow: /admin/
Crawl-delay: 0.5

Sitemap: https://example.com/sitemap.xml
```

### Usage

1. **Automatic**: The robots.txt is automatically available at `/robots.txt`
2. **Search Engines**: Search engines will automatically discover and follow the rules
3. **Testing**: Test your robots.txt with Google Search Console's robots.txt tester
4. **Integration**: Works seamlessly with the dynamic sitemap generation

---

## Security & XSS Protection

**Zyte SSR does NOT escape any output by default.**

- All template expressions (function calls, property accesses, etc.) are rendered as raw HTML.
- It is the developer's responsibility to escape any untrusted data before including it in the output.
- The framework provides an `html` tagged template function and an `escapeHtml` utility to help you safely interpolate dynamic values.

### Recommended: Use the `html` Tag for Safe Interpolation

```typescript
import { html } from 'zyte';
export function aboutPage(context) {
  return html`<div>User: ${context.query.user}</div>`;
}
```
- All interpolated values in the `html` tag are automatically escaped to prevent XSS.
- The result is a string, which you can return from your component functions.

### Manual Escaping
If you are building HTML strings manually, use the `escapeHtml` utility:

```typescript
import { escapeHtml } from 'zyte';
export function aboutPage(context) {
  const user = escapeHtml(context.query.user);
  return `<div>User: ${user}</div>`;
}
```

### Example: Unsafe (Do NOT do this)
```typescript
export function aboutPage(context) {
  // If context.query.user is untrusted, this is vulnerable to XSS!
  return `<div>User: ${context.query.user}</div>`;
}
```

**Summary:**
- Use the `html` tag for new code or when interpolating untrusted data.
- All output is rendered as raw HTML unless you escape it yourself.
- There is no automatic XSS protection at the framework level.

--- 