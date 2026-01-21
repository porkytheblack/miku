'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Suggestion } from '@/types';

// Check if Clerk is configured
const isClerkConfigured = typeof window === 'undefined'
  ? !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  : !!(typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Conditionally import Clerk - this will be tree-shaken if not used
let useUserHook: () => { isSignedIn: boolean; isLoaded: boolean } = () => ({
  isSignedIn: false,
  isLoaded: true,
});

// Dynamic import for Clerk hooks
if (isClerkConfigured) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const clerk = require('@clerk/nextjs');
    useUserHook = clerk.useUser;
  } catch {
    // Clerk not available, use default
  }
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteWithHistory extends Note {
  history: {
    id: string;
    content: string;
    suggestions: Suggestion[];
    version: number;
    createdAt: string;
  }[];
}

interface NotesContextType {
  notes: Note[];
  currentNote: NoteWithHistory | null;
  isLoading: boolean;
  error: string | null;
  fetchNotes: () => Promise<void>;
  createNote: (title?: string, content?: string, suggestions?: Suggestion[]) => Promise<Note | null>;
  updateNote: (id: string, data: { title?: string; content?: string; suggestions?: Suggestion[] }) => Promise<Note | null>;
  deleteNote: (id: string) => Promise<boolean>;
  loadNote: (id: string) => Promise<NoteWithHistory | null>;
  setCurrentNote: (note: NoteWithHistory | null) => void;
  clearCurrentNote: () => void;
}

const NotesContext = createContext<NotesContextType | undefined>(undefined);

export function NotesProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useUserHook();
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentNote, setCurrentNote] = useState<NoteWithHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    if (!isSignedIn) {
      setNotes([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notes');
      if (!response.ok) {
        if (response.status === 503) {
          // Database not configured, silently fail
          setNotes([]);
          return;
        }
        throw new Error('Failed to fetch notes');
      }
      const data = await response.json();
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notes');
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const createNote = useCallback(async (
    title?: string,
    content?: string,
    suggestions?: Suggestion[]
  ): Promise<Note | null> => {
    if (!isSignedIn) return null;

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, suggestions }),
      });

      if (!response.ok) {
        throw new Error('Failed to create note');
      }

      const note = await response.json();
      setNotes(prev => [note, ...prev]);
      return note;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create note');
      return null;
    }
  }, [isSignedIn]);

  const updateNote = useCallback(async (
    id: string,
    data: { title?: string; content?: string; suggestions?: Suggestion[] }
  ): Promise<Note | null> => {
    if (!isSignedIn) return null;

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update note');
      }

      const note = await response.json();
      setNotes(prev => prev.map(n => n.id === id ? note : n));

      // Update current note if it's the one being edited
      if (currentNote?.id === id) {
        setCurrentNote(prev => prev ? { ...prev, ...note } : null);
      }

      return note;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update note');
      return null;
    }
  }, [isSignedIn, currentNote?.id]);

  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    if (!isSignedIn) return false;

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      setNotes(prev => prev.filter(n => n.id !== id));

      // Clear current note if it's the one being deleted
      if (currentNote?.id === id) {
        setCurrentNote(null);
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
      return false;
    }
  }, [isSignedIn, currentNote?.id]);

  const loadNote = useCallback(async (id: string): Promise<NoteWithHistory | null> => {
    if (!isSignedIn) return null;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/notes/${id}`);
      if (!response.ok) {
        throw new Error('Failed to load note');
      }

      const note = await response.json();
      setCurrentNote(note);
      return note;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load note');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn]);

  const clearCurrentNote = useCallback(() => {
    setCurrentNote(null);
  }, []);

  // Fetch notes when user signs in
  useEffect(() => {
    if (isSignedIn) {
      fetchNotes();
    } else {
      setNotes([]);
      setCurrentNote(null);
    }
  }, [isSignedIn, fetchNotes]);

  return (
    <NotesContext.Provider
      value={{
        notes,
        currentNote,
        isLoading,
        error,
        fetchNotes,
        createNote,
        updateNote,
        deleteNote,
        loadNote,
        setCurrentNote,
        clearCurrentNote,
      }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
}
