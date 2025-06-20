# Zyte SSR Framework — AI/Developer Context

## Overview
Zyte SSR is a zero-dependency, TypeScript-first server-side rendering (SSR) framework for Bun. It is designed for simplicity, fast builds, and a clear separation between server-rendered and client-side code. The framework is CLI-driven and supports per-component client-side TypeScript with automatic bundling and script injection.

---

## Project Structure
```
zyte-ssr/
  src/
    cli.ts         # Main CLI entrypoint, all build/dev logic lives here
    index.ts       # SSR core (route discovery, rendering, template processing)
    server.ts      # Bun HTTP server, SSR handler, static file serving
  bin/zyte         # CLI executable
  package.json     # CLI and framework package
  ...
```

### Example Generated Project
```
zyte-example/
  src/
    app/
      app.ts
      app.html
      app.css
      app.client.ts
    routes/
      counter/
        counter.ts
        counter.html
        counter.css
        counter.client.ts
    index.ts
  dist/
    client/
      ...bundled client JS...
```

---

## Key Conventions
- **SSR components:** `.ts` files (not ending with `.client.ts`) in `src/app` or `src/routes/*`.
- **Client code:** `.client.ts` files colocated with SSR components. These are bundled with esbuild and injected automatically.
- **HTML templates:** `.html` files matching the SSR component name.
- **Static assets:** Served from `dist/client`, `src/app`, or `src/routes`.

---

## CLI Commands
- `zyte new <project-name>` — Scaffold a new project with example app and counter route.
- `zyte dev` — Build in watch mode (in-process), serve with Bun, auto-rebuild on changes.
- `zyte build` — Production build (bundles client, copies files, emits server.js).
- `zyte add-route <name>` — Add a new route scaffold.

All build and dev logic is in `src/cli.ts` (no separate build script in generated projects).

---

## SSR and Client Bundling Flow
1. **Route Discovery:**
   - `src/index.ts` scans `src/routes` for `.ts`/`.js` files, ignoring `.client.ts`.
   - Each route is mapped to its SSR component and HTML template.
2. **Rendering:**
   - On request, SSR loads the component, processes the template, and injects the result.
   - If a bundled client script exists for the route, injects `<script src="..."></script>` before `</body>`.
3. **Client Bundling:**
   - All `.client.ts` files are bundled with esbuild to `dist/client/...`.
   - Watch mode only re-bundles changed `.client.ts` files; other changes trigger a full rebuild.
4. **Static File Serving:**
   - Server checks `dist/client` first, then `src/app`, then `src/routes` for static assets.

---

## Design Decisions
- **No dependencies except esbuild (for client bundling).**
- **All build/dev logic is in the CLI, not in generated projects.**
- **SSR and client code are strictly separated by file naming.**
- **Automatic script injection based on existence of client bundle.**
- **In-process build watcher for dev mode (no subprocesses).**
- **Route discovery ignores `.client.ts` files to avoid SSR errors.**

---

## Extending/Modifying
- To add new route types, update `src/index.ts` route discovery.
- To support more static asset types, update the static file logic in `src/server.ts`.
- To change client bundle injection, update the HTML post-processing in SSR render.
- To add more CLI commands, extend `src/cli.ts`.

---

## Troubleshooting
- If a client script is not loaded, check that it is bundled to `dist/client` and the script tag is injected.
- If SSR errors reference `.client.ts`, ensure route discovery ignores those files.
- If static assets are not served, check the static file search order in `src/server.ts`.

---

## Author/AI Note
This documentation is for future AI/codebase maintainers. The framework was developed with a focus on clarity, maintainability, and a smooth developer experience for both SSR and client-side interactivity.

## Recent Improvements
- **Automated CSS injection:** SSR now automatically injects a <link rel="stylesheet"> tag for matching .css files for both app and route components.
- **No hardcoded CSS links in templates:** CLI generators no longer add <link rel="stylesheet"> tags; injection is handled by SSR.
- **Static file serving for /routes/...:** The server now maps /routes/... URLs to src/routes/... for assets like CSS, ensuring correct loading for all routes. 