"use client";

/**
 * HeroSection Component
 *
 * Main hero area with headline, subheadline, CTAs, and overlapping screenshots.
 * Features three screenshots in a stacked arrangement:
 * - Back-left: Kanban board (rotated -3deg)
 * - Back-right: Env variables (rotated 2deg)
 * - Front-center: Markdown editor (elevated, no rotation)
 */

import Image from "next/image";
import { DownloadIcon, GitHubIcon } from "./Icons";
import { GITHUB_REPO, GITHUB_RELEASES } from "@/config/downloads";

interface HeroSectionProps {
  className?: string;
  onDownloadClick?: () => void;
}

export function HeroSection({
  className = "",
  onDownloadClick,
}: HeroSectionProps) {
  const handleDownloadClick = (e: React.MouseEvent) => {
    if (onDownloadClick) {
      e.preventDefault();
      onDownloadClick();
    }
  };

  return (
    <section className={`pt-28 md:pt-36 pb-8 px-6 overflow-hidden ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Text Content */}
        <div className="text-center mb-16 md:mb-20">
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 animate-fade-in leading-[1.1]">
            Center your{" "}
            <span className="italic font-serif text-accent-primary">
              workflows
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl lg:text-2xl text-text-secondary max-w-3xl mx-auto mb-10 leading-relaxed animate-fade-in animation-delay-100">
            Miku is a central hub for a developer&apos;s many complex workflows.
            Write docs, manage tasks, configure environments, and let AI assist
            without overwriting your voice.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in animation-delay-200">
            <a
              href={GITHUB_RELEASES}
              onClick={handleDownloadClick}
              className="
                flex items-center gap-2.5
                px-7 py-3.5
                rounded-lg
                bg-accent-primary text-bg-primary
                font-semibold text-base
                hover:opacity-90
                transition-all
                hover:scale-[1.02]
                active:scale-[0.98]
                shadow-lg shadow-accent-primary/25
                download-btn
              "
            >
              <DownloadIcon className="w-5 h-5" />
              Download for free
            </a>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="
                flex items-center gap-2.5
                px-7 py-3.5
                rounded-lg
                bg-bg-secondary
                border border-border-default
                text-text-primary
                font-semibold text-base
                hover:border-border-focus
                hover:bg-bg-tertiary/50
                transition-all
              "
            >
              <GitHubIcon className="w-5 h-5" />
              View on GitHub
            </a>
          </div>
        </div>

        {/* Overlapping Screenshots */}
        <div className="relative max-w-5xl mx-auto">
          {/* Back-left: Kanban Board */}
          <div
            className="
              absolute
              left-0 sm:left-[2%]
              top-[8%]
              w-[50%] sm:w-[45%]
              z-10
              animate-hero-screenshot-1
            "
            style={{ transform: "rotate(-3deg)" }}
          >
            <div className="rounded-xl overflow-hidden border border-border-default shadow-2xl shadow-black/40">
              <Image
                src="/screenshots/miku-kanban-board.png"
                alt="Miku Kanban Board - Visual project management"
                width={800}
                height={500}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Back-right: Env Variables */}
          <div
            className="
              absolute
              right-0 sm:right-[2%]
              top-[8%]
              w-[50%] sm:w-[45%]
              z-10
              animate-hero-screenshot-2
            "
            style={{ transform: "rotate(2deg)" }}
          >
            <div className="rounded-xl overflow-hidden border border-border-default shadow-2xl shadow-black/40">
              <Image
                src="/screenshots/miku-env-variables.png"
                alt="Miku Environment Variables - Configuration management"
                width={800}
                height={500}
                className="w-full h-auto"
              />
            </div>
          </div>

          {/* Front-center: Markdown Editor (elevated) - this drives the container height */}
          <div
            className="
              relative
              mx-auto
              pt-[12%]
              w-[85%] sm:w-[70%] md:w-[65%]
              z-20
              animate-hero-screenshot-3
            "
          >
            <div className="rounded-xl overflow-hidden border border-border-default shadow-2xl shadow-black/50">
              <Image
                src="/screenshots/miku-markdown-editor.png"
                alt="Miku Markdown Editor - Focused writing environment"
                width={800}
                height={500}
                className="w-full h-auto"
                priority
              />
            </div>
          </div>

          {/* Gradient fade at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg-primary to-transparent z-30 pointer-events-none" />
        </div>
      </div>
    </section>
  );
}
