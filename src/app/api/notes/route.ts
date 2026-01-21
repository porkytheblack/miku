import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { db, notes, noteHistory, users } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';

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

// GET /api/notes - List all notes for the current user
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const userNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt));

    return NextResponse.json(userNotes);
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// POST /api/notes - Create a new note
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    // Ensure user exists in database before creating note
    const userExists = await ensureUserExists(userId);
    if (!userExists) {
      return NextResponse.json({ error: 'Failed to sync user' }, { status: 500 });
    }

    const body = await request.json();
    const { title, content, suggestions } = body;

    // Create the note
    const [note] = await db
      .insert(notes)
      .values({
        userId,
        title: title || 'Untitled',
        content: content || '',
      })
      .returning();

    // Create initial history entry
    if (content) {
      await db.insert(noteHistory).values({
        noteId: note.id,
        content,
        suggestions: suggestions || [],
        version: 1,
      });
    }

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Failed to create note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
