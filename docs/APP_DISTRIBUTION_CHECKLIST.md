# App Distribution Checklist

A step-by-step checklist for setting up Tauri app distribution with Oasis server, based on the Miku app configuration.

> For detailed explanations, see [OASIS_SETUP_GUIDE.md](./OASIS_SETUP_GUIDE.md)

---

## Quick Reference

| Component | Files to Copy/Modify |
|-----------|---------------------|
| Icons | `src-tauri/icons/` |
| Tauri Config | `src-tauri/tauri.conf.json` |
| Capabilities | `src-tauri/capabilities/default.json` |
| Rust Entry | `src-tauri/src/lib.rs` |
| Version Script | `scripts/version.js` |
| GitHub Workflow | `.github/workflows/release.yml` |

---

## Step 1: Generate Icons

### Required Icon Files

Create these files in `src-tauri/icons/`:

```
icons/
├── 32x32.png
├── 64x64.png           # Optional but recommended
├── 128x128.png
├── 128x128@2x.png      # 256x256 pixels for Retina
├── icon.icns           # macOS (generate from PNG)
├── icon.ico            # Windows (generate from PNG)
├── icon.png            # Master icon (512x512 or 1024x1024)
├── Square30x30Logo.png # Windows Store (optional)
├── Square44x44Logo.png
├── Square71x71Logo.png
├── Square89x89Logo.png
├── Square107x107Logo.png
├── Square142x142Logo.png
├── Square150x150Logo.png
├── Square284x284Logo.png
├── Square310x310Logo.png
└── StoreLogo.png
```

### Generate Icons from Master

Using ImageMagick:

```bash
# Generate PNGs from master icon
convert icon.png -resize 32x32 32x32.png
convert icon.png -resize 64x64 64x64.png
convert icon.png -resize 128x128 128x128.png
convert icon.png -resize 256x256 128x128@2x.png

# Generate Windows .ico
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Generate macOS .icns (on macOS)
mkdir MyIcon.iconset
sips -z 16 16 icon.png --out MyIcon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out MyIcon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out MyIcon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out MyIcon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out MyIcon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out MyIcon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out MyIcon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out MyIcon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out MyIcon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out MyIcon.iconset/icon_512x512@2x.png
iconutil -c icns MyIcon.iconset
mv MyIcon.icns icon.icns
rm -r MyIcon.iconset
```

Or use Tauri's icon generator:

```bash
npm run tauri icon src-tauri/icons/icon.png
```

---

## Step 2: Configure Tauri

### tauri.conf.json

Update `src-tauri/tauri.conf.json`:

```json
{
  "$schema": "../node_modules/@tauri-apps/cli/config.schema.json",
  "productName": "YOUR_APP_NAME",
  "version": "0.0.1",
  "identifier": "com.yourcompany.yourapp",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "YOUR_APP_NAME",
        "label": "main",
        "width": 1200,
        "height": 800,
        "minWidth": 600,
        "minHeight": 400,
        "resizable": true,
        "decorations": true,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "category": "Productivity",
    "shortDescription": "Your app description",
    "longDescription": "A longer description of your application...",
    "macOS": {
      "minimumSystemVersion": "10.15"
    },
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE",
      "endpoints": [
        "https://YOUR_OASIS_SERVER/YOUR_APP_SLUG/update/{{target}}-{{arch}}/{{current_version}}"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

**Replace:**
- `YOUR_APP_NAME` - Your app's display name
- `com.yourcompany.yourapp` - Your app's bundle identifier
- `YOUR_PUBLIC_KEY_HERE` - Your Tauri signing public key (see Step 3)
- `YOUR_OASIS_SERVER` - Your Oasis server URL
- `YOUR_APP_SLUG` - Your app's URL-friendly identifier

---

## Step 3: Generate Signing Keys

### Tauri Signing Keys

```bash
# Generate a new signing key pair
npx tauri signer generate -w ~/.tauri/your-app.key

# Output:
# - ~/.tauri/your-app.key (PRIVATE - keep secret!)
# - ~/.tauri/your-app.key.pub (PUBLIC - goes in tauri.conf.json)
```

Copy the public key content to `tauri.conf.json` → `plugins.updater.pubkey`.

### Store Private Key

Save the private key content (not the file path) as a GitHub secret.

---

## Step 4: Install Tauri Plugins

### Add Rust Dependencies

In `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
tauri-plugin-updater = "2"
tauri-plugin-process = "2"
tauri-plugin-log = "2"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### Register Plugins

In `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Add Capabilities

In `src-tauri/capabilities/default.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capabilities for the app",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",
    "fs:default",
    "fs:allow-app-read-recursive",
    "fs:allow-app-write-recursive",
    "fs:create-app-specific-dirs",
    "shell:allow-open",
    "updater:default",
    "process:allow-restart",
    "process:allow-exit"
  ]
}
```

---

## Step 5: Create Version Script

Create `scripts/version.js`:

```javascript
#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGE_JSON = path.join(ROOT_DIR, "package.json");
const TAURI_CONF = path.join(ROOT_DIR, "src-tauri", "tauri.conf.json");
const CARGO_TOML = path.join(ROOT_DIR, "src-tauri", "Cargo.toml");

function readPackageJson() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));
}

function writePackageJson(data) {
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(data, null, 2) + "\n");
}

function readTauriConf() {
  return JSON.parse(fs.readFileSync(TAURI_CONF, "utf8"));
}

function writeTauriConf(data) {
  fs.writeFileSync(TAURI_CONF, JSON.stringify(data, null, 2) + "\n");
}

function readCargoToml() {
  return fs.readFileSync(CARGO_TOML, "utf8");
}

function writeCargoToml(content) {
  fs.writeFileSync(CARGO_TOML, content);
}

function getCargoVersion(content) {
  const match = content.match(/^version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

function setCargoVersion(content, version) {
  return content.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${version}"`);
}

function getAllVersions() {
  const pkg = readPackageJson();
  const tauri = readTauriConf();
  const cargo = readCargoToml();

  return {
    "package.json": pkg.version,
    "tauri.conf.json": tauri.version,
    "Cargo.toml": getCargoVersion(cargo),
  };
}

function setAllVersions(version) {
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  const pkg = readPackageJson();
  pkg.version = version;
  writePackageJson(pkg);
  console.log(`Updated package.json to ${version}`);

  const tauri = readTauriConf();
  tauri.version = version;
  writeTauriConf(tauri);
  console.log(`Updated tauri.conf.json to ${version}`);

  let cargo = readCargoToml();
  cargo = setCargoVersion(cargo, version);
  writeCargoToml(cargo);
  console.log(`Updated Cargo.toml to ${version}`);
}

function bumpVersion(currentVersion, type) {
  const parts = currentVersion.split("-")[0].split(".").map(Number);
  let [major, minor, patch] = parts;

  switch (type) {
    case "major": major += 1; minor = 0; patch = 0; break;
    case "minor": minor += 1; patch = 0; break;
    case "patch": patch += 1; break;
    default: throw new Error(`Invalid bump type: ${type}`);
  }

  return `${major}.${minor}.${patch}`;
}

function checkVersions() {
  const versions = getAllVersions();
  const uniqueVersions = new Set(Object.values(versions));

  console.log("Current versions:");
  for (const [file, version] of Object.entries(versions)) {
    console.log(`  ${file}: ${version}`);
  }

  if (uniqueVersions.size === 1) {
    console.log("\nAll versions are in sync!");
    return true;
  } else {
    console.log("\nWarning: Versions are out of sync!");
    return false;
  }
}

const [, , command, arg] = process.argv;

switch (command) {
  case "get":
    const versions = getAllVersions();
    const uniqueVersions = new Set(Object.values(versions));
    if (uniqueVersions.size === 1) {
      console.log(Object.values(versions)[0]);
    } else {
      console.error("Versions are out of sync");
      process.exit(1);
    }
    break;
  case "set":
    if (!arg) { console.error("Usage: version.js set <version>"); process.exit(1); }
    setAllVersions(arg);
    break;
  case "bump":
    if (!["major", "minor", "patch"].includes(arg)) {
      console.error("Usage: version.js bump <major|minor|patch>");
      process.exit(1);
    }
    const current = getAllVersions()["package.json"];
    const newVersion = bumpVersion(current, arg);
    setAllVersions(newVersion);
    console.log(`\nBumped: ${current} -> ${newVersion}`);
    break;
  case "check":
    process.exit(checkVersions() ? 0 : 1);
  default:
    console.log("Usage: version.js <get|set|bump|check> [arg]");
}
```

Add to `package.json`:

```json
{
  "scripts": {
    "version": "node scripts/version.js",
    "version:get": "node scripts/version.js get",
    "version:check": "node scripts/version.js check",
    "version:bump:patch": "node scripts/version.js bump patch",
    "version:bump:minor": "node scripts/version.js bump minor",
    "version:bump:major": "node scripts/version.js bump major"
  }
}
```

---

## Step 6: Set Up GitHub Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., 1.2.0)'
        required: false
        type: string

env:
  APP_NAME: your-app
  APP_SLUG: your-app

jobs:
  prepare:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      release_notes: ${{ steps.notes.outputs.notes }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Extract version
        id: version
        run: |
          if [ -n "${{ github.event.inputs.version }}" ]; then
            VERSION="${{ github.event.inputs.version }}"
            VERSION="${VERSION#v}"
          elif [[ "${{ github.ref }}" == refs/tags/v* ]]; then
            VERSION="${{ github.ref_name }}"
            VERSION="${VERSION#v}"
          else
            echo "No version specified"
            exit 1
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT

      - name: Generate release notes
        id: notes
        run: |
          LAST_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          if [ -n "$LAST_TAG" ]; then
            NOTES=$(git log --pretty=format:"- %s" $LAST_TAG..HEAD | head -20)
          else
            NOTES=$(git log --pretty=format:"- %s" -10)
          fi
          {
            echo "notes<<RELEASE_NOTES_EOF"
            echo "$NOTES"
            echo "RELEASE_NOTES_EOF"
          } >> $GITHUB_OUTPUT

  build:
    needs: prepare
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            target: aarch64-apple-darwin
            os_name: darwin
            arch: aarch64
            artifact_ext: .app.tar.gz
          - platform: macos-latest
            target: x86_64-apple-darwin
            os_name: darwin
            arch: x86_64
            artifact_ext: .app.tar.gz
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
            os_name: linux
            arch: x86_64
            artifact_ext: .AppImage.tar.gz
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
            os_name: windows
            arch: x86_64
            artifact_ext: .msi

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Import Apple certificate
        if: startsWith(matrix.platform, 'macos')
        env:
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          KEYCHAIN_PASSWORD=$(openssl rand -base64 32)
          security create-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security set-keychain-settings -lut 21600 $KEYCHAIN_PATH
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          CERTIFICATE_PATH=$RUNNER_TEMP/certificate.p12
          echo -n "$APPLE_CERTIFICATE" | base64 --decode > $CERTIFICATE_PATH
          security import $CERTIFICATE_PATH -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k $KEYCHAIN_PATH
          security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" $KEYCHAIN_PATH
          security list-keychain -d user -s $KEYCHAIN_PATH
          rm $CERTIFICATE_PATH
          echo "KEYCHAIN_PATH=$KEYCHAIN_PATH" >> $GITHUB_ENV

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - run: npm ci

      - name: Update version
        shell: bash
        run: |
          VERSION="${{ needs.prepare.outputs.version }}"
          npm pkg set version="$VERSION"
          if command -v jq &> /dev/null; then
            jq ".version = \"$VERSION\"" src-tauri/tauri.conf.json > tmp.json && mv tmp.json src-tauri/tauri.conf.json
          else
            node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));c.version='$VERSION';fs.writeFileSync('src-tauri/tauri.conf.json',JSON.stringify(c,null,2));"
          fi
          if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
          elif [[ "$OSTYPE" == "linux"* ]]; then
            sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
          else
            node -e "const fs=require('fs');let c=fs.readFileSync('src-tauri/Cargo.toml','utf8');c=c.replace(/^version = \".*\"/m,'version = \"$VERSION\"');fs.writeFileSync('src-tauri/Cargo.toml',c);"
          fi

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          args: --target ${{ matrix.target }}

      - name: Prepare artifacts
        shell: bash
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        run: |
          mkdir -p artifacts installers
          VERSION="${{ needs.prepare.outputs.version }}"
          PLATFORM="${{ matrix.os_name }}-${{ matrix.arch }}"

          if [[ "${{ matrix.os_name }}" == "darwin" ]]; then
            BUNDLE_DIR="src-tauri/target/${{ matrix.target }}/release/bundle/macos"
            ARTIFACT=$(find "$BUNDLE_DIR" -name "*.app.tar.gz" -type f | head -1)
            SIG=$(find "$BUNDLE_DIR" -name "*.app.tar.gz.sig" -type f | head -1)
            DMG=$(find "src-tauri/target/${{ matrix.target }}/release/bundle/dmg" -name "*.dmg" -type f 2>/dev/null | head -1)
            [ -n "$DMG" ] && cp "$DMG" "installers/${{ env.APP_NAME }}_${VERSION}_${PLATFORM}.dmg"
          elif [[ "${{ matrix.os_name }}" == "linux" ]]; then
            BUNDLE_DIR="src-tauri/target/${{ matrix.target }}/release/bundle/appimage"
            APPIMAGE=$(find "$BUNDLE_DIR" -name "*.AppImage" -not -name "*.sig" -type f | head -1)
            if [ -n "$APPIMAGE" ]; then
              TARBALL="${APPIMAGE}.tar.gz"
              tar -czvf "$TARBALL" -C "$(dirname "$APPIMAGE")" "$(basename "$APPIMAGE")"
              if [ -n "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" ]; then
                npx --yes @tauri-apps/cli signer sign -k "$TAURI_SIGNING_PRIVATE_KEY" -p "$TAURI_SIGNING_PRIVATE_KEY_PASSWORD" "$TARBALL"
              else
                npx --yes @tauri-apps/cli signer sign -k "$TAURI_SIGNING_PRIVATE_KEY" "$TARBALL"
              fi
              ARTIFACT="$TARBALL"
              SIG="${TARBALL}.sig"
              cp "$APPIMAGE" "installers/${{ env.APP_NAME }}_${VERSION}_${PLATFORM}.AppImage"
            fi
          elif [[ "${{ matrix.os_name }}" == "windows" ]]; then
            BUNDLE_DIR="src-tauri/target/${{ matrix.target }}/release/bundle/msi"
            ARTIFACT=$(find "$BUNDLE_DIR" -name "*.msi" -type f | head -1)
            SIG=$(find "$BUNDLE_DIR" -name "*.msi.sig" -type f | head -1)
            NSIS=$(find "src-tauri/target/${{ matrix.target }}/release/bundle/nsis" -name "*.exe" -type f 2>/dev/null | head -1)
            [ -n "$NSIS" ] && cp "$NSIS" "installers/${{ env.APP_NAME }}_${VERSION}_${PLATFORM}_setup.exe"
          fi

          [ -n "$ARTIFACT" ] && cp "$ARTIFACT" "artifacts/${{ env.APP_NAME }}_${VERSION}_${PLATFORM}${{ matrix.artifact_ext }}"
          [ -n "$SIG" ] && cp "$SIG" "artifacts/${{ env.APP_NAME }}_${VERSION}_${PLATFORM}${{ matrix.artifact_ext }}.sig"

      - uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.os_name }}-${{ matrix.arch }}
          path: artifacts/
          retention-days: 1

      - uses: actions/upload-artifact@v4
        with:
          name: installer-${{ matrix.os_name }}-${{ matrix.arch }}
          path: installers/
          retention-days: 1
          if-no-files-found: ignore

      - name: Cleanup keychain
        if: startsWith(matrix.platform, 'macos') && always()
        run: |
          [ -n "$KEYCHAIN_PATH" ] && security delete-keychain $KEYCHAIN_PATH || true

  release:
    needs: [prepare, build]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/download-artifact@v4
        with:
          path: artifacts
          pattern: build-*
          merge-multiple: true

      - uses: actions/download-artifact@v4
        with:
          path: installers
          pattern: installer-*
          merge-multiple: true

      - name: Setup rclone
        run: |
          curl -O https://downloads.rclone.org/rclone-current-linux-amd64.deb
          sudo dpkg -i rclone-current-linux-amd64.deb
          mkdir -p ~/.config/rclone
          cat > ~/.config/rclone/rclone.conf << EOF
          [r2]
          type = s3
          provider = Cloudflare
          access_key_id = ${{ secrets.CLOUDFLARE_R2_ACCESS_KEY_ID }}
          secret_access_key = ${{ secrets.CLOUDFLARE_R2_SECRET_ACCESS_KEY }}
          endpoint = https://${{ secrets.CLOUDFLARE_ACCOUNT_ID }}.r2.cloudflarestorage.com
          acl = private
          no_check_bucket = true
          EOF

      - name: Upload to R2
        run: |
          VERSION="${{ needs.prepare.outputs.version }}"
          BUCKET="${{ secrets.R2_BUCKET_NAME }}"

          for file in artifacts/*; do
            [ -f "$file" ] && rclone copyto "$file" "r2:$BUCKET/${{ env.APP_SLUG }}/releases/$VERSION/$(basename "$file")"
          done

          if [ -d "installers" ] && [ "$(ls -A installers 2>/dev/null)" ]; then
            for file in installers/*; do
              [ -f "$file" ] && rclone copyto "$file" "r2:$BUCKET/${{ env.APP_SLUG }}/installers/$VERSION/$(basename "$file")"
            done
          fi

      - name: Register with Oasis
        env:
          RELEASE_NOTES: ${{ needs.prepare.outputs.release_notes }}
        run: |
          VERSION="${{ needs.prepare.outputs.version }}"

          ARTIFACTS="["
          FIRST=true
          for platform in "darwin-aarch64" "darwin-x86_64" "linux-x86_64" "windows-x86_64"; do
            OS=$(echo $platform | cut -d'-' -f1)
            case "$OS" in
              darwin) EXT=".app.tar.gz" ;;
              linux) EXT=".AppImage.tar.gz" ;;
              windows) EXT=".msi" ;;
            esac

            ARTIFACT_FILE="artifacts/${{ env.APP_NAME }}_${VERSION}_${platform}${EXT}"
            SIG_FILE="${ARTIFACT_FILE}.sig"

            if [ -f "$ARTIFACT_FILE" ] && [ -f "$SIG_FILE" ]; then
              [ "$FIRST" = true ] && FIRST=false || ARTIFACTS="$ARTIFACTS,"
              SIGNATURE=$(cat "$SIG_FILE")
              ARTIFACTS="$ARTIFACTS{\"platform\":\"$platform\",\"signature\":\"$SIGNATURE\",\"r2_key\":\"${{ env.APP_SLUG }}/releases/$VERSION/${{ env.APP_NAME }}_${VERSION}_${platform}${EXT}\"}"
            fi
          done
          ARTIFACTS="$ARTIFACTS]"

          INSTALLERS="[]"

          PAYLOAD=$(jq -n \
            --arg version "$VERSION" \
            --arg notes "$RELEASE_NOTES" \
            --argjson artifacts "$ARTIFACTS" \
            --argjson installers "$INSTALLERS" \
            '{version:$version,notes:$notes,artifacts:$artifacts,installers:$installers,auto_publish:true}')

          curl -sf -X POST \
            "${{ secrets.OASIS_SERVER_URL }}/ci/apps/${{ env.APP_SLUG }}/releases" \
            -H "Authorization: Bearer ${{ secrets.OASIS_CI_KEY }}" \
            -H "Content-Type: application/json" \
            -d "$PAYLOAD"

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          tag_name: v${{ needs.prepare.outputs.version }}
          name: ${{ env.APP_NAME }} v${{ needs.prepare.outputs.version }}
          body: |
            ## ${{ env.APP_NAME }} v${{ needs.prepare.outputs.version }}

            ### Downloads
            See release assets below.

            ### What's New
            ${{ needs.prepare.outputs.release_notes }}
          draft: false
          prerelease: false
          files: |
            artifacts/*
            installers/*
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**IMPORTANT:** Update these values in the workflow:
- `APP_NAME: your-app` → Your app name (lowercase, no spaces)
- `APP_SLUG: your-app` → URL-friendly identifier

---

## Step 7: Configure GitHub Secrets

Go to **Repository → Settings → Secrets and variables → Actions**

### Required Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| **Apple Signing (macOS only)** | | |
| `APPLE_CERTIFICATE` | Base64-encoded .p12 | `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | Certificate password | Your .p12 password |
| `APPLE_SIGNING_IDENTITY` | Signing identity | `Developer ID Application: Name (TEAMID)` |
| `APPLE_ID` | Apple Developer email | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password | [appleid.apple.com](https://appleid.apple.com) → Security |
| `APPLE_TEAM_ID` | Team ID | [developer.apple.com](https://developer.apple.com/account) → Membership |
| **Tauri Signing** | | |
| `TAURI_SIGNING_PRIVATE_KEY` | Private key content | `cat ~/.tauri/your-app.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Key password (optional) | Your key password |
| **Cloudflare R2** | | |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID | Cloudflare Dashboard URL |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 access key | R2 → Manage API Tokens |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 secret | R2 → Manage API Tokens |
| `R2_BUCKET_NAME` | Bucket name | Your bucket name |
| `R2_PUBLIC_URL` | Public URL | Your custom domain or R2.dev URL |
| **Oasis Server** | | |
| `OASIS_SERVER_URL` | Oasis base URL | e.g., `https://oasis.example.com` |
| `OASIS_CI_KEY` | CI API key | Oasis → Settings → API Keys |

---

## Step 8: Set Up Oasis Server

### Create App in Oasis

1. Log in to Oasis dashboard
2. Create new app:
   - **Name:** Your App Name
   - **Slug:** your-app (matches `APP_SLUG` in workflow)

### Configure Oasis Environment

Your Oasis server needs:

```env
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://releases.example.com
```

### Generate CI API Key

1. Oasis → Settings → API Keys
2. Create new key with scope `ci` for your app
3. Save as `OASIS_CI_KEY` in GitHub Secrets

---

## Step 9: Release Process

### Bump Version

```bash
npm run version:bump:patch  # 1.0.0 → 1.0.1
# or
npm run version:bump:minor  # 1.0.0 → 1.1.0
# or
npm run version:bump:major  # 1.0.0 → 2.0.0
```

### Commit and Tag

```bash
git add -A
git commit -m "Bump version to $(npm run version:get --silent)"

VERSION=$(npm run version:get --silent)
git tag "v$VERSION"
git push && git push --tags
```

### What Happens

1. GitHub detects tag push
2. Workflow builds for macOS (ARM64 + Intel), Windows, Linux
3. Signs all artifacts
4. Uploads to Cloudflare R2
5. Registers release with Oasis
6. Creates GitHub Release

---

## Quick Verification Checklist

Before your first release, verify:

- [ ] All icons exist in `src-tauri/icons/`
- [ ] `tauri.conf.json` has correct app name, identifier, and public key
- [ ] `capabilities/default.json` includes `updater:default`
- [ ] Plugins registered in `src-tauri/src/lib.rs`
- [ ] Version script works: `npm run version:get`
- [ ] All GitHub Secrets configured
- [ ] App exists in Oasis with correct slug
- [ ] R2 bucket exists and is accessible
- [ ] Local build works: `npm run tauri:build`

---

## Troubleshooting

### Common Issues

**"Signature verification failed"**
- Ensure `pubkey` in tauri.conf.json matches your private key
- Check `TAURI_SIGNING_PRIVATE_KEY` contains key content, not file path

**"No artifact found"**
- Check bundle directory paths in workflow
- Verify Tauri builds the expected bundle types

**"R2 Access Denied"**
- Verify R2 token has `Object Read & Write` permissions
- Check bucket name and Account ID are correct

**"Notarization failed"**
- Verify `APPLE_PASSWORD` is an app-specific password
- Check `APPLE_TEAM_ID` matches your certificate

**"Update not working"**
- Verify endpoint URL format: `{{target}}-{{arch}}/{{current_version}}`
- Check release is published (not draft) in Oasis
- Platform format should be `darwin-aarch64`, not `macos-arm64`

---

## Files to Copy for New Projects

```bash
# Copy from miku to your new project
cp -r miku-dev/src-tauri/icons your-app/src-tauri/
cp miku-dev/scripts/version.js your-app/scripts/
cp miku-dev/.github/workflows/release.yml your-app/.github/workflows/
cp miku-dev/src-tauri/capabilities/default.json your-app/src-tauri/capabilities/
```

Then update:
1. App name in all config files
2. Bundle identifier
3. Public key
4. Oasis endpoint URL
5. GitHub workflow `APP_NAME` and `APP_SLUG`
