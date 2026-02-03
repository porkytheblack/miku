/**
 * ScreenshotFrame Component
 *
 * A framed screenshot display with optional rotation, shadows, and depth effects.
 * Used in both the hero section (overlapping arrangement) and feature sections.
 * The screenshots already include the app's window chrome, so we just add a card frame.
 */

import Image from "next/image";

interface ScreenshotFrameProps {
  src: string;
  alt: string;
  rotation?: number;
  elevated?: boolean;
  className?: string;
  priority?: boolean;
}

export function ScreenshotFrame({
  src,
  alt,
  rotation = 0,
  elevated = false,
  className = "",
  priority = false,
}: ScreenshotFrameProps) {
  const rotationStyle = rotation !== 0 ? `rotate(${rotation}deg)` : undefined;

  return (
    <div
      className={`
        relative
        rounded-xl
        overflow-hidden
        border border-border-default
        ${elevated ? "shadow-2xl shadow-black/40" : "shadow-xl shadow-black/30"}
        ${className}
      `}
      style={{
        transform: rotationStyle,
      }}
    >
      {/* Screenshot image - already includes window chrome */}
      <Image
        src={src}
        alt={alt}
        width={800}
        height={500}
        className="w-full h-auto"
        priority={priority}
      />
    </div>
  );
}
