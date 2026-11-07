import { forwardRef } from 'react';
import { Pin, Search, Trash2, X } from 'lucide-react';
import type { NoteSummary } from '../types/note';

export interface SidebarProps {
  collapsed: boolean;
  notes: NoteSummary[];
  activeNoteId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectNote: (id: string) => void;
  onTogglePinNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

function formatShortTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export const Sidebar = forwardRef<HTMLInputElement, SidebarProps>(function Sidebar(
  {
    collapsed,
    notes,
    activeNoteId,
    searchQuery,
    onSearchChange,
    onSelectNote,
    onTogglePinNote,
    onDeleteNote,
  },
  searchInputRef
) {
  const pinnedNotes = notes.filter((note) => note.pinned);
  const regularNotes = notes.filter((note) => !note.pinned);

  const renderCard = (note: NoteSummary) => {
    const isSelected = note.id === activeNoteId;
    return (
      <div
        key={note.id}
        role="button"
        tabIndex={0}
        className={`note-card ${isSelected ? 'is-selected' : ''}`}
        onClick={() => onSelectNote(note.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectNote(note.id);
          }
        }}
      >
        <div className="note-card-header">
          <span className="note-card-title">{note.title}</span>
          <div className="note-card-actions">
            <button
              type="button"
              className={`mini-action-btn ${note.pinned ? 'is-pinned' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePinNote(note.id);
              }}
              aria-label={
                note.pinned ? `Lepas sematan ${note.title}` : `Sematkan ${note.title}`
              }
              title={note.pinned ? 'Lepas sematan catatan' : 'Sematkan di atas'}
            >
              <Pin size={13} />
            </button>
            <button
              type="button"
              className="mini-action-btn is-danger"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteNote(note.id);
              }}
              aria-label={`Hapus ${note.title}`}
              title="Hapus catatan"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
        <div className="note-card-meta">
          <span className="note-card-date">{formatShortTime(note.updatedAt)}</span>
          <span className="note-card-preview">{note.preview}</span>
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}
      aria-hidden={collapsed}
      inert={collapsed || undefined}
    >
      <div className="sidebar-search-wrap">
        <div className="search-box">
          <Search size={14} color="var(--text-muted)" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari catatan..."
            aria-label="Cari catatan"
          />
          {searchQuery && (
            <button
              type="button"
              className="mini-action-btn"
              onClick={() => onSearchChange('')}
              aria-label="Bersihkan pencarian"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="sidebar-list">
        {notes.length === 0 ? (
          <div className="sidebar-empty">
            {searchQuery ? 'Tidak ada catatan yang cocok.' : 'Belum ada catatan.'}
          </div>
        ) : (
          <>
            {pinnedNotes.length > 0 && (
              <section>
                <div className="sidebar-section-label">Disematkan</div>
                {pinnedNotes.map(renderCard)}
              </section>
            )}
            {regularNotes.length > 0 && (
              <section>
                {pinnedNotes.length > 0 && (
                  <div className="sidebar-section-label">Catatan</div>
                )}
                {regularNotes.map(renderCard)}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
});
