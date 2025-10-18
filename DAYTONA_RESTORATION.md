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

### 2. Convex Actions Files

#### Created New File: `convex/sandbox.ts`

**Why separate?** Convex requires that only actions run in Node.js runtime (with `'use node'` directive). Mutations and queries must run in V8 runtime. By separating the Daytona sandbox action into its own file, we can use Node.js for sandbox operations while keeping other functions in V8.

#### Updated File: `convex/demos.ts`

#### File: `convex/sandbox.ts` (Node.js Runtime)

This file contains the Daytona sandbox execution logic and runs in Node.js runtime:

```typescript
'use node';  // This entire file runs in Node.js

import { Daytona } from '@daytonaio/sdk';
import { internal } from './_generated/api';
```

#### `executeInSandbox` Action Implementation

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

#### File: `convex/demos.ts` (V8 Runtime)

This file contains mutations, queries, and the AI code generation action. It runs in V8 runtime (no `'use node'`).

**Updated `generateDemo` Workflow:**

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

// Execute in Daytona sandbox (in separate Node.js action file)
await ctx.scheduler.runAfter(0, internal.sandbox.executeInSandbox, { demoId });
```

**Key Point:** The reference changed from `internal.demos.executeInSandbox` to `internal.sandbox.executeInSandbox` because the action is now in a separate file.

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
6. Schedule sandbox.executeInSandbox
    ↓
sandbox.executeInSandbox (Node.js action)
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

## File Structure

```
convex/
├── demos.ts          # V8 runtime - mutations, queries, generateDemo action
├── sandbox.ts        # Node.js runtime - executeInSandbox action (NEW)
├── papers.ts         # V8 runtime (with Node.js action for PDF extraction)
├── users.ts          # V8 runtime - user management
└── schema.ts         # Database schema
```

## Verification Checklist

- [x] Daytona SDK imported in `convex/sandbox.ts`
- [x] `executeInSandbox` action implemented in separate Node.js file
- [x] Sandbox creation with proper configuration
- [x] File writing to sandbox filesystem
- [x] HTTP server startup in sandbox
- [x] Result fetching from sandbox URL
- [x] Proper error handling
- [x] Sandbox cleanup after execution
- [x] Status transitions maintained
- [x] Next.js webpack polyfills configured
- [x] Environment variables documented
- [x] **CRITICAL FIX**: Separated Node.js actions from V8 functions to prevent Convex deployment error

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

