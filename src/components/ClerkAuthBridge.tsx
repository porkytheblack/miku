'use client';

import { ReactNode } from 'react';
import { useAuth } from '@clerk/nextjs';
import { AuthContext } from './AuthProvider';

/**
 * Bridge component that connects Clerk's auth state to our AuthContext.
 * This component should ONLY be rendered when ClerkProvider is present.
 * Uses useAuth() which is the recommended hook for checking auth state.
 */
export function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  return (
    <AuthContext.Provider value={{ isSignedIn: !!isSignedIn, isLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}
