'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNotes, Note } from '@/context/NotesContext';
import { useAuth } from '@/components/AuthProvider';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadNote: (content: string, title: string, noteId: string) => void;
}

export default function NotesModal({ isOpen, onClose, onLoadNote }: NotesModalProps) {
  const { notes, isLoading, fetchNotes, deleteNote, loadNote } = useNotes();
  const { isSignedIn } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;

    const query = searchQuery.toLowerCase();
    return notes.filter(note =>
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query)
    );
  }, [notes, searchQuery]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredNotes.length]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      fetchNotes();
    }
  }, [isOpen, fetchNotes]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredNotes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredNotes[selectedIndex]) {
      e.preventDefault();
      handleSelectNote(filteredNotes[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [filteredNotes, selectedIndex, onClose]);

  const handleSelectNote = useCallback(async (note: Note) => {
    const fullNote = await loadNote(note.id);
    if (fullNote) {
      onLoadNote(fullNote.content, fullNote.title, fullNote.id);
      onClose();
    }
  }, [loadNote, onLoadNote, onClose]);

  const handleDeleteNote = useCallback(async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this note?')) {
      await deleteNote(noteId);
    }
  }, [deleteNote]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get preview text (first ~100 chars of content)
  const getPreview = (content: string) => {
    const stripped = content.replace(/[#*`>\-]/g, '').trim();
    return stripped.length > 100 ? stripped.slice(0, 100) + '...' : stripped;
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl max-h-[70vh] flex flex-col"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          margin: '16px',
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="flex-1 bg-transparent border-none outline-none"
            style={{
              color: 'var(--text-primary)',
              fontSize: '16px',
            }}
          />
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto"
          style={{
            padding: 'var(--spacing-2)',
          }}
        >
          {!isSignedIn ? (
            <div className="text-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>
                Sign in to save and access your notes
              </p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>
                Loading notes...
              </p>
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="text-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>
                {searchQuery ? 'No notes found' : 'No saved notes yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredNotes.map((note, index) => (
                <button
                  key={note.id}
                  onClick={() => handleSelectNote(note)}
                  className="w-full text-left p-3 rounded-lg transition-colors"
                  style={{
                    background: index === selectedIndex ? 'var(--bg-tertiary)' : 'transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-medium truncate"
                        style={{
                          color: 'var(--text-primary)',
                          fontSize: '14px',
                        }}
                      >
                        {note.title}
                      </h3>
                      <p
                        className="truncate mt-1"
                        style={{
                          color: 'var(--text-tertiary)',
                          fontSize: '13px',
                        }}
                      >
                        {getPreview(note.content)}
                      </p>
                      <p
                        className="mt-1"
                        style={{
                          color: 'var(--text-tertiary)',
                          fontSize: '12px',
                        }}
                      >
                        {formatDate(note.updatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteNote(e, note.id)}
                      className="p-1 rounded opacity-0 hover:opacity-100 transition-opacity hover:bg-[var(--bg-tertiary)]"
                      style={{
                        color: 'var(--text-tertiary)',
                        opacity: index === selectedIndex ? 0.5 : 0,
                      }}
                      title="Delete note"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{
            borderTop: '1px solid var(--border-default)',
            fontSize: '12px',
            color: 'var(--text-tertiary)',
          }}
        >
          <span>{filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <kbd className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>
              Enter
            </kbd>
            <span>to open</span>
            <kbd className="px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>
              Esc
            </kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
