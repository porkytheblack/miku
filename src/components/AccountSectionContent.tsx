'use client';

import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';

// Dynamically import SignOutButton
const SignOutButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.SignOutButton),
  { ssr: false }
);

export default function AccountSectionContent() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <section>
        <h3
          className="mb-3"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--weight-medium)',
          }}
        >
          Account
        </h3>
        <div
          className="p-3 rounded-lg animate-pulse"
          style={{
            background: 'var(--bg-tertiary)',
            height: '64px',
          }}
        />
      </section>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = user.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`
    : user.primaryEmailAddress?.emailAddress || 'User';

  return (
    <section>
      <h3
        className="mb-3"
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 'var(--weight-medium)',
        }}
      >
        Account
      </h3>

      <div
        className="p-3 rounded-lg flex items-center gap-3"
        style={{
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {user.imageUrl && (
          <img
            src={user.imageUrl}
            alt={displayName}
            className="w-10 h-10 rounded-full"
          />
        )}
        <div className="flex-1 min-w-0">
          <p
            className="font-medium truncate"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {displayName}
          </p>
          {user.primaryEmailAddress?.emailAddress && (
            <p
              className="truncate"
              style={{
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--text-xs)',
              }}
            >
              {user.primaryEmailAddress.emailAddress}
            </p>
          )}
        </div>
      </div>

      <SignOutButton redirectUrl="/">
        <button
          className="w-full mt-3 py-2 px-3 rounded text-sm font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
          }}
        >
          Sign Out
        </button>
      </SignOutButton>
    </section>
  );
}
