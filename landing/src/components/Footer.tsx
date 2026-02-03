import Image from "next/image";
import { GitHubIcon } from "./Icons";
import { GITHUB_REPO, CURRENT_VERSION } from "@/config/downloads";

interface FooterProps {
  className?: string;
}

export function Footer({ className = "" }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`border-t border-border-default py-12 px-6 ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Main Footer Content */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-8">
          {/* Logo and Tagline */}
          <div className="flex items-center gap-3">
            <Image
              src="/brand/miku-colored.svg"
              alt="Miku"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <div>
              <span className="font-semibold text-text-primary">Miku</span>
              <p className="text-text-tertiary text-sm">The Editor That Listens</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              <GitHubIcon className="w-4 h-4" />
              GitHub
            </a>
            <a
              href={`${GITHUB_REPO}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              Releases
            </a>
            <a
              href={`${GITHUB_REPO}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              Report an Issue
            </a>
            <a
              href={`${GITHUB_REPO}/discussions`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              Discussions
            </a>
            <a
              href={`${GITHUB_REPO}#readme`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              Documentation
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-border-default">
          <p className="text-text-tertiary text-sm text-center sm:text-left">
            {currentYear} Miku. Open source under the MIT License.
          </p>
          <p className="text-text-tertiary text-sm">
            Version {CURRENT_VERSION}
          </p>
        </div>
      </div>
    </footer>
  );
}
