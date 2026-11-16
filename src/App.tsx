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
import {
  parseMarkdownToTipTap,
  serializeTipTapToMarkdown,
} from './utils/markdown';

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
  filePath?: string;
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

  const activeNoteRef = useRef<Note | null>(null);
  activeNoteRef.current = activeNote;

  // In-memory store for open external markdown files
  const externalNotesMapRef = useRef<Map<string, Note>>(new Map());

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

      if (draft.filePath) {
        // Save back to external markdown file on disk
        let docObj: Record<string, unknown> = {};
        try {
          docObj = JSON.parse(draft.contentJson) as Record<string, unknown>;
        } catch {
          docObj = {};
        }
        const mdText = serializeTipTapToMarkdown(docObj);
        await notesApi.saveMarkdownFile(draft.filePath, mdText);

        const cached = externalNotesMapRef.current.get(draft.noteId);
        if (cached) {
          const updatedCached: Note = {
            ...cached,
            contentJson: draft.contentJson,
            plainText: draft.plainText,
            updatedAt: Date.now(),
          };
          externalNotesMapRef.current.set(draft.noteId, updatedCached);
        }

        setNotes((prev) =>
          sortSummaries(
            prev.map((item) =>
              item.id === draft.noteId ? { ...item, updatedAt: Date.now() } : item
            )
          )
        );
      } else {
        // Save to internal store
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
      if (!cancelled) {
        // Keep active external notes visible during search if they match
        const externals: NoteSummary[] = [];
        externalNotesMapRef.current.forEach((extNote) => {
          const q = searchQuery.trim().toLowerCase();
          if (
            !q ||
            extNote.title.toLowerCase().includes(q) ||
            extNote.plainText.toLowerCase().includes(q)
          ) {
            externals.push({
              id: extNote.id,
              title: extNote.title,
              preview: extNote.preview,
              pinned: extNote.pinned,
              updatedAt: extNote.updatedAt,
              isExternal: true,
            });
          }
        });
        setNotes(sortSummaries([...externals, ...filtered]));
      }
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

      if (externalNotesMapRef.current.has(id)) {
        setActiveNote(externalNotesMapRef.current.get(id)!);
        return;
      }

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

  // Open an external Markdown file
  const handleOpenMarkdownFile = useCallback(async () => {
    await flushPendingSave();
    const fileData = await notesApi.openMarkdownFileDialog();
    if (!fileData) return;

    const parsed = parseMarkdownToTipTap(fileData.content, fileData.filename);
    const externalNote: Note = {
      id: `ext-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      title: parsed.title,
      preview: parsed.preview,
      contentJson: parsed.contentJson,
      plainText: parsed.plainText,
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      filePath: fileData.path,
    };

    externalNotesMapRef.current.set(externalNote.id, externalNote);

    setNotes((prev) => [
      {
        id: externalNote.id,
        title: externalNote.title,
        preview: externalNote.preview,
        pinned: false,
        updatedAt: externalNote.updatedAt,
        isExternal: true,
      },
      ...prev,
    ]);
    setActiveNote(externalNote);
  }, [flushPendingSave]);

  // Save As (export to Markdown)
  const handleSaveAs = useCallback(async () => {
    if (!activeNoteRef.current) return;
    await flushPendingSave();

    const current = activeNoteRef.current;
    let docObj: Record<string, unknown> = {};
    try {
      docObj = JSON.parse(current.contentJson) as Record<string, unknown>;
    } catch {
      docObj = {};
    }

    const mdText = serializeTipTapToMarkdown(docObj);
    const defaultName = current.title ? `${current.title}.md` : 'Catatan.md';
    const savedPath = await notesApi.saveAsMarkdownDialog(defaultName, mdText);

    if (savedPath) {
      const updated: Note = {
        ...current,
        filePath: savedPath,
        updatedAt: Date.now(),
      };
      externalNotesMapRef.current.set(updated.id, updated);
      setActiveNote(updated);
      setNotes((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, isExternal: true, updatedAt: updated.updatedAt } : item
        )
      );
      setSaveStatus('saved');
    }
  }, [flushPendingSave]);

  // Drag & drop support for Markdown files
  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const isMd =
        file.name.endsWith('.md') ||
        file.name.endsWith('.markdown') ||
        file.name.endsWith('.txt');

      if (isMd) {
        await flushPendingSave();
        const content = await file.text();
        const filePath = (file as unknown as { path?: string }).path;
        const parsed = parseMarkdownToTipTap(content, file.name);

        const externalNote: Note = {
          id: `ext-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          title: parsed.title,
          preview: parsed.preview,
          contentJson: parsed.contentJson,
          plainText: parsed.plainText,
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          filePath: filePath || undefined,
        };

        externalNotesMapRef.current.set(externalNote.id, externalNote);

        setNotes((prev) => [
          {
            id: externalNote.id,
            title: externalNote.title,
            preview: externalNote.preview,
            pinned: false,
            updatedAt: externalNote.updatedAt,
            isExternal: true,
          },
          ...prev,
        ]);
        setActiveNote(externalNote);
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    // Tauri-specific drag drop listener
    let unlistenTauriDrop: (() => void) | undefined;
    if (isTauriRuntime()) {
      void (async () => {
        unlistenTauriDrop = await getCurrentWindow().onDragDropEvent(async (event) => {
          if (event.payload.type === 'drop' && event.payload.paths.length > 0) {
            const dropPath = event.payload.paths[0];
            const isMdPath =
              dropPath.endsWith('.md') ||
              dropPath.endsWith('.markdown') ||
              dropPath.endsWith('.txt');
            if (isMdPath) {
              await flushPendingSave();
              try {
                const fileData = await notesApi.readMarkdownFile(dropPath);
                const parsed = parseMarkdownToTipTap(fileData.content, fileData.filename);
                const externalNote: Note = {
                  id: `ext-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
                  title: parsed.title,
                  preview: parsed.preview,
                  contentJson: parsed.contentJson,
                  plainText: parsed.plainText,
                  pinned: false,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  filePath: fileData.path,
                };

                externalNotesMapRef.current.set(externalNote.id, externalNote);
                setNotes((prev) => [
                  {
                    id: externalNote.id,
                    title: externalNote.title,
                    preview: externalNote.preview,
                    pinned: false,
                    updatedAt: externalNote.updatedAt,
                    isExternal: true,
                  },
                  ...prev,
                ]);
                setActiveNote(externalNote);
              } catch (err) {
                console.error('Gagal membaca dropped markdown file:', err);
              }
            }
          }
        });
      })();
    }

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      if (unlistenTauriDrop) unlistenTauriDrop();
    };
  }, [flushPendingSave]);

  const handleContentChange = useCallback(
    (noteId: string, contentJson: string, plainText: string) => {
      pendingDraftRef.current = {
        noteId,
        contentJson,
        plainText,
        filePath: activeNoteRef.current?.filePath,
      };
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
      if (externalNotesMapRef.current.has(id)) {
        const ext = externalNotesMapRef.current.get(id)!;
        const updated = { ...ext, pinned: !ext.pinned };
        externalNotesMapRef.current.set(id, updated);
        setNotes((prev) =>
          sortSummaries(prev.map((item) => (item.id === id ? { ...item, pinned: updated.pinned } : item)))
        );
        setActiveNote((prev) => (prev && prev.id === id ? updated : prev));
        return;
      }

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

      if (externalNotesMapRef.current.has(id)) {
        externalNotesMapRef.current.delete(id);
        const remaining = notes.filter((n) => n.id !== id);
        setNotes(remaining);
        if (activeNote?.id === id) {
          if (remaining.length > 0) {
            const nextNote = externalNotesMapRef.current.has(remaining[0].id)
              ? externalNotesMapRef.current.get(remaining[0].id)!
              : await notesApi.getNote(remaining[0].id);
            setActiveNote(nextNote);
          } else {
            setActiveNote(null);
          }
        }
        return;
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
    [activeNote?.id, flushPendingSave, notes]
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

  // Global keyboard shortcuts: Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S, Ctrl+\, Ctrl+F
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key.toLowerCase() === 'n' && !e.shiftKey) {
        e.preventDefault();
        void handleCreateNote();
      } else if (e.key.toLowerCase() === 'o') {
        e.preventDefault();
        void handleOpenMarkdownFile();
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          void handleSaveAs();
        } else {
          void flushPendingSave();
        }
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
  }, [flushPendingSave, handleCreateNote, handleOpenMarkdownFile, handleSaveAs, handleToggleSidebar]);

  return (
    <div className="app-shell">
      <Titlebar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        onCreateNote={() => void handleCreateNote()}
        onOpenFile={() => void handleOpenMarkdownFile()}
        onSaveAs={() => void handleSaveAs()}
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
