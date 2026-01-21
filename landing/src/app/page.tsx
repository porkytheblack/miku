import Image from "next/image";

const GITHUB_REPO = "https://github.com/porkytheblack/miku";
const GITHUB_RELEASES = "https://github.com/porkytheblack/miku/releases/latest";
const DMG_DOWNLOAD = "https://github.com/porkytheblack/miku/releases/latest/download/Miku.dmg";

// Icons as SVG components
function SparklesIcon() {
  return (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      className="w-6 h-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="w-5 h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-bg-primary/80 backdrop-blur-md border-b border-border-default">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/miku-colored.svg"
              alt="Miku"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-medium text-text-primary">Miku</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-default hover:border-border-focus transition-colors text-sm"
            >
              <GitHubIcon />
              <StarIcon />
              <span>Star</span>
            </a>
            <a
              href={DMG_DOWNLOAD}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-bg-primary font-medium hover:opacity-90 transition-opacity text-sm"
            >
              <DownloadIcon />
              Download
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-secondary border border-border-default mb-8">
            <span className="text-text-secondary text-sm">Hi, I&apos;m Miku</span>
            <Image
              src="/brand/miku-colored.svg"
              alt="Miku"
              width={24}
              height={24}
              className="rounded"
            />
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6">
            The Editor That{" "}
            <span className="underline-animate text-accent-primary">Listens</span>
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed">
            A markdown editor with an AI assistant that behaves like a patient, skilled human editor—
            <em className="text-text-tertiary">not a co-writer.</em>
          </p>

          {/* Demo Card */}
          <div className="bg-bg-secondary border border-border-default rounded-xl p-8 max-w-2xl mx-auto mb-12 text-left">
            <div className="font-mono text-base leading-relaxed space-y-4 text-text-secondary">
              <p>
                You open Miku. A blank page. You{" "}
                <span className="text-text-primary font-medium bg-bg-tertiary px-1.5 py-0.5 rounded">
                  write
                </span>
                .
              </p>
              <p>
                Minutes pass. Pages fill.{" "}
                <span className="text-text-tertiary">Miku says nothing.</span>
              </p>
              <p>
                You finish a section. You lean back.{" "}
                <span className="text-text-primary bg-bg-tertiary px-1.5 py-0.5 rounded">
                  Miku quietly analyzes
                </span>
                .
              </p>
              <p>
                Soft highlights appear—
                <span className="highlight-yellow">a yellow phrase here</span>,{" "}
                <span className="highlight-blue">a blue sentence there</span>.
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={DMG_DOWNLOAD}
              className="flex items-center gap-3 px-8 py-4 rounded-xl bg-accent-primary text-bg-primary font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              <AppleIcon />
              Download for macOS
            </a>
            <p className="text-text-tertiary text-sm">
              Free and open source
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-bg-secondary/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-accent-subtle flex items-center justify-center text-accent-primary mb-4">
                <SparklesIcon />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Silent While You Write
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                No autocomplete. No interruptions. Just you and your thoughts.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-accent-subtle flex items-center justify-center text-accent-primary mb-4">
                <EyeIcon />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                Observes, Never Rewrites
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Miku highlights areas worth revisiting. Your text stays untouched.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-bg-secondary border border-border-default rounded-xl p-6">
              <div className="w-12 h-12 rounded-lg bg-accent-subtle flex items-center justify-center text-accent-primary mb-4">
                <UserIcon />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                You Remain the Author
              </h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Suggestions are references, not commands. Every decision is yours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Start Writing
          </h2>
          <p className="text-text-secondary text-lg mb-8">
            Download Miku for macOS. Windows and Linux coming soon.
          </p>

          <div className="flex flex-col items-center gap-6">
            <a
              href={DMG_DOWNLOAD}
              className="flex items-center gap-3 px-8 py-4 rounded-xl bg-accent-primary text-bg-primary font-semibold text-lg hover:opacity-90 transition-opacity"
            >
              <AppleIcon />
              Download .dmg
            </a>

            <a
              href={GITHUB_RELEASES}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm underline underline-offset-4"
            >
              View all releases on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-default py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/miku-colored.svg"
              alt="Miku"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-text-secondary text-sm">
              Miku — The Editor That Listens
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              <GitHubIcon />
              GitHub
            </a>
            <a
              href={`${GITHUB_REPO}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              Report an Issue
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
