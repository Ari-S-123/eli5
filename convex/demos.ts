"use node";

import { v } from 'convex/values';
import { mutation, query, action, internalMutation } from './_generated/server';
import { getUserFromAuth } from './users';
import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { Daytona } from '@daytonaio/sdk';

/**
 * Generates an interactive visual demo from a paper concept
 * 
 * @param args.paperId - ID of the paper to generate demo from
 * @param args.concept - Description of the concept to demonstrate
 * @returns Demo ID
 */
export const generateDemo = action({
  args: {
    paperId: v.id('papers'),
    concept: v.string(),
  },
  returns: v.id('demos'),
  handler: async (ctx, args) => {
    const userId: Id<'users'> = await ctx.runQuery(api.users.getCurrentUser, {}).then(
      (user) => {
        if (!user) throw new Error('Not authenticated');
        return user._id;
      }
    );

    // Get paper content
    const paper = await ctx.runQuery(internal.papers.getPaperInternal, {
      paperId: args.paperId,
    });

    if (!paper) {
      throw new Error('Paper not found');
    }

    if (paper.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Create demo record
    const demoId: Id<'demos'> = await ctx.runMutation(internal.demos.createDemo, {
      paperId: args.paperId,
      userId,
      concept: args.concept,
      status: 'generating',
      generatedCode: '',
      codeType: 'html',
    });

    try {
      // Generate code using Anthropic Claude
      const result = await generateText({
        model: anthropic('claude-sonnet-4-20250514'),
        messages: [
          {
            role: 'user',
            content: `You are an expert at creating interactive visual demonstrations of academic concepts.

Paper Title: ${paper.title}
Paper Content: ${paper.extractedContent ?? 'No content available'}

Concept to Demonstrate: ${args.concept}

Generate a complete, self-contained HTML file that visually demonstrates this concept. Requirements:
1. Include ALL CSS inline in a <style> tag (no external stylesheets)
2. Include ALL JavaScript inline in a <script> tag (no external dependencies)
3. Make it interactive and animated where appropriate
4. Use modern HTML5, CSS3, and vanilla JavaScript
5. Work without any external dependencies or CDN links
6. Be responsive and mobile-friendly
7. Keep total size under 100KB
8. Use clear visual design with smooth animations
9. Add explanatory text to help understand the concept

Return ONLY the complete HTML code, no markdown formatting, no explanations, just pure HTML starting with <!DOCTYPE html>.`,
          },
        ],
        maxTokens: 8000,
      });

      // Extract HTML code (remove any markdown formatting if present)
      let htmlCode = result.text.trim();
      
      // Remove markdown code blocks if present
      if (htmlCode.startsWith('```')) {
        htmlCode = htmlCode.replace(/```html\n?/g, '').replace(/```\n?/g, '');
      }

      // Update demo with generated code
      await ctx.runMutation(internal.demos.updateDemo, {
        demoId,
        status: 'executing',
        generatedCode: htmlCode,
      });

      // Schedule sandbox execution
      await ctx.scheduler.runAfter(0, internal.demos.executeInSandbox, {
        demoId,
      });
    } catch (error) {
      console.error('Demo generation failed:', error);
      
      await ctx.runMutation(internal.demos.updateDemo, {
        demoId,
        status: 'failed',
        executionResults: {
          sandboxId: '',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      });
    }

    return demoId;
  },
});

/**
 * Internal mutation to create a demo record
 */
export const createDemo = internalMutation({
  args: {
    paperId: v.id('papers'),
    userId: v.id('users'),
    concept: v.string(),
    status: v.union(
      v.literal('generating'),
      v.literal('executing'),
      v.literal('ready'),
      v.literal('failed')
    ),
    generatedCode: v.string(),
    codeType: v.union(v.literal('html'), v.literal('react')),
  },
  returns: v.id('demos'),
  handler: async (ctx, args) => {
    return await ctx.db.insert('demos', {
      paperId: args.paperId,
      userId: args.userId,
      concept: args.concept,
      status: args.status,
      generatedCode: args.generatedCode,
      codeType: args.codeType,
    });
  },
});

/**
 * Internal mutation to update demo details
 */
export const updateDemo = internalMutation({
  args: {
    demoId: v.id('demos'),
    status: v.optional(
      v.union(
        v.literal('generating'),
        v.literal('executing'),
        v.literal('ready'),
        v.literal('failed')
      )
    ),
    generatedCode: v.optional(v.string()),
    executionResults: v.optional(
      v.object({
        sandboxId: v.string(),
        outputHtml: v.optional(v.string()),
        screenshot: v.optional(v.string()),
        logs: v.optional(v.array(v.string())),
        errors: v.optional(v.array(v.string())),
      })
    ),
    demoFileStorageId: v.optional(v.id('_storage')),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};

    if (args.status !== undefined) updates.status = args.status;
    if (args.generatedCode !== undefined) updates.generatedCode = args.generatedCode;
    if (args.executionResults !== undefined) updates.executionResults = args.executionResults;
    if (args.demoFileStorageId !== undefined) updates.demoFileStorageId = args.demoFileStorageId;

    await ctx.db.patch(args.demoId, updates);
    return null;
  },
});

/**
 * Executes generated code in a Daytona sandbox
 * 
 * @param args.demoId - ID of the demo to execute
 */
export const executeInSandbox = action({
  args: {
    demoId: v.id('demos'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Get demo details
      const demo = await ctx.runQuery(internal.demos.getDemoInternal, {
        demoId: args.demoId,
      });

      if (!demo) {
        throw new Error('Demo not found');
      }

      // Initialize Daytona client
      const daytona = new Daytona({
        apiKey: process.env.DAYTONA_API_KEY!,
        apiUrl: process.env.DAYTONA_API_URL ?? 'https://api.daytona.io',
        target: (process.env.DAYTONA_TARGET as 'local' | 'us' | 'eu') ?? 'us',
      });

      // Create sandbox
      const workspace = await daytona.create({
        project: {
          name: `demo-${args.demoId}`,
          repository: {
            url: 'https://github.com/daytonaio/sample-blank-node',
          },
        },
      });

      const sandboxId = workspace.id;

      try {
        // Write HTML file to sandbox
        await workspace.writeFile({
          path: 'demo.html',
          content: demo.generatedCode,
        });

        // Start HTTP server
        await workspace.executeCommand({
          command: 'npx -y http-server -p 8080 --cors',
          background: true,
        });

        // Wait for server to start
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Fetch the rendered HTML
        const workspaceUrl = workspace.url;
        const demoUrl = `${workspaceUrl}:8080/demo.html`;
        
        const response = await fetch(demoUrl);
        const renderedHtml = await response.text();

        // Store the HTML in Convex storage
        const blob = new Blob([renderedHtml], { type: 'text/html' });
        const storageId = await ctx.storage.store(blob);

        // Update demo with results
        await ctx.runMutation(internal.demos.updateDemo, {
          demoId: args.demoId,
          status: 'ready',
          executionResults: {
            sandboxId,
            outputHtml: renderedHtml,
          },
          demoFileStorageId: storageId,
        });

        // Clean up sandbox
        await daytona.remove({ workspaceId: workspace.id });
      } catch (error) {
        // Clean up sandbox on error
        try {
          await daytona.remove({ workspaceId: workspace.id });
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    } catch (error) {
      console.error('Sandbox execution failed:', error);

      await ctx.runMutation(internal.demos.updateDemo, {
        demoId: args.demoId,
        status: 'failed',
        executionResults: {
          sandboxId: '',
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        },
      });
    }

    return null;
  },
});

/**
 * Internal query to get demo details
 */
export const getDemoInternal = query({
  args: {
    demoId: v.id('demos'),
  },
  returns: v.union(
    v.object({
      _id: v.id('demos'),
      _creationTime: v.number(),
      paperId: v.id('papers'),
      userId: v.id('users'),
      concept: v.string(),
      status: v.union(
        v.literal('generating'),
        v.literal('executing'),
        v.literal('ready'),
        v.literal('failed')
      ),
      generatedCode: v.string(),
      codeType: v.union(v.literal('html'), v.literal('react')),
      executionResults: v.optional(
        v.object({
          sandboxId: v.string(),
          outputHtml: v.optional(v.string()),
          screenshot: v.optional(v.string()),
          logs: v.optional(v.array(v.string())),
          errors: v.optional(v.array(v.string())),
        })
      ),
      demoFileStorageId: v.optional(v.id('_storage')),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.demoId);
  },
});

/**
 * Gets a demo by ID with URL
 * 
 * @param args.demoId - ID of the demo to retrieve
 * @returns Demo document with URL or null if not found
 */
export const getDemo = query({
  args: {
    demoId: v.id('demos'),
  },
  returns: v.union(
    v.object({
      _id: v.id('demos'),
      _creationTime: v.number(),
      paperId: v.id('papers'),
      userId: v.id('users'),
      concept: v.string(),
      status: v.union(
        v.literal('generating'),
        v.literal('executing'),
        v.literal('ready'),
        v.literal('failed')
      ),
      generatedCode: v.string(),
      codeType: v.union(v.literal('html'), v.literal('react')),
      executionResults: v.optional(
        v.object({
          sandboxId: v.string(),
          outputHtml: v.optional(v.string()),
          screenshot: v.optional(v.string()),
          logs: v.optional(v.array(v.string())),
          errors: v.optional(v.array(v.string())),
        })
      ),
      demoFileStorageId: v.optional(v.id('_storage')),
      demoUrl: v.union(v.string(), v.null()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getUserFromAuth(ctx);
    const demo = await ctx.db.get(args.demoId);

    if (!demo || demo.userId !== userId) {
      return null;
    }

    // Get demo URL if available
    const demoUrl = demo.demoFileStorageId
      ? await ctx.storage.getUrl(demo.demoFileStorageId)
      : null;

    return {
      ...demo,
      demoUrl,
    };
  },
});

/**
 * Lists all demos for a specific paper
 * 
 * @param args.paperId - ID of the paper
 * @returns Array of demo documents
 */
export const listPaperDemos = query({
  args: {
    paperId: v.id('papers'),
  },
  returns: v.array(
    v.object({
      _id: v.id('demos'),
      _creationTime: v.number(),
      paperId: v.id('papers'),
      userId: v.id('users'),
      concept: v.string(),
      status: v.union(
        v.literal('generating'),
        v.literal('executing'),
        v.literal('ready'),
        v.literal('failed')
      ),
      generatedCode: v.string(),
      codeType: v.union(v.literal('html'), v.literal('react')),
      executionResults: v.optional(
        v.object({
          sandboxId: v.string(),
          outputHtml: v.optional(v.string()),
          screenshot: v.optional(v.string()),
          logs: v.optional(v.array(v.string())),
          errors: v.optional(v.array(v.string())),
        })
      ),
      demoFileStorageId: v.optional(v.id('_storage')),
      demoUrl: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getUserFromAuth(ctx);

    const demos = await ctx.db
      .query('demos')
      .withIndex('by_paperId', (q) => q.eq('paperId', args.paperId))
      .order('desc')
      .collect();

    // Filter to only user's demos and get URLs
    const demosWithUrls = await Promise.all(
      demos
        .filter((demo) => demo.userId === userId)
        .map(async (demo) => {
          const demoUrl = demo.demoFileStorageId
            ? await ctx.storage.getUrl(demo.demoFileStorageId)
            : null;
          return {
            ...demo,
            demoUrl,
          };
        })
    );

    return demosWithUrls;
  },
});

