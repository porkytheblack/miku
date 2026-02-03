/**
 * TypeScript bindings for Tauri commands
 * These functions call the Rust backend commands defined in src-tauri/src/lib.rs
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Keyboard sound settings (snake_case for Rust backend)
 */
export interface KeyboardSoundSettingsBackend {
  enabled: boolean;
  profile_id: string;
  volume: number;
  play_keyup_sounds: boolean;
  pitch_variation: number;
}

export interface EditorSettings {
  theme: string;
  font_size: number;
  line_height: number;
  editor_width: number;
  font_family: string;
  review_mode: string;
  aggressiveness: string;
  writing_context: string;
  sound_enabled: boolean;
  keyboard_sounds: KeyboardSoundSettingsBackend;
}

export interface Document {
  path: string | null;
  content: string;
  is_modified: boolean;
}

export interface Workspace {
  path: string;
  name: string;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: WorkspaceFile[];
}

/**
 * Load settings from the app data directory
 */
export async function loadSettings(): Promise<EditorSettings> {
  return invoke<EditorSettings>('load_settings');
}

/**
 * Save settings to the app data directory
 */
export async function saveSettings(settings: EditorSettings): Promise<void> {
  return invoke('save_settings', { settings });
}

/**
 * Open a file and return its contents
 */
export async function openFile(path: string): Promise<Document> {
  return invoke<Document>('open_file', { path });
}

/**
 * Save content to a file
 */
export async function saveFile(path: string, content: string): Promise<void> {
  return invoke('save_file', { path, content });
}

/**
 * Create a new empty document
 */
export async function newDocument(): Promise<Document> {
  return invoke<Document>('new_document');
}

/**
 * Get the list of recently opened files
 */
export async function getRecentFiles(): Promise<string[]> {
  return invoke<string[]>('get_recent_files');
}

/**
 * Add a file to the recent files list
 */
export async function addRecentFile(path: string): Promise<void> {
  return invoke('add_recent_file', { path });
}

/**
 * Get the app version
 */
export async function getAppVersion(): Promise<string> {
  return invoke<string>('get_app_version');
}

/**
 * Convert frontend settings to backend format
 */
export function toBackendSettings(settings: {
  theme: string;
  fontSize: number;
  lineHeight: number;
  editorWidth: number;
  fontFamily: string;
  reviewMode: string;
  aggressiveness: string;
  writingContext: string;
  soundEnabled: boolean;
  keyboardSounds: {
    enabled: boolean;
    profileId: string;
    volume: number;
    playKeyupSounds: boolean;
    pitchVariation: number;
  };
}): EditorSettings {
  return {
    theme: settings.theme,
    font_size: settings.fontSize,
    line_height: settings.lineHeight,
    editor_width: settings.editorWidth,
    font_family: settings.fontFamily,
    review_mode: settings.reviewMode,
    aggressiveness: settings.aggressiveness,
    writing_context: settings.writingContext,
    sound_enabled: settings.soundEnabled,
    keyboard_sounds: {
      enabled: settings.keyboardSounds.enabled,
      profile_id: settings.keyboardSounds.profileId,
      volume: settings.keyboardSounds.volume,
      play_keyup_sounds: settings.keyboardSounds.playKeyupSounds,
      pitch_variation: settings.keyboardSounds.pitchVariation,
    },
  };
}

/**
 * Convert backend settings to frontend format
 */
export function toFrontendSettings(settings: EditorSettings): {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  lineHeight: number;
  editorWidth: number;
  fontFamily: 'mono' | 'sans';
  reviewMode: 'auto' | 'manual';
  aggressiveness: 'gentle' | 'balanced' | 'strict';
  writingContext: string;
  soundEnabled: boolean;
  keyboardSounds: {
    enabled: boolean;
    profileId: 'cherry-mx-blue' | 'cherry-mx-brown' | 'topre';
    volume: number;
    playKeyupSounds: boolean;
    pitchVariation: number;
  };
} {
  // Provide defaults for keyboard sounds in case they're missing from old settings
  const keyboardSoundsDefaults = {
    enabled: false,
    profile_id: 'cherry-mx-blue',
    volume: 0.5,
    play_keyup_sounds: false,
    pitch_variation: 0.02,
  };
  const keyboardSounds = settings.keyboard_sounds ?? keyboardSoundsDefaults;

  return {
    theme: settings.theme as 'light' | 'dark' | 'system',
    fontSize: settings.font_size,
    lineHeight: settings.line_height,
    editorWidth: settings.editor_width,
    fontFamily: settings.font_family as 'mono' | 'sans',
    reviewMode: settings.review_mode as 'auto' | 'manual',
    aggressiveness: settings.aggressiveness as 'gentle' | 'balanced' | 'strict',
    writingContext: settings.writing_context,
    soundEnabled: settings.sound_enabled ?? true,
    keyboardSounds: {
      enabled: keyboardSounds.enabled,
      profileId: keyboardSounds.profile_id as 'cherry-mx-blue' | 'cherry-mx-brown' | 'topre',
      volume: keyboardSounds.volume,
      playKeyupSounds: keyboardSounds.play_keyup_sounds,
      pitchVariation: keyboardSounds.pitch_variation,
    },
  };
}

// ============ Workspace Commands ============

/**
 * Get workspace info from a path
 */
export async function getWorkspaceInfo(path: string): Promise<Workspace> {
  return invoke<Workspace>('get_workspace_info', { path });
}

/**
 * Get current workspace
 */
export async function getCurrentWorkspace(): Promise<Workspace | null> {
  return invoke<Workspace | null>('get_current_workspace');
}

/**
 * Set the current workspace
 */
export async function setWorkspace(path: string): Promise<void> {
  return invoke('set_workspace', { path });
}

/**
 * Get recent workspaces
 */
export async function getRecentWorkspaces(): Promise<Workspace[]> {
  return invoke<Workspace[]>('get_recent_workspaces');
}

/**
 * List files in a workspace
 */
export async function listWorkspaceFiles(workspacePath: string): Promise<WorkspaceFile[]> {
  return invoke<WorkspaceFile[]>('list_workspace_files', { workspacePath });
}

/**
 * Create a new file
 */
export async function createFile(basePath: string, name: string): Promise<string> {
  return invoke<string>('create_file', { basePath, name });
}

/**
 * Create a new folder
 */
export async function createFolder(basePath: string, name: string): Promise<string> {
  return invoke<string>('create_folder', { basePath, name });
}

/**
 * Delete a file or folder
 */
export async function deleteFile(path: string): Promise<void> {
  return invoke('delete_file', { path });
}

/**
 * Rename a file or folder
 */
export async function renameFile(oldPath: string, newName: string): Promise<string> {
  return invoke<string>('rename_file', { oldPath, newName });
}
