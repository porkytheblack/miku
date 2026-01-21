import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import { SettingsProvider } from "@/context/SettingsContext";
import { MikuProvider } from "@/context/MikuContext";
import { NotesProvider } from "@/context/NotesContext";
import { AuthProvider } from "@/components/AuthProvider";
import dynamic from "next/dynamic";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miku — The Editor That Listens",
  description: "A markdown editor with an AI assistant that behaves like a patient, skilled human editor—not a co-writer.",
};

// Check if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Dynamically import Clerk components only when configured
const ClerkProvider = isClerkConfigured
  ? dynamic(() => import("@clerk/nextjs").then((mod) => mod.ClerkProvider), { ssr: true })
  : null;

const ClerkAuthBridge = isClerkConfigured
  ? dynamic(() => import("@/components/ClerkAuthBridge").then((mod) => mod.ClerkAuthBridge), { ssr: true })
  : null;

function Providers({ children }: { children: React.ReactNode }) {
  // AuthProvider must wrap MikuProvider so that MikuContext can access auth state
  const content = (
    <SettingsProvider>
      <AuthProvider>
        <MikuProvider>
          <NotesProvider>
            {children}
          </NotesProvider>
        </MikuProvider>
      </AuthProvider>
    </SettingsProvider>
  );

  // When Clerk is configured, wrap with ClerkAuthBridge to sync auth state
  if (ClerkAuthBridge) {
    return <ClerkAuthBridge>{content}</ClerkAuthBridge>;
  }

  return content;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en" suppressHydrationWarning>
      <body className={`${jetbrainsMono.variable} ${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );

  // Only wrap with ClerkProvider if Clerk is configured
  if (ClerkProvider) {
    return (
      <ClerkProvider
        signInFallbackRedirectUrl="/editor"
        signUpFallbackRedirectUrl="/editor"
      >
        {content}
      </ClerkProvider>
    );
  }

  return content;
}
