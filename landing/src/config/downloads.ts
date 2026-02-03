/**
 * Download Links Configuration
 *
 * This file contains all download URLs for Miku across different platforms.
 * Update these URLs when releasing new versions.
 *
 * URL Format Tips:
 * - GitHub releases: https://github.com/owner/repo/releases/download/vX.X.X/filename
 * - Direct CDN links work best for reliable downloads
 * - Ensure all URLs point to the same version for consistency
 */

export interface DownloadLink {
  url: string;
  label: string;
  sublabel: string;
}

export interface PlatformDownloads {
  macos: {
    universal: DownloadLink;
    arm64: DownloadLink;
    x64: DownloadLink;
  };
  windows: {
    msi: DownloadLink;
    exe: DownloadLink;
  };
  linux: {
    appImage: DownloadLink;
    deb: DownloadLink;
    rpm: DownloadLink;
  };
}

/**
 * Current version being distributed
 * Update this when releasing a new version
 */
export const CURRENT_VERSION = "0.0.8";

/**
 * GitHub repository information
 */
export const GITHUB_REPO = "https://github.com/porkytheblack/miku";
export const GITHUB_RELEASES = `${GITHUB_REPO}/releases/latest`;
export const GITHUB_RELEASE_TAG = `${GITHUB_REPO}/releases/tag/v${CURRENT_VERSION}`;

/**
 * Download links for all platforms and architectures
 *
 * To update download links:
 * 1. Update CURRENT_VERSION above
 * 2. Replace the URLs below with the new release URLs
 * 3. Verify all links are accessible before deploying
 */
export const DOWNLOAD_LINKS: PlatformDownloads = {
  macos: {
    arm64: {
      url: `https://oasis.dterminal.net/miku/download/darwin-aarch64/${CURRENT_VERSION}`,
      label: "macOS (Apple Silicon)",
      sublabel: "M1/M2/M3/M4",
    },
    x64: {
      url: `https://oasis.dterminal.net/miku/download/darwin-x86_64/${CURRENT_VERSION}`,
      label: "macOS (Intel)",
      sublabel: "x86_64",
    },
  },
  windows: {
    exe: {
      url: `https://oasis.dterminal.net/miku/download/windows-x86_64/${CURRENT_VERSION}`,
      label: "Windows Setup",
      sublabel: ".exe",
    },
  },
  linux: {
    appImage: {
      url: `https://oasis.dterminal.net/miku/download/linux-x86_64/${CURRENT_VERSION}`,
      label: "Linux AppImage",
      sublabel: "Universal",
    }
  },
};

/**
 * Helper function to get the recommended download for a platform
 */
export function getRecommendedDownload(platform: "macos" | "windows" | "linux"): DownloadLink {
  switch (platform) {
    case "macos":
      return DOWNLOAD_LINKS.macos.arm64;
    case "windows":
      return DOWNLOAD_LINKS.windows.exe;
    case "linux":
      return DOWNLOAD_LINKS.linux.appImage;
  }
}

/**
 * Get all downloads for a specific platform
 */
export function getPlatformDownloads(platform: "macos" | "windows" | "linux"): DownloadLink[] {
  switch (platform) {
    case "macos":
      return [
        DOWNLOAD_LINKS.macos.arm64,
        DOWNLOAD_LINKS.macos.x64,
      ];
    case "windows":
      return [
        DOWNLOAD_LINKS.windows.exe,
      ];
    case "linux":
      return [
        DOWNLOAD_LINKS.linux.appImage
      ];
  }
}
