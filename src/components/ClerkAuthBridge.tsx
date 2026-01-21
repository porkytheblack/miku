'use client';

import { ReactNode } from 'react';
import { useUser } from '@clerk/nextjs';
import { AuthContext } from './AuthProvider';

/**
 * Bridge component that connects Clerk's auth state to our AuthContext.
 * This component should ONLY be rendered when ClerkProvider is present.
 */
export function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();

  return (
    <AuthContext.Provider value={{ isSignedIn: !!isSignedIn, isLoaded }}>
      {children}
    </AuthContext.Provider>
  );
}
