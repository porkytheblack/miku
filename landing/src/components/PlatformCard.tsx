"use client";

/**
 * PlatformCard Component
 *
 * A download card for a specific platform (macOS, Windows, Linux).
 * Shows platform icon, name, primary download button, and expandable
 * "Other formats" section with alternative download options.
 */

import { useState } from "react";
import {
  AppleIcon,
  WindowsIcon,
  LinuxIcon,
  DownloadIcon,
  ChevronDownIcon,
} from "./Icons";
import { DownloadLink } from "@/config/downloads";

type Platform = "macos" | "windows" | "linux";

interface PlatformCardProps {
  platform: Platform;
  primaryDownload: DownloadLink;
  alternativeDownloads: DownloadLink[];
  className?: string;
}

const platformConfig: Record<
  Platform,
  { name: string; icon: React.ComponentType<{ className?: string }> }
> = {
  macos: { name: "macOS", icon: AppleIcon },
  windows: { name: "Windows", icon: WindowsIcon },
  linux: { name: "Linux", icon: LinuxIcon },
};

export function PlatformCard({
  platform,
  primaryDownload,
  alternativeDownloads,
  className = "",
}: PlatformCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = platformConfig[platform];
  const Icon = config.icon;

  return (
    <div
      className={`
        flex flex-col
        p-6
        rounded-xl
        bg-bg-secondary
        border border-border-default
        hover:border-border-focus
        transition-colors duration-200
        ${className}
      `}
    >
      {/* Platform Icon and Name */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-bg-tertiary">
          <Icon className="w-6 h-6 text-text-primary" />
        </div>
        <span className="text-xl font-semibold text-text-primary">
          {config.name}
        </span>
      </div>

      {/* Primary Download Button */}
      <a
        href={primaryDownload.url}
        className="
          flex items-center justify-center gap-2
          w-full py-3 px-4
          rounded-lg
          bg-accent-primary text-bg-primary
          font-semibold
          hover:opacity-90
          transition-opacity
          download-btn
        "
      >
        <DownloadIcon className="w-5 h-5" />
        <span>{primaryDownload.label}</span>
      </a>
      <p className="text-center text-text-tertiary text-sm mt-2 mb-4">
        {primaryDownload.sublabel}
      </p>

      {/* Expandable Other Formats */}
      {alternativeDownloads.length > 0 && (
        <div className="border-t border-border-default pt-4 mt-auto">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="
              flex items-center justify-between
              w-full
              text-sm text-text-secondary
              hover:text-text-primary
              transition-colors
            "
            aria-expanded={isExpanded}
            aria-controls={`${platform}-alternatives`}
          >
            <span>Other formats</span>
            <ChevronDownIcon
              className={`
                w-4 h-4
                transition-transform duration-200
                ${isExpanded ? "rotate-180" : ""}
              `}
            />
          </button>

          <div
            id={`${platform}-alternatives`}
            className={`
              overflow-hidden
              transition-all duration-300 ease-in-out
              ${isExpanded ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0"}
            `}
          >
            <div className="flex flex-col gap-2">
              {alternativeDownloads.map((download, index) => (
                <a
                  key={index}
                  href={download.url}
                  className="
                    flex items-center justify-between
                    py-2 px-3
                    rounded-lg
                    bg-bg-tertiary/50
                    text-text-secondary
                    hover:bg-bg-tertiary
                    hover:text-text-primary
                    transition-colors
                    text-sm
                  "
                >
                  <span>{download.label}</span>
                  <span className="text-text-tertiary text-xs">
                    {download.sublabel}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
