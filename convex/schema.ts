import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Database schema for ELI5 Academic Paper Visual Demo Generator
 *
 * This schema defines three main entities:
 * - users: User accounts provisioned from WorkOS authentication
 * - papers: Academic PDFs uploaded by users with extracted content
 * - demos: Interactive visual demonstrations generated from papers
 */
export default defineSchema({
  /**
   * Users table - stores user information from WorkOS authentication
   */
  users: defineTable({
    workosId: v.string(),
    email: v.string(),
    name: v.string(),
    organizationId: v.optional(v.string()),
  }).index('by_workosId', ['workosId']),

  /**
   * Papers table - stores uploaded academic PDFs and their extracted content
   */
  papers: defineTable({
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
  }).index('by_userId', ['userId']),

  /**
   * Demos table - stores generated visual demonstrations for papers
   */
  demos: defineTable({
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
  })
    .index('by_paperId', ['paperId'])
    .index('by_userId', ['userId']),

  /**
   * Numbers table - used by sample functions in `convex/myFunctions.ts`
   * to demonstrate basic querying and mutations. This enables the
   * existing example code to type-check and run.
   */
  numbers: defineTable({
    value: v.number(),
  }),
});
