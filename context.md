# Zyte SSR Framework — AI/Developer Context

## Overview
Zyte SSR is a zero-dependency, TypeScript-first server-side rendering (SSR) framework for Bun. It is designed for simplicity, fast builds, and a clear separation between server-rendered and client-side code. The framework is CLI-driven and supports per-component client-side TypeScript with automatic bundling and script injection.

---

## Project Structure
```
zyte/
  src/
    cli.ts         # Main CLI entrypoint: all build/dev logic, CLI commands, and scaffolding
    index.ts       # SSR core: route discovery, rendering, template and asset injection
    server.ts      # Bun HTTP server: SSR handler, static file serving, asset resolution
  bin/zyte         # CLI executable (entry point for all commands)
  package.json     # CLI and framework package metadata
  ...
```

### Example Generated Project
```
zyte-example/
  src/
    app/
      app.ts           # Main SSR component
      app.html         # HTML template for SSR
      app.css          # CSS for SSR and client
      app.client.ts    # Client-side logic (hydration, interactivity)
    routes/
      counter/
        counter.ts         # SSR component for /counter
        counter.html       # HTML template for /counter
        counter.css        # CSS for /counter
        counter.client.ts  # Client-side logic for /counter
    index.ts           # Project entry (optional)
  dist/
    client/
      ...bundled client JS...
```

### Example: Async SSR Component
```ts
// src/routes/about/about.ts
export async function aboutPage() {
  const data = await fetchSomeData();
  return `<div>Data: ${data}</div>`;
}
```

---

## Key Conventions
- **SSR components:** `.ts` files (not ending with `.client.ts`) in `src/app` or `src/routes/*` are treated as server-side entry points. These can be synchronous or `async` functions (returning `Promise<string>`), so you can fetch data or perform async operations during SSR.
- **Multiple exports:** Components can export multiple functions and properties that can be used in templates. Each export is available in the template via `{{ functionName() }}` or `{{ propertyName }}`.
- **Client code:** `.client.ts` files colocated with SSR components. These are bundled with esbuild and injected automatically into the HTML.
- **HTML templates:** `.html` files matching the SSR component name are used for rendering.
- **CSS:** `.css` files matching the component or route are automatically injected as `<link rel="stylesheet">` during SSR (no need to manually add in templates).
- **Static assets:** Served from `dist/client`, `src/app`, or `src/routes` in that order of precedence.

---

## Template Processing & Multiple Exports

The framework now supports multiple exports and enhanced template expressions:

### Supported Template Expressions
- **Function calls:** `{{ functionName() }}`, `{{ functionName('arg') }}`, `{{ functionName(arg1, arg2) }}`
- **Property access:** `{{ propertyName }}`, `{{ data.title }}`
- **Async functions:** All function calls are awaited, supporting `async`/`await` in SSR components

### Example: Multiple Exports
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

export async function loadUserInfo(userId: string) {
  const user = await fetchUser(userId);
  return `<div>User: ${user.name}</div>`;
}
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
    {{ loadUserInfo('123') }}
  </main>
  
  {{ sidebar() }}
</body>
</html>
```

### Argument Types Supported
- **Strings:** `{{ functionName('hello') }}`, `{{ functionName("world") }}`
- **Numbers:** `{{ functionName(42) }}`, `{{ functionName(3.14) }}`
- **Booleans:** `{{ functionName(true) }}`, `{{ functionName(false) }}`
- **Null/Undefined:** `{{ functionName(null) }}`, `{{ functionName(undefined) }}`

---

## CLI Commands
- `zyte new <project-name>` — Scaffold a new project with example app and counter route.
- `zyte dev` — Build in watch mode (in-process), serve with Bun, auto-rebuild on changes.
- `zyte build` — Production build (bundles client, copies files, emits server.js).
- `zyte add-route <name>` — Add a new route scaffold.

> **Note:** All build and dev logic is in `src/cli.ts`. Generated projects do not contain their own build scripts.

---

## SSR and Client Bundling Flow
1. **Route Discovery:**
   - `src/index.ts` scans `src/routes` for `.ts`/`.js` files, ignoring `.client.ts`.
   - Each route is mapped to its SSR component, HTML template, and CSS file (if present).
2. **Rendering:**
   - On request, SSR loads the component module, making all exports available to the template.
   - The template processor supports multiple function calls and property access: `{{ functionName() }}`, `{{ propertyName }}`, `{{ data.title }}`.
   - All function calls are awaited, supporting async SSR components.
   - If a bundled client script exists for the route, injects `<script src="...">` before `</body>`.
   - If a matching CSS file exists, injects `<link rel="stylesheet">` in the `<head>`.
3. **Client Bundling:**
   - All `.client.ts` files are bundled with esbuild to `dist/client/...`.
   - Watch mode only re-bundles changed `.client.ts` files; other changes trigger a full rebuild.
4. **Static File Serving:**
   - Server checks `dist/client` first, then `src/app`, then `src/routes` for static assets.
   - `/routes/...` URLs are mapped to `src/routes/...` for assets like CSS.

* The template processor and SSR rendering fully support multiple exports and async SSR component functions. All `{{ functionName() }}` template calls are awaited, so you can use `async`/`await` in your SSR logic.

---

## Design Decisions & Rationale
- **Zero dependencies except esbuild:** Ensures fast installs and minimal attack surface.
- **All build/dev logic in CLI:** Keeps generated projects clean and easy to upgrade.
- **Strict SSR/client code separation:** Prevents SSR errors and enables clear mental model.
- **Automatic asset injection:** Reduces boilerplate and mistakes in templates.
- **In-process build watcher:** Fast feedback loop for development.
- **Route discovery ignores `.client.ts`:** Prevents accidental SSR of client-only code.

---

## Extending & Modifying
- **Add new route types:** Update route discovery logic in `src/index.ts`.
- **Support more static asset types:** Update static file logic in `src/server.ts`.
- **Change client bundle/script injection:** Update HTML post-processing in SSR render (in `src/index.ts`).
- **Add CLI commands:** Extend `src/cli.ts` with new command logic and help output.
- **Change CSS injection:** Update SSR render logic to alter how/where CSS is injected.

---

## Troubleshooting & Debugging
- **Client script not loaded:**
  - Ensure it is bundled to `dist/client`.
  - Check that the script tag is injected in the rendered HTML.
- **SSR errors reference `.client.ts`:**
  - Confirm route discovery ignores `.client.ts` files.
- **Static assets not served:**
  - Check the static file search order in `src/server.ts`.
  - Ensure asset paths match the expected URL structure.
- **CSS not applied:**
  - Make sure a matching `.css` file exists and is not empty.
  - Confirm `<link rel="stylesheet">` is injected in the SSR output.

---

## Author/AI Note
This documentation is for future AI/codebase maintainers. The framework is designed for clarity, maintainability, and a smooth developer experience for both SSR and client-side interactivity. When extending or refactoring, prefer explicit, convention-driven logic and keep the CLI as the single source of build/dev truth.

---

## Recent Improvements & Rationale
- **Automated CSS injection:** SSR now automatically injects a `<link rel="stylesheet">` tag for matching `.css` files for both app and route components. This reduces manual errors and keeps templates clean.
- **No hardcoded CSS links in templates:** CLI generators no longer add `<link rel="stylesheet">` tags; injection is handled by SSR for consistency.
- **Static file serving for `/routes/...`:** The server now maps `/routes/...` URLs to `src/routes/...` for assets like CSS, ensuring correct loading for all routes and simplifying asset management.

---

## For Future Maintainers
- **When adding features:**
  - Update this context file with rationale and usage notes.
  - Prefer convention over configuration.
  - Keep the SSR/client separation strict.
- **When debugging:**
  - Trace asset resolution and injection logic in `src/index.ts` and `src/server.ts`.
  - Use the CLI as the entry point for all build/dev tasks.
- **When updating dependencies:**
  - Only esbuild should be required for client bundling; avoid adding runtime dependencies.

--- 