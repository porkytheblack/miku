# Changelog

All notable changes to Echoes of the Void will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Memory Convergence UI with drag-drop combining
- Stellar Remnant card (deals damage equal to Void level)
- Controller rumble feedback for Steam Deck

### Changed
- Save system v2 with better backwards compatibility
- Improved card hover animations

### Fixed
- Audio memory leak after extended play sessions
- Rare crash when Memory Devourer steals last card

## [0.4.0] - 2026-01-20

### Added
- Full controller support for Steam Deck
- New enemy type: Corruption Spawn
- 12 new Memory cards
- Daily Challenge mode (beta)

### Changed
- Rebalanced Void Meter fill rate (5% → 4% per turn)
- Hollow Knight now telegraphs 2 turns ahead
- Improved card draw animations

### Fixed
- Memory bonds not persisting between sectors
- UI scaling issues on ultrawide monitors
- Localization crashes with certain characters

## [0.3.2] - 2026-01-05

### Fixed
- Critical save corruption bug when alt-tabbing during autosave
- Boss health bars not updating correctly in phase 2
- Sound effects playing at wrong volume after minimizing

## [0.3.1] - 2025-12-28

### Fixed
- Hotfix for startup crash on Windows 7
- Memory leak in particle system

## [0.3.0] - 2025-12-20

### Added
- Memory Bond system
- 3 new boss encounters
- Event system with 15 unique events
- Achievement system (45 achievements)

### Changed
- Complete UI overhaul
- Card rarity colors updated
- Enemy AI improvements

### Removed
- Legacy save format support (migration tool provided)

## [0.2.0] - 2025-11-15

### Added
- Void corruption mechanic
- Meta-progression framework
- 8 new cards
- 2 new enemy types

### Fixed
- Numerous balance issues from playtesting

## [0.1.0] - 2025-10-01

### Added
- Initial alpha release
- Core combat system
- 30 starter cards
- 3 enemy types
- 1 boss encounter
- Basic save/load functionality
