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

## Example Project Structure

```
my-app/
  src/
    app/
      app.ts           # Main app SSR component
      app.html         # App HTML template
      app.css          # App styles
      app.client.ts    # Client-side interactivity for app
    routes/
      counter/
        counter.ts         # SSR component for /counter
        counter.html       # HTML template for /counter
        counter.css        # Styles for /counter
        counter.client.ts  # Client-side code for /counter
    index.ts           # SSR entrypoint
  dist/                # Built output (auto-generated)
  package.json
  tsconfig.json
```

---

## Example: Minimal Counter Route

**src/routes/counter/counter.ts**
```ts
export function counterPage() {
  return `
  <div class="container">
    <h1>Counter Example</h1>
    <p>Current count: <span id="count">0</span></p>
    <button id="increment">Increment</button>
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

export function footer() {
  return `
  <footer class="page-footer">
    <p>&copy; 2024 Zyte SSR Framework</p>
  </footer>
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
  
  {{ footer() }}
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

> This project is entirely vibe-coded with Cursor. Use at your own risk. (made for fun)

---

## Deployment

Zyte SSR apps can be deployed to any platform that supports Bun. Here are the recommended deployment configurations:

### Render.com

1. **Build Command:** `bun install && bun run build`
2. **Start Command:** `bun run dist/server.js`

### Vercel

1. **Build Command:** `bun install && bun run build`
2. **Output Directory:** `dist`
3. **Install Command:** `bun install`

### Railway

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