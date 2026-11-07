import { createRef } from 'react';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NoteEditor, serializeDocToPlainText, type NoteEditorHandle } from './NoteEditor';
import type { Note } from '../types/note';

const sampleNote: Note = {
  id: 'note-1',
  title: 'Judul Awal',
  preview: 'Paragraf isi pertama',
  contentJson: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Judul Awal' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Paragraf isi pertama' }],
      },
    ],
  }),
  plainText: 'Judul Awal\nParagraf isi pertama',
  pinned: false,
  createdAt: 1000,
  updatedAt: 1000,
};

const secondNote: Note = {
  id: 'note-2',
  title: 'Catatan Baru',
  preview: 'Konten berbeda',
  contentJson: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Catatan Baru' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Konten berbeda' }],
      },
    ],
  }),
  plainText: 'Catatan Baru\nKonten berbeda',
  pinned: false,
  createdAt: 2000,
  updatedAt: 2000,
};

describe('NoteEditor', () => {
  it('renders first block as H1 title and extracts clean line-separated plain text', () => {
    const onContentChange = vi.fn();
    const onFormatStateChange = vi.fn();
    const ref = createRef<NoteEditorHandle>();

    render(
      <NoteEditor
        ref={ref}
        note={sampleNote}
        saveStatus="saved"
        onContentChange={onContentChange}
        onFormatStateChange={onFormatStateChange}
      />
    );

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Judul Awal');
    expect(screen.getByText('Paragraf isi pertama')).toBeInTheDocument();

    expect(
      serializeDocToPlainText({
        type: 'doc',
        content: [
          { type: 'heading', content: [{ type: 'text', text: 'Judul Catatan' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Baris kedua' }] },
        ],
      })
    ).toBe('Judul Catatan\nBaris kedua');

    act(() => {
      ref.current?.runFormatAction('bold');
      ref.current?.runFormatAction('italic');
      ref.current?.runFormatAction('bulletList');
      ref.current?.runFormatAction('taskList');
    });
    expect(ref.current).not.toBeNull();
  });

  it('renders saving and error status indicators correctly', () => {
    const onContentChange = vi.fn();
    const onFormatStateChange = vi.fn();

    const { rerender } = render(
      <NoteEditor
        note={sampleNote}
        saveStatus="saved"
        onContentChange={onContentChange}
        onFormatStateChange={onFormatStateChange}
      />
    );

    expect(screen.queryByText('Menyimpan…')).toBeNull();
    expect(screen.queryByText('Gagal menyimpan — coba ketik ulang')).toBeNull();

    rerender(
      <NoteEditor
        note={sampleNote}
        saveStatus="saving"
        onContentChange={onContentChange}
        onFormatStateChange={onFormatStateChange}
      />
    );
    expect(screen.getByText('Menyimpan…')).toBeInTheDocument();

    rerender(
      <NoteEditor
        note={sampleNote}
        saveStatus="error"
        onContentChange={onContentChange}
        onFormatStateChange={onFormatStateChange}
      />
    );
    const errorEl = screen.getByText('Gagal menyimpan — coba ketik ulang');
    expect(errorEl).toBeInTheDocument();
    expect(errorEl).toHaveClass('is-error');
  });

  it('switches note content when note id changes', () => {
    const onContentChange = vi.fn();
    const onFormatStateChange = vi.fn();

    const { rerender } = render(
      <NoteEditor
        note={sampleNote}
        saveStatus="saved"
        onContentChange={onContentChange}
        onFormatStateChange={onFormatStateChange}
      />
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Judul Awal');

    rerender(
      <NoteEditor
        note={secondNote}
        saveStatus="saved"
        onContentChange={onContentChange}
        onFormatStateChange={onFormatStateChange}
      />
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Catatan Baru');
  });

  it('safely handles empty or corrupted JSON in serializeDocToPlainText', () => {
    expect(serializeDocToPlainText({})).toBe('');
    expect(serializeDocToPlainText({ type: 'doc' })).toBe('');
    expect(
      serializeDocToPlainText({
        type: 'doc',
        content: [
          { type: 'heading', content: [{ type: 'text', text: 'H1' }] },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }],
              },
            ],
          },
        ],
      })
    ).toBe('H1\nItem 1');
  });
});
