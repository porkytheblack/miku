'use client';

import dynamic from 'next/dynamic';
import { isClerkConfigured } from './AuthProvider';

// Dynamically import Clerk components only when configured
const SignInButton = isClerkConfigured
  ? dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignInButton), { ssr: false })
  : null;

const UserButton = isClerkConfigured
  ? dynamic(() => import('@clerk/nextjs').then((mod) => mod.UserButton), { ssr: false })
  : null;

interface ClerkButtonsProps {
  isSignedIn: boolean;
}

// Placeholder icon for when auth is disabled
function AuthPlaceholder({ disabled = false }: { disabled?: boolean }) {
  return (
    <button
      className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
      aria-label={disabled ? "Auth disabled" : "Sign in"}
      title={disabled ? "Authentication not configured" : "Sign in to save notes"}
      disabled={disabled}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)', opacity: disabled ? 0.5 : 1 }}
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </button>
  );
}

/**
 * Renders Clerk auth buttons (UserButton when signed in, SignInButton when not)
 * Only renders when Clerk is configured, otherwise shows a disabled placeholder
 */
export default function ClerkButtons({ isSignedIn }: ClerkButtonsProps) {
  if (!isClerkConfigured) {
    return <AuthPlaceholder disabled />;
  }

  if (isSignedIn && UserButton) {
    return (
      <UserButton
        appearance={{
          elements: {
            avatarBox: 'w-6 h-6',
          },
        }}
      />
    );
  }

  if (!isSignedIn && SignInButton) {
    return (
      <SignInButton mode="modal">
        <AuthPlaceholder />
      </SignInButton>
    );
  }

  // Loading state
  return <AuthPlaceholder disabled />;
}
