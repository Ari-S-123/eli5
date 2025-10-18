'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';
import { internal } from './_generated/api';
import { Daytona } from '@daytonaio/sdk';

/**
 * Executes generated code in a Daytona sandbox
 * 
 * This action runs in Node.js runtime and:
 * 1. Creates an isolated Daytona sandbox environment
 * 2. Writes the generated HTML to the sandbox
 * 3. Starts an HTTP server to serve the HTML
 * 4. Fetches the rendered HTML
 * 5. Stores the result in Convex storage
 * 6. Cleans up the sandbox
 * 
 * @param args.demoId - ID of the demo to execute
 */
export const executeInSandbox = action({
  args: {
    demoId: v.id('demos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const demo = await ctx.runQuery(internal.demos.getDemoInternal, {
      demoId: args.demoId,
    });

    if (!demo) {
      throw new Error('Demo not found');
    }

    // Initialize Daytona client
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY,
      apiUrl: process.env.DAYTONA_API_URL,
      target: (process.env.DAYTONA_TARGET as 'local' | 'us' | 'eu') ?? 'us',
    });

    try {
      // Create sandbox with Node.js environment
      const sandbox = await daytona.create({
        language: 'typescript',
        envVars: {
          NODE_ENV: 'production',
        },
      });

      console.log(`Created Daytona sandbox: ${sandbox.id}`);

      // Write generated HTML to sandbox by executing a write command
      const writeCommand = `cat > /workspace/demo.html << 'EOFHTML'
${demo.generatedCode}
EOFHTML`;
      await sandbox.process.executeCommand(writeCommand);
      
      console.log('HTML file written to sandbox');

      // Start HTTP server to serve the HTML
      const serverCommand = 'npx -y http-server /workspace -p 8080 --cors -s';
      await sandbox.process.executeCommand(serverCommand);

      console.log('HTTP server started in sandbox');

      // Wait for server to start
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Fetch the rendered HTML from the sandbox
      // Daytona exposes ports via the sandbox URL
      const sandboxUrl = `https://${sandbox.id}-8080.daytona.app`;
      const htmlResponse = await fetch(`${sandboxUrl}/demo.html`);
      
      if (!htmlResponse.ok) {
        throw new Error(`Failed to fetch demo: ${htmlResponse.status} ${htmlResponse.statusText}`);
      }

      const renderedHtml = await htmlResponse.text();

      // Store results in Convex storage
      const fileStorageId = await ctx.storage.store(
        new Blob([renderedHtml], { type: 'text/html' })
      );

      // Update demo with execution results
      await ctx.runMutation(internal.demos.updateDemo, {
        demoId: args.demoId,
        status: 'ready',
        executionResults: {
          sandboxId: sandbox.id,
          outputHtml: renderedHtml,
        },
        demoFileStorageId: fileStorageId,
      });

      console.log(`Demo executed successfully in sandbox: ${sandbox.id}`);

      // Clean up sandbox using the delete method
      await sandbox.delete();
      console.log(`Sandbox ${sandbox.id} cleaned up`);
    } catch (error) {
      console.error('Sandbox execution failed:', error);

      // Update demo status to failed
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

