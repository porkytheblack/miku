# Echoes of the Void

A roguelike deckbuilder set in a dying universe. Players collect memories of fallen civilizations to power their abilities.

## Overview

In **Echoes of the Void**, you play as a Remembrancer—one of the last beings capable of channeling the memories of extinct species. As the universe slowly collapses into entropy, you travel between dying star systems, collecting memory fragments. You use these fragments to survive encounters with the Hollow—entities born from the void itself.

## Core Mechanics

### Memory Cards
- Each card represents a memory from a fallen civilization
- Cards have **Resonance** (cost), **Echo** (effect), and **Fade** (durability)
- Some memories can be combined to unlock **Convergence** abilities

### The Void Meter
- Every turn, the Void creeps closer
- Taking damage or using powerful abilities accelerates Void accumulation
- At 100%, the run ends—but you keep one memory for your next attempt

### Star System Navigation
- Procedurally generated star maps
- Each node is a dying world with unique encounters
- Choose your path: more dangerous routes yield rarer memories

## Current Build

**Version:** 0.4.2-alpha
**Last Updated:** 2024-01-28
**Status:** Playable vertical slice

### What's Working
- Core card combat loop
- 47 unique memory cards
- 3 enemy types (Hollow Shade, Void Leech, Entropy Warden)
- Basic star map generation
- Save/load system

### Known Issues
- Memory combination UI is placeholder
- Audio cuts out after ~20 minutes
- Rare crash when loading saves from v0.3.x

## Team

- **Design & Code:** Solo developer
- **Art:** Commissioned from various artists
- **Music:** Placeholder tracks, looking for composer

## Links

- [Design Document](./docs/game-design.docs)
- [Development Roadmap](./roadmap.kanban)
- [Technical Notes](./docs/tech-notes.md)
