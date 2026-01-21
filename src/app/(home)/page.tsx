'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth, isClerkConfigured } from '@/components/AuthProvider';

// Dynamically import Clerk components
const SignInButton = isClerkConfigured
  ? dynamic(() => import('@clerk/nextjs').then((mod) => mod.SignInButton), { ssr: false })
  : null;

// Floating highlight that appears and fades
function FloatingHighlight({ color, delay, children }: { color: string; delay: number; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimeout = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(showTimeout);
  }, [delay]);

  return (
    <span
      className="relative inline transition-all duration-700"
      style={{
        backgroundColor: visible ? color : 'transparent',
        borderRadius: '2px',
        padding: '0 2px',
      }}
    >
      {children}
    </span>
  );
}

export default function HomePage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [showHighlights, setShowHighlights] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);

  // Redirect signed-in users to editor
  useEffect(() => {
    if (isSignedIn) {
      router.push('/editor');
    }
  }, [isSignedIn, router]);

  useEffect(() => {
    // Start showing highlights after a delay
    const highlightTimer = setTimeout(() => setShowHighlights(true), 3000);

    // Subtle cursor follow effect
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPosition({ x: e.clientX, y: e.clientY });
      setShowCursor(true);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      clearTimeout(highlightTimer);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Show loading state while redirecting signed-in users
  if (isSignedIn) {
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
          <p style={{ color: 'var(--text-secondary)' }}>Opening editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Subtle gradient orb that follows cursor */}
      {showCursor && (
        <div
          className="pointer-events-none fixed w-96 h-96 rounded-full opacity-20 blur-3xl transition-all duration-1000 ease-out"
          style={{
            background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)',
            left: cursorPosition.x - 192,
            top: cursorPosition.y - 192,
          }}
        />
      )}

      {/* Floating Header Bar */}
      <header className="w-full p-6 flex justify-center">
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-full"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          }}
        >
          {isClerkConfigured && SignInButton ? (
            <SignInButton mode="modal">
              <button
                className="px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                }}
              >
                Sign In to Start
              </button>
            </SignInButton>
          ) : (
            <span
              className="px-4 py-2 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Sign-in not configured
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* Hero section */}
        <div className="max-w-2xl text-center space-y-8">
          {/* Main title with animation */}
          <h1
            className="text-5xl md:text-6xl font-semibold tracking-tight"
            style={{ lineHeight: 1.1 }}
          >
            The Editor That{' '}
            <span
              className="relative inline-block"
              style={{ color: 'var(--accent-primary)' }}
            >
              Listens
              {/* Animated underline */}
              <svg
                className="absolute -bottom-2 left-0 w-full animate-draw"
                height="8"
                viewBox="0 0 200 8"
                fill="none"
              >
                <path
                  d="M1 5.5C40 2 60 7 100 4C140 1 160 6 199 3.5"
                  stroke="var(--accent-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="animate-draw-path"
                />
              </svg>
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-xl md:text-2xl"
            style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
          >
            A markdown editor with an AI assistant that behaves like a patient, skilled human editor—
            <span className="italic">not a co-writer</span>.
          </p>

          {/* Animated demo text */}
          <div
            className="mt-12 p-8 rounded-xl text-left"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-default)',
            }}
          >
            <div
              className="font-mono text-base leading-relaxed"
              style={{ color: 'var(--text-primary)' }}
            >
              <p className="mb-4">
                You open Miku. A blank page. You{' '}
                <FloatingHighlight color={showHighlights ? 'var(--highlight-clarity)' : 'transparent'} delay={3500}>
                  write
                </FloatingHighlight>
                .
              </p>
              <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
                Minutes pass. Pages fill.{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>Miku says nothing.</span>
              </p>
              <p className="mb-4">
                You finish a section. You lean back.{' '}
                <FloatingHighlight color={showHighlights ? 'var(--highlight-style)' : 'transparent'} delay={4000}>
                  Miku quietly analyzes
                </FloatingHighlight>
                .
              </p>
              <p style={{ color: 'var(--text-secondary)' }}>
                Soft highlights appear—
                <FloatingHighlight color={showHighlights ? 'var(--highlight-clarity)' : 'transparent'} delay={4500}>
                  a yellow phrase here
                </FloatingHighlight>
                ,{' '}
                <FloatingHighlight color={showHighlights ? 'var(--highlight-style)' : 'transparent'} delay={5000}>
                  a blue sentence there
                </FloatingHighlight>
                .
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-4 justify-center items-center mt-8">
            {isClerkConfigured && SignInButton ? (
              <SignInButton mode="modal">
                <button
                  className="px-8 py-4 rounded-lg text-lg font-medium transition-all hover:scale-105 hover:shadow-lg"
                  style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                  }}
                >
                  Get Started — Sign In
                </button>
              </SignInButton>
            ) : (
              <p style={{ color: 'var(--text-tertiary)' }}>
                Authentication is required to use Miku
              </p>
            )}
            <span
              className="text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Create a free account to start writing
            </span>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
          <FeatureCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            }
            title="Silent While You Write"
            description="No autocomplete. No interruptions. Just you and your thoughts."
          />
          <FeatureCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            }
            title="Observes, Never Rewrites"
            description="Miku highlights areas worth revisiting. Your text stays untouched."
          />
          <FeatureCard
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            title="You Remain the Author"
            description="Suggestions are references, not commands. Every decision is yours."
          />
        </div>
      </main>

      {/* Footer */}
      <footer
        className="py-6 text-center text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <p>Your words first. Always.</p>
      </footer>

      {/* Animations */}
      <style jsx>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        .animate-blink {
          animation: blink 1s infinite;
        }

        @keyframes draw {
          from {
            stroke-dashoffset: 300;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        .animate-draw-path {
          stroke-dasharray: 300;
          stroke-dashoffset: 300;
          animation: draw 1.5s ease-out 0.5s forwards;
        }
      `}</style>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div
      className="p-6 rounded-xl transition-all hover:scale-[1.02]"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
        style={{
          background: 'var(--bg-tertiary)',
          color: 'var(--accent-primary)',
        }}
      >
        {icon}
      </div>
      <h3
        className="font-medium mb-2"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm"
        style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
      >
        {description}
      </p>
    </div>
  );
}
