/**
 * ACP Module Entry Point
 *
 * Re-exports the ACP agent and related utilities for use
 * both as a standalone CLI agent and from within the Miku editor.
 */

export { MikuAcpAgent } from './mikuAcpAgent';
export { startMikuAcpAgent } from './cli';
export type {
  MikuFileConfig,
  MikuFileProvider,
  MikuFileTool,
  MikuFileMode,
  MikuFilePermissions,
  MikuFileMcpServer,
} from '../mikuFileParser';
export {
  parseMikuFile,
  serializeMikuFile,
  createDefaultMikuFile,
  MikuFileParseError,
} from '../mikuFileParser';
