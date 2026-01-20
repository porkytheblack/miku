# Miku — UI & Design Tokens

## Design Language

Miku's visual design mirrors Anthropic's aesthetic: warm, calm, and human. The interface should feel like quality paper—something you want to write on—not a sterile digital tool.

---

## Design Principles

### 1. Invisible by Default
UI elements hide themselves. The screen belongs to your words. Controls appear only when needed and retreat when they're not.

### 2. Warmth Over Sterility
No pure whites. No pure blacks. Colors are softened and warm, reducing eye strain and creating a sense of comfort during long writing sessions.

### 3. Calm Motion
Animations are subtle and purposeful. Nothing bounces, flashes, or demands attention. Transitions feel like breathing—smooth and natural.

### 4. Generous Space
Whitespace is a feature, not wasted space. Text has room to breathe. Elements don't crowd each other.

---

## Color Tokens

### Light Mode

```
Background
--bg-primary:          #FAFAF9      /* Main writing surface */
--bg-secondary:        #F5F5F4      /* Floating bar, tooltips */
--bg-tertiary:         #E7E5E4      /* Hover states, subtle borders */

Text
--text-primary:        #1C1917      /* Body text */
--text-secondary:      #57534E      /* Muted text, placeholders */
--text-tertiary:       #A8A29E      /* Disabled, hints */

Accent
--accent-primary:      #D97757      /* Anthropic coral - status, focus rings */
--accent-subtle:       #FDEBE6      /* Accent backgrounds */

Border
--border-default:      #E7E5E4      /* Subtle dividers */
--border-focus:        #D97757      /* Focus states */
```

### Dark Mode

```
Background
--bg-primary:          #1C1917      /* Main writing surface */
--bg-secondary:        #292524      /* Floating bar, tooltips */
--bg-tertiary:         #44403C      /* Hover states, subtle borders */

Text
--text-primary:        #FAFAF9      /* Body text */
--text-secondary:      #A8A29E      /* Muted text, placeholders */
--text-tertiary:       #78716C      /* Disabled, hints */

Accent
--accent-primary:      #E89B7D      /* Softened coral for dark mode */
--accent-subtle:       #2D2420      /* Accent backgrounds */

Border
--border-default:      #44403C      /* Subtle dividers */
--border-focus:        #E89B7D      /* Focus states */
```

### Highlight Colors (Both Modes)

Used for Miku's editorial highlights. Semi-transparent to let text show through.

```
--highlight-clarity:    rgba(234, 179, 8, 0.25)    /* Yellow - clarity issues */
--highlight-grammar:    rgba(239, 68, 68, 0.25)    /* Red - errors */
--highlight-style:      rgba(59, 130, 246, 0.25)   /* Blue - style suggestions */
--highlight-structure:  rgba(168, 85, 247, 0.25)   /* Purple - structure */
--highlight-economy:    rgba(34, 197, 94, 0.25)    /* Green - redundancy */
```

---

## Typography

### Font Stack

```
--font-mono:      'JetBrains Mono', 'SF Mono', 'Fira Code', monospace
--font-sans:      'Inter', -apple-system, BlinkMacSystemFont, sans-serif
```

**Editor:** Uses `--font-mono` by default (customizable)
**UI Elements:** Uses `--font-sans`

### Scale

```
--text-xs:        12px     /* Tooltips, labels */
--text-sm:        14px     /* UI text, secondary info */
--text-base:      16px     /* Default editor text */
--text-lg:        18px     /* Optional larger editor text */
--text-xl:        20px     /* Optional larger editor text */
```

### Line Height

```
--leading-tight:   1.4     /* UI elements */
--leading-normal:  1.6     /* Editor default */
--leading-relaxed: 1.8     /* Optional relaxed spacing */
```

### Font Weight

```
--weight-normal:   400
--weight-medium:   500
--weight-semibold: 600
```

---

## Spacing

Based on a 4px grid.

```
--space-1:    4px
--space-2:    8px
--space-3:    12px
--space-4:    16px
--space-5:    20px
--space-6:    24px
--space-8:    32px
--space-10:   40px
--space-12:   48px
--space-16:   64px
```

### Editor Specific

```
--editor-padding-x:      clamp(24px, 15vw, 200px)   /* Responsive side margins */
--editor-padding-y:      var(--space-16)            /* Top/bottom breathing room */
--editor-max-width:      720px                       /* Optimal reading width */
```

---

## Radius

```
--radius-sm:     4px      /* Small buttons, tags */
--radius-md:     8px      /* Tooltips, inputs */
--radius-lg:     12px     /* Floating bar */
--radius-full:   9999px   /* Pills, circular elements */
```

---

## Shadows

Minimal and warm-tinted.

```
Light Mode
--shadow-sm:     0 1px 2px rgba(28, 25, 23, 0.05)
--shadow-md:     0 4px 12px rgba(28, 25, 23, 0.08)
--shadow-lg:     0 8px 24px rgba(28, 25, 23, 0.12)

Dark Mode
--shadow-sm:     0 1px 2px rgba(0, 0, 0, 0.2)
--shadow-md:     0 4px 12px rgba(0, 0, 0, 0.3)
--shadow-lg:     0 8px 24px rgba(0, 0, 0, 0.4)
```

---

## Animation

```
--duration-fast:      100ms
--duration-normal:    200ms
--duration-slow:      300ms

--easing-default:     cubic-bezier(0.4, 0, 0.2, 1)
--easing-in:          cubic-bezier(0.4, 0, 1, 1)
--easing-out:         cubic-bezier(0, 0, 0.2, 1)
```

---

## Component Specifications

### The Editor

```
Container:
- Background:         var(--bg-primary)
- Width:              100vw
- Height:             100vh
- Overflow:           auto

Content Area:
- Max Width:          var(--editor-max-width)
- Margin:             0 auto
- Padding:            var(--editor-padding-y) var(--editor-padding-x)

Text:
- Font:               var(--font-mono)
- Size:               var(--text-base)
- Color:              var(--text-primary)
- Line Height:        var(--leading-normal)

Cursor:
- Color:              var(--accent-primary)
- Width:              2px
- Animation:          Gentle blink, 1s interval
```

### Floating Bar

```
Container:
- Position:           Fixed, bottom center
- Bottom Offset:      var(--space-6)
- Background:         var(--bg-secondary)
- Border:             1px solid var(--border-default)
- Border Radius:      var(--radius-lg)
- Padding:            var(--space-2) var(--space-4)
- Shadow:             var(--shadow-md)
- Min Width:          120px
- Height:             40px

Visibility:
- Default:            opacity: 0, pointer-events: none
- On Hover Zone:      opacity: 1, pointer-events: auto
- On Miku Active:     opacity: 1, pointer-events: auto
- Transition:         opacity var(--duration-normal) var(--easing-default)

Hover Zone:
- Invisible div at bottom of viewport
- Height:             80px

Contents:
- Layout:             Flexbox, center aligned, gap: var(--space-3)
- Status Indicator:   16px icon or animated dots
- Settings Icon:      16px, color: var(--text-secondary)
- Settings Hover:     color: var(--text-primary)
```

### Status Indicator States

```
Idle:
- Icon:               Small circle or Miku logo
- Color:              var(--text-tertiary)

Thinking:
- Animation:          Three dots, staggered fade
- Color:              var(--accent-primary)

Ready (has suggestions):
- Icon:               Small badge or glow
- Color:              var(--accent-primary)
```

### Highlight

```
Appearance:
- Background:         Respective highlight color token
- Border Radius:      2px
- Cursor:             pointer

Hover State:
- Background:         Increase opacity by 0.1
- Transition:         var(--duration-fast)
```

### Tooltip

```
Container:
- Position:           Absolute, above highlight
- Background:         var(--bg-secondary)
- Border:             1px solid var(--border-default)
- Border Radius:      var(--radius-md)
- Padding:            var(--space-4)
- Shadow:             var(--shadow-lg)
- Max Width:          320px

Header:
- Font:               var(--font-sans)
- Size:               var(--text-sm)
- Weight:             var(--weight-medium)
- Color:              var(--text-primary)
- Margin Bottom:      var(--space-2)

Observation Text:
- Font:               var(--font-sans)
- Size:               var(--text-sm)
- Color:              var(--text-secondary)
- Margin Bottom:      var(--space-3)

Suggested Revision:
- Background:         var(--bg-tertiary)
- Border Radius:      var(--radius-sm)
- Padding:            var(--space-3)
- Font:               var(--font-mono)
- Size:               var(--text-sm)
- Color:              var(--text-primary)
- Margin Bottom:      var(--space-3)

Actions:
- Layout:             Flexbox, gap: var(--space-2)
- Button Style:       Ghost buttons, var(--text-sm)
- Accept Button:      var(--accent-primary) text
- Dismiss Button:     var(--text-secondary) text

Animation:
- Entry:              Fade + slight Y translate (8px → 0)
- Duration:           var(--duration-normal)
```

---

## Settings Panel

```
Trigger:              Click settings icon in floating bar
Container:            Modal overlay, centered
Size:                 400px width, auto height (max 80vh)
Background:           var(--bg-secondary)
Border Radius:        var(--radius-lg)
Shadow:               var(--shadow-lg)

Sections:
- Appearance (theme toggle, colors)
- Typography (font, size, line height)
- Editor (max width, padding)
- Miku (sensitivity, auto-review timing)

Overlay:
- Background:         rgba(0, 0, 0, 0.5)
- Click to dismiss:   Yes
```

---

## Responsive Behavior

```
< 768px (Mobile/Tablet):
- Editor padding:     var(--space-4)
- Floating bar:       Full width minus var(--space-4) margins
- Tooltips:           Bottom sheet style, full width

>= 768px (Desktop):
- Standard layout as specified above
```

---

## Customizable Properties

Exposed in settings for user modification:

```
Theme:               Light / Dark / System
Background Color:    Color picker (defaults to --bg-primary)
Text Color:          Color picker (defaults to --text-primary)
Accent Color:        Color picker (defaults to --accent-primary)
Font Family:         Dropdown (Mono options + System)
Font Size:           Slider (14px - 24px)
Line Height:         Slider (1.4 - 2.0)
Editor Width:        Slider (480px - 960px)
```

---

## Summary

Miku's interface is defined by restraint. Warm colors, generous space, and invisible UI let writers focus on what matters—their words. Every pixel serves the writing experience.
