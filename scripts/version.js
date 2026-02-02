#!/usr/bin/env node

/**
 * Version Management Script for Miku
 *
 * This script helps manage version numbers across all configuration files:
 * - package.json
 * - src-tauri/tauri.conf.json
 * - src-tauri/Cargo.toml
 *
 * Usage:
 *   node scripts/version.js get          - Get current version
 *   node scripts/version.js set 1.2.3    - Set version to 1.2.3
 *   node scripts/version.js bump major   - Bump major version (1.0.0 -> 2.0.0)
 *   node scripts/version.js bump minor   - Bump minor version (1.0.0 -> 1.1.0)
 *   node scripts/version.js bump patch   - Bump patch version (1.0.0 -> 1.0.1)
 *   node scripts/version.js check        - Check if all versions are in sync
 */

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
  return content.replace(
    /^(version\s*=\s*)"[^"]+"/m,
    `$1"${version}"`
  );
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
  // Validate version format
  if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected: x.y.z or x.y.z-prerelease`);
  }

  // Update package.json
  const pkg = readPackageJson();
  pkg.version = version;
  writePackageJson(pkg);
  console.log(`Updated package.json to ${version}`);

  // Update tauri.conf.json
  const tauri = readTauriConf();
  tauri.version = version;
  writeTauriConf(tauri);
  console.log(`Updated tauri.conf.json to ${version}`);

  // Update Cargo.toml
  let cargo = readCargoToml();
  cargo = setCargoVersion(cargo, version);
  writeCargoToml(cargo);
  console.log(`Updated Cargo.toml to ${version}`);
}

function bumpVersion(currentVersion, type) {
  const parts = currentVersion.split("-")[0].split(".").map(Number);

  if (parts.length !== 3) {
    throw new Error(`Invalid version format: ${currentVersion}`);
  }

  let [major, minor, patch] = parts;

  switch (type) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      throw new Error(`Invalid bump type: ${type}. Use: major, minor, or patch`);
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

// Main
const [, , command, arg] = process.argv;

switch (command) {
  case "get":
    const versions = getAllVersions();
    const uniqueVersions = new Set(Object.values(versions));
    if (uniqueVersions.size === 1) {
      console.log(Object.values(versions)[0]);
    } else {
      console.error("Versions are out of sync:");
      for (const [file, version] of Object.entries(versions)) {
        console.error(`  ${file}: ${version}`);
      }
      process.exit(1);
    }
    break;

  case "set":
    if (!arg) {
      console.error("Usage: version.js set <version>");
      process.exit(1);
    }
    setAllVersions(arg);
    console.log(`\nVersion set to ${arg}`);
    break;

  case "bump":
    if (!arg || !["major", "minor", "patch"].includes(arg)) {
      console.error("Usage: version.js bump <major|minor|patch>");
      process.exit(1);
    }
    const currentVersions = getAllVersions();
    const currentVersion = currentVersions["package.json"];
    const newVersion = bumpVersion(currentVersion, arg);
    setAllVersions(newVersion);
    console.log(`\nBumped ${arg} version: ${currentVersion} -> ${newVersion}`);
    break;

  case "check":
    const inSync = checkVersions();
    process.exit(inSync ? 0 : 1);

  default:
    console.log(`
Version Management Script for Miku

Usage:
  node scripts/version.js get          - Get current version
  node scripts/version.js set 1.2.3    - Set version to 1.2.3
  node scripts/version.js bump major   - Bump major version (1.0.0 -> 2.0.0)
  node scripts/version.js bump minor   - Bump minor version (1.0.0 -> 1.1.0)
  node scripts/version.js bump patch   - Bump patch version (1.0.0 -> 1.0.1)
  node scripts/version.js check        - Check if all versions are in sync
    `);
    break;
}
