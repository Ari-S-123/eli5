import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

/**
 * Middleware to protect routes with WorkOS authentication
 * 
 * Unauthenticated paths:
 * - / (home/landing page)
 * - /sign-in (login)
 * - /sign-up (registration)
 * - /callback (OAuth callback)
 * 
 * All other routes require authentication
 */
export default authkitMiddleware({
  eagerAuth: true,
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: ['/', '/sign-in', '/sign-up', '/callback'],
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
