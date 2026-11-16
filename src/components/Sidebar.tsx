import { forwardRef } from 'react';
import { FileText, ListTree, Pin, Search, Trash2, X } from 'lucide-react';
import type { HeadingItem, NoteSummary, SidebarTab } from '../types/note';

export interface SidebarProps {
  collapsed: boolean;
  notes: NoteSummary[];
  activeNoteId: string | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectNote: (id: string) => void;
  onTogglePinNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  headings?: HeadingItem[];
  activeHeadingIndex?: number | null;
  onSelectHeading?: (index: number) => void;
  activeNoteTitle?: string;
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
    activeTab = 'notes',
    onTabChange,
    headings = [],
    activeHeadingIndex = null,
    onSelectHeading,
    activeNoteTitle,
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
      <div className="sidebar-tabs-wrap">
        <div className="sidebar-tabs" role="tablist" aria-label="Navigasi Sidebar">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'notes'}
            className={`sidebar-tab ${activeTab === 'notes' ? 'is-active' : ''}`}
            onClick={() => onTabChange?.('notes')}
            title="Daftar Semua Catatan"
          >
            <FileText size={13} />
            <span>Semua Catatan</span>
            <span className="sidebar-tab-badge">{notes.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'outline'}
            className={`sidebar-tab ${activeTab === 'outline' ? 'is-active' : ''}`}
            onClick={() => onTabChange?.('outline')}
            title="Daftar Isi / Subjudul (Alt+O)"
          >
            <ListTree size={13} />
            <span>Daftar Isi</span>
            {headings.length > 0 && (
              <span className="sidebar-tab-badge is-highlight">{headings.length}</span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'notes' ? (
        <>
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
        </>
      ) : (
        <div className="sidebar-outline-wrap">
          {!activeNoteId ? (
            <div className="sidebar-empty">
              <ListTree size={22} className="sidebar-empty-icon" />
              <span>Pilih atau buka catatan untuk melihat daftar isi.</span>
            </div>
          ) : headings.length === 0 ? (
            <div className="sidebar-empty">
              <ListTree size={22} className="sidebar-empty-icon" />
              <span className="sidebar-empty-title">Belum ada subjudul</span>
              <p className="sidebar-empty-hint">
                Ketik <code># Judul</code> atau <code>## Subjudul</code> di catatan untuk membuat daftar isi otomatis.
              </p>
            </div>
          ) : (
            <>
              <div className="outline-header">
                <span className="outline-header-title">{activeNoteTitle || 'Catatan'}</span>
                <span className="outline-header-count">{headings.length} bagian</span>
              </div>
              <nav className="outline-list" aria-label="Daftar Isi Catatan">
                {headings.map((item) => {
                  const isActive = activeHeadingIndex === item.index;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`outline-item outline-level-${item.level} ${isActive ? 'is-active' : ''}`}
                      onClick={() => onSelectHeading?.(item.index)}
                      title={`Lompat ke ${item.text}`}
                    >
                      <span className="outline-level-indicator" />
                      <span className="outline-item-text">{item.text}</span>
                    </button>
                  );
                })}
              </nav>
            </>
          )}
        </div>
      )}
    </aside>
  );
});
