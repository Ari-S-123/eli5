'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { ConvexReactClient, useConvexAuth, useMutation } from 'convex/react';
import { ConvexProviderWithAuth } from 'convex/react';
import { AuthKitProvider, useAuth, useAccessToken } from '@workos-inc/authkit-nextjs/components';
import { api } from '@/convex/_generated/api';

/**
 * Provides Convex client and authentication context to the React tree.
 * Also ensures the authenticated user exists in the Convex database
 * to prevent race conditions where queries run before user provisioning.
 */
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [convex] = useState(() => {
    return new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  });
  return (
    <AuthKitProvider>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromAuthKit}>
        <EnsureUserOnAuth />
        {children}
      </ConvexProviderWithAuth>
    </AuthKitProvider>
  );
}

function useAuthFromAuthKit() {
  const { user, loading: isLoading } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const isAuthenticated = !!user;

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken?: boolean } = {}): Promise<string | null> => {
      if (!user) {
        return null;
      }

      try {
        if (forceRefreshToken) {
          return (await refresh()) ?? null;
        }

        return (await getAccessToken()) ?? null;
      } catch (error) {
        console.error('Failed to get access token:', error);
        return null;
      }
    },
    [user, refresh, getAccessToken],
  );

  return {
    isLoading,
    isAuthenticated,
    fetchAccessToken,
  };
}

/**
 * Ensures a corresponding `users` document exists for the authenticated identity.
 * Runs once per app mount after auth is ready; idempotent on the server.
 */
function EnsureUserOnAuth() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const hasEnsuredRef = useRef(false);

  useEffect(() => {
    if (hasEnsuredRef.current) return;
    if (isLoading) return;
    if (!isAuthenticated) return;

    (async () => {
      try {
        await ensureUser({});
      } catch (error) {
        // This should never block the UI; log for observability
        console.error('Failed to ensure user in Convex:', error);
      } finally {
        hasEnsuredRef.current = true;
      }
    })();
  }, [isLoading, isAuthenticated, ensureUser]);

  return null;
}
