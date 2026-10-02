/**
 * Word-count and reading-time helpers for the editor chrome.
 *
 * Words are defined as non-whitespace sequences. Reading time uses a simple
 * 200 words-per-minute estimate, matching the quiet "n min read" indicator.
 */

/** Count non-whitespace sequences in text. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  return trimmed.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Estimate reading time in minutes for the given text.
 * Returns `null` for empty/whitespace-only documents (the indicator is hidden),
 * otherwise `Math.max(1, Math.round(words / 200))`.
 */
export function readingTimeMinutes(text: string): number | null {
  const words = countWords(text);
  if (words === 0) {
    return null;
  }
  return Math.max(1, Math.round(words / 200));
}