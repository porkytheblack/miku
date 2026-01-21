'use client';

import dynamic from 'next/dynamic';
import { isClerkConfigured } from './AuthProvider';

// Dynamically import the entire content component when Clerk is configured
const AccountSectionContent = isClerkConfigured
  ? dynamic(() => import('./AccountSectionContent'), { ssr: false })
  : () => null;

// Wrapper that only renders when Clerk is configured
export default function AccountSection() {
  if (!isClerkConfigured) {
    return null;
  }

  return <AccountSectionContent />;
}
