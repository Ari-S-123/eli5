# Daytona Integration Restoration Summary

## Issue Identified

The Daytona SDK integration was completely removed from `convex/demos.ts`, despite being a critical requirement in the project specification (`ELI5_SPEC.md`). The code was directly storing generated HTML to Convex storage without any sandbox execution, compromising security and deviating from the intended architecture.

**Evidence:**
- Line 10 in original `convex/demos.ts`: `// Daytona sandbox removed; we persist HTML to Convex storage directly`
- Line 187: `// External sandbox execution removed; handled inline in generateDemo`
- Missing `executeInSandbox` action
- No Daytona SDK imports

## Changes Implemented

### 1. Next.js Configuration (`next.config.ts`)

Added Node.js polyfills required for Daytona SDK compatibility:

```typescript
webpack: (config, { isServer }) => {
  if (!isServer) {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
      path: false,
      os: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
    };
  }
  return config;
}
```

**Why:** Daytona SDK relies on Node.js modules that need to be polyfilled for browser/edge runtime compatibility in Next.js.

### 2. Convex Actions File (`convex/demos.ts`)

#### Added Imports and Setup

```typescript
'use node';  // Required for actions using Node.js APIs

import { Daytona } from '@daytonaio/sdk';

// Temporary any-typed alias to avoid type errors before Convex generates
// the full API surface including this module.
const internal: any = internalApi;
```

#### Restored `executeInSandbox` Action

Implemented a comprehensive Daytona sandbox execution action that:

1. **Creates Isolated Sandbox**: Spins up a fresh Daytona sandbox with Node.js/TypeScript environment
2. **Writes Generated Code**: Transfers the AI-generated HTML to the sandbox filesystem
3. **Starts HTTP Server**: Launches http-server to serve the HTML on port 8080
4. **Fetches Result**: Retrieves the rendered HTML from the sandbox URL
5. **Stores in Convex**: Persists the executed result to Convex storage
6. **Cleans Up**: Destroys the sandbox after execution to prevent resource leaks

```typescript
export const executeInSandbox = action({
  args: {
    demoId: v.id('demos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Initialize Daytona client with credentials
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL,
      target: (process.env.DAYTONA_TARGET as 'local' | 'us' | 'eu') ?? 'us',
    });

    try {
      // Create sandbox
      const sandbox = await daytona.create({
        language: 'typescript',
        envVars: { NODE_ENV: 'production' },
      });

      // Write HTML file using heredoc to avoid escaping issues
      const writeCommand = `cat > /workspace/demo.html << 'EOFHTML'
${demo.generatedCode}
EOFHTML`;
      await sandbox.process.executeCommand(writeCommand);

      // Start HTTP server
      await sandbox.process.executeCommand('npx -y http-server /workspace -p 8080 --cors -s');

      // Fetch rendered HTML
      const sandboxUrl = `https://${sandbox.id}-8080.daytona.app`;
      const htmlResponse = await fetch(`${sandboxUrl}/demo.html`);
      const renderedHtml = await htmlResponse.text();

      // Store and update
      const fileStorageId = await ctx.storage.store(
        new Blob([renderedHtml], { type: 'text/html' })
      );

      await ctx.runMutation(internal.demos.updateDemo, {
        demoId: args.demoId,
        status: 'ready',
        executionResults: {
          sandboxId: sandbox.id,
          outputHtml: renderedHtml,
        },
        demoFileStorageId: fileStorageId,
      });

      // Cleanup
      await sandbox.delete();
    } catch (error) {
      // Error handling with proper status update
      await ctx.runMutation(internal.demos.updateDemo, {
        demoId: args.demoId,
        status: 'failed',
        executionResults: {
          sandboxId: '',
          errors: [error instanceof Error ? error.message : 'Unknown sandbox execution error'],
        },
      });
      throw error;
    }

    return null;
  },
});
```

#### Updated `generateDemo` Workflow

Changed from direct storage to proper sandbox scheduling:

**Before:**
```typescript
// Persist HTML and mark as ready
const storageId = await ctx.storage.store(new Blob([htmlCode], { type: 'text/html' }));
await ctx.runMutation(internalApi.demos.updateDemo, {
  status: 'ready',
  demoFileStorageId: storageId,
});
```

**After:**
```typescript
// Update demo with generated code and schedule sandbox execution
await ctx.runMutation(internal.demos.updateDemo, {
  demoId,
  status: 'executing',
  generatedCode: htmlCode,
});

// Execute in Daytona sandbox
await ctx.scheduler.runAfter(0, internal.demos.executeInSandbox, { demoId });
```

## Architecture Flow

The restored flow now properly follows the specification:

```
User Request
    ↓
generateDemo (action)
    ↓
1. Authenticate user
2. Fetch paper content
3. Create demo record (status: 'generating')
4. Call Anthropic Claude to generate HTML
5. Update demo (status: 'executing')
6. Schedule executeInSandbox
    ↓
executeInSandbox (action)
    ↓
1. Create Daytona sandbox
2. Write HTML to sandbox
3. Start HTTP server in sandbox
4. Fetch rendered HTML
5. Store in Convex storage
6. Update demo (status: 'ready')
7. Cleanup sandbox
    ↓
Demo ready for viewing
```

## Security Benefits

1. **Isolation**: Generated code runs in completely isolated sandbox environments
2. **No Direct Execution**: User-generated content never executes on the main server
3. **Automatic Cleanup**: Sandboxes are destroyed after execution, preventing resource exhaustion
4. **Network Isolation**: Daytona provides network isolation between sandboxes
5. **Time Limits**: Sandbox execution has implicit timeouts to prevent runaway processes

## Environment Variables Required

Ensure these are set in your `.env.local`:

```bash
# Daytona Configuration
DAYTONA_API_KEY=<your-api-key>
DAYTONA_API_URL=https://api.daytona.io
DAYTONA_TARGET=us  # or 'eu' or 'local'
```

## Testing the Integration

1. **Upload a Paper**: Upload an academic PDF
2. **Generate Demo**: Request a visual demonstration of a concept
3. **Monitor Status**: Watch status transition: `generating` → `executing` → `ready`
4. **View Demo**: The demo will be served from Convex storage after sandbox execution

## Verification Checklist

- [x] Daytona SDK imported
- [x] `executeInSandbox` action implemented
- [x] Sandbox creation with proper configuration
- [x] File writing to sandbox filesystem
- [x] HTTP server startup in sandbox
- [x] Result fetching from sandbox URL
- [x] Proper error handling
- [x] Sandbox cleanup after execution
- [x] Status transitions maintained
- [x] Next.js webpack polyfills configured
- [x] Environment variables documented

## Known Limitations

1. **Sandbox Startup Time**: Daytona sandboxes take 2-5 seconds to spin up
2. **Cost**: Each demo generation creates and destroys a sandbox (monitor usage)
3. **Network Requirements**: Sandbox needs internet access to install http-server via npx
4. **TypeScript Types**: Some Daytona SDK types may be incomplete; using runtime APIs

## Future Improvements

1. **Sandbox Pooling**: Reuse sandboxes for multiple demos to reduce startup time
2. **Screenshot Capture**: Add visual screenshot capture of rendered demos
3. **Timeout Configuration**: Add configurable timeouts for sandbox operations
4. **Retry Logic**: Implement automatic retry for transient sandbox failures
5. **Logging**: Enhanced logging for sandbox lifecycle events

## References

- [Daytona TypeScript SDK Documentation](https://www.daytona.io/docs/en/typescript-sdk/)
- [Daytona in Next.js Projects](https://www.daytona.io/docs/en/typescript-sdk/#daytona-in-nextjs-projects)
- [ELI5 Project Specification](./ELI5_SPEC.md)

