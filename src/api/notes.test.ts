import { beforeEach, describe, expect, it, vi } from 'vitest';
import { notesApi, resetBrowserStoreForTests } from './notes';

describe('notesApi', () => {
  beforeEach(() => {
    resetBrowserStoreForTests();
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  });

  it('seeds welcome note once and supports create, save, search, pin, and delete', async () => {
    const initial = await notesApi.listNotes();
    expect(initial).toHaveLength(1);
    expect(initial[0].title).toContain('Selamat Datang');

    const created = await notesApi.createNote();
    const updatedSummary = await notesApi.saveNote(
      created.id,
      JSON.stringify({ type: 'doc' }),
      'Belajar Tauri\nRust desktop super enteng'
    );
    expect(updatedSummary.title).toBe('Belajar Tauri');
    expect(updatedSummary.preview).toBe('Rust desktop super enteng');

    const searchHits = await notesApi.listNotes('ENTENG');
    expect(searchHits).toHaveLength(1);
    expect(searchHits[0].id).toBe(created.id);

    const pinned = await notesApi.togglePinNote(initial[0].id);
    expect(pinned.pinned).toBe(true);

    const ordered = await notesApi.listNotes();
    expect(ordered[0].id).toBe(initial[0].id);

    await notesApi.deleteNote(initial[0].id);
    await notesApi.deleteNote(created.id);
    expect(await notesApi.listNotes()).toHaveLength(0);
  });

  it('delegates to Tauri invoke with camelCase arguments when running inside Tauri', async () => {
    const invokeSpy = vi.fn().mockResolvedValue({
      id: 'n1',
      title: 'Judul',
      preview: 'Isi',
      pinned: false,
      updatedAt: 100,
    });

    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: invokeSpy,
    };

    await notesApi.saveNote('n1', '{"type":"doc"}', 'Judul\nIsi');
    expect(invokeSpy).toHaveBeenCalledWith(
      'save_note',
      {
        id: 'n1',
        contentJson: '{"type":"doc"}',
        plainText: 'Judul\nIsi',
      },
      undefined
    );
  });
});
