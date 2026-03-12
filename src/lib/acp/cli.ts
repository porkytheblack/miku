#!/usr/bin/env node

/**
 * Miku ACP Agent CLI
 *
 * Starts a Miku-powered ACP agent that communicates over stdio.
 * Can be launched by any ACP client (Zed, Neovim, etc.) as a subprocess.
 *
 * Usage:
 *   npx tsx src/lib/acp/cli.ts [path-to-miku-file]
 *   npx tsx src/lib/acp/cli.ts ./my-project/.miku
 *   npx tsx src/lib/acp/cli.ts --dir ./my-project
 *
 * If no .miku file is provided, creates a default agent config for the
 * current or specified directory.
 */

import * as acp from '@agentclientprotocol/sdk';
import { Readable, Writable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { MikuAcpAgent } from './mikuAcpAgent';
import { parseMikuFile, createDefaultMikuFile, MikuFileParseError } from '../mikuFileParser';
import type { MikuFileConfig } from '../mikuFileParser';

/**
 * Find a .miku file in a directory by looking for common names
 */
function findMikuFile(dir: string): string | null {
  const candidates = [
    'miku.json',
    '.miku',
    '.miku.json',
    'agent.miku',
    'agent.miku.json',
  ];

  for (const name of candidates) {
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }

  // Also search for any *.miku files
  try {
    const entries = fs.readdirSync(dir);
    const mikuFile = entries.find(e => e.endsWith('.miku') || e.endsWith('.miku.json'));
    if (mikuFile) {
      return path.join(dir, mikuFile);
    }
  } catch {
    // Ignore read errors
  }

  return null;
}

/**
 * Load a .miku config from a file path or directory
 */
function loadConfig(target: string): { config: MikuFileConfig; basePath: string } {
  const resolved = path.resolve(target);

  // Check if it's a file
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    const content = fs.readFileSync(resolved, 'utf-8');
    const config = parseMikuFile(content);
    const basePath = path.dirname(resolved);

    // Resolve working directory relative to config file
    if (config.workingDirectory) {
      config.workingDirectory = path.resolve(basePath, config.workingDirectory);
    }

    return { config, basePath };
  }

  // Check if it's a directory - look for .miku file
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    const mikuFile = findMikuFile(resolved);
    if (mikuFile) {
      const content = fs.readFileSync(mikuFile, 'utf-8');
      const config = parseMikuFile(content);
      if (config.workingDirectory) {
        config.workingDirectory = path.resolve(resolved, config.workingDirectory);
      }
      return { config, basePath: resolved };
    }

    // No .miku file found - create default config
    const dirName = path.basename(resolved);
    const config = createDefaultMikuFile(`Miku Agent (${dirName})`);
    config.workingDirectory = resolved;
    return { config, basePath: resolved };
  }

  throw new Error(`Path not found: ${resolved}`);
}

/**
 * Start the Miku ACP agent over stdio
 */
export function startMikuAcpAgent(configTarget?: string): void {
  const args = process.argv.slice(2);
  const target = configTarget || args[0] || process.cwd();

  // Handle --dir flag
  let resolvedTarget = target;
  const dirIndex = args.indexOf('--dir');
  if (dirIndex !== -1 && args[dirIndex + 1]) {
    resolvedTarget = args[dirIndex + 1];
  }

  // Handle --help
  if (args.includes('--help') || args.includes('-h')) {
    console.error(`
Miku ACP Agent - AI coding assistant powered by Miku

Usage:
  miku-acp [options] [path]

Arguments:
  path                   Path to a .miku file or directory containing one.
                        If omitted, uses the current directory.

Options:
  --dir <path>          Working directory for the agent
  --help, -h            Show this help message
  --version, -v         Show version

The agent communicates over stdio using the Agent Client Protocol (ACP).
It can be connected to any ACP-compatible editor like Zed, Neovim, etc.

.miku File Format:
  Create a .miku or miku.json file to configure the agent:

  {
    "version": 1,
    "name": "My Agent",
    "description": "AI assistant for my project",
    "provider": {
      "type": "anthropic",
      "model": "claude-sonnet-4-5-20250514",
      "apiKeyEnv": "ANTHROPIC_API_KEY"
    },
    "tools": [],
    "modes": [
      { "id": "review", "name": "Review", "description": "Review code" },
      { "id": "edit", "name": "Edit", "description": "Edit code" }
    ],
    "permissions": {
      "allowFileRead": true,
      "allowFileWrite": true,
      "allowTerminal": false
    }
  }
`);
    process.exit(0);
  }

  // Handle --version
  if (args.includes('--version') || args.includes('-v')) {
    console.error('miku-acp v0.0.9');
    process.exit(0);
  }

  // Load configuration
  let config: MikuFileConfig;
  let basePath: string;

  try {
    const loaded = loadConfig(resolvedTarget);
    config = loaded.config;
    basePath = loaded.basePath;
  } catch (err) {
    if (err instanceof MikuFileParseError) {
      console.error(`Error parsing .miku file: ${err.message}`);
    } else {
      console.error(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    process.exit(1);
  }

  // Set up env vars from config
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  console.error(`[miku-acp] Starting agent: ${config.name}`);
  console.error(`[miku-acp] Base path: ${basePath}`);
  console.error(`[miku-acp] Provider: ${config.provider.type} (${config.provider.model})`);

  // Set up ACP stdio connection
  // Note: ACP uses stdout for messages, stderr for logs
  const input = Writable.toWeb(process.stdout);
  const output = Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>;

  const stream = acp.ndJsonStream(input, output);

  new acp.AgentSideConnection(
    (conn) => new MikuAcpAgent(conn, config, basePath),
    stream
  );

  console.error('[miku-acp] Agent ready, listening for ACP messages on stdio');
}

// Auto-start when run directly
const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('cli.ts') ||
   process.argv[1].endsWith('cli.js') ||
   process.argv[1].includes('miku-acp'));

if (isMainModule) {
  startMikuAcpAgent();
}
