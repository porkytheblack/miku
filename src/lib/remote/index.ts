/**
 * Miku Remote — Module Exports
 */

export { MikuPeer } from './peer';
export type { MikuPeerHandlers } from './peer';

export { FileSyncManager } from './fileSync';
export type { FileSyncHandlers } from './fileSync';

export { RemoteWorkspaceManager } from './remoteWorkspace';
export type { RemoteWorkspaceHandlers } from './remoteWorkspace';

export { AgentRelayHost, AgentRelayRemote } from './agentRelay';
export type { AgentRelayHostHandlers, AgentRelayRemoteHandlers } from './agentRelay';

export type {
  RemoteRole,
  RemoteConnectionStatus,
  RemotePeerInfo,
  RemotePeerState,
  FileManifestEntry,
  FileSyncMessage,
  AgentRelayMessage,
  RemoteMessage,
  ControlMessage,
} from './types';

export {
  DEFAULT_REMOTE_STATE,
  ROOM_CODE_LENGTH,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_BASE_DELAY_MS,
  FILE_CHUNK_SIZE,
} from './types';
