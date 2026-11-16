import {
  Bold,
  CheckSquare,
  Download,
  FolderOpen,
  Italic,
  List,
  ListTree,
  Minus,
  Moon,
  PanelLeft,
  Pin,
  Square,
  SquarePen,
  Sun,
  X,
} from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriRuntime } from '../api/notes';

export interface EditorFormatState {
  bold: boolean;
  italic: boolean;
  bulletList: boolean;
  taskList: boolean;
}

export type EditorFormatAction = 'bold' | 'italic' | 'bulletList' | 'taskList';

export interface TitlebarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onCreateNote: () => void;
  onOpenFile?: () => void;
  onSaveAs?: () => void;
  onToggleOutline?: () => void;
  isOutlineActive?: boolean;
  hasActiveNote: boolean;
  formatState: EditorFormatState;
  onFormatAction: (action: EditorFormatAction) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  alwaysOnTop: boolean;
  onToggleAlwaysOnTop: () => void;
  onClose?: () => void;
}

export function Titlebar({
  sidebarCollapsed,
  onToggleSidebar,
  onCreateNote,
  onOpenFile,
  onSaveAs,
  onToggleOutline,
  isOutlineActive = false,
  hasActiveNote,
  formatState,
  onFormatAction,
  theme,
  onToggleTheme,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  onClose,
}: TitlebarProps) {
  const handleMinimize = async () => {
    if (isTauriRuntime()) {
      try {
        await getCurrentWindow().minimize();
      } catch (err) {
        console.error('Failed to minimize window', err);
      }
    }
  };

  const handleMaximize = async () => {
    if (isTauriRuntime()) {
      try {
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.error('Failed to toggle maximize', err);
      }
    }
  };

  const handleClose = async () => {
    if (onClose) {
      onClose();
    }
    if (isTauriRuntime()) {
      try {
        await getCurrentWindow().destroy();
      } catch (err) {
        console.error('Failed to close window', err);
      }
    }
  };

  return (
    <header className="titlebar" data-tauri-drag-region>
      <div className="titlebar-group">
        <button
          type="button"
          className={`icon-btn ${!sidebarCollapsed ? 'is-active' : ''}`}
          onClick={onToggleSidebar}
          title="Tampilkan/Sembunyikan Sidebar (Ctrl+\)"
          aria-label="Toggle Sidebar"
        >
          <PanelLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onCreateNote}
          title="Catatan Baru (Ctrl+N)"
          aria-label="Catatan Baru"
        >
          <SquarePen size={16} />
        </button>
        {onOpenFile && (
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenFile}
            title="Buka File Markdown (Ctrl+O)"
            aria-label="Buka File"
          >
            <FolderOpen size={16} />
          </button>
        )}
        {onToggleOutline && (
          <button
            type="button"
            className={`icon-btn ${isOutlineActive ? 'is-active' : ''}`}
            onClick={onToggleOutline}
            title="Daftar Isi Catatan (Alt+O)"
            aria-label="Toggle Daftar Isi"
            disabled={!hasActiveNote}
          >
            <ListTree size={16} />
          </button>
        )}
      </div>

      {hasActiveNote ? (
        <div className="titlebar-center">
          <button
            type="button"
            className={`icon-btn ${formatState.bold ? 'is-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormatAction('bold')}
            title="Tebal (Ctrl+B)"
            aria-label="Format Tebal"
          >
            <Bold size={15} />
          </button>
          <button
            type="button"
            className={`icon-btn ${formatState.italic ? 'is-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormatAction('italic')}
            title="Miring (Ctrl+I)"
            aria-label="Format Miring"
          >
            <Italic size={15} />
          </button>
          <button
            type="button"
            className={`icon-btn ${formatState.bulletList ? 'is-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormatAction('bulletList')}
            title="Daftar Poin"
            aria-label="Daftar Poin"
          >
            <List size={15} />
          </button>
          <button
            type="button"
            className={`icon-btn ${formatState.taskList ? 'is-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onFormatAction('taskList')}
            title="Daftar Tugas / Checklist"
            aria-label="Daftar Tugas"
          >
            <CheckSquare size={15} />
          </button>
        </div>
      ) : (
        <div className="titlebar-center is-empty">
          <span className="titlebar-app-title">Mononote</span>
        </div>
      )}

      <div className="titlebar-group">
        {hasActiveNote && onSaveAs && (
          <button
            type="button"
            className="icon-btn"
            onClick={onSaveAs}
            title="Simpan Sebagai Markdown (Ctrl+Shift+S)"
            aria-label="Simpan Sebagai"
          >
            <Download size={15} />
          </button>
        )}
        <button
          type="button"
          className={`icon-btn pin-screen-btn ${alwaysOnTop ? 'is-active' : ''}`}
          onClick={onToggleAlwaysOnTop}
          title={
            alwaysOnTop
              ? 'Lepas Pin di Layar (kembali normal)'
              : 'Pin di Layar (selalu tampil di atas aplikasi lain)'
          }
          aria-label="Pin ke Layar"
          aria-pressed={alwaysOnTop}
        >
          <Pin size={14} className={alwaysOnTop ? 'is-pinned-icon' : ''} />
          <span>Pin</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Ganti ke Mode Terang' : 'Ganti ke Mode Gelap'}
          aria-label="Ganti Tema"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <div className="window-controls">
          <button
            type="button"
            className="win-btn win-min"
            onClick={handleMinimize}
            title="Minimalkan"
            aria-label="Minimalkan"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            className="win-btn win-max"
            onClick={handleMaximize}
            title="Maksimalkan"
            aria-label="Maksimalkan"
          >
            <Square size={11} />
          </button>
          <button
            type="button"
            className="win-btn win-close"
            onClick={handleClose}
            title="Tutup Mononote"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
