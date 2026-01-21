'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import BlockEditor from "@/components/BlockEditor";
import FloatingBar from "@/components/FloatingBar";
import { useAuth } from '@/components/AuthProvider';

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
      <BlockEditor />
      <FloatingBar />
    </main>
  );
}
