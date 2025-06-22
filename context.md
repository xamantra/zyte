# Zyte SSR Framework — AI & LLM Technical Context

## 1. Overview

Zyte SSR is a zero-dependency, TypeScript-first server-side rendering (SSR) framework designed for the [Bun](https://bun.sh/) runtime. It is architected for simplicity, rapid development, and a convention-driven project structure. The framework's core features include file-based routing, automatic client-side code bundling, and a template engine that allows for seamless integration of asynchronous data fetching directly within HTML templates.

This document serves as a comprehensive technical specification intended for consumption by AI and LLM-based development assistants. It details the internal architecture, control flow, and API for the purpose of understanding, maintaining, and extending the framework.

---

## 2. Core Architectural Concepts

### File-Based Routing
Routes are programmatically discovered by scanning the `src/routes` directory. The framework maps the file system structure directly to URL paths. A component defined at `src/routes/about/about.ts` corresponds to the `/about` URL. The root route `/` is a special case, mapped to `src/app/app.ts`. This logic is implemented in the `discoverRoutes` method of the `ZyteSSR` class in `src/index.ts`.

### SSR Components
A component is a TypeScript module (`.ts` or `.js`) that exports functions or variables. These exports are consumed by the template engine to render dynamic HTML.

### Multiple Exports per Component
A single module can export multiple named entities (functions, variables, constants). This allows for co-location of related server-side logic. For example, a `profile.ts` module might export `getProfileData`, `renderProfileHeader`, and `pageTitle`, all usable within the associated `profile.html` template.

### Asynchronous Rendering
The template engine is intrinsically asynchronous. Any function call within a template expression (e.g., `{{ myFunction() }}`) is automatically `await`ed by the `evaluateExpression` function in `src/index.ts`. This enables direct-to-template data fetching or other async operations during the render cycle without manual promise handling.

### Client-Side Hydration
Interactivity is achieved by creating a `.client.ts` file alongside its corresponding server-side component (e.g., `about.client.ts` for `about.ts`). During the build process (`buildProject` in `src/cli.ts`), these `.client.ts` files are discovered and bundled using `esbuild` into the `dist/client/` directory. The `startServer` function in `src/server.ts` then dynamically injects the appropriate client script as a `<script>` tag into the final HTML document before serving the response.

### Automated Asset Injection
- **CSS**: A `.css` file with the same basename as a component (e.g., `about.css` for `about.ts`) is automatically discovered by the `render` method in `src/index.ts`. If found, a `<link rel="stylesheet">` tag pointing to the corresponding asset path is injected into the HTML `<head>`.
- **Client Scripts**: Bundled `.client.js` files are injected as `<script type="module">` tags just before the closing `</body>` tag by the request handler in `src/server.ts`.

### Comprehensive Static File Serving
The framework serves any file that doesn't have a `.ts` or `.html` extension as static content, automatically supporting all common web assets without configuration. This includes:
- **Web essentials**: `robots.txt`, `sitemap.xml`, `favicon.ico`, `manifest.json`
- **Images**: Any image format (`.png`, `.jpg`, `.webp`, `.svg`, `.ico`, etc.)
- **Fonts**: All font formats (`.woff`, `.woff2`, `.ttf`, `.otf`, etc.)
- **Documents**: `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, etc.
- **Archives**: `.zip`, `.tar`, `.gz`, `.rar`, etc.
- **Media**: Any audio/video format (`.mp4`, `.webm`, `.mp3`, `.wav`, etc.)
- **Data files**: `.json`, `.csv`, `.xml`, `.yaml`, `.yml`, etc.
- **And any other file type** users might need

**File Resolution Order:**
1. `dist/client/` - For built assets
2. `src/app/` - For app-level static files  
3. `src/routes/` - For route-specific static files

**Directory Safety:** The system includes checks to ensure only actual files (not directories) are served, preventing `EISDIR` errors when users request paths with trailing slashes.

### Dynamic Sitemap Generation
The framework automatically generates a dynamic `sitemap.xml` at `/sitemap.xml` based on discovered routes. This feature:
- **Route Discovery**: Automatically includes all routes from the `src/routes/` directory
- **Root Page**: Always includes the home page (`/`) with highest priority (1.0)
- **Configurable**: Supports custom URLs, excluded paths, and SEO parameters via `server.config.ts`
- **SEO Optimized**: Follows sitemap protocol standards with proper XML formatting
- **Caching**: Sitemap is cached for 1 hour for performance optimization
- **Auto-detection**: Automatically detects the site's base URL from the request

**Configuration Options:**
- `enabled`: Enable/disable sitemap generation (default: true)
- `baseUrl`: Custom base URL (auto-detected if not provided)
- `excludePaths`: Array of route paths to exclude from sitemap
- `customUrls`: Array of custom URLs with specific SEO parameters
- `defaultChangefreq`: Default change frequency for discovered routes
- `defaultPriority`: Default priority for discovered routes (0.0 to 1.0)

### Dynamic Robots.txt Generation
The framework automatically generates a dynamic `robots.txt` at `/robots.txt` with configurable rules for search engine crawlers. This feature:
- **Default Rules**: Provides sensible default rules for all robots (allow `/`, disallow `/admin/`, `/private/`, `/__zyte_keepalive`)
- **Sitemap Integration**: Automatically includes reference to the generated sitemap
- **Configurable**: Supports custom rules for different user agents with allow/disallow paths and crawl delays
- **SEO Optimized**: Follows robots.txt protocol standards with proper formatting
- **Caching**: Robots.txt is cached for 1 hour for performance optimization
- **Auto-detection**: Automatically detects the site's base URL from the request

**Configuration Options:**
- `enabled`: Enable/disable robots.txt generation (default: true)
- `baseUrl`: Custom base URL (auto-detected if not provided)
- `userAgents`: Array of user agent configurations with allow/disallow rules and crawl delays
- `sitemap`: Include sitemap reference (default: true)
- `customRules`: Array of custom robots.txt rules as strings

### In-Memory Caching
The framework implements a configurable in-memory caching layer to reduce render times for frequently accessed pages. The cache is a `Map` stored in `src/server.ts`.
- **Cache Key**: The URL path of the incoming request.
- **Cache Value**: An object containing the rendered HTML `content` and a `timestamp`.
- **Caching Strategy**: Caching is applied only to `GET` requests with no query parameters.
- **Cache Invalidation**: A `cacheMaxAge` setting (default: 5 minutes) is used to check for and evict stale entries.
- **Cache Pre-warming**: At server startup, the framework iterates through all discovered routes, renders them with an empty context, and populates the cache. This ensures initial page loads are served from memory.
- **Configuration**: Caching behavior can be controlled via `cacheEnabled` and `cacheMaxAge` options in `server.config.ts`.

### Gzip Compression
The server automatically compresses HTTP responses with gzip for clients that support it (via the `Accept-Encoding` header). This is handled transparently in `src/server.ts` as a middleware-like wrapper around the main request handler. Compression is applied *after* the in-memory cache check, ensuring that the cache stores raw, uncompressed HTML, and compression is a final, on-the-fly step before sending the response. This optimizes both CPU usage (by not re-rendering) and bandwidth.

### Automatic Image Lazy Loading
To improve initial page load performance, the framework automatically adds `loading="lazy"` to all `<img>` tags in rendered HTML that do not already have a `loading` attribute. This is handled by the `injectLazyLoading` function in `src/server.ts` just before the final response is prepared. This native browser feature defers the loading of off-screen images, reducing initial network bandwidth and speeding up perceived load time.

---

## 3. Project Structure

### Framework Internal Structure
```
zyte/
├── bin/
│   ├── zyte          # Shell script executable for POSIX systems
│   ├── zyte.cmd      # Batch script for Windows CMD
│   └── zyte.ps1      # PowerShell script for Windows
├── src/
│   ├── cli.ts        # Main CLI entrypoint: orchestrates build, dev, and scaffolding logic
│   ├── index.ts      # SSR core: route discovery, template engine, rendering logic
│   └── server.ts     # Bun HTTP server: request handling, static file serving, asset injection
└── package.json      # Defines CLI commands, dependencies, and project metadata
```

### Generated Project Structure (via `zyte new`)
```
<project-name>/
├── src/
│   ├── app/                    # Root route (/) component files
│   │   ├── app.ts              # Main SSR component for the root route
│   │   ├── app.html            # HTML template for the root route
│   │   ├── app.css             # Styles for the root route
│   │   └── app.client.ts       # Client-side interactivity for the root route
│   │
│   ├── routes/                 # All other routes
│   │   └── counter/
│   │       ├── counter.ts
│   │       ├── counter.html
│   │       ├── counter.css
│   │       └── counter.client.ts
│   │
│   ├── index.ts                # User-facing SSR entrypoint (not part of the framework's src)
│   └── server.config.ts        # Optional server configuration
│
├── dist/                     # Build output (auto-generated)
│   ├── client/                 # Bundled client-side scripts
│   └── server.js               # Production server entrypoint
│
├── package.json
└── tsconfig.json
```

---

## 4. CLI Commands (Technical Breakdown)

All CLI logic resides in `src/cli.ts` and is executed by the `bin/zyte` scripts. The `main` function in `src/cli.ts` parses `process.argv` to route to the appropriate command handler.

### `zyte new <project-name>`
- **Handler:** `createNewProject(projectName)`
- **Action:** Scaffolds a new Zyte SSR project.
- **Mechanism:**
    1. Creates a new directory named `<project-name>`.
    2. Writes a series of files using hardcoded string templates within the `createNewProject` function. This includes:
        - `package.json` with `dev`, `build`, and `start` scripts pointing to the framework's commands.
        - `tsconfig.json` with appropriate paths and compiler options.
        - `src/index.ts` (the user-space entrypoint).
        - `src/server.config.ts` (optional configuration).
        - A complete root component under `src/app/` (`app.ts`, `app.html`, `app.css`, `app.client.ts`).
        - An example `/counter` route under `src/routes/counter/`.

### `zyte add-route <route-name>`
- **Handler:** `addRoute(routeName)`
- **Action:** Scaffolds a new route within `src/routes`.
- **Mechanism:**
    1. Creates a new subdirectory `src/routes/<route-name>`.
    2. Populates the directory with four files using hardcoded string templates: `<route-name>.ts`, `<route-name>.html`, `<route-name>.css`, and `<route-name>.client.ts`.

### `zyte dev`
- **Handler:** `startDevServer()`
- **Action:** Starts the development server with live-reloading capabilities.
- **Mechanism:**
    1. Executes an initial full project build by calling `buildProject()`.
    2. Spawns the Bun web server (`src/server.ts`) as a child process.
    3. Initializes `fs.watch` on the `src/` directory (recursively).
    4. On any file change, it triggers a rebuild by calling `buildProject()`. The server process is *not* restarted.
    5. Code changes are reflected on the next request due to cache-busting query parameters (`?t=${Date.now()}`) appended to dynamic `import()` calls in `src/index.ts`.

### `zyte build`
- **Handler:** `buildProject()`
- **Action:** Builds the project for production.
- **Mechanism:**
    1. Cleans the `dist/` directory.
    2. Creates `dist/client`.
    3. Calls `bundleClientFiles()` to find all `.client.ts` files and uses a conditional, dynamically imported `esbuild` instance to compile and bundle them into `dist/client/`.
    4. Copies server-side files (`index.ts`, `server.ts` etc.) to `dist/`, effectively creating a self-contained production-ready application.

---

## 5. Technical Deep Dive: File-by-File

#### `bin/zyte`, `bin/zyte.cmd`, `bin/zyte.ps1`
- **Purpose:** Cross-platform CLI entrypoints.
- **Mechanism:** These are simple wrapper scripts that execute `bun run src/cli.ts` with all forwarded arguments. The `package.json` `"bin"` field maps the `zyte` command to these scripts.

#### `src/cli.ts`
- **Purpose:** The central orchestrator for all build, development, and scaffolding tasks.
- **Key Internals:**
    - `main()`: Entry function that reads `process.argv.slice(2)` and uses a `switch` statement to delegate to the appropriate command function.
    - `createNewProject(projectName)` / `addRoute(routeName)`: Contain hardcoded string literals for every file that is scaffolded. They perform synchronous file system operations (`fs.mkdirSync`, `fs.writeFileSync`).
    - `startDevServer()`: Manages the development workflow, combining an initial build, server process management (`Bun.spawn`), and file watching (`fs.watch`).
    - `buildProject()`: A procedural function that orchestrates the cleaning of `dist`, bundling of client assets, and copying of server assets.
    - `bundleClientFiles()`: Scans the project for `.client.ts` files, invokes `esbuild.build()` for each, and places the output in `dist/client/`. It includes a `try-catch` block to handle cases where `esbuild` might not be available, allowing the build to proceed without client-side scripts.

#### `src/server.ts`
- **Purpose:** Defines the Bun web server and handles all incoming HTTP requests.
- **Key Internals:**
    - `startServer(options)`: The main export. It initializes the `ZyteSSR` engine from `src/index.ts`, loads an optional `server.config.ts`, and starts the Bun HTTP server (`Bun.serve`). It also handles cache pre-warming by iterating through all discovered routes from the `ZyteSSR` instance, rendering them, and storing them in an in-memory cache (`ssrCache`).
    - **Configuration Loading:** It attempts to `import()` `process.cwd() + '/server.config.ts'` or `process.cwd() + '/src/server.config.ts'` to get user-defined options like `port`, `cacheEnabled`, `cacheMaxAge` or an `onStart` callback.
    - **Request Handler (`fetch` method of `Bun.serve`):** This is the core request-response pipeline.
        1. **Caching:** Checks if a valid, non-stale cached response exists for the request path. If so, serves it immediately.
        2. **Keep-Alive:** Responds to `/__zyte_keepalive` with a JSON status object.
        3. **Dynamic Sitemap:** Responds to `/sitemap.xml` with a dynamically generated XML sitemap based on discovered routes and configuration options.
        4. **Dynamic Robots.txt:** Responds to `/robots.txt` with a dynamically generated robots.txt file based on configuration options and user agent rules.
        5. **Static Assets:** If the request URL path doesn't end in `.ts` or `.html`, it attempts to serve a physical file from `dist/client/`, `src/app/`, or `src/routes/`. The system includes directory safety checks to prevent `EISDIR` errors.
        6. **SSR Rendering:** For all other requests, it instantiates an `SSRContext` object (containing `query`, `params`, `headers`) and invokes `ssr.render()` from the `ZyteSSR` instance.
    - **Client Script Injection:** After receiving the rendered HTML from `ssr.render()`, it calls a dedicated `injectClientScript` helper to check if a corresponding bundled client script exists (e.g., `dist/client/about.js` for the `/about` route). If found, the HTML string is modified to inject a `<script type="module" src="/client/..."></script>` tag before the `</body>`.
    - **Image Lazy Loading:** After script injection, the final HTML is passed through the `injectLazyLoading` function, which automatically adds `loading="lazy"` to all `<img>` tags that don't already have a loading attribute. This is an automatic, non-configurable performance enhancement.
    - **Cache Population:** After a page is rendered, if the request is cacheable (`GET` with no query parameters) and caching is enabled, the final HTML is stored in the `ssrCache` with a timestamp.
    - **Gzip Compression**: After the main `handler` function resolves a response (either from cache or by rendering), the `fetch` method in `Bun.serve` inspects the request's `Accept-Encoding` header. If `gzip` is supported, it compresses the response body using `Bun.gzipSync` before sending it.

#### `src/index.ts`
- **Purpose:** The core SSR engine, responsible for route discovery, template processing, and rendering.
- **`ZyteSSR` Class:**
    - `constructor()`: Initializes the route map by calling `discoverRoutes()`.
    - `getRoutesMap()`: Exposes the internal `routes` map to allow other parts of the framework, like the server's cache warming mechanism, to access the list of discovered routes.
    - `discoverRoutes()`: Populates a `Map<string, string>` where keys are URL paths (`/about`) and values are the absolute paths to the corresponding component module (`.../src/routes/about/about.ts`). It uses the recursive helper `scanRoutesDirectory`.
    - `render(path, context)`: The primary method for rendering a page.
        1. Looks up the component module path from the route map. The root `/` is a special case mapped to `src/app/app.ts`.
        2. Reads the sibling `.html` template file into a string.
        3. **CSS Injection:** Checks for a sibling `.css` file. If it exists, a `<link rel="stylesheet" href="...">` tag is prepended into the `<head>` of the HTML string.
        4. Dynamically imports the component module using `import()`. Crucially, it appends a `?t=${Date.now()}` query string in development mode to bypass Bun's module cache.
        5. Calls `processTemplate()` with the HTML, the imported module's exports, and the request context.
    - `processTemplate(html, component, context)`: The template engine implementation. It uses `String.prototype.replace()` with a global regex (`/\{\{\s*([^}]+)\s*\}\}/g`) to find all `{{...}}` expressions and passes each match to `evaluateExpression`.
    - `evaluateExpression(match, component, context)`: The heart of the template engine.
        - It parses the expression to determine if it's a function call (contains `(`) or a property access.
        - **Function Calls:** It extracts the function name and arguments. Arguments are parsed by `parseTemplateArgs` into their correct types (string, number, boolean, null). It then invokes the function from the `component` object, passing the `context` as the final argument. The result is `await`ed.
        - **Property/Expression Access:** It supports dot notation (`myObject.property`) and a simple `||` for default values. It attempts to resolve the expression against properties on the `component` object first, then the `context` object (`query`, `params`).
        - The first truthy value found is returned.
- **Context Object:** Every template has access to a `context` object containing:
    - `context.query`: `URLSearchParams` from the request.
    - `context.params`: Route parameters (e.g., for `/users/:id`).
    - `context.headers`: Request headers.

---

## 6. Template Engine Internals

The template engine is located in `src/index.ts` within the `processTemplate` and `evaluateExpression` methods.

- **Invocation:** It is triggered by `render` after the component module and HTML template are loaded.
- **Regex:** ` /\{\{\s*([^}]+)\s*\}\}/g ` captures the content inside `{{ }}`.
- **Evaluation Strategy (`evaluateExpression`):**
    1. The captured expression (e.g., `myFunction('arg1', 123)` or `page.title || 'Default'`) is analyzed.
    2. **If it's a function call:**
        - The function name and argument string are extracted.
        - `parseTemplateArgs` is called to convert the argument string into an array of primitive values.
        - The function is retrieved from the imported component's exports.
        - It is invoked with `Function.prototype.apply()` with the parsed arguments, plus the `context` object appended as the last argument.
        - The call is `await`ed, and the resolved value is returned.
    3. **If it's a property access:**
        - The expression is split by `||` to handle default values.
        - It attempts to resolve the property path (e.g., `pageData.author`) against the `component` object and the `context` object.
        - The first truthy value found is returned.
- **Context Object:** Every template has access to a `context` object containing:
    - `context.query`: `URLSearchParams` from the request.
    - `context.params`: Route parameters (e.g., for `/users/:id`).
    - `context.headers`: Request headers.

---

## 7. Framework Maintenance & Extension Guide

This section provides instructions for an AI on how to modify the framework.

- **To Add a CLI Command:**
    1. In `src/cli.ts`, add the new command string to the `COMMANDS` object.
    2. Add a `case` to the `switch` statement in the `main()` function.
    3. Implement a new function (e.g., `myNewCommand()`) to handle the command's logic, including any file system operations or process spawning.

- **To Modify Route Discovery:**
    - Edit the `discoverRoutes` and `scanRoutesDirectory` methods in `src/index.ts`. For example, to change the routes directory from `src/routes` to `src/pages`, update the hardcoded path in `discoverRoutes`.

- **To Enhance the Template Engine:**
    - All logic is in `processTemplate`, `parseTemplateArgs`, and `evaluateExpression` in `src/index.ts`.
    - To add a new operator (e.g., `&&`), modify the parsing logic within `evaluateExpression`.
    - To support more complex data types in function arguments, enhance `parseTemplateArgs`.

- **To Modify Static File Serving:**
    - The logic resides in the `fetch` handler in `src/server.ts`. The current implementation uses a negative regex pattern (`!/\.(ts|html)$/`) to serve any file that doesn't have `.ts` or `.html` extensions. To modify this behavior, update the regex pattern and the file resolution logic.

- **To Modify Sitemap Generation:**
    - The sitemap generation logic is in the request handler in `src/server.ts`. It uses the `getRoutesMap()` method from the SSR instance to discover routes and applies configuration from `server.config.ts`.

- **To Modify Robots.txt Generation:**
    - The robots.txt generation logic is in the request handler in `src/server.ts`. It applies configuration from `server.config.ts` and can include custom rules, user agent specific configurations, and sitemap references.

- **To Update Scaffolding Templates:**
    - The file contents for `zyte new` and `zyte add-route` are hardcoded as multi-line string literals inside the `createNewProject` and `addRoute` functions in `src/cli.ts`. Modify these strings directly to change the generated code.

---

## 8. Recent Improvements & Rationale
- **Dynamic Robots.txt Generation**: Added automatic robots.txt generation at `/robots.txt` with configurable rules for search engine crawlers. This includes default rules, custom user agent configurations, and automatic sitemap integration, eliminating the need for manual robots.txt maintenance.
- **Dynamic Sitemap Generation**: Added automatic sitemap.xml generation at `/sitemap.xml` that dynamically includes all discovered routes with configurable SEO parameters. This eliminates the need for manual sitemap maintenance and ensures search engines can discover all pages automatically.
- **Comprehensive Static File Serving**: Enhanced the static file serving system to automatically serve any file that doesn't have a `.ts` or `.html` extension. This eliminates the need to maintain a list of supported file extensions and provides future-proof support for any file type users might need. The system includes directory safety checks to prevent `EISDIR` errors when users request paths with trailing slashes.
- **In-Memory Caching with Pre-warming**: Added a configurable, in-memory caching layer to dramatically improve performance for repeated requests. The cache is pre-warmed at server startup to ensure even the first page load is fast. This reduces server load and latency.
- **Gzip Compression**: Implemented automatic gzip compression for all server responses where the client supports it. This is done after caching to reduce bandwidth without caching compressed content, providing a balance of speed and efficiency.
- **Automatic Image Lazy Loading**: To improve initial page load performance, the framework now automatically adds `loading="lazy"` to all `<img>` tags in the rendered HTML. This browser-native feature defers the loading of off-screen images until the user scrolls near them, reducing network bandwidth and speeding up the initial render.
- **Automated CSS injection:** SSR now automatically injects a `<link rel="stylesheet">` tag for matching `.css` files for both app and route components. This reduces manual errors and keeps templates clean.
- **No hardcoded CSS links in templates:** CLI generators no longer add `<link rel="stylesheet">` tags; injection is handled by SSR for consistency.
- **Static file serving for `/routes/...`:** The server now maps `/routes/...` URLs to `src/routes/...` for assets like CSS, ensuring correct loading for all routes and simplifying asset management.

---

## 9. For Future Maintainers
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