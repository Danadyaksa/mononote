import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { notesApi, resetBrowserStoreForTests } from './api/notes';

describe('App integration', () => {
  beforeEach(() => {
    localStorage.clear();
    resetBrowserStoreForTests();
  });

  it('loads welcome note, toggles dark mode, and auto-collapses sidebar into Focus Mode when pinned to screen', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Selamat Datang di Mononote/i })
      ).toBeInTheDocument();
    });

    // Toggle theme
    const initialTheme = document.documentElement.getAttribute('data-theme');
    await user.click(screen.getByRole('button', { name: 'Ganti Tema' }));
    expect(document.documentElement.getAttribute('data-theme')).not.toBe(initialTheme);

    // Activate Pin to Screen -> auto-collapses sidebar into Focus Mode
    const pinBtn = screen.getByRole('button', { name: 'Pin ke Layar' });
    await user.click(pinBtn);
    expect(pinBtn).toHaveAttribute('aria-pressed', 'true');

    const sidebar = document.querySelector('.sidebar');
    expect(sidebar).toHaveClass('is-collapsed');

    // User can still manually re-open sidebar while pinned
    await user.click(screen.getByRole('button', { name: 'Toggle Sidebar' }));
    expect(sidebar).not.toHaveClass('is-collapsed');
  });

  it('shows clean empty state when all notes are deleted and creates a fresh note on click', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Selamat Datang di Mononote')).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole('button', { name: /Hapus Selamat Datang di Mononote/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Belum ada catatan aktif')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Buat Catatan Baru' }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
  });

  it('flushes pending unsaved draft immediately when Close button is clicked without waiting 300ms', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(notesApi, 'saveNote');

    render(<App />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Selamat Datang di Mononote/i })
      ).toBeInTheDocument();
    });

    const formatBtn = screen.getByRole('button', { name: 'Daftar Poin' });
    await user.click(formatBtn);

    // The 300ms autosave timer has not fired yet
    expect(saveSpy).not.toHaveBeenCalled();

    // Clicking Close triggers immediate flush without waiting 300ms
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    await user.click(closeBtn);

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });
});
