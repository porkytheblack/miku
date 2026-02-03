"use client";

/**
 * Navigation Component
 *
 * Fixed navigation bar with logo, section links, and action buttons.
 * Includes scroll-aware background styling.
 */

import { useState, useEffect } from "react";
import Image from "next/image";
import { GitHubIcon, StarIcon, DownloadIcon } from "./Icons";
import { GITHUB_REPO, GITHUB_RELEASES } from "@/config/downloads";

interface NavigationProps {
  className?: string;
}

export function Navigation({ className = "" }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-bg-primary/95 backdrop-blur-md border-b border-border-default shadow-lg shadow-black/5"
          : "bg-transparent"
      } ${className}`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <a
          href="#"
          className="flex items-center gap-2.5 group"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <Image
            src="/brand/miku-colored.svg"
            alt="Miku"
            width={32}
            height={32}
            className="rounded-lg transition-transform group-hover:scale-105"
          />
          <span className="font-semibold text-text-primary text-lg">Miku</span>
        </a>

        {/* Desktop Navigation Links */}
        <div className="hidden md:flex items-center gap-6">
          <button
            onClick={() => scrollToSection("features")}
            className="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
          >
            Features
          </button>
          <button
            onClick={() => scrollToSection("download")}
            className="text-text-secondary hover:text-text-primary transition-colors text-sm font-medium"
          >
            Download
          </button>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {/* GitHub Star Button */}
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary border border-border-default hover:border-border-focus transition-colors text-sm"
          >
            <GitHubIcon className="w-4 h-4" />
            <StarIcon className="w-3.5 h-3.5 text-yellow-500" />
            <span className="hidden sm:inline">Star</span>
          </a>

          {/* Download CTA */}
          <a
            href={GITHUB_RELEASES}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-bg-primary font-medium hover:opacity-90 transition-opacity text-sm"
          >
            <DownloadIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
