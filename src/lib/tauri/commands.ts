/**
 * TypeScript bindings for Tauri commands
 * These functions call the Rust backend commands defined in src-tauri/src/lib.rs
 */

import { invoke } from '@tauri-apps/api/core';

export interface EditorSettings {
  theme: string;
  font_size: number;
  line_height: number;
  editor_width: number;
  font_family: string;
  review_mode: string;
  aggressiveness: string;
  writing_context: string;
}

export interface Document {
  path: string | null;
  content: string;
  is_modified: boolean;
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
} {
  return {
    theme: settings.theme as 'light' | 'dark' | 'system',
    fontSize: settings.font_size,
    lineHeight: settings.line_height,
    editorWidth: settings.editor_width,
    fontFamily: settings.font_family as 'mono' | 'sans',
    reviewMode: settings.review_mode as 'auto' | 'manual',
    aggressiveness: settings.aggressiveness as 'gentle' | 'balanced' | 'strict',
    writingContext: settings.writing_context,
  };
}
