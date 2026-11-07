import {
  Bold,
  CheckSquare,
  Italic,
  List,
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
  hasActiveNote,
  formatState,
  onFormatAction,
  theme,
  onToggleTheme,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  onClose,
}: TitlebarProps) {
  const handleMinimize = () => {
    if (isTauriRuntime()) {
      void getCurrentWindow().minimize();
    }
  };

  const handleToggleMaximize = () => {
    if (isTauriRuntime()) {
      void getCurrentWindow().toggleMaximize();
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (isTauriRuntime()) {
      void getCurrentWindow().close();
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
            title="Checklist"
            aria-label="Format Checklist"
          >
            <CheckSquare size={15} />
          </button>
        </div>
      ) : (
        <div data-tauri-drag-region />
      )}

      <div className="titlebar-group">
        <button
          type="button"
          className={`icon-btn pin-screen-btn ${alwaysOnTop ? 'is-active' : ''}`}
          onClick={onToggleAlwaysOnTop}
          title="Sematkan jendela selalu di atas layar"
          aria-label="Pin ke Layar"
          aria-pressed={alwaysOnTop}
        >
          <Pin size={14} />
          <span>{alwaysOnTop ? 'Tersemat' : 'Pin'}</span>
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
            className="win-btn"
            onClick={handleMinimize}
            aria-label="Minimize"
            title="Perkecil"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="win-btn"
            onClick={handleToggleMaximize}
            aria-label="Maximize"
            title="Perbesar"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            className="win-btn win-close"
            onClick={handleClose}
            aria-label="Close"
            title="Tutup"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}
