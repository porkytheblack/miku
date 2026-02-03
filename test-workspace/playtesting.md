# Playtest Session Notes

## Upcoming: Discord Playtest - Feb 5, 2026

### Logistics
- **Time**: 7 PM EST
- **Platform**: Discord voice + screen share
- **Build**: v0.4.1-beta
- **Participants**: ~15 confirmed

### Focus Areas
1. New Memory Convergence UI
2. Stellar Remnant card balance
3. Audio after extended play (memory leak fix verification)

### Build Checklist
- [x] Windows executable
- [x] macOS executable
- [ ] Write playtest instructions
- [ ] Set up feedback form

---

## Session #12 - Jan 28, 2026

**Participants**: Alex, Jordan, Sam, Taylor (4 testers)
**Build**: v0.4.0
**Duration**: 2 hours each

### Key Findings

#### Balance Issues
- **Void Meter fills too fast** - Multiple testers felt punished for playing cards
  - Recommendation: Reduce base fill from 5% to 4% per turn ✅ Implemented

- **Hollow Knight too unpredictable** - One-turn telegraphs aren't enough
  - Recommendation: Show intent 2 turns ahead ✅ Implemented

- **Stellar Remnant feels mandatory** - "Why would I pick anything else at high Void?"
  - Status: Under review, may need damage cap

#### UX Issues
- Card hover animations clip on screen edge (Sam)
- "Discard" vs "Exhaust" distinction unclear for new players (Taylor)
- Daily challenge seed isn't shown anywhere (Alex)

#### Bugs Found
- Memory bonds don't persist between sectors ✅ Fixed
- Rare crash when Memory Devourer steals last card ⏳ In Progress
- Controller can't navigate event choices (Jordan) ✅ Fixed

### Quotes
> "The moment I realized my cards were bonding together... that's when it clicked." - Jordan

> "I want to feel powerful at high Void, but right now I just feel punished." - Alex

---

## Session #11 - Jan 14, 2026

**Participants**: 6 testers (Discord community)
**Build**: v0.3.2
**Duration**: 1.5 hours avg

### Key Findings

#### Positive Feedback
- New save system is seamless
- Controller support "feels native" on Steam Deck
- Event writing praised across the board

#### Issues
- Ultrawide monitor UI scaling broken ✅ Fixed in 0.4.0
- Audio cuts out after ~20 minutes ⏳ Root cause identified
- Localization crashes with Japanese characters ✅ Fixed

### Feature Requests
- Deck viewing during combat (most requested)
- Card stats/history tracking
- Customizable key bindings

---

## Session #10 - Dec 20, 2025

**Participants**: 8 testers (mix of genre veterans and newcomers)
**Build**: v0.3.0
**Duration**: 2 hours

### First Impressions (New Players)

| Tester | Prior Experience | Time to "Get It" | Completed Tutorial |
|--------|------------------|------------------|-------------------|
| Pat | Slay the Spire veteran | Immediate | Skipped |
| Robin | Casual gamer | ~15 min | Yes |
| Casey | No deckbuilders | ~25 min | Yes, with confusion |
| Morgan | Hearthstone only | ~10 min | Partial |

### Tutorial Feedback
- Step 3 (card types) needs visual examples
- Void Meter explanation too brief
- "I didn't know I could right-click cards for details" - Casey

### Combat Pacing
- Turns feel good length-wise
- Enemy turn animations could be faster
- End turn button position awkward (moved in 0.3.1)

---

## Testing Protocol

### Pre-Session
1. Confirm build is stable
2. Prepare feedback form
3. Brief testers on focus areas
4. Ensure recording consent

### During Session
- Note timestamps for interesting moments
- Don't interrupt unless asked
- Watch for confusion points
- Track completion rates

### Post-Session
1. Send thank-you + feedback form link
2. Compile notes within 24 hours
3. Create tickets for reproducible bugs
4. Update roadmap if needed
