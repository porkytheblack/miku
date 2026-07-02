# Changelog

All notable changes to Miku are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v3.0.0] — July 2026

This is a major release — the first since v0.0.9 (Feb 5, 2026). It brings Claude Code agent chat integration, system tray and multi-window support, image paste/drag-drop, system-wide file associations, a comprehensive UI/UX overhaul, and numerous bug fixes.

### ✨ Features

#### Claude Code Agent Chat Integration
- **Full Claude Code integration** — chat with Claude directly inside Miku using the claude CLI with streaming JSON output
- **Real-time streaming** — native Rust process streaming delivers stdout/stderr line-by-line as Tauri events for live response display
- **Rich tool call rendering** — tool-specific views for Edit (inline diffs), Write/Read (file previews), Bash (terminal-style), Grep/Glob (search results), TodoWrite (interactive checklist with progress bar), and WebSearch/WebFetch
- **Task tracking panel** — shows Claude's TodoWrite tasks with SVG checkboxes and progress indicator
- **File changes panel** — collapsible summary of edited/read files
- **Markdown rendering** — assistant messages and streaming content rendered as markdown with syntax highlighting, tables, links, and blockquotes (via @uiw/react-markdown-preview)
- **Permission modes** — Auto-approve (--dangerously-skip-permissions), Default (Claude Code config), and Plan mode (read-only tools)
- **Model selection** — Default, Sonnet 4, Opus 4, Haiku 4
- **Persistent agent chat** — EditorSwitcher keeps all agent chat editors mounted (hidden) so AcpClient connections and chat history stay alive across tab switches
- **Session restore** — tabs persisted to app data dir, restored on mount with debounced auto-save (500ms) and beforeunload save
- **Editable working directory** — compact badge in header with inline-edit, browse button (native directory picker), and per-document persistence

#### System Tray & Window Management
- **System tray** — TrayIconBuilder with Show/New Window/Quit menu; left-click shows and focuses main window
- **Minimize to tray** — hide window to tray via command palette
- **Always on top** — toggle via command palette
- **Multi-window** — spawn new webview windows from tray menu or command palette (Cmd+K)

#### Image Support
- **Paste images from clipboard** — pasted image bytes saved to `assets/` folder next to document, markdown `![alt](src)` inserted at cursor
- **Drag-drop images** — drag from OS file manager or browser directly into the editor
- **Inline image previews** — ImagePreviewLayer renders thumbnail previews in the right gutter, aligned with each image's markdown line, scrolling with the textarea

#### File Associations
- **System-wide file associations** — double-click `.md`, `.markdown`, `.mdown`, `.mkd`, `.mdwn` files in Finder/Explorer/nautilus to open in Miku
- **Native Miku formats registered** — `.miku` (agent config), `.miku-env`, `.miku-kanban`, `.miku-docs`, `.miku-chat` open via OS file associations
- **Cross-platform wiring** — macOS uses RunEvent::Opened (Apple Events), Windows/Linux uses tauri-plugin-single-instance + args parsing

#### UI/UX
- **Comprehensive agent chat overhaul** — full design system integration using app CSS variables, card-based connect screen, permission approval cards with risk-level coloring, fade-in animations, pulse effects
- **Reusable component library** — Button (4 variants, 3 sizes), OptionButton, StatusBadge, PermissionBadge, ChatIcon, ChevronIcon, ErrorBanner, TaskStatusIcon
- **Command palette** — Cmd+K with Toggle Always on Top, Minimize to System Tray, New Window commands

### 🐛 Bug Fixes

- **macOS title bar dark theme** — title bar was rendering white (default chrome); switched to `titleBarStyle: "Overlay"` + `hiddenTitle: true` with `data-tauri-drag-region` for window dragging
- **Agent chat TypeScript error** — `unknown` description coerced to boolean (`!!`) for JSX guard on Next 16.1.4's stricter React children typing
- **macOS compatibility** — added /opt/homebrew/bin and /usr/local/bin to Claude binary search paths, NVM node version enumeration, augmented PATH for spawned processes, extended capabilities to miku-* windows
- **Tray-icon compilation on Windows** — extracted tray setup into `#[cfg(desktop)]` function, explicit type annotations for closure params
- **Image asset protocol** — enabled `app.security.assetProtocol.enable` in tauri.conf.json so pasted/dropped images render; tightened drop default handling to prevent native file/URL drop navigation
- **Various agent chat streaming fixes** — CLI arg ordering, --verbose flag for stream-json, execute() fallback, diagnostic logging, pre-flight version check, Windows .cmd support
- **CI release workflow** — migrated release.yml from npm to pnpm after package-lock.json removal; upgraded tauri-action from v0 to v1

### 🔧 Chores & Maintenance

- **Standardized on pnpm** — removed `package-lock.json`, pnpm-lock.yaml is the source of truth
- **Added CONTRIBUTING.md** — contribution guidelines for the project
- **Added issue templates** — structured bug report and feature request templates
- **Removed scratch files** — cleaned up `some-cool-stuff.md` and `stuff.md`
- **Version bumped to v3.0.0** — standardized across package.json, Cargo.toml, and tauri.conf.json

### 📋 Merged Pull Requests

| PR | Title | Date |
|----|-------|------|
| #22 | fix(ci): migrate release.yml from npm to pnpm | Jul 2 |
| #20 | chore: repo cleanup — remove scratch files, standardize on pnpm, add CONTRIBUTING.md + issue templates | Jul 2 |
| #19 | fix(ui): make title bar follow dark theme on macOS | Jul 2 |
| #18 | fix(agent-chat): coerce unknown description to boolean for JSX guard | Apr 16 |
| #17 | fix(ci): force tauri-action to use npm, not auto-detected pnpm | Apr 16 |
| #16 | feat: image paste and drag-drop with inline previews | Apr 15 |
| #15 | feat: system-wide file associations for .md and native Miku formats | Apr 15 |
| #14 | feat: paste and drag-drop images into the editor with inline previews | Apr 14 |
| #13 | feat: add image preview layer and drag-drop image insertion | Apr 14 |
| #12 | feat: ACP/Claude Code support with system tray, multi-window, session restore | Mar 12 |

---

## [v0.0.9] — Feb 5, 2026

- feat: tabbing + links + bottom padding on env editor + themes
- patch: checklist

## [v0.0.8] — Feb 3, 2026

- patch: removed landing page from tauri
- feat: v0.0.8 ready
- patch: autosave + new landing page

## [v0.0.7] — Feb 3, 2026

- v0.0.7 version bump
- feat: mechanical keyboard sounds + patch: kanban board clearance

## [v0.0.6] — Feb 3, 2026

- patch: version bump
- feat: update requests
