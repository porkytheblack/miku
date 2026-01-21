'use client';

import { ReactNode, createContext, useContext } from 'react';

// Auth context type
interface AuthContextType {
  isSignedIn: boolean;
  isLoaded: boolean;
}

// Default context value when Clerk is not available
const defaultAuthContext: AuthContextType = {
  isSignedIn: false,
  isLoaded: true,
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Check if Clerk is configured
export const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Auth provider that provides a default context.
 * When Clerk is configured, ClerkAuthBridge inside layout.tsx will update this.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={defaultAuthContext}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth state - safe to use whether or not Clerk is configured
 */
export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

// Export the context for ClerkAuthBridge to use
export { AuthContext };
export type { AuthContextType };
