# Deployment Guide

## Platform-Specific Deployment

### Render.com

When deploying to Render.com, you may encounter an esbuild bundling error. This is a known issue that has been fixed in the framework. Here are the recommended deployment steps:

#### Option 1: Use the Framework's Built-in Server (Recommended)

1. Set your **Build Command** to:
   ```bash
   bun install && bun run build
   ```

2. Set your **Start Command** to:
   ```bash
   bun run dist/server.js
   ```

3. Make sure your `package.json` has the correct scripts:
   ```json
   {
     "scripts": {
       "build": "zyte build",
       "start": "bun run dist/server.js"
     }
   }
   ```

#### Option 2: Use Bun Directly

1. Set your **Build Command** to:
   ```bash
   bun install
   ```

2. Set your **Start Command** to:
   ```bash
   bun run src/server.ts
   ```

### Vercel

For Vercel deployment, use the following configuration:

1. Set your **Build Command** to:
   ```bash
   bun install && bun run build
   ```

2. Set your **Output Directory** to:
   ```
   dist
   ```

3. Set your **Install Command** to:
   ```bash
   bun install
   ```

### Railway

For Railway deployment:

1. Set your **Build Command** to:
   ```bash
   bun install && bun run build
   ```

2. Set your **Start Command** to:
   ```bash
   bun run dist/server.js
   ```

## Environment Variables

Make sure to set the following environment variables:

- `PORT`: The port your server should listen on (optional, defaults to 3000)

## Troubleshooting

### esbuild Bundling Error

If you encounter the error:
```
The esbuild JavaScript API cannot be bundled. Please mark the "esbuild" package as external so it's not included in the bundle.
```

This has been fixed in the framework. The solution includes:

1. **Framework-level fix**: esbuild is now marked as external in the framework's build configuration
2. **Conditional import**: esbuild is imported conditionally to avoid bundling issues
3. **Graceful fallback**: If esbuild is not available, the build process continues without client bundling

### Client-Side Interactivity

If client-side interactivity doesn't work in production:

1. Check that your `.client.ts` files are being bundled correctly
2. Verify that the client scripts are being served from `/client/` paths
3. Ensure your HTML templates include the client script tags

## Production Considerations

1. **Static Assets**: Make sure your CSS and other static assets are in the correct locations
2. **Environment Variables**: Use environment variables for any configuration that differs between development and production
3. **Error Handling**: The framework includes built-in error handling for production deployments

## Support

If you continue to experience issues, please:

1. Check that you're using the latest version of the framework
2. Verify your deployment configuration matches the examples above
3. Check the deployment platform's logs for specific error messages 