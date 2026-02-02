# Oasis Update Server Setup Guide

This guide walks you through setting up automated releases for your Tauri application using the Oasis Update Server, Cloudflare R2 for storage, and GitHub Actions for CI/CD.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Architecture](#architecture)
4. [Setup Steps](#setup-steps)
   - [1. Cloudflare R2 Setup](#1-cloudflare-r2-setup)
   - [2. Oasis Server Setup](#2-oasis-server-setup)
   - [3. Tauri App Configuration](#3-tauri-app-configuration)
   - [4. GitHub Repository Setup](#4-github-repository-setup)
   - [5. Apple Developer Setup (macOS)](#5-apple-developer-setup-macos)
5. [GitHub Secrets Reference](#github-secrets-reference)
6. [Releasing a New Version](#releasing-a-new-version)
7. [Troubleshooting](#troubleshooting)

---

## Overview

This setup enables:

- **Automatic builds** for macOS (ARM64 + Intel), Windows (x64), and Linux (x64)
- **Code signing** for macOS (Apple notarization) and update artifacts (Tauri signing)
- **Installer distribution** (.dmg, .exe, .AppImage) for first-time downloads
- **In-app updates** via Tauri's built-in updater
- **Centralized release management** through the Oasis dashboard

## Prerequisites

Before starting, ensure you have:

- [ ] A Tauri v2 application
- [ ] A GitHub repository for your app
- [ ] A Cloudflare account (free tier works)
- [ ] An Oasis Update Server instance (self-hosted or managed)
- [ ] (Optional) Apple Developer account for macOS code signing

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RELEASE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. Developer pushes tag (v1.0.0)                                       │
│           │                                                             │
│           ▼                                                             │
│  2. GitHub Actions builds for all platforms                             │
│           │                                                             │
│           ├──► macOS ARM64  ──► .app.tar.gz + .dmg                     │
│           ├──► macOS Intel  ──► .app.tar.gz + .dmg                     │
│           ├──► Windows x64  ──► .msi + .exe                            │
│           └──► Linux x64    ──► .AppImage.tar.gz + .AppImage           │
│                                                                         │
│  3. Artifacts uploaded to Cloudflare R2                                 │
│           │                                                             │
│           ▼                                                             │
│  4. Release registered with Oasis Server                                │
│           │                                                             │
│           ├──► Update artifacts (for in-app updater)                   │
│           └──► Installers (for landing page downloads)                 │
│                                                                         │
│  5. Users receive updates                                               │
│           │                                                             │
│           ├──► Existing users: In-app updater checks Oasis             │
│           └──► New users: Download installers from your site           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Setup Steps

### 1. Cloudflare R2 Setup

R2 is used to store your release artifacts and installers.

#### Create an R2 Bucket

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2** in the sidebar
3. Click **Create bucket**
4. Name it (e.g., `my-app-releases`)
5. Choose a location close to your users

#### Create R2 API Tokens

You need **two tokens** with different permissions:

**Token 1: CI/CD Token (for GitHub Actions)**
1. Go to **R2** → **Manage R2 API Tokens**
2. Click **Create API Token**
3. Configure:
   - **Name**: `GitHub Actions - MyApp`
   - **Permissions**: `Object Read & Write`
   - **Specify bucket(s)**: Select your bucket
4. Save the **Access Key ID** and **Secret Access Key**

**Token 2: Oasis Server Token (for file verification)**
1. Create another token with the same settings
2. Or use the same token if your Oasis server needs write access

#### Get Your Account ID

1. Go to any R2 page in Cloudflare Dashboard
2. Copy your **Account ID** from the URL or sidebar

#### (Optional) Set Up Public Access

For direct download links, enable public access:

1. Go to your bucket → **Settings**
2. Under **Public access**, click **Allow Access**
3. Set up a custom domain or use the R2.dev subdomain
4. Note the public URL (e.g., `https://releases.example.com`)

---

### 2. Oasis Server Setup

#### Configure Oasis Environment Variables

Your Oasis server needs these environment variables:

```env
# R2 Configuration
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=my-app-releases

# Optional: Public URL for downloads
R2_PUBLIC_URL=https://releases.example.com
```

#### Create Your App in Oasis

1. Log in to your Oasis dashboard
2. Create a new app with:
   - **Name**: Your app name
   - **Slug**: URL-friendly identifier (e.g., `my-app`)

#### Generate a CI API Key

1. In Oasis, go to **Settings** → **API Keys**
2. Create a new key with:
   - **Name**: `GitHub Actions CI`
   - **Scope**: `ci`
   - **App**: Select your app
3. Save the key (format: `uk_live_xxxxx`)

---

### 3. Tauri App Configuration

#### Install the Updater Plugin

```bash
# Add the Rust plugin
cargo add tauri-plugin-updater --manifest-path src-tauri/Cargo.toml

# Add the JavaScript plugin
npm install @tauri-apps/plugin-updater
```

#### Configure tauri.conf.json

Add the updater configuration:

```json
{
  "version": "1.0.0",
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://your-oasis-server.com/my-app/update/{{target}}-{{arch}}/{{current_version}}"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  },
  "bundle": {
    "macOS": {
      "signingIdentity": "-"
    }
  }
}
```

Replace:
- `YOUR_PUBLIC_KEY_HERE` with your Tauri signing public key
- `your-oasis-server.com` with your Oasis server URL
- `my-app` with your app slug

#### Generate Tauri Signing Keys

```bash
npx tauri signer generate -w ~/.tauri/myapp.key
```

This creates:
- `~/.tauri/myapp.key` - Private key (keep secret!)
- `~/.tauri/myapp.key.pub` - Public key (goes in tauri.conf.json)

**Important**: Save the private key securely. You'll need it for GitHub Secrets.

#### Register the Plugin (src-tauri/src/lib.rs)

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        // ... other plugins
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### Add Capability (src-tauri/capabilities/default.json)

```json
{
  "permissions": [
    "updater:default",
    // ... other permissions
  ]
}
```

---

### 4. GitHub Repository Setup

#### Create the Workflow File

Create `.github/workflows/release.yml` with the release workflow. See the [example workflow](#example-workflow) below.

#### Add GitHub Secrets

Go to **Repository** → **Settings** → **Secrets and variables** → **Actions**

Add all required secrets (see [GitHub Secrets Reference](#github-secrets-reference)).

---

### 5. Apple Developer Setup (macOS)

For macOS code signing and notarization:

#### Export Your Certificate

1. Open **Keychain Access** on your Mac
2. Find your "Developer ID Application" certificate
3. Right-click → **Export**
4. Save as `.p12` file with a password

#### Base64 Encode the Certificate

```bash
base64 -i Certificates.p12 | pbcopy
```

This copies the base64-encoded certificate to your clipboard.

#### Create an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in → **Security** → **App-Specific Passwords**
3. Generate a password for "GitHub Actions"

#### Find Your Team ID

1. Go to [developer.apple.com/account](https://developer.apple.com/account)
2. **Membership** → Copy your **Team ID**

---

## GitHub Secrets Reference

| Secret | Description | Example |
|--------|-------------|---------|
| **Apple Signing** | | |
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate | `MIIKkQIBAzCCCl...` |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the .p12 file | `your-password` |
| `APPLE_SIGNING_IDENTITY` | Signing identity name | `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | Apple Developer email | `dev@example.com` |
| `APPLE_PASSWORD` | App-specific password | `xxxx-xxxx-xxxx-xxxx` |
| `APPLE_TEAM_ID` | Apple Developer Team ID | `ABCD1234EF` |
| **Tauri Signing** | | |
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of your .key file | `dW50cnVzdGVkIGNv...` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the key (optional) | `your-password` |
| **Cloudflare R2** | | |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare Account ID | `a1b2c3d4e5f6...` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 API Access Key ID | `a1b2c3d4e5f6...` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API Secret Access Key | `xxxxxxxxxxxxxx...` |
| `R2_BUCKET_NAME` | Name of your R2 bucket | `my-app-releases` |
| `R2_PUBLIC_URL` | Public URL for the bucket | `https://releases.example.com` |
| **Oasis Server** | | |
| `OASIS_SERVER_URL` | Base URL of Oasis server | `https://updates.example.com` |
| `OASIS_CI_KEY` | CI API key from Oasis | `uk_live_xxxxx...` |

---

## Releasing a New Version

### Using Version Scripts

```bash
# Bump patch version (1.0.0 → 1.0.1)
npm run version:bump:patch

# Bump minor version (1.0.0 → 1.1.0)
npm run version:bump:minor

# Bump major version (1.0.0 → 2.0.0)
npm run version:bump:major

# Check versions are in sync
npm run version:check
```

### Create and Push Release

```bash
# Commit version bump
git add -A
git commit -m "Bump version to $(npm run version:get --silent)"

# Create tag and push
VERSION=$(npm run version:get --silent)
git tag "v$VERSION"
git push && git push --tags
```

### What Happens Next

1. GitHub Actions triggers on the tag push
2. Builds run in parallel for all platforms
3. Artifacts are signed and uploaded to R2
4. Release is registered with Oasis
5. GitHub Release is created with download links

---

## Troubleshooting

### Build Failures

**"No artifact found"**
- Check the bundle directory paths in the workflow
- Ensure Tauri is configured to produce the expected bundle types

**"Failed to sign"**
- Verify `TAURI_SIGNING_PRIVATE_KEY` is set correctly
- Ensure the key content is the actual key, not a file path

### R2 Upload Issues

**"Access Denied" or "CreateBucket" error**
- Ensure R2 token has `Object Read & Write` permissions
- Verify the bucket name matches exactly
- Check the Account ID is correct

**"File not found in R2"**
- Verify the Oasis server and GitHub use the same bucket name
- Check R2 credentials on your Oasis server
- Ensure both tokens can access the same bucket

### macOS Signing Issues

**"Certificate not found"**
- Ensure `APPLE_CERTIFICATE` is base64-encoded correctly
- Verify the certificate password is correct

**"Notarization failed"**
- Check `APPLE_ID` and `APPLE_PASSWORD` (app-specific password)
- Ensure `APPLE_TEAM_ID` matches your certificate

### Update Not Working

**"Signature verification failed"**
- Ensure `pubkey` in `tauri.conf.json` matches your private key
- Verify artifacts were signed during build

**"No update available"**
- Check the endpoint URL format in `tauri.conf.json`
- Verify the release was published (not draft) in Oasis
- Check the platform format matches (`darwin-aarch64`, not `macos-arm64`)

---

## Example Workflow

See `.github/workflows/release.yml` for a complete working example that:

- Builds for macOS (ARM64 + Intel), Windows, and Linux
- Signs macOS builds with Apple certificates
- Signs all update artifacts with Tauri signing key
- Uploads update artifacts to `{app}/releases/{version}/`
- Uploads installers to `{app}/installers/{version}/`
- Registers the release with Oasis (including installers)
- Creates a GitHub Release with download links

---

## File Structure

After setup, your repository should have:

```
your-app/
├── .github/
│   └── workflows/
│       └── release.yml          # Release workflow
├── src-tauri/
│   ├── Cargo.toml               # With tauri-plugin-updater
│   ├── capabilities/
│   │   └── default.json         # With updater:default permission
│   ├── src/
│   │   └── lib.rs               # With updater plugin registered
│   └── tauri.conf.json          # With updater configuration
├── scripts/
│   └── version.js               # Version management script
├── package.json                 # With version scripts
└── docs/
    └── OASIS_SETUP_GUIDE.md     # This guide
```

---

## Support

- **Oasis Issues**: [GitHub Issues](https://github.com/porkytheblack/oasis/issues)
- **Tauri Documentation**: [tauri.app/docs](https://tauri.app/docs)
- **Cloudflare R2 Docs**: [developers.cloudflare.com/r2](https://developers.cloudflare.com/r2)
