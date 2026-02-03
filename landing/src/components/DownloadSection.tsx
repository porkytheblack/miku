"use client";

/**
 * DownloadSection Component
 *
 * A download section featuring three platform cards side by side.
 * Each card shows the platform icon, name, primary download button,
 * and expandable alternative download formats.
 */

import { useEffect, useRef, useState } from "react";
import { PlatformCard } from "./PlatformCard";
import {
  DOWNLOAD_LINKS,
  GITHUB_RELEASES,
  CURRENT_VERSION,
} from "@/config/downloads";

interface DownloadSectionProps {
  className?: string;
}

export function DownloadSection({ className = "" }: DownloadSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  return (
    <section
      id="download"
      ref={sectionRef}
      className={`py-24 md:py-32 px-6 ${className}`}
    >
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div
          className={`
            text-center mb-14
            ${isVisible ? "animate-fade-in" : "opacity-0"}
          `}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold mb-4 text-text-primary">
            Start building your workflow hub
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Download Miku for your platform. Free and open source, forever.
          </p>
          <p className="text-text-tertiary text-sm mt-3">
            Version {CURRENT_VERSION}
          </p>
        </div>

        {/* Platform Cards */}
        <div
          className={`
            grid md:grid-cols-3 gap-6
            ${isVisible ? "animate-fade-in-up animation-delay-200" : "opacity-0"}
          `}
        >
          {/* macOS */}
          <PlatformCard
            platform="macos"
            primaryDownload={DOWNLOAD_LINKS.macos.arm64}
            alternativeDownloads={[
              DOWNLOAD_LINKS.macos.x64,
            ]}
          />

          {/* Windows */}
          <PlatformCard
            platform="windows"
            primaryDownload={DOWNLOAD_LINKS.windows.exe}
            alternativeDownloads={[]}
          />

          {/* Linux */}
          <PlatformCard
            platform="linux"
            primaryDownload={DOWNLOAD_LINKS.linux.appImage}
            alternativeDownloads={[
            ]}
          />
        </div>

        {/* View All Releases Link */}
        <div
          className={`
            text-center mt-10
            ${isVisible ? "animate-fade-in animation-delay-400" : "opacity-0"}
          `}
        >
          <a
            href={GITHUB_RELEASES}
            target="_blank"
            rel="noopener noreferrer"
            className="
              inline-flex items-center gap-2
              text-text-secondary
              hover:text-text-primary
              transition-colors
              text-sm
              underline underline-offset-4
              decoration-border-default
              hover:decoration-text-secondary
            "
          >
            View all releases on GitHub
          </a>
        </div>

        {/* System Requirements */}
        <div
          className={`
            mt-16 pt-10 border-t border-border-default
            ${isVisible ? "animate-fade-in animation-delay-500" : "opacity-0"}
          `}
        >
          <h3 className="text-center text-sm font-medium text-text-tertiary uppercase tracking-wider mb-6">
            System Requirements
          </h3>
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            <div>
              <h4 className="font-medium text-text-primary mb-1">macOS</h4>
              <p className="text-text-tertiary text-sm">
                macOS 10.15 Catalina or later
              </p>
            </div>
            <div>
              <h4 className="font-medium text-text-primary mb-1">Windows</h4>
              <p className="text-text-tertiary text-sm">
                Windows 10 version 1803 or later
              </p>
            </div>
            <div>
              <h4 className="font-medium text-text-primary mb-1">Linux</h4>
              <p className="text-text-tertiary text-sm">
                Ubuntu 18.04, Fedora 31, or equivalent
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
