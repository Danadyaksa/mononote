import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { resetBrowserStoreForTests } from './api/notes';

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
});
