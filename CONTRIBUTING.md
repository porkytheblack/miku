# Contributing to Miku

Thanks for your interest in contributing to Miku! This document covers the basics.

## Getting Started

Miku is a [Tauri](https://tauri.app) + [Next.js](https://nextjs.org) desktop editor. To work on it locally:

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [pnpm](https://pnpm.io) (the project's package manager — do not use npm/yarn)
- [Rust](https://www.rust-lang.org) toolchain (for Tauri)
- Platform-specific Tauri dependencies — see the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/porkytheblack/miku.git
cd miku
pnpm install
pnpm tauri dev
```

## Development Workflow

1. **Create a branch** from `main` — use a descriptive name like `fix/short-description` or `feat/short-description`.
2. **Make your changes** — keep PRs focused and small.
3. **Test locally** — run `pnpm tauri dev` to verify the app builds and your changes work.
4. **Open a pull request** — fill in the PR template and describe what you changed and why.
5. **Address review feedback** — respond to comments and push updates to your branch.

### Code Style

- The project uses [ESLint](https://eslint.org) with a flat config (`eslint.config.mjs`).
- Run `pnpm lint` to check for issues before submitting.
- Use TypeScript throughout — avoid `any` where possible.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Common types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.

## Package Manager

This project uses **pnpm**. The `pnpm-lock.yaml` file is the source of truth for dependencies. Do not commit `package-lock.json` or `yarn.lock`.

## Reporting Issues

Use the GitHub issue templates for bug reports and feature requests. Provide as much detail as possible — screenshots, reproduction steps, and your OS/version are especially helpful for a desktop app.

## Questions?

Open a GitHub discussion or issue and we'll get back to you.