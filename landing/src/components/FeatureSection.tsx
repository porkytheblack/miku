"use client";

/**
 * FeatureSection Component
 *
 * A section with text on one side and a screenshot on the other.
 * Supports alternating layouts (text-left or text-right).
 * Includes scroll-triggered animations via Intersection Observer.
 */

import { useEffect, useRef, useState } from "react";
import { LabelBadge } from "./LabelBadge";
import { ScreenshotFrame } from "./ScreenshotFrame";

interface FeatureSectionProps {
  label: string;
  headline: string;
  description: string;
  screenshotSrc: string;
  screenshotAlt: string;
  textPosition: "left" | "right";
  className?: string;
}

export function FeatureSection({
  label,
  headline,
  description,
  screenshotSrc,
  screenshotAlt,
  textPosition,
  className = "",
}: FeatureSectionProps) {
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
        threshold: 0.15,
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

  const textContent = (
    <div
      className={`
        flex flex-col justify-center
        ${isVisible ? "animate-feature-text-in" : "opacity-0"}
      `}
    >
      <LabelBadge className="mb-4 self-start">{label}</LabelBadge>
      <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold text-text-primary mb-4 leading-tight">
        {headline}
      </h2>
      <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
        {description}
      </p>
    </div>
  );

  const screenshotContent = (
    <div
      className={`
        ${isVisible ? "animate-feature-screenshot-in" : "opacity-0"}
      `}
    >
      <ScreenshotFrame
        src={screenshotSrc}
        alt={screenshotAlt}
        className="w-full max-w-xl mx-auto"
      />
    </div>
  );

  return (
    <section
      ref={sectionRef}
      className={`py-20 md:py-28 px-6 ${className}`}
    >
      <div className="max-w-6xl mx-auto">
        <div
          className={`
            grid md:grid-cols-2 gap-12 md:gap-16 lg:gap-20 items-center
            ${textPosition === "right" ? "md:[direction:rtl]" : ""}
          `}
        >
          <div className={textPosition === "right" ? "md:[direction:ltr]" : ""}>
            {textPosition === "left" ? textContent : screenshotContent}
          </div>
          <div className={textPosition === "right" ? "md:[direction:ltr]" : ""}>
            {textPosition === "left" ? screenshotContent : textContent}
          </div>
        </div>
      </div>
    </section>
  );
}
