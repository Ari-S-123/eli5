import { v } from 'convex/values';
import { mutation, query, QueryCtx, MutationCtx } from './_generated/server';
import { Id } from './_generated/dataModel';

/**
 * Helper function to get authenticated user from context
 * Throws an error if user is not authenticated or not found in database
 *
 * @param ctx - Query or mutation context
 * @returns User ID from the database
 * @throws Error if user is not authenticated or not found in database
 */
export async function getUserFromAuth(ctx: QueryCtx | MutationCtx): Promise<Id<'users'>> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error('Not authenticated');
  }

  const user = await ctx.db
    .query('users')
    .withIndex('by_workosId', (q) => q.eq('workosId', identity.subject))
    .unique();

  if (!user) {
    throw new Error('User not found in database. Please ensure the user is created via ensureUser mutation first.');
  }

  return user._id;
}

/**
 * Ensures a user exists in the database, creating one if necessary
 * This mutation is called automatically when a user signs in
 *
 * @returns The user ID
 */
export const ensureUser = mutation({
  args: {},
  returns: v.id('users'),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_workosId', (q) => q.eq('workosId', identity.subject))
      .unique();

    if (existingUser) {
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert('users', {
      workosId: identity.subject,
      email: identity.email ?? '',
      name: identity.name ?? 'Unknown User',
      // Ensure `organizationId` is a string when present; otherwise leave undefined
      organizationId:
        typeof identity.organizationId === 'string'
          ? identity.organizationId
          : undefined,
    });

    return userId;
  },
});

/**
 * Gets the current authenticated user's information
 *
 * @returns User document or null if not authenticated
 */
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id('users'),
      _creationTime: v.number(),
      workosId: v.string(),
      email: v.string(),
      name: v.string(),
      organizationId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query('users')
      .withIndex('by_workosId', (q) => q.eq('workosId', identity.subject))
      .unique();

    return user;
  },
});
