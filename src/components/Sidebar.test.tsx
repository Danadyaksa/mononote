import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import type { NoteSummary } from '../types/note';

const sampleNotes: NoteSummary[] = [
  {
    id: 'pinned-1',
    title: 'Target Minggu Ini',
    preview: 'Beresin UI notepad',
    pinned: true,
    updatedAt: 1730970000000,
  },
  {
    id: 'normal-1',
    title: 'Catatan Belanja',
    preview: 'Kopi dan susu',
    pinned: false,
    updatedAt: 1730980000000,
  },
];

describe('Sidebar', () => {
  it('separates Disematkan and Catatan groups and fires selection, pin, delete, and search callbacks', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onTogglePin = vi.fn();
    const onDelete = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <Sidebar
        collapsed={false}
        notes={sampleNotes}
        activeNoteId="normal-1"
        searchQuery=""
        onSearchChange={onSearchChange}
        onSelectNote={onSelect}
        onTogglePinNote={onTogglePin}
        onDeleteNote={onDelete}
      />
    );

    expect(screen.getByText('Disematkan')).toBeInTheDocument();
    expect(screen.getByText('Catatan')).toBeInTheDocument();

    await user.click(screen.getByText('Target Minggu Ini'));
    expect(onSelect).toHaveBeenCalledWith('pinned-1');

    await user.click(screen.getByRole('button', { name: 'Lepas sematan Target Minggu Ini' }));
    expect(onTogglePin).toHaveBeenCalledWith('pinned-1');

    await user.click(screen.getByRole('button', { name: 'Hapus Catatan Belanja' }));
    expect(onDelete).toHaveBeenCalledWith('normal-1');

    await user.type(screen.getByPlaceholderText('Cari catatan...'), 'k');
    expect(onSearchChange).toHaveBeenCalledWith('k');
  });

  it('renders empty states, clears search query, and applies collapsed state', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    const { container, rerender } = render(
      <Sidebar
        collapsed={false}
        notes={[]}
        activeNoteId={null}
        searchQuery=""
        onSearchChange={onSearchChange}
        onSelectNote={vi.fn()}
        onTogglePinNote={vi.fn()}
        onDeleteNote={vi.fn()}
      />
    );

    expect(screen.getByText('Belum ada catatan.')).toBeInTheDocument();

    rerender(
      <Sidebar
        collapsed={false}
        notes={[]}
        activeNoteId={null}
        searchQuery="tidak-ada"
        onSearchChange={onSearchChange}
        onSelectNote={vi.fn()}
        onTogglePinNote={vi.fn()}
        onDeleteNote={vi.fn()}
      />
    );

    expect(screen.getByText('Tidak ada catatan yang cocok.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bersihkan pencarian' }));
    expect(onSearchChange).toHaveBeenCalledWith('');

    rerender(
      <Sidebar
        collapsed={true}
        notes={sampleNotes}
        activeNoteId="normal-1"
        searchQuery=""
        onSearchChange={onSearchChange}
        onSelectNote={vi.fn()}
        onTogglePinNote={vi.fn()}
        onDeleteNote={vi.fn()}
      />
    );

    const aside = container.querySelector('aside.sidebar');
    expect(aside).toHaveClass('is-collapsed');
    expect(aside).toHaveAttribute('aria-hidden', 'true');
  });
});
