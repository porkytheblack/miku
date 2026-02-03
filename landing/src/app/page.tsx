"use client";

/**
 * Miku Landing Page
 *
 * Hex.tech-inspired layout featuring:
 * - Hero section with overlapping screenshots
 * - Four alternating feature sections
 * - Download section with platform cards
 */

import { useCallback } from "react";
import { Navigation } from "@/components/Navigation";
import { HeroSection } from "@/components/HeroSection";
import { FeatureSection } from "@/components/FeatureSection";
import { DownloadSection } from "@/components/DownloadSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  const scrollToDownload = useCallback(() => {
    const downloadSection = document.getElementById("download");
    if (downloadSection) {
      downloadSection.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <HeroSection onDownloadClick={scrollToDownload} />

      {/* Feature Sections */}
      <div id="features">
        {/* Section 1: Documentation - text LEFT, screenshot RIGHT */}
        <FeatureSection
          label="Documentation"
          headline="Write with focus, not friction"
          description="A distraction-free markdown editor that lets you write naturally. Syntax highlighting, live preview, and keyboard shortcuts that stay out of your way until you need them."
          screenshotSrc="/screenshots/miku-markdown-editor.png"
          screenshotAlt="Miku Markdown Editor - Focused writing environment with live preview"
          textPosition="left"
        />

        {/* Section 2: Project Management - screenshot LEFT, text RIGHT */}
        <FeatureSection
          label="Project Management"
          headline="Organize work visually"
          description="A kanban board built for developers. Track tasks, manage sprints, and keep your projects moving forward. Drag and drop simplicity with powerful organization."
          screenshotSrc="/screenshots/miku-kanban-board.png"
          screenshotAlt="Miku Kanban Board - Visual project management for developers"
          textPosition="right"
          className="bg-bg-secondary/30"
        />

        {/* Section 3: Configuration - text LEFT, screenshot RIGHT */}
        <FeatureSection
          label="Configuration"
          headline="Manage every environment"
          description="Environment variables, API keys, and configuration files in one secure place. Switch between development, staging, and production with confidence."
          screenshotSrc="/screenshots/miku-env-variables.png"
          screenshotAlt="Miku Environment Variables - Configuration management for all environments"
          textPosition="left"
        />

        {/* Section 4: AI Assistance - screenshot LEFT, text RIGHT */}
        <FeatureSection
          label="AI Assistance"
          headline="AI that observes, not overwrites"
          description="Miku's AI reads your work and offers suggestions through subtle highlights. It waits for you to ask before speaking. Your voice stays yours, enhanced by thoughtful feedback."
          screenshotSrc="/screenshots/miku-ai-review-suggestions.png"
          screenshotAlt="Miku AI Review - Intelligent suggestions that respect your writing voice"
          textPosition="right"
          className="bg-bg-secondary/30"
        />
      </div>

      {/* Download Section */}
      <DownloadSection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
