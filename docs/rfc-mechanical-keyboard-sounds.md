# RFC: Mechanical Keyboard Sound Support for Miku Editor

## Status
Draft

## Abstract

This RFC proposes adding mechanical keyboard sound support to the Miku editor, enabling users to hear satisfying click sounds while typing. The implementation prioritizes zero perceptible latency through Web Audio API buffer pooling and preloading, while providing a configurable system for multiple sound profiles and per-key variation.

## 1. Introduction

### 1.1 Problem Statement

Writers often find mechanical keyboard sounds satisfying and conducive to productive writing sessions. Many users type on membrane or laptop keyboards but desire the auditory feedback of mechanical switches. The Miku editor currently lacks typing sound feedback, missing an opportunity to enhance the writing experience.

### 1.2 Goals

1. **Zero perceptible typing lag**: Sound playback must not introduce any noticeable delay to the typing experience (target: < 10ms from keypress to sound onset)
2. **Toggle functionality**: Users can enable/disable keyboard sounds with a single setting
3. **Multiple sound profiles**: Support at least 3 distinct mechanical keyboard sound profiles (e.g., Cherry MX Blue, Cherry MX Brown, Topre)
4. **Natural variation**: Avoid robotic repetition by introducing subtle variation in sound playback
5. **Resource efficiency**: Minimal memory footprint and CPU usage
6. **Graceful degradation**: System works in both Tauri (desktop) and browser environments

### 1.3 Non-Goals

- Real-time audio synthesis of keyboard sounds (we use pre-recorded samples)
- Per-key unique sounds based on physical keyboard layout
- 3D spatial audio panning (left/right based on key position)
- Recording custom sound profiles from user's microphone
- Syncing sounds with external applications or system-wide keyboard events

### 1.4 Success Criteria

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Sound onset latency | < 10ms | Performance.now() delta measurement |
| Memory footprint | < 5MB per profile | DevTools memory snapshot |
| CPU usage during typing | < 2% increase | DevTools performance monitor |
| Sound variation | No identical consecutive sounds | Randomization verification |
| User preference persistence | 100% reliable | Settings load/save verification |

## 2. Background

### 2.1 Current State

The Miku editor already has audio infrastructure for completion notifications:

- **`/src/lib/audio.ts`**: Contains `playCompletionSound()` and `preloadCompletionSound()` functions using `HTMLAudioElement`
- **`/src/components/SoundNotifier.tsx`**: Listens for Miku status changes and plays completion sounds
- **`/src/context/SettingsContext.tsx`**: Manages `soundEnabled` boolean for notification sounds
- **`/public/phrases/`**: Directory containing audio assets (currently `miku-i-am-done.mp3`)

The current implementation uses `HTMLAudioElement` which is suitable for notification sounds but has higher latency than Web Audio API, making it unsuitable for per-keystroke feedback.

### 2.2 Terminology

| Term | Definition |
|------|------------|
| **AudioContext** | Web Audio API interface for audio processing graph |
| **AudioBuffer** | Decoded audio data stored in memory for low-latency playback |
| **AudioBufferSourceNode** | Node that plays an AudioBuffer; single-use and must be recreated for each playback |
| **Buffer Pool** | Pre-created set of AudioBufferSourceNodes ready for immediate playback |
| **Sound Profile** | A collection of audio samples representing a specific keyboard type |
| **Keydown Event** | DOM event fired when a key is pressed (before keyup) |
| **Latency Hint** | AudioContext configuration specifying desired latency tradeoffs |

### 2.3 Prior Art

#### KeyEcho (Tauri + Rust)
- Uses Rust's `rodio` for native audio playback
- WAV format for zero decompression delay
- LRU cache for decoded audio buffers
- Achieves near-zero latency on desktop

#### Mechvibes (Electron)
- Electron-based, community sound packs
- Higher latency due to Electron overhead
- Supports per-key sound mapping

#### Klack (macOS native)
- Swift native implementation
- Smooth performance on macOS
- Paid, closed-source

#### Browser-Based Approaches
- Web Audio API with preloaded buffers achieves 10-20ms latency
- `howler.js` library provides cross-browser audio abstraction
- Games commonly use buffer pools for rapid sound triggering

## 3. Algorithm Analysis

### 3.1 Candidate Approaches

#### 3.1.1 HTMLAudioElement (Current Approach)

**Description**: Create Audio elements, set src, and call play().

**Time Complexity**: O(1) per playback
**Space Complexity**: O(n) where n = number of cached Audio elements

**Advantages**:
- Simple API
- Already used in codebase
- Works everywhere

**Disadvantages**:
- Higher latency (50-150ms typical)
- Cannot play overlapping sounds from same element
- No fine-grained control over playback

**Best Suited For**: Notification sounds, background music

#### 3.1.2 Web Audio API with On-Demand Buffer Creation

**Description**: Fetch and decode audio on first use, create new source nodes for each playback.

**Time Complexity**: O(1) per playback after initial decode
**Space Complexity**: O(m) where m = total buffer size

**Advantages**:
- Low latency (10-30ms)
- Full audio graph control
- Overlapping sounds supported

**Disadvantages**:
- First playback delayed by decode time
- Slight overhead creating source nodes

**Best Suited For**: Interactive sounds with occasional playback

#### 3.1.3 Web Audio API with Preloaded Buffer Pool

**Description**: Preload all audio buffers at initialization, create source nodes on demand (they are optimized for this pattern).

**Time Complexity**: O(1) per playback
**Space Complexity**: O(m + k) where m = buffer size, k = active source nodes

**Advantages**:
- Lowest achievable latency (< 10ms)
- Consistent playback timing
- Browser-optimized source node creation
- Natural support for overlapping sounds

**Disadvantages**:
- Requires initialization time
- Memory committed upfront

**Best Suited For**: Rapid, repeated sound triggering (keyboard sounds)

#### 3.1.4 Tauri Native Audio (Rust Backend)

**Description**: Handle audio entirely in Rust using rodio/symphonia, communicate via Tauri commands.

**Time Complexity**: O(1) per playback
**Space Complexity**: O(m) in Rust memory space

**Advantages**:
- Potentially lowest latency
- Native performance
- No browser audio policy issues

**Disadvantages**:
- Tauri-only (no browser support)
- IPC overhead between frontend and backend
- More complex implementation
- Requires Rust audio dependencies

**Best Suited For**: Desktop-only applications with extreme latency requirements

### 3.2 Comparative Analysis

| Criterion | HTMLAudioElement | Web Audio On-Demand | Web Audio Preloaded | Tauri Native |
|-----------|-----------------|---------------------|---------------------|--------------|
| Latency | 50-150ms | 10-30ms | < 10ms | < 5ms |
| Browser Support | Excellent | Excellent | Excellent | None |
| Tauri Support | Yes | Yes | Yes | Yes |
| Implementation Complexity | Low | Medium | Medium | High |
| Memory Efficiency | Medium | Good | Good | Good |
| Overlapping Sounds | Poor | Excellent | Excellent | Excellent |
| First Sound Delay | None | Decode time | Preload time | None |

### 3.3 Recommendation

**Selected Approach: Web Audio API with Preloaded Buffer Pool**

**Justification**:

1. **Latency**: Achieves < 10ms latency, meeting our primary goal
2. **Cross-Platform**: Works in both browser and Tauri WebView
3. **Proven Pattern**: Used extensively in web games and audio applications
4. **Balance**: Optimal tradeoff between complexity and performance
5. **Browser Optimization**: Source node creation is explicitly optimized by browser engines for repeated buffer playback

The Tauri native approach was considered but rejected because:
- The IPC overhead would negate latency benefits for frequent events
- Browser Web Audio API is already fast enough (< 10ms)
- Maintaining cross-platform compatibility is valuable
- The additional Rust dependencies and complexity are not justified

## 4. Detailed Design

### 4.1 Architecture Overview

```
+-------------------+     +----------------------+     +------------------+
|   BlockEditor     |---->|  KeyboardSoundEngine |---->|   AudioContext   |
|   (keydown event) |     |  (singleton manager) |     |   (Web Audio)    |
+-------------------+     +----------------------+     +------------------+
                                    |
                                    v
                          +------------------+
                          |  SoundProfile    |
                          |  (buffer cache)  |
                          +------------------+
                                    |
                                    v
                          +------------------+
                          |  /public/sounds/ |
                          |  (audio files)   |
                          +------------------+
```

**Data Flow**:
1. User presses key in BlockEditor
2. BlockEditor's keydown handler calls `KeyboardSoundEngine.playKeySound()`
3. Engine selects appropriate buffer based on current profile and key type
4. Engine creates AudioBufferSourceNode, connects to output, starts playback
5. Node auto-disconnects after playback completes (handled by browser)

### 4.2 Data Structures

#### 4.2.1 KeyboardSoundProfile

```typescript
/**
 * Represents a collection of sounds for a specific keyboard type.
 * Each profile contains multiple variations for natural sound.
 */
interface KeyboardSoundProfile {
  /** Unique identifier for the profile */
  id: string;

  /** Human-readable display name */
  name: string;

  /** Description for UI display */
  description: string;

  /**
   * Sound variations for regular key presses.
   * Multiple variations prevent repetitive sound.
   * Minimum: 3 variations recommended.
   */
  keydownSounds: AudioBuffer[];

  /**
   * Sound for key release (optional).
   * Many mechanical switches have distinct release sound.
   * Can be empty array to disable.
   */
  keyupSounds: AudioBuffer[];

  /**
   * Sound for spacebar (optional, uses keydown if empty).
   * Spacebar often has distinctive sound.
   */
  spacebarSounds: AudioBuffer[];

  /**
   * Sound for Enter key (optional, uses keydown if empty).
   * Enter key often has distinctive sound.
   */
  enterSounds: AudioBuffer[];

  /**
   * Sound for Backspace (optional, uses keydown if empty).
   */
  backspaceSounds: AudioBuffer[];

  /**
   * Volume multiplier for this profile (0.0 - 1.0).
   * Allows normalization across profiles.
   */
  baseVolume: number;
}
```

**Invariants**:
- `keydownSounds.length >= 1` (must have at least one sound)
- `0 <= baseVolume <= 1`
- All AudioBuffers must be decoded before use
- Profile ID must be unique within the registry

#### 4.2.2 KeyboardSoundSettings

```typescript
/**
 * User preferences for keyboard sounds.
 * Persisted in SettingsContext.
 */
interface KeyboardSoundSettings {
  /** Whether keyboard sounds are enabled */
  enabled: boolean;

  /** Selected sound profile ID */
  profileId: string;

  /** Master volume (0.0 - 1.0) */
  volume: number;

  /** Whether to play keyup sounds */
  playKeyupSounds: boolean;

  /**
   * Pitch variation range (0.0 - 0.1 recommended).
   * Adds subtle pitch randomization for natural feel.
   * 0 = no variation, 0.05 = +/- 5% pitch variation.
   */
  pitchVariation: number;
}
```

**Default Values**:
```typescript
const DEFAULT_KEYBOARD_SOUND_SETTINGS: KeyboardSoundSettings = {
  enabled: false,  // Opt-in feature
  profileId: 'cherry-mx-blue',
  volume: 0.5,
  playKeyupSounds: false,  // More subtle default
  pitchVariation: 0.02,  // 2% variation
};
```

#### 4.2.3 KeyboardSoundEngine State

```typescript
/**
 * Internal state of the sound engine.
 * Not exposed to external components.
 */
interface KeyboardSoundEngineState {
  /** Web Audio API context */
  audioContext: AudioContext | null;

  /** Master gain node for volume control */
  masterGain: GainNode | null;

  /** Loaded sound profiles, keyed by profile ID */
  profiles: Map<string, KeyboardSoundProfile>;

  /** Currently active profile ID */
  activeProfileId: string | null;

  /** Loading state for UI feedback */
  loadingState: 'idle' | 'loading' | 'ready' | 'error';

  /** Error message if loadingState is 'error' */
  error: string | null;

  /** Index tracking for round-robin sound selection */
  soundIndices: {
    keydown: number;
    keyup: number;
    spacebar: number;
    enter: number;
    backspace: number;
  };

  /** Last played time for rate limiting */
  lastPlayedTime: number;
}
```

### 4.3 Algorithm Specification

#### 4.3.1 Engine Initialization

```
PROCEDURE initializeEngine()
  REQUIRE: Window object available (client-side only)
  ENSURE: AudioContext created and profiles loading initiated

  1. Check if AudioContext is supported
     IF typeof AudioContext === 'undefined' AND typeof webkitAudioContext === 'undefined':
       SET state.loadingState = 'error'
       SET state.error = 'Web Audio API not supported'
       RETURN

  2. AudioContext will be created lazily on first user interaction
     (Required due to browser autoplay policies)
     SET state.loadingState = 'idle'

  3. Register event listener for first user interaction
     ONCE 'click' OR 'keydown' on document:
       CALL createAudioContext()
       CALL loadProfiles()
```

#### 4.3.2 AudioContext Creation

```
PROCEDURE createAudioContext()
  REQUIRE: User gesture has occurred
  ENSURE: AudioContext ready for playback

  1. Create AudioContext with low latency hint
     SET state.audioContext = new AudioContext({
       latencyHint: 'interactive'  // Optimize for responsive playback
     })

  2. Create master gain node
     SET state.masterGain = audioContext.createGain()
     CONNECT state.masterGain TO audioContext.destination

  3. If context is suspended (browser policy), resume it
     IF audioContext.state === 'suspended':
       AWAIT audioContext.resume()

  4. SET state.loadingState = 'loading'
```

#### 4.3.3 Profile Loading

```
PROCEDURE loadProfiles()
  REQUIRE: AudioContext initialized
  ENSURE: All profiles loaded and decoded

  1. Define profile manifest
     SET profiles = [
       { id: 'cherry-mx-blue', name: 'Cherry MX Blue', path: '/sounds/cherry-mx-blue/' },
       { id: 'cherry-mx-brown', name: 'Cherry MX Brown', path: '/sounds/cherry-mx-brown/' },
       { id: 'topre', name: 'Topre', path: '/sounds/topre/' }
     ]

  2. FOR EACH profile IN profiles:
     TRY:
       // Load keydown sounds (required)
       SET keydownBuffers = AWAIT loadSoundVariations(profile.path + 'keydown/', 4)

       // Load optional sounds (fallback to keydown if missing)
       SET keyupBuffers = AWAIT loadSoundVariations(profile.path + 'keyup/', 2) OR []
       SET spaceBuffers = AWAIT loadSoundVariations(profile.path + 'space/', 2) OR keydownBuffers
       SET enterBuffers = AWAIT loadSoundVariations(profile.path + 'enter/', 2) OR keydownBuffers
       SET backspaceBuffers = AWAIT loadSoundVariations(profile.path + 'backspace/', 2) OR keydownBuffers

       // Create profile object
       SET loadedProfile = {
         id: profile.id,
         name: profile.name,
         keydownSounds: keydownBuffers,
         keyupSounds: keyupBuffers,
         spacebarSounds: spaceBuffers,
         enterSounds: enterBuffers,
         backspaceSounds: backspaceBuffers,
         baseVolume: 1.0
       }

       state.profiles.set(profile.id, loadedProfile)
     CATCH error:
       LOG 'Failed to load profile:', profile.id, error
       CONTINUE  // Don't fail completely if one profile fails

  3. IF state.profiles.size > 0:
       SET state.loadingState = 'ready'
       SET state.activeProfileId = first profile ID
     ELSE:
       SET state.loadingState = 'error'
       SET state.error = 'No sound profiles could be loaded'
```

#### 4.3.4 Sound Variation Loading

```
PROCEDURE loadSoundVariations(basePath: string, count: number) -> AudioBuffer[]
  REQUIRE: basePath is valid URL path, count > 0
  ENSURE: Returns array of decoded AudioBuffers

  SET buffers = []

  FOR i FROM 1 TO count:
    SET url = basePath + i + '.wav'  // e.g., '/sounds/cherry-mx-blue/keydown/1.wav'
    TRY:
      SET response = AWAIT fetch(url)
      IF NOT response.ok:
        CONTINUE  // Skip missing variations

      SET arrayBuffer = AWAIT response.arrayBuffer()
      SET audioBuffer = AWAIT state.audioContext.decodeAudioData(arrayBuffer)
      buffers.push(audioBuffer)
    CATCH:
      CONTINUE  // Skip failed loads

  RETURN buffers
```

#### 4.3.5 Playing Key Sound

```
PROCEDURE playKeySound(keyType: 'keydown' | 'keyup', key: string)
  REQUIRE: Engine initialized, profile loaded, sounds enabled
  ENSURE: Appropriate sound plays with minimal latency

  1. Early exit checks
     IF state.loadingState !== 'ready': RETURN
     IF state.audioContext === null: RETURN
     IF state.audioContext.state === 'suspended':
       AWAIT state.audioContext.resume()

  2. Rate limiting (prevent sound spam)
     SET now = performance.now()
     IF now - state.lastPlayedTime < 10:  // Min 10ms between sounds
       RETURN
     SET state.lastPlayedTime = now

  3. Get active profile
     SET profile = state.profiles.get(state.activeProfileId)
     IF profile === undefined: RETURN

  4. Select appropriate sound array based on key
     SET soundArray, indexKey = selectSoundArray(profile, keyType, key)
     IF soundArray.length === 0: RETURN

  5. Select sound variation (round-robin with shuffle)
     SET soundIndex = state.soundIndices[indexKey]
     SET buffer = soundArray[soundIndex]

     // Advance index with wrap-around
     state.soundIndices[indexKey] = (soundIndex + 1) % soundArray.length

  6. Create and configure source node
     SET source = state.audioContext.createBufferSource()
     SET source.buffer = buffer

     // Apply pitch variation for natural feel
     IF settings.pitchVariation > 0:
       SET variation = 1 + (Math.random() * 2 - 1) * settings.pitchVariation
       SET source.playbackRate.value = variation

  7. Create gain node for this sound (allows per-sound volume)
     SET gainNode = state.audioContext.createGain()
     SET gainNode.gain.value = settings.volume * profile.baseVolume

  8. Connect audio graph and play
     CONNECT source TO gainNode
     CONNECT gainNode TO state.masterGain
     source.start(0)  // Start immediately

     // No need to manually disconnect - browser handles cleanup
```

#### 4.3.6 Sound Array Selection

```
PROCEDURE selectSoundArray(profile, keyType, key) -> (AudioBuffer[], string)
  REQUIRE: profile is valid KeyboardSoundProfile
  ENSURE: Returns appropriate sound array and index key

  IF keyType === 'keyup':
    IF profile.keyupSounds.length > 0:
      RETURN (profile.keyupSounds, 'keyup')
    ELSE:
      RETURN ([], '')  // No keyup sound configured

  // keyType === 'keydown'
  SWITCH key.toLowerCase():
    CASE ' ':
    CASE 'space':
      RETURN (profile.spacebarSounds, 'spacebar')

    CASE 'enter':
      RETURN (profile.enterSounds, 'enter')

    CASE 'backspace':
      RETURN (profile.backspaceSounds, 'backspace')

    DEFAULT:
      RETURN (profile.keydownSounds, 'keydown')
```

### 4.4 Interface Definition

#### 4.4.1 KeyboardSoundEngine API

```typescript
/**
 * Singleton engine for keyboard sound playback.
 * Must be initialized before use.
 */
interface IKeyboardSoundEngine {
  /**
   * Initialize the audio engine.
   * Safe to call multiple times; subsequent calls are no-ops.
   * Must be called from user gesture handler for browser compatibility.
   */
  initialize(): Promise<void>;

  /**
   * Play a key sound.
   * @param keyType - Whether this is a keydown or keyup event
   * @param key - The key that was pressed (e.g., 'a', 'Enter', ' ')
   */
  playKeySound(keyType: 'keydown' | 'keyup', key: string): void;

  /**
   * Update engine settings.
   * @param settings - Partial settings to merge with current
   */
  updateSettings(settings: Partial<KeyboardSoundSettings>): void;

  /**
   * Get current loading state for UI feedback.
   */
  getLoadingState(): 'idle' | 'loading' | 'ready' | 'error';

  /**
   * Get available sound profiles.
   */
  getProfiles(): Array<{ id: string; name: string; description: string }>;

  /**
   * Set the active sound profile.
   * @param profileId - ID of the profile to activate
   * @returns true if profile exists and was activated
   */
  setActiveProfile(profileId: string): boolean;

  /**
   * Clean up resources.
   * Call when component unmounts or feature is disabled.
   */
  dispose(): void;
}
```

#### 4.4.2 React Hook API

```typescript
/**
 * Hook for using keyboard sounds in a component.
 * Handles initialization, settings sync, and cleanup.
 */
function useKeyboardSounds(): {
  /** Whether the engine is ready for playback */
  isReady: boolean;

  /** Current error message, if any */
  error: string | null;

  /** Available sound profiles */
  profiles: Array<{ id: string; name: string; description: string }>;

  /** Play a key sound (call from event handler) */
  playKeySound: (keyType: 'keydown' | 'keyup', key: string) => void;
};
```

### 4.5 Error Handling

| Error Condition | Detection | Handling |
|----------------|-----------|----------|
| Web Audio API not supported | Feature detection at init | Set error state, disable feature gracefully |
| AudioContext creation fails | Try-catch at creation | Set error state, log error, disable feature |
| Audio file fetch fails (404) | Response.ok check | Log warning, continue with available sounds |
| Audio decode fails | decodeAudioData rejection | Log warning, skip that variation |
| All profiles fail to load | profiles.size === 0 | Set error state, disable feature |
| AudioContext suspended | context.state check | Call resume() before playback |
| Rate limit exceeded | Time-based check | Skip playback, no error |

### 4.6 Edge Cases

#### Empty Input
- If no key is provided to `playKeySound()`, return silently
- If profile has no sounds for a key type, fall back to keydown sounds
- If keydown sounds are empty (shouldn't happen), return silently

#### Single Element Input
- Profile with only 1 sound variation: Works fine, just repeats same sound
- Settings with volume = 0: Play sound at 0 volume (effectively silent)

#### Maximum Size Input
- Very long key press sequences: Rate limiting prevents sound spam
- Many overlapping sounds: Browser handles cleanup; GainNode prevents volume buildup

#### Malformed Input
- Invalid profile ID in settings: Fall back to first available profile
- Corrupted audio file: Skip during decode, use remaining variations
- Invalid volume values: Clamp to 0-1 range

#### Concurrent Access
- Multiple rapid key presses: Each creates new source node (browser optimized for this)
- Settings update during playback: Applied on next sound (no interruption)

#### Resource Exhaustion
- AudioContext limit reached (rare): Browser typically handles gracefully
- Memory pressure: AudioBuffers are relatively small; monitor in testing

## 5. Implementation Guide

### 5.1 Prerequisites

**Dependencies**:
- No new npm packages required (Web Audio API is built-in)
- Audio files in WAV format (lossless, fast decode)

**Audio Files Required**:
```
public/
  sounds/
    cherry-mx-blue/
      keydown/
        1.wav, 2.wav, 3.wav, 4.wav
      keyup/
        1.wav, 2.wav
      space/
        1.wav, 2.wav
      enter/
        1.wav, 2.wav
      backspace/
        1.wav, 2.wav
    cherry-mx-brown/
      (same structure)
    topre/
      (same structure)
```

**Audio File Specifications**:
- Format: WAV (PCM)
- Sample rate: 44100 Hz or 48000 Hz
- Bit depth: 16-bit
- Channels: Mono (stereo acceptable but unnecessary)
- Duration: 50-200ms per sample
- File size: ~10-50KB per sample

### 5.2 Implementation Order

1. **Phase 1: Core Engine** (Priority: High)
   - Create `/src/lib/keyboardSounds.ts` with engine class
   - Implement AudioContext initialization
   - Implement single-profile loading
   - Implement basic `playKeySound()` function
   - Add manual testing capability

2. **Phase 2: Settings Integration** (Priority: High)
   - Extend `EditorSettings` type with keyboard sound settings
   - Update `SettingsContext` default values
   - Add persistence (localStorage + Tauri backend)

3. **Phase 3: Editor Integration** (Priority: High)
   - Create `useKeyboardSounds` hook
   - Integrate with `BlockEditor` keydown/keyup handlers
   - Ensure sounds only play in editor context (not global)

4. **Phase 4: Settings UI** (Priority: Medium)
   - Add keyboard sounds section to `SettingsPanel`
   - Toggle switch for enable/disable
   - Profile selector dropdown
   - Volume slider
   - Keyup sounds toggle
   - Preview button to test sounds

5. **Phase 5: Additional Profiles** (Priority: Medium)
   - Source/create additional sound profiles
   - Add profile metadata (descriptions, icons)
   - Implement profile-specific volume normalization

6. **Phase 6: Polish** (Priority: Low)
   - Add loading indicator during initialization
   - Add error messages for failed loads
   - Performance optimization if needed
   - Documentation

### 5.3 Testing Strategy

#### Unit Tests
```typescript
describe('KeyboardSoundEngine', () => {
  test('initializes without error', async () => {
    // Mock AudioContext
    const engine = new KeyboardSoundEngine();
    await engine.initialize();
    expect(engine.getLoadingState()).toBe('ready');
  });

  test('plays sound without throwing', () => {
    const engine = getInitializedEngine();
    expect(() => engine.playKeySound('keydown', 'a')).not.toThrow();
  });

  test('rate limits rapid calls', () => {
    const engine = getInitializedEngine();
    const playSpy = jest.spyOn(engine, '_playBuffer');

    // Rapid fire 10 calls
    for (let i = 0; i < 10; i++) {
      engine.playKeySound('keydown', 'a');
    }

    // Should be rate limited
    expect(playSpy).toHaveBeenCalledTimes(/* less than 10 */);
  });

  test('selects spacebar sound for space key', () => {
    // Test sound selection logic
  });

  test('falls back to keydown when special key sound missing', () => {
    // Test fallback behavior
  });
});
```

#### Integration Tests
```typescript
describe('BlockEditor with keyboard sounds', () => {
  test('plays sound on keydown when enabled', () => {
    render(<BlockEditor />, { wrapper: TestProviders });
    const editor = screen.getByRole('textbox');

    // Enable sounds in settings
    // ...

    fireEvent.keyDown(editor, { key: 'a' });

    // Verify sound was triggered
    // (May need to mock AudioContext)
  });

  test('does not play sound when disabled', () => {
    // Test with sounds disabled
  });
});
```

#### Performance Benchmarks
```typescript
describe('Performance', () => {
  test('sound onset latency < 10ms', async () => {
    const engine = getInitializedEngine();
    const measurements: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      engine.playKeySound('keydown', 'a');
      const end = performance.now();
      measurements.push(end - start);
      await new Promise(r => setTimeout(r, 50)); // Wait between tests
    }

    const avgLatency = measurements.reduce((a, b) => a + b) / measurements.length;
    expect(avgLatency).toBeLessThan(10);
  });

  test('memory footprint acceptable', () => {
    // Use Performance API memory measurements
  });
});
```

### 5.4 Common Pitfalls

1. **AudioContext Autoplay Policy**
   - **Problem**: Creating AudioContext before user gesture fails in most browsers
   - **Solution**: Create AudioContext lazily on first click/keydown, or call `resume()` before playback

2. **Forgotten Cleanup**
   - **Problem**: AudioBufferSourceNodes accumulate if manually tracked
   - **Solution**: Don't track them; browser garbage collects after `onended`

3. **Rate Limiting Too Aggressive**
   - **Problem**: Fast typists miss sounds
   - **Solution**: Set rate limit to 10ms (allows 100 sounds/second)

4. **Volume Normalization**
   - **Problem**: Different profiles have different perceived loudness
   - **Solution**: Include `baseVolume` per profile, normalize during content creation

5. **Memory Leaks**
   - **Problem**: Holding references to old AudioBuffers
   - **Solution**: Clear profile map on dispose, let GC handle buffers

6. **SSR Errors**
   - **Problem**: Accessing AudioContext during server-side render
   - **Solution**: Check `typeof window !== 'undefined'` before any audio operations

## 6. Performance Characteristics

### 6.1 Complexity Analysis

**Time Complexity**:
- Initialization: O(p * v * d) where p = profiles, v = variations, d = decode time
- playKeySound(): O(1) - constant time operations only
- Profile switching: O(1) - just updates activeProfileId

**Space Complexity**:
- Per profile: O(v * s) where v = variations (~20), s = average sample size (~30KB)
- Total: O(p * v * s) = 3 profiles * 20 variations * 30KB = ~1.8MB
- Plus AudioContext overhead: ~100KB

### 6.2 Benchmarking Methodology

```typescript
// Latency measurement
function measureLatency(iterations = 1000): Promise<LatencyStats> {
  const measurements: number[] = [];

  return new Promise((resolve) => {
    let i = 0;
    const interval = setInterval(() => {
      const start = performance.now();
      engine.playKeySound('keydown', 'a');
      measurements.push(performance.now() - start);

      if (++i >= iterations) {
        clearInterval(interval);
        resolve({
          min: Math.min(...measurements),
          max: Math.max(...measurements),
          avg: measurements.reduce((a, b) => a + b) / measurements.length,
          p95: percentile(measurements, 95),
          p99: percentile(measurements, 99),
        });
      }
    }, 50);
  });
}
```

### 6.3 Expected Performance

| Metric | Expected Value | Notes |
|--------|----------------|-------|
| Initialization time | 500-1500ms | Depends on network; only once per session |
| Sound onset latency | 2-8ms | Well under perceptible threshold |
| Memory per profile | ~600KB | 20 samples * 30KB average |
| Total memory | ~2MB | 3 profiles + engine overhead |
| CPU per keypress | < 0.1ms | Source node creation is optimized |
| CPU idle | 0% | No processing when not playing |

### 6.4 Optimization Opportunities

1. **Lazy Profile Loading**: Only load selected profile, load others on demand
2. **Compressed Audio**: Use Opus/AAC for smaller files (tradeoff: decode latency)
3. **Shared Buffers**: Some sounds could be shared across profiles
4. **Worker-Based Decoding**: Decode audio in Web Worker to not block main thread
5. **IndexedDB Caching**: Cache decoded buffers to speed up subsequent loads

## 7. Security Considerations

1. **Audio File Sources**: Only load from same origin (`/public/sounds/`)
2. **No User-Uploaded Audio**: Prevents potential audio-based exploits
3. **No Microphone Access**: Feature does not require or use microphone
4. **No External Requests**: All audio is bundled with application
5. **XSS Prevention**: No user input used in audio file paths

## 8. Operational Considerations

### 8.1 Monitoring

- **Initialization Success Rate**: Track via analytics
- **Profile Loading Failures**: Log to console in development
- **Feature Usage**: Track enable/disable in settings analytics (if applicable)

### 8.2 Alerting

No runtime alerting required. Failures are graceful (no sounds) and non-critical.

### 8.3 Debugging

**Console Logging** (development mode):
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[KeyboardSounds] Initialized with latency:',
    audioContext.baseLatency * 1000, 'ms');
  console.log('[KeyboardSounds] Loaded profiles:',
    Array.from(profiles.keys()));
}
```

**DevTools Tips**:
- Use Performance panel to measure actual sound latency
- Use Memory panel to verify buffer sizes
- Use Console to check for AudioContext warnings

## 9. Migration Plan

This is a new feature with no existing implementation to migrate from. The feature will be:

1. **Disabled by default**: Users must explicitly enable in settings
2. **Backward compatible**: No changes to existing audio (completion sounds)
3. **Progressive enhancement**: If initialization fails, app continues normally

## 10. Open Questions

1. **Sound Licensing**: Need to source royalty-free mechanical keyboard sounds or record our own
2. **Mobile Support**: Should keyboard sounds work on mobile devices with on-screen keyboards?
3. **Profile Customization**: Should users be able to adjust individual profile volumes?
4. **Additional Keys**: Should we support distinct sounds for Shift, Ctrl, Tab, etc.?

## 11. References

- [Web Audio API Best Practices (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)
- [Web Audio API Performance Notes](https://padenot.github.io/web-audio-perf/)
- [Perfect Timing and Latency (O'Reilly Web Audio API Book)](https://www.oreilly.com/library/view/web-audio-api/9781449332679/ch02.html)
- [AudioContext Latency Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/baseLatency)
- [KeyEcho: Tauri Keyboard Sounds Implementation](https://upweb.dev/posts/open-sourced-keyecho)
- [Mechy Keyboard (GitHub)](https://github.com/JulianKominovic/mechy-keyboard)

## Appendices

### A. Worked Examples

#### A.1 Typical Usage Flow

1. User opens Miku editor
2. User opens Settings panel
3. User scrolls to "Keyboard Sounds" section
4. User toggles "Enable keyboard sounds" ON
   - Engine initializes (creates AudioContext on this user gesture)
   - Profiles begin loading
   - Loading indicator shown
5. After 1-2 seconds, profiles loaded
6. User selects "Cherry MX Blue" profile
7. User closes Settings
8. User types in editor
9. Each keypress triggers `playKeySound('keydown', key)`
10. Sound plays within 10ms of keypress
11. User continues typing with satisfying click sounds

#### A.2 Sound Selection Trace

```
Input: playKeySound('keydown', 'Enter')

1. Check enabled: true
2. Check loadingState: 'ready'
3. Check rate limit: 50ms since last sound (OK)
4. Get profile: cherry-mx-blue
5. Select sound array for 'Enter':
   - keyType is 'keydown'
   - key is 'Enter'
   - Return enterSounds array
6. enterSounds has 2 buffers
7. Current enter index: 0
8. Select buffer at index 0
9. Increment index to 1 (wraps to 0 after next)
10. Create source node
11. Apply pitch variation: 0.98 (random within +/-2%)
12. Set gain: 0.5 (user volume) * 1.0 (profile base) = 0.5
13. Connect: source -> gainNode -> masterGain -> destination
14. source.start(0)
15. Sound plays!
```

### B. Proof of Correctness

**Claim**: The sound selection algorithm provides varied, non-repetitive sound playback.

**Proof**:
1. Each key type (keydown, space, enter, backspace) maintains an independent index
2. Index advances by 1 after each playback
3. Index wraps to 0 when it reaches array length
4. With n variations, the same sound is never played twice in a row (unless n=1)
5. Pitch variation adds additional randomness even when same buffer is reused
6. Therefore, consecutive sounds will differ in either sample selection or pitch

**Claim**: Rate limiting prevents audio glitches from rapid keypresses.

**Proof**:
1. `lastPlayedTime` tracks the timestamp of the most recent sound
2. Before playing, we check if `now - lastPlayedTime < 10ms`
3. If true, we skip playback (return early)
4. This ensures minimum 10ms gap between sounds
5. At 100 sounds/second max, audio hardware can handle this easily
6. Therefore, no audio glitches from overlapping start times

### C. Alternative Approaches Considered

#### C.1 Howler.js Library

**Description**: Popular audio library with Web Audio API and HTML5 Audio fallback.

**Why Rejected**:
- Adds ~10KB dependency
- Abstracts away control we need
- Our use case is simple enough for direct Web Audio API
- No significant benefit over direct implementation

#### C.2 Pre-created Source Node Pool

**Description**: Create multiple AudioBufferSourceNodes upfront and reuse them.

**Why Rejected**:
- AudioBufferSourceNodes are single-use by design
- Browser explicitly optimizes for create-play-discard pattern
- Pool management adds complexity with no benefit
- MDN documentation confirms this is the intended pattern

#### C.3 Separate AudioContext per Profile

**Description**: Each profile gets its own AudioContext.

**Why Rejected**:
- Browser limits on AudioContext count
- Unnecessary resource usage
- Single AudioContext with multiple buffers is the standard pattern
