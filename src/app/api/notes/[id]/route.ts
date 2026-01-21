import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, notes, noteHistory } from '@/lib/db';
import { eq, and, desc, sql } from 'drizzle-orm';

// GET /api/notes/[id] - Get a single note with its history
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;

    // Fetch note
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)));

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Fetch history
    const history = await db
      .select()
      .from(noteHistory)
      .where(eq(noteHistory.noteId, id))
      .orderBy(desc(noteHistory.version));

    return NextResponse.json({ ...note, history });
  } catch (error) {
    console.error('Failed to fetch note:', error);
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

// PUT /api/notes/[id] - Update a note
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content, suggestions, saveHistory = true } = body;

    // Check ownership
    const [existingNote] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)));

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Update the note
    const [updatedNote] = await db
      .update(notes)
      .set({
        title: title !== undefined ? title : existingNote.title,
        content: content !== undefined ? content : existingNote.content,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    // Add history entry if content changed and saveHistory is true
    if (saveHistory && content !== undefined && content !== existingNote.content) {
      // Get the latest version number
      const [latest] = await db
        .select({ maxVersion: sql<number>`COALESCE(MAX(${noteHistory.version}), 0)` })
        .from(noteHistory)
        .where(eq(noteHistory.noteId, id));

      await db.insert(noteHistory).values({
        noteId: id,
        content,
        suggestions: suggestions || [],
        version: (latest?.maxVersion || 0) + 1,
      });
    }

    return NextResponse.json(updatedNote);
  } catch (error) {
    console.error('Failed to update note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

// DELETE /api/notes/[id] - Delete a note
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;

    // Check ownership and delete
    const result = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
