/**
 * LabelBadge Component
 *
 * A small pill-shaped label used above feature section headlines.
 * Provides visual categorization with a subtle accent background.
 */

interface LabelBadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function LabelBadge({ children, className = "" }: LabelBadgeProps) {
  return (
    <span
      className={`
        inline-block
        px-3 py-1
        text-xs font-semibold uppercase tracking-wider
        text-accent-primary
        bg-accent-subtle
        border border-accent-primary/20
        rounded-full
        ${className}
      `}
    >
      {children}
    </span>
  );
}
