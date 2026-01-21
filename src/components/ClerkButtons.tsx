'use client';

import dynamic from 'next/dynamic';
import { isClerkConfigured } from './AuthProvider';

// Dynamically import Clerk components only when configured
const SignInButton = isClerkConfigured
  ? dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignInButton), { ssr: false })
  : null;

const SignOutButton = isClerkConfigured
  ? dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignOutButton), { ssr: false })
  : null;

interface ClerkButtonsProps {
  isSignedIn: boolean;
}

// User icon for sign-in state
function UserIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text-secondary)' }}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

// Sign out icon (door with arrow)
function SignOutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: 'var(--text-secondary)' }}
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
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
 * Renders Clerk auth buttons (Sign out icon when signed in, Sign in icon when not)
 * Only renders when Clerk is configured, otherwise shows a disabled placeholder
 */
export default function ClerkButtons({ isSignedIn }: ClerkButtonsProps) {
  if (!isClerkConfigured) {
    return <AuthPlaceholder disabled />;
  }

  if (isSignedIn && SignOutButton) {
    return (
      <SignOutButton redirectUrl="/">
        <button
          className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
          aria-label="Sign out"
          title="Sign out"
        >
          <SignOutIcon />
        </button>
      </SignOutButton>
    );
  }

  if (!isSignedIn && SignInButton) {
    return (
      <SignInButton mode="modal">
        <button
          className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
          aria-label="Sign in"
          title="Sign in to save notes"
        >
          <UserIcon />
        </button>
      </SignInButton>
    );
  }

  // Loading state
  return <AuthPlaceholder disabled />;
}
