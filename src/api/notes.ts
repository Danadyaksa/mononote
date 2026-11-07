import { invoke } from '@tauri-apps/api/core';
import type { Note, NoteSummary } from '../types/note';

const STORAGE_KEY = 'mononote:browser-notes';
const INIT_KEY = 'mononote:browser-initialized';
export const EMPTY_DOC_JSON = JSON.stringify({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 } }, { type: 'paragraph' }],
});

const WELCOME_DOC_JSON = JSON.stringify({
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Selamat Datang di Mononote' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Tempat coret-coret cepat yang bersih dan ringan di mata.',
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        {
          type: 'taskItem',
          attrs: { checked: true },
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Baris pertama otomatis jadi judul catatan' }],
            },
          ],
        },
        {
          type: 'taskItem',
          attrs: { checked: false },
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Klik ikon Pin di kanan atas buat tempel jendela di layar',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const WELCOME_PLAIN_TEXT =
  'Selamat Datang di Mononote\nTempat coret-coret cepat yang bersih dan ringan di mata.\nBaris pertama otomatis jadi judul catatan\nKlik ikon Pin di kanan atas buat tempel jendela di layar';

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function extractTitleAndPreview(plainText: string): { title: string; preview: string } {
  const lines = plainText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rawTitle = lines[0] ?? 'Catatan Baru';
  const rawPreview = lines[1] ?? 'Belum ada teks tambahan';

  return {
    title: rawTitle.length > 120 ? `${rawTitle.slice(0, 120)}…` : rawTitle,
    preview: rawPreview.length > 90 ? `${rawPreview.slice(0, 90)}…` : rawPreview,
  };
}

function readBrowserNotes(): Note[] {
  if (!localStorage.getItem(INIT_KEY)) {
    const now = Date.now();
    const { title, preview } = extractTitleAndPreview(WELCOME_PLAIN_TEXT);
    const welcome: Note = {
      id: crypto.randomUUID(),
      title,
      preview,
      contentJson: WELCOME_DOC_JSON,
      plainText: WELCOME_PLAIN_TEXT,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([welcome]));
    localStorage.setItem(INIT_KEY, '1');
    return [welcome];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Note[]) : [];
  } catch {
    return [];
  }
}

function writeBrowserNotes(notes: Note[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function toSummary(note: Note): NoteSummary {
  return {
    id: note.id,
    title: note.title,
    preview: note.preview,
    pinned: note.pinned,
    updatedAt: note.updatedAt,
  };
}

let browserAlwaysOnTop = false;

export function resetBrowserStoreForTests(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(INIT_KEY);
  browserAlwaysOnTop = false;
}

export const notesApi = {
  async listNotes(query?: string): Promise<NoteSummary[]> {
    if (isTauriRuntime()) {
      return invoke<NoteSummary[]>('list_notes', { query: query ?? null });
    }
    const q = query?.trim().toLowerCase();
    return readBrowserNotes()
      .filter((note) => {
        if (!q) return true;
        return (
          note.title.toLowerCase().includes(q) || note.plainText.toLowerCase().includes(q)
        );
      })
      .map(toSummary)
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  },

  async getNote(id: string): Promise<Note> {
    if (isTauriRuntime()) {
      return invoke<Note>('get_note', { id });
    }
    const found = readBrowserNotes().find((n) => n.id === id);
    if (!found) throw new Error(`Catatan tidak ditemukan: ${id}`);
    return found;
  },

  async createNote(): Promise<Note> {
    if (isTauriRuntime()) {
      return invoke<Note>('create_note');
    }
    const notes = readBrowserNotes();
    const now = Date.now();
    const created: Note = {
      id: crypto.randomUUID(),
      title: 'Catatan Baru',
      preview: 'Belum ada teks tambahan',
      contentJson: EMPTY_DOC_JSON,
      plainText: '',
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    writeBrowserNotes([created, ...notes]);
    return created;
  },

  async saveNote(id: string, contentJson: string, plainText: string): Promise<NoteSummary> {
    if (isTauriRuntime()) {
      return invoke<NoteSummary>('save_note', { id, contentJson, plainText });
    }
    const notes = readBrowserNotes();
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error(`Catatan tidak ditemukan: ${id}`);
    const { title, preview } = extractTitleAndPreview(plainText);
    const updated: Note = {
      ...notes[idx],
      title,
      preview,
      contentJson,
      plainText,
      updatedAt: Date.now(),
    };
    notes[idx] = updated;
    writeBrowserNotes(notes);
    return toSummary(updated);
  },

  async togglePinNote(id: string): Promise<NoteSummary> {
    if (isTauriRuntime()) {
      return invoke<NoteSummary>('toggle_pin_note', { id });
    }
    const notes = readBrowserNotes();
    const idx = notes.findIndex((n) => n.id === id);
    if (idx === -1) throw new Error(`Catatan tidak ditemukan: ${id}`);
    const updated: Note = {
      ...notes[idx],
      pinned: !notes[idx].pinned,
    };
    notes[idx] = updated;
    writeBrowserNotes(notes);
    return toSummary(updated);
  },

  async deleteNote(id: string): Promise<void> {
    if (isTauriRuntime()) {
      await invoke<void>('delete_note', { id });
      return;
    }
    const remaining = readBrowserNotes().filter((n) => n.id !== id);
    writeBrowserNotes(remaining);
  },

  async setAlwaysOnTop(alwaysOnTop: boolean): Promise<boolean> {
    if (isTauriRuntime()) {
      return invoke<boolean>('set_always_on_top', { alwaysOnTop });
    }
    browserAlwaysOnTop = alwaysOnTop;
    return browserAlwaysOnTop;
  },
};
