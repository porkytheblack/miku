import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// For server-side usage
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. Database features will be disabled.');
}

// Create postgres client
const client = connectionString ? postgres(connectionString) : null;

// Create drizzle instance
export const db = client ? drizzle(client, { schema }) : null;

// Export schema types
export * from './schema';
