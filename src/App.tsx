import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime, notesApi } from './api/notes';
import type { Note, NoteSummary } from './types/note';
import {
  Titlebar,
  type EditorFormatAction,
  type EditorFormatState,
} from './components/Titlebar';
import { Sidebar } from './components/Sidebar';
import { NoteEditor, type NoteEditorHandle } from './components/NoteEditor';

const THEME_STORAGE_KEY = 'mononote:theme';
const AUTOSAVE_DELAY_MS = 300;

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }
  return 'light';
}

function sortSummaries(items: NoteSummary[]): NoteSummary[] {
  return [...items].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt
  );
}

interface PendingDraft {
  noteId: string;
  contentJson: string;
  plainText: string;
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoCollapsedByPin, setAutoCollapsedByPin] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [formatState, setFormatState] = useState<EditorFormatState>({
    bold: false,
    italic: false,
    bulletList: false,
    taskList: false,
  });

  const editorRef = useRef<NoteEditorHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingDraftRef = useRef<PendingDraft | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const draft = pendingDraftRef.current;
    if (!draft) return;
    pendingDraftRef.current = null;

    try {
      setSaveStatus('saving');
      const summary = await notesApi.saveNote(
        draft.noteId,
        draft.contentJson,
        draft.plainText
      );
      if (searchQueryRef.current.trim()) {
        const refreshed = await notesApi.listNotes(searchQueryRef.current);
        setNotes(refreshed);
      } else {
        setNotes((prev) =>
          sortSummaries(prev.map((item) => (item.id === summary.id ? summary : item)))
        );
      }
      setSaveStatus('saved');
    } catch {
      pendingDraftRef.current = draft;
      setSaveStatus('error');
    }
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initialList = await notesApi.listNotes();
      if (cancelled) return;
      setNotes(initialList);
      if (initialList.length > 0) {
        const full = await notesApi.getNote(initialList[0].id);
        if (!cancelled) setActiveNote(full);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh list when searchQuery changes
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const filtered = await notesApi.listNotes(searchQuery);
      if (!cancelled) setNotes(filtered);
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  // Flush before closing window
  const isClosingRef = useRef(false);

  const handleCloseWindow = useCallback(async () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    try {
      await flushPendingSave();
    } finally {
      if (isTauriRuntime()) {
        try {
          await getCurrentWindow().destroy();
        } catch {
          isClosingRef.current = false;
          await getCurrentWindow().close();
        }
      }
    }
  }, [flushPendingSave]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let unlisten: (() => void) | undefined;
    let isMounted = true;

    void (async () => {
      const cleanup = await getCurrentWindow().onCloseRequested(async (event) => {
        if (isClosingRef.current) return;
        event.preventDefault();
        isClosingRef.current = true;
        try {
          await flushPendingSave();
        } finally {
          await getCurrentWindow().destroy();
        }
      });
      if (isMounted) {
        unlisten = cleanup;
      } else {
        cleanup();
      }
    })();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
    };
  }, [flushPendingSave]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushPendingSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushPendingSave]);

  const handleSelectNote = useCallback(
    async (id: string) => {
      if (activeNote?.id === id) return;
      await flushPendingSave();
      const full = await notesApi.getNote(id);
      setActiveNote(full);
    },
    [activeNote?.id, flushPendingSave]
  );

  const handleCreateNote = useCallback(async () => {
    await flushPendingSave();
    if (searchQueryRef.current) {
      setSearchQuery('');
    }
    const created = await notesApi.createNote();
    const list = await notesApi.listNotes();
    setNotes(list);
    setActiveNote(created);
  }, [flushPendingSave]);

  const handleContentChange = useCallback(
    (noteId: string, contentJson: string, plainText: string) => {
      pendingDraftRef.current = { noteId, contentJson, plainText };
      setSaveStatus('saving');
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void flushPendingSave();
      }, AUTOSAVE_DELAY_MS);
    },
    [flushPendingSave]
  );

  const handleTogglePinNote = useCallback(
    async (id: string) => {
      await flushPendingSave();
      const updated = await notesApi.togglePinNote(id);
      setNotes((prev) =>
        sortSummaries(prev.map((item) => (item.id === updated.id ? updated : item)))
      );
      setActiveNote((prev) =>
        prev && prev.id === updated.id ? { ...prev, pinned: updated.pinned } : prev
      );
    },
    [flushPendingSave]
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      if (pendingDraftRef.current?.noteId === id) {
        pendingDraftRef.current = null;
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      } else {
        await flushPendingSave();
      }

      await notesApi.deleteNote(id);
      const remaining = await notesApi.listNotes(searchQueryRef.current);
      setNotes(remaining);

      if (activeNote?.id === id) {
        if (remaining.length > 0) {
          const nextFull = await notesApi.getNote(remaining[0].id);
          setActiveNote(nextFull);
        } else {
          setActiveNote(null);
        }
      }
    },
    [activeNote?.id, flushPendingSave]
  );

  const handleToggleAlwaysOnTop = useCallback(async () => {
    const next = !alwaysOnTop;
    const confirmed = await notesApi.setAlwaysOnTop(next);
    setAlwaysOnTop(confirmed);
    if (confirmed) {
      if (!sidebarCollapsed) {
        setSidebarCollapsed(true);
        setAutoCollapsedByPin(true);
      }
    } else if (autoCollapsedByPin) {
      setSidebarCollapsed(false);
      setAutoCollapsedByPin(false);
    }
  }, [alwaysOnTop, autoCollapsedByPin, sidebarCollapsed]);

  const handleToggleSidebar = useCallback(() => {
    setAutoCollapsedByPin(false);
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const handleFormatAction = useCallback((action: EditorFormatAction) => {
    editorRef.current?.runFormatAction(action);
  }, []);

  // Global keyboard shortcuts: Ctrl+N, Ctrl+\, Ctrl+F
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void handleCreateNote();
      } else if (e.key === '\\') {
        e.preventDefault();
        handleToggleSidebar();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSidebarCollapsed(false);
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCreateNote, handleToggleSidebar]);

  return (
    <div className="app-shell">
      <Titlebar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        onCreateNote={() => void handleCreateNote()}
        hasActiveNote={activeNote !== null}
        formatState={formatState}
        onFormatAction={handleFormatAction}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        alwaysOnTop={alwaysOnTop}
        onToggleAlwaysOnTop={() => void handleToggleAlwaysOnTop()}
        onClose={() => void handleCloseWindow()}
      />

      <div className="workspace">
        <Sidebar
          ref={searchInputRef}
          collapsed={sidebarCollapsed}
          notes={notes}
          activeNoteId={activeNote?.id ?? null}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectNote={(id) => void handleSelectNote(id)}
          onTogglePinNote={(id) => void handleTogglePinNote(id)}
          onDeleteNote={(id) => void handleDeleteNote(id)}
        />

        {activeNote ? (
          <NoteEditor
            ref={editorRef}
            note={activeNote}
            saveStatus={saveStatus}
            onContentChange={handleContentChange}
            onFormatStateChange={setFormatState}
          />
        ) : (
          <div className="empty-workspace">
            <div>Belum ada catatan aktif</div>
            <button
              type="button"
              className="primary-btn"
              onClick={() => void handleCreateNote()}
            >
              Buat Catatan Baru
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
