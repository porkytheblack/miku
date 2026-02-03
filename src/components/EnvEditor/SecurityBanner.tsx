'use client';

/**
 * Security banner displayed at the top of the EnvEditor
 * Reminds users that this file type is not processed by AI
 */
export default function SecurityBanner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-2)',
        padding: 'var(--spacing-2) var(--spacing-4)',
        background: 'var(--accent-subtle)',
        borderBottom: '1px solid var(--border-default)',
        color: 'var(--accent-primary)',
        fontSize: 'var(--text-sm)',
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span>
        <strong>Secure file</strong> - This file is not processed by AI and is stored locally only
      </span>
    </div>
  );
}
