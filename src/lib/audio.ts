/**
 * Audio utilities for Miku
 */

let audioElement: HTMLAudioElement | null = null;

/**
 * Play the "I am done" sound when AI finishes processing
 */
export function playCompletionSound(): void {
  if (typeof window === 'undefined') return;

  try {
    // Reuse existing audio element or create a new one
    if (!audioElement) {
      audioElement = new Audio('/phrases/miku-i-am-done.mp3');
    }

    // Reset to beginning if already played
    audioElement.currentTime = 0;
    audioElement.play().catch((error) => {
      // Silently fail - user may not have the sound file or autoplay blocked
      console.debug('Could not play completion sound:', error);
    });
  } catch (error) {
    // Silently fail for any other errors
    console.debug('Audio playback error:', error);
  }
}

/**
 * Preload the completion sound for faster playback
 */
export function preloadCompletionSound(): void {
  if (typeof window === 'undefined') return;

  try {
    if (!audioElement) {
      audioElement = new Audio('/phrases/miku-i-am-done.mp3');
      audioElement.preload = 'auto';
    }
  } catch (error) {
    console.debug('Could not preload audio:', error);
  }
}
