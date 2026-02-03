# Technical Notes

Random technical notes, discoveries, and reminders for the dev team.

---

## FMOD Audio Memory Leak (Jan 30, 2026)

**Status**: In Progress

Found the culprit! FMOD event instances aren't being released when sounds finish playing. The issue is in `AudioManager.PlayOneShot()` - we're creating instances but the callback for release isn't firing.

```csharp
// WRONG - instance never released
eventInstance.start();

// RIGHT - release after playback
eventInstance.start();
eventInstance.release(); // This schedules release after sound completes
```

Need to audit all 47 call sites. Priority: HIGH (audio cuts out after ~20 min).

---

## Tauri WKWebView Drag and Drop (Jan 28, 2026)

If anyone's wondering why we use mouse events instead of HTML5 DnD for the deck builder UI: **WKWebView doesn't properly support HTML5 Drag and Drop API**.

The `dataTransfer` object is basically non-functional. Had to implement our own drag system using:
- `mousedown` with threshold detection (5px)
- Document-level `mousemove` listeners
- React state for drag tracking
- Portal-based drag preview

Works great now but took 2 days to figure out. Don't try to "fix" it by switching to native DnD.

---

## Save File Encryption (Jan 22, 2026)

Using AES-256-GCM for save encryption in production. Key derivation:

1. Hardware ID (stable across sessions)
2. Steam user ID (if available)
3. Installation timestamp
4. Salt stored in registry/keychain

This prevents simple save file sharing while not being draconian. Determined cheaters will crack it, but casual sharing is blocked.

**Note**: Dev builds use plaintext saves for debugging.

---

## Shader Compilation Stuttering (Jan 15, 2026)

Getting reports of stuttering on first card plays. Root cause: shader compilation on first use.

Solutions considered:
1. ❌ Warm up all shaders at load - too slow, 800+ variants
2. ✅ Background compilation during menu - compile common shaders while player is in menus
3. ✅ Shader cache persistence - Unity's caching should help on subsequent launches

Implementing #2 and #3. Should reduce "first play" stutters significantly.

---

## Memory Profiling Results (Jan 10, 2026)

Baseline memory usage after 1 hour:
- Before optimization: 2.4 GB
- After texture streaming: 1.1 GB
- After audio fixes (pending): ???

Main offenders:
1. Card art textures (fixed with streaming)
2. Audio instances (in progress)
3. Particle systems (acceptable)

Target: Stay under 1.5 GB for 4+ hour sessions.

---

## Random Seed Handling (Jan 5, 2026)

For daily challenges, we need deterministic RNG. Current implementation:

```csharp
// Seed = YYYYMMDD as int
int seed = int.Parse(DateTime.UtcNow.ToString("yyyyMMdd"));
Random.InitState(seed);
```

This gives everyone the same daily challenge regardless of timezone (uses UTC).

**Important**: Enemy AI decisions must also use seeded RNG, not Unity's default.

---

## Controller Deadzone Tuning (Dec 20, 2025)

Steam Deck has different stick characteristics than Xbox/PlayStation controllers.

Final values:
- Xbox/PS: 0.15 deadzone
- Steam Deck: 0.20 deadzone
- Generic: 0.18 deadzone (safe default)

Auto-detect controller type via Steam Input API when available.

---

## Build Time Optimization (Dec 12, 2025)

Full build was taking 45 minutes. Optimizations:

1. Asset import cache on CI - saves ~15 min
2. Parallel script compilation - saves ~5 min
3. Incremental builds for dev - saves sanity

Current times:
- Full CI build: 25 min
- Dev incremental: 2-3 min

Still want to get CI under 20 min but it's acceptable now.
