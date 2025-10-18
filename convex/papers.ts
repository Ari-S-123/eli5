

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
 * Generates a URL for uploading a PDF file to Convex storage
 *
 * @returns Upload URL for the file
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    // Verify user is authenticated
    await getUserFromAuth(ctx);

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Creates a paper record after file upload and triggers content extraction
 *
 * @param args.fileName - Name of the uploaded PDF file
 * @param args.fileStorageId - Storage ID from Convex storage
 * @param args.title - Title of the paper (optional, defaults to filename)
 * @returns Paper ID
 */
export const createPaper = mutation({
  args: {
    fileName: v.string(),
    fileStorageId: v.id('_storage'),
    title: v.optional(v.string()),
  },
  returns: v.id('papers'),
  handler: async (ctx, args) => {
    const userId = await getUserFromAuth(ctx);

    // Create paper record with processing status
    const paperId = await ctx.db.insert('papers', {
      userId,
      title: args.title ?? args.fileName.replace('.pdf', ''),
      fileName: args.fileName,
      fileStorageId: args.fileStorageId,
      status: 'processing' as const,
    });

    // Schedule PDF content extraction
    await ctx.scheduler.runAfter(0, internal.papers.extractPdfContent, {
      paperId,
    });

    return paperId;
  },
});

/**
 * Internal mutation to update paper details
 *
 * @param args.paperId - ID of the paper to update
 * @param args.status - New status
 * @param args.extractedContent - Extracted text content
 * @param args.metadata - Paper metadata (authors, abstract, keywords)
 * @param args.pdfUrl - URL to the PDF file
 */
export const updatePaper = internalMutation({
  args: {
    paperId: v.id('papers'),
    status: v.optional(
      v.union(v.literal('uploading'), v.literal('processing'), v.literal('ready'), v.literal('error')),
    ),
    extractedContent: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        authors: v.optional(v.array(v.string())),
        abstract: v.optional(v.string()),
        keywords: v.optional(v.array(v.string())),
      }),
    ),
    pdfUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {};

    if (args.status !== undefined) updates.status = args.status;
    if (args.extractedContent !== undefined) updates.extractedContent = args.extractedContent;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.pdfUrl !== undefined) updates.pdfUrl = args.pdfUrl;

    await ctx.db.patch(args.paperId, updates);
    return null;
  },
});

/**
 * Extracts content from a PDF using Anthropic's PDF analyzing skill
 * This is an internal action that processes the uploaded PDF
 *
 * @param args.paperId - ID of the paper to process
 */
export const extractPdfContent = action({
  args: {
    paperId: v.id('papers'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Get paper details
      const paper = await ctx.runQuery(internal.papers.getPaperInternal, {
        paperId: args.paperId,
      });

      if (!paper) {
        throw new Error('Paper not found');
      }

      // Get PDF URL from storage
      const pdfUrl = await ctx.storage.getUrl(paper.fileStorageId);

      if (!pdfUrl) {
        throw new Error('PDF file not found in storage');
      }

      // Use Anthropic's Claude with PDF analyzing to extract content
    const result = await generateText({
        model: anthropic('claude-sonnet-4-5-20250929'),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this academic paper PDF and extract the following information in a structured format:
1. Full text content
2. Paper title
3. Authors (comma-separated list)
4. Abstract
5. Key keywords or topics (comma-separated list)

Format your response as JSON with keys: content, title, authors, abstract, keywords`,
              },
              {
                // Fetch the PDF bytes and pass as a file part
                type: 'file',
                mediaType: 'application/pdf',
                data: await (await fetch(pdfUrl)).arrayBuffer(),
              },
            ],
          },
        ],
      maxOutputTokens: 8000,
      });

      // Parse the extracted information
      let extractedData: {
        content?: string;
        title?: string;
        authors?: string;
        abstract?: string;
        keywords?: string;
      } = {};

      try {
        // Try to parse as JSON
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: use the entire text as content
          extractedData = { content: result.text };
        }
      } catch {
        // If JSON parsing fails, use raw text
        extractedData = { content: result.text };
      }

      // Update paper with extracted content
      await ctx.runMutation(internal.papers.updatePaper, {
        paperId: args.paperId,
        status: 'ready',
        extractedContent: extractedData.content ?? result.text,
        pdfUrl,
        metadata: {
          authors: extractedData.authors?.split(',').map((a) => a.trim()),
          abstract: extractedData.abstract,
          keywords: extractedData.keywords?.split(',').map((k) => k.trim()),
        },
      });
    } catch (error) {
      console.error('PDF extraction failed:', error);

      // Update paper status to error
      await ctx.runMutation(internal.papers.updatePaper, {
        paperId: args.paperId,
        status: 'error',
      });
    }

    return null;
  },
});

/**
 * Internal query to get paper details (used by actions)
 */
export const getPaperInternal = query({
  args: {
    paperId: v.id('papers'),
  },
  returns: v.union(
    v.object({
      _id: v.id('papers'),
      _creationTime: v.number(),
      userId: v.id('users'),
      title: v.string(),
      fileName: v.string(),
      fileStorageId: v.id('_storage'),
      pdfUrl: v.optional(v.string()),
      status: v.union(v.literal('uploading'), v.literal('processing'), v.literal('ready'), v.literal('error')),
      extractedContent: v.optional(v.string()),
      metadata: v.optional(
        v.object({
          authors: v.optional(v.array(v.string())),
          abstract: v.optional(v.string()),
          keywords: v.optional(v.array(v.string())),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.paperId);
  },
});

/**
 * Gets a single paper by ID with authentication check
 *
 * @param args.paperId - ID of the paper to retrieve
 * @returns Paper document with URL or null if not found
 */
export const getPaper = query({
  args: {
    paperId: v.id('papers'),
  },
  returns: v.union(
    v.object({
      _id: v.id('papers'),
      _creationTime: v.number(),
      userId: v.id('users'),
      title: v.string(),
      fileName: v.string(),
      fileStorageId: v.id('_storage'),
      pdfUrl: v.union(v.string(), v.null()),
      status: v.union(v.literal('uploading'), v.literal('processing'), v.literal('ready'), v.literal('error')),
      extractedContent: v.optional(v.string()),
      metadata: v.optional(
        v.object({
          authors: v.optional(v.array(v.string())),
          abstract: v.optional(v.string()),
          keywords: v.optional(v.array(v.string())),
        }),
      ),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const userId = await getUserFromAuth(ctx);
    const paper = await ctx.db.get(args.paperId);

    if (!paper || paper.userId !== userId) {
      return null;
    }

    // Get PDF URL if available
    const pdfUrl = paper.fileStorageId ? await ctx.storage.getUrl(paper.fileStorageId) : null;

    return {
      ...paper,
      pdfUrl,
    };
  },
});

/**
 * Lists all papers for the current authenticated user
 *
 * @returns Array of paper documents
 */
export const listUserPapers = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id('papers'),
      _creationTime: v.number(),
      userId: v.id('users'),
      title: v.string(),
      fileName: v.string(),
      fileStorageId: v.id('_storage'),
      pdfUrl: v.union(v.string(), v.null()),
      status: v.union(v.literal('uploading'), v.literal('processing'), v.literal('ready'), v.literal('error')),
      extractedContent: v.optional(v.string()),
      metadata: v.optional(
        v.object({
          authors: v.optional(v.array(v.string())),
          abstract: v.optional(v.string()),
          keywords: v.optional(v.array(v.string())),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getUserFromAuth(ctx);

    const papers = await ctx.db
      .query('papers')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .order('desc')
      .collect();

    // Get URLs for all papers
    const papersWithUrls = await Promise.all(
      papers.map(async (paper) => {
        const pdfUrl = await ctx.storage.getUrl(paper.fileStorageId);
        return {
          ...paper,
          pdfUrl,
        };
      }),
    );

    return papersWithUrls;
  },
});
