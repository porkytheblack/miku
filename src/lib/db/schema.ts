import { pgTable, text, timestamp, jsonb, uuid, integer, varchar } from 'drizzle-orm/pg-core';
import { Suggestion } from '@/types';

// Users table - synced from Clerk
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Clerk user ID
  email: text('email').notNull(),
  name: text('name'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Notes table - stores saved documents
export const notes = pgTable('notes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull().default('Untitled'),
  content: text('content').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// History entries - stores revision history for a note
export const noteHistory = pgTable('note_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  noteId: uuid('note_id').notNull().references(() => notes.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  suggestions: jsonb('suggestions').$type<Suggestion[]>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  version: integer('version').notNull().default(1),
});

// User preferences - stores API keys and model choices
export const userPreferences = pgTable('user_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  // AI Configuration
  selectedProvider: varchar('selected_provider', { length: 50 }).default('openai'),
  selectedModel: varchar('selected_model', { length: 100 }).default('gpt-4o'),
  // Encrypted API keys (stored as JSON object)
  apiKeys: jsonb('api_keys').$type<{ openai?: string; anthropic?: string; google?: string }>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Types for database operations
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

export type NoteHistory = typeof noteHistory.$inferSelect;
export type NewNoteHistory = typeof noteHistory.$inferInsert;

export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
