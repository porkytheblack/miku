'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import BlockEditor from "@/components/BlockEditor";
import FloatingBar from "@/components/FloatingBar";
import { useAuth, isClerkConfigured } from '@/components/AuthProvider';

// Dynamically import Clerk components
const UserButton = isClerkConfigured
  ? dynamic(() => import('@clerk/nextjs').then((mod) => mod.UserButton), { ssr: false })
  : null;

const SignOutButton = isClerkConfigured
  ? dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignOutButton), { ssr: false })
  : null;

export default function EditorPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users to landing page
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/');
    }
  }, [isLoaded, isSignedIn, router]);

  // Show loading state while checking auth
  if (!isLoaded) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Show redirect message for unauthenticated users
  if (!isSignedIn) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen">
      {/* User menu in top right */}
      {isClerkConfigured && UserButton && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-3 px-3 py-2 rounded-full"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
        >
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-8 h-8',
              },
            }}
          />
          {SignOutButton && (
            <SignOutButton redirectUrl="/">
              <button
                className="px-3 py-1 rounded-full text-xs font-medium transition-all hover:scale-105"
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                }}
              >
                Sign Out
              </button>
            </SignOutButton>
          )}
        </div>
      )}
      <BlockEditor />
      <FloatingBar />
    </main>
  );
}
