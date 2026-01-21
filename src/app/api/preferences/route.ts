import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db, userPreferences, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

// Helper to ensure user exists in database (creates if not exists)
async function ensureUserExists(userId: string): Promise<boolean> {
  if (!db) return false;

  try {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!existingUser) {
      // Get user info from Clerk
      const user = await currentUser();
      if (!user) return false;

      const email = user.emailAddresses?.[0]?.emailAddress;
      if (!email) return false;

      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || null;

      await db.insert(users).values({
        id: userId,
        email,
        name,
        imageUrl: user.imageUrl,
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to ensure user exists:', error);
    return false;
  }
}

// GET /api/preferences - Get user preferences
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const [preferences] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (!preferences) {
      // Return default preferences if none exist
      return NextResponse.json({
        selectedProvider: 'openai',
        selectedModel: 'gpt-4o',
        apiKeys: {},
      });
    }

    return NextResponse.json({
      selectedProvider: preferences.selectedProvider,
      selectedModel: preferences.selectedModel,
      apiKeys: preferences.apiKeys || {},
    });
  } catch (error) {
    console.error('Failed to fetch preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// POST /api/preferences - Create or update user preferences
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Ensure user exists in database before creating preferences
    const userExists = await ensureUserExists(userId);
    if (!userExists) {
      return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
    }

    const body = await request.json();
    const { selectedProvider, selectedModel, apiKeys } = body;

    // Check if preferences already exist
    const [existing] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (existing) {
      // Update existing preferences
      const [updated] = await db
        .update(userPreferences)
        .set({
          selectedProvider: selectedProvider ?? existing.selectedProvider,
          selectedModel: selectedModel ?? existing.selectedModel,
          apiKeys: apiKeys ?? existing.apiKeys,
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, userId))
        .returning();

      return NextResponse.json({
        selectedProvider: updated.selectedProvider,
        selectedModel: updated.selectedModel,
        apiKeys: updated.apiKeys || {},
      });
    } else {
      // Create new preferences
      const [created] = await db
        .insert(userPreferences)
        .values({
          userId,
          selectedProvider: selectedProvider || 'openai',
          selectedModel: selectedModel || 'gpt-4o',
          apiKeys: apiKeys || {},
        })
        .returning();

      return NextResponse.json({
        selectedProvider: created.selectedProvider,
        selectedModel: created.selectedModel,
        apiKeys: created.apiKeys || {},
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Failed to save preferences:', error);
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
  }
}
