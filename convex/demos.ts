

import { v } from 'convex/values';
import { mutation, query, action, internalMutation } from './_generated/server';
import { getUserFromAuth } from './users';
import { api, internal as internalApi } from './_generated/api';
import { Id } from './_generated/dataModel';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';

// Temporary any-typed alias to avoid type errors before Convex generates
// the full API surface including this module.
const internal: any = internalApi;

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
    const userId: Id<'users'> = await ctx.runQuery(api.users.getCurrentUser, {}).then((user) => {
      if (!user) throw new Error('Not authenticated');
      return user._id;
    });

    // Get paper content
    const paper = await ctx.runQuery(api.papers.getPaperInternal, {
      paperId: args.paperId,
    });

    if (!paper) {
      throw new Error('Paper not found');
    }

    if (paper.userId !== userId) {
      throw new Error('Unauthorized');
    }

    // Create demo record
    const demoId: Id<'demos'> = await ctx.runMutation(internalApi.demos.createDemo, {
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
        model: anthropic('claude-sonnet-4-5-20250929'),
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
        maxOutputTokens: 8000,
      });

      // Extract HTML code (remove any markdown formatting if present)
      let htmlCode = result.text.trim();

      // Remove markdown code blocks if present
      if (htmlCode.startsWith('```')) {
        htmlCode = htmlCode.replace(/```html\n?/g, '').replace(/```\n?/g, '');
      }

      // Update demo with generated code and schedule sandbox execution
      await ctx.runMutation(internalApi.demos.updateDemo, {
        demoId,
        status: 'executing',
        generatedCode: htmlCode,
      });

      // Execute in Daytona sandbox (in separate Node.js action)
      await ctx.scheduler.runAfter(0, internal.sandbox.executeInSandbox, { demoId });
    } catch (error) {
      console.error('Demo generation failed:', error);

      await ctx.runMutation(internalApi.demos.updateDemo, {
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
    status: v.union(v.literal('generating'), v.literal('executing'), v.literal('ready'), v.literal('failed')),
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
      v.union(v.literal('generating'), v.literal('executing'), v.literal('ready'), v.literal('failed')),
    ),
    generatedCode: v.optional(v.string()),
    executionResults: v.optional(
      v.object({
        sandboxId: v.string(),
        outputHtml: v.optional(v.string()),
        screenshot: v.optional(v.string()),
        logs: v.optional(v.array(v.string())),
        errors: v.optional(v.array(v.string())),
      }),
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
 * Internal query to get demo details (used by sandbox execution action)
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
      status: v.union(v.literal('generating'), v.literal('executing'), v.literal('ready'), v.literal('failed')),
      generatedCode: v.string(),
      codeType: v.union(v.literal('html'), v.literal('react')),
      executionResults: v.optional(
        v.object({
          sandboxId: v.string(),
          outputHtml: v.optional(v.string()),
          screenshot: v.optional(v.string()),
          logs: v.optional(v.array(v.string())),
          errors: v.optional(v.array(v.string())),
        }),
      ),
      demoFileStorageId: v.optional(v.id('_storage')),
    }),
    v.null(),
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
      status: v.union(v.literal('generating'), v.literal('executing'), v.literal('ready'), v.literal('failed')),
      generatedCode: v.string(),
      codeType: v.union(v.literal('html'), v.literal('react')),
      executionResults: v.optional(
        v.object({
          sandboxId: v.string(),
          outputHtml: v.optional(v.string()),
          screenshot: v.optional(v.string()),
          logs: v.optional(v.array(v.string())),
          errors: v.optional(v.array(v.string())),
        }),
      ),
      demoFileStorageId: v.optional(v.id('_storage')),
      demoUrl: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getUserFromAuth(ctx);
    const demo = await ctx.db.get(args.demoId);

    if (!demo || demo.userId !== userId) {
      return null;
    }

    // Get demo URL if available
    const demoUrl = demo.demoFileStorageId ? await ctx.storage.getUrl(demo.demoFileStorageId) : null;

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
      status: v.union(v.literal('generating'), v.literal('executing'), v.literal('ready'), v.literal('failed')),
      generatedCode: v.string(),
      codeType: v.union(v.literal('html'), v.literal('react')),
      executionResults: v.optional(
        v.object({
          sandboxId: v.string(),
          outputHtml: v.optional(v.string()),
          screenshot: v.optional(v.string()),
          logs: v.optional(v.array(v.string())),
          errors: v.optional(v.array(v.string())),
        }),
      ),
      demoFileStorageId: v.optional(v.id('_storage')),
      demoUrl: v.union(v.string(), v.null()),
    }),
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
          const demoUrl = demo.demoFileStorageId ? await ctx.storage.getUrl(demo.demoFileStorageId) : null;
          return {
            ...demo,
            demoUrl,
          };
        }),
    );

    return demosWithUrls;
  },
});
