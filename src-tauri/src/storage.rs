use crate::models::{Note, NoteSummary};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const DEFAULT_TITLE: &str = "Catatan Baru";
const DEFAULT_PREVIEW: &str = "Belum ada teks tambahan";
const EMPTY_DOC_JSON: &str =
    r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1}},{"type":"paragraph"}]}"#;
const WELCOME_DOC_JSON: &str = r#"{"type":"doc","content":[{"type":"heading","attrs":{"level":1},"content":[{"type":"text","text":"Selamat Datang di Mononote"}]},{"type":"paragraph","content":[{"type":"text","text":"Tempat coret-coret cepat yang bersih dan ringan di mata."}]},{"type":"taskList","content":[{"type":"taskItem","attrs":{"checked":true},"content":[{"type":"paragraph","content":[{"type":"text","text":"Baris pertama otomatis jadi judul catatan"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Klik ikon Pin di kanan atas buat tempel jendela di layar"}]}]},{"type":"taskItem","attrs":{"checked":false},"content":[{"type":"paragraph","content":[{"type":"text","text":"Tekan Ctrl+N kapan saja untuk catatan baru"}]}]}]}]}"#;
const WELCOME_PLAIN_TEXT: &str = "Selamat Datang di Mononote\nTempat coret-coret cepat yang bersih dan ringan di mata.\nBaris pertama otomatis jadi judul catatan\nKlik ikon Pin di kanan atas buat tempel jendela di layar\nTekan Ctrl+N kapan saja untuk catatan baru";

pub struct NoteStore {
    base_dir: PathBuf,
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn validate_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.contains('/')
        || id.contains('\\')
        || id.contains("..")
        || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err("ID catatan tidak valid".into());
    }
    Ok(())
}

impl NoteStore {
    pub fn new(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    fn notes_dir(&self) -> PathBuf {
        self.base_dir.join("notes")
    }

    fn init_marker_path(&self) -> PathBuf {
        self.base_dir.join(".initialized")
    }

    fn note_path(&self, id: &str) -> Result<PathBuf, String> {
        validate_id(id)?;
        Ok(self.notes_dir().join(format!("{id}.json")))
    }

    fn ensure_notes_dir(&self) -> Result<PathBuf, String> {
        let dir = self.notes_dir();
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Gagal membuat folder penyimpanan catatan: {e}"))?;
        Ok(dir)
    }

    fn write_note_atomic(&self, note: &Note) -> Result<(), String> {
        self.ensure_notes_dir()?;
        let final_path = self.note_path(&note.id)?;
        let tmp_path = self.notes_dir().join(format!("{}.json.tmp", note.id));

        let payload = serde_json::to_vec_pretty(note)
            .map_err(|e| format!("Gagal menyusun data catatan: {e}"))?;

        {
            let mut file = File::create(&tmp_path)
                .map_err(|e| format!("Gagal menulis file sementara catatan: {e}"))?;
            file.write_all(&payload)
                .map_err(|e| format!("Gagal menyimpan isi catatan: {e}"))?;
            file.sync_all()
                .map_err(|e| format!("Gagal menyinkronkan catatan ke disk: {e}"))?;
        }

        fs::rename(&tmp_path, &final_path)
            .map_err(|e| format!("Gagal memfinalisasi penyimpanan catatan: {e}"))?;
        Ok(())
    }

    pub fn ensure_initialized(&self) -> Result<(), String> {
        let notes_dir = self.ensure_notes_dir()?;
        let marker = self.init_marker_path();
        if marker.exists() {
            return Ok(());
        }

        let has_existing_notes = fs::read_dir(&notes_dir)
            .map_err(|e| format!("Gagal membaca folder catatan: {e}"))?
            .flatten()
            .any(|entry| {
                entry
                    .path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("json"))
                    .unwrap_or(false)
            });

        if !has_existing_notes {
            let now = now_millis();
            let (title, preview) = Self::extract_title_and_preview(WELCOME_PLAIN_TEXT);
            let welcome = Note {
                id: Uuid::new_v4().to_string(),
                title,
                preview,
                content_json: WELCOME_DOC_JSON.to_string(),
                plain_text: WELCOME_PLAIN_TEXT.to_string(),
                pinned: false,
                created_at: now,
                updated_at: now,
            };
            self.write_note_atomic(&welcome)?;
        }

        fs::write(&marker, b"1")
            .map_err(|e| format!("Gagal menulis penanda inisialisasi: {e}"))?;
        Ok(())
    }

    pub fn extract_title_and_preview(plain_text: &str) -> (String, String) {
        let mut non_empty = plain_text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty());

        let title = match non_empty.next() {
            Some(first) => {
                let chars: Vec<char> = first.chars().collect();
                if chars.len() > 120 {
                    format!("{}…", chars[..120].iter().collect::<String>())
                } else {
                    first.to_string()
                }
            }
            None => DEFAULT_TITLE.to_string(),
        };

        let preview = match non_empty.next() {
            Some(second) => {
                let chars: Vec<char> = second.chars().collect();
                if chars.len() > 90 {
                    format!("{}…", chars[..90].iter().collect::<String>())
                } else {
                    second.to_string()
                }
            }
            None => DEFAULT_PREVIEW.to_string(),
        };

        (title, preview)
    }

    pub fn list_notes(&self, query: Option<&str>) -> Result<Vec<NoteSummary>, String> {
        let dir = self.ensure_notes_dir()?;
        let normalized_query = query
            .map(str::trim)
            .filter(|q| !q.is_empty())
            .map(str::to_lowercase);

        let entries =
            fs::read_dir(&dir).map_err(|e| format!("Gagal membaca daftar catatan: {e}"))?;

        let mut summaries = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            let is_json = path
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| ext.eq_ignore_ascii_case("json"))
                .unwrap_or(false);
            if !is_json {
                continue;
            }

            let raw = match fs::read_to_string(&path) {
                Ok(content) => content,
                Err(err) => {
                    eprintln!("Melewati file catatan yang tidak terbaca {:?}: {err}", path);
                    continue;
                }
            };

            let note: Note = match serde_json::from_str(&raw) {
                Ok(parsed) => parsed,
                Err(err) => {
                    eprintln!("Melewati file catatan rusak {:?}: {err}", path);
                    continue;
                }
            };

            if let Some(ref q) = normalized_query {
                let matches_title = note.title.to_lowercase().contains(q);
                let matches_body = note.plain_text.to_lowercase().contains(q);
                if !matches_title && !matches_body {
                    continue;
                }
            }

            summaries.push(NoteSummary::from(&note));
        }

        summaries.sort_by(|a, b| {
            b.pinned
                .cmp(&a.pinned)
                .then_with(|| b.updated_at.cmp(&a.updated_at))
        });

        Ok(summaries)
    }

    pub fn get_note(&self, id: &str) -> Result<Note, String> {
        let path = self.note_path(id)?;
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("Catatan tidak ditemukan ({id}): {e}"))?;
        serde_json::from_str(&raw).map_err(|e| format!("Data catatan rusak ({id}): {e}"))
    }

    pub fn create_note(&self) -> Result<Note, String> {
        let now = now_millis();
        let note = Note {
            id: Uuid::new_v4().to_string(),
            title: DEFAULT_TITLE.to_string(),
            preview: DEFAULT_PREVIEW.to_string(),
            content_json: EMPTY_DOC_JSON.to_string(),
            plain_text: String::new(),
            pinned: false,
            created_at: now,
            updated_at: now,
        };
        self.write_note_atomic(&note)?;
        Ok(note)
    }

    pub fn save_note(
        &self,
        id: &str,
        content_json: String,
        plain_text: String,
    ) -> Result<NoteSummary, String> {
        let mut note = self.get_note(id)?;
        let (title, preview) = Self::extract_title_and_preview(&plain_text);
        note.title = title;
        note.preview = preview;
        note.content_json = content_json;
        note.plain_text = plain_text;
        note.updated_at = now_millis();
        self.write_note_atomic(&note)?;
        Ok(NoteSummary::from(&note))
    }

    pub fn toggle_pin_note(&self, id: &str) -> Result<NoteSummary, String> {
        let mut note = self.get_note(id)?;
        note.pinned = !note.pinned;
        self.write_note_atomic(&note)?;
        Ok(NoteSummary::from(&note))
    }

    pub fn delete_note(&self, id: &str) -> Result<(), String> {
        let path = self.note_path(id)?;
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("Gagal menghapus catatan: {e}"))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::thread;
    use std::time::Duration;
    use tempfile::tempdir;

    #[test]
    fn extracts_title_and_preview_accurately() {
        assert_eq!(
            NoteStore::extract_title_and_preview("   \n  "),
            ("Catatan Baru".to_string(), "Belum ada teks tambahan".to_string())
        );

        assert_eq!(
            NoteStore::extract_title_and_preview("Daftar Belanja\n\nSusu oat\nKopi arabika"),
            ("Daftar Belanja".to_string(), "Susu oat".to_string())
        );

        let long_second_line = format!("Judul\n{}", "a".repeat(120));
        let (title, preview) = NoteStore::extract_title_and_preview(&long_second_line);
        assert_eq!(title, "Judul");
        assert_eq!(preview.chars().count(), 91); // 90 chars + ellipsis
        assert!(preview.ends_with('…'));
    }

    #[test]
    fn initializes_welcome_note_only_once() {
        let dir = tempdir().unwrap();
        let store = NoteStore::new(dir.path().to_path_buf());

        store.ensure_initialized().unwrap();
        let initial = store.list_notes(None).unwrap();
        assert_eq!(initial.len(), 1);

        store.delete_note(&initial[0].id).unwrap();
        assert!(store.list_notes(None).unwrap().is_empty());

        // Re-running ensure_initialized after user deletes all notes must NOT recreate welcome note
        store.ensure_initialized().unwrap();
        assert!(store.list_notes(None).unwrap().is_empty());
    }

    #[test]
    fn crud_sorting_search_and_corrupt_file_resilience() {
        let dir = tempdir().unwrap();
        let store = NoteStore::new(dir.path().to_path_buf());

        let first = store.create_note().unwrap();
        store
            .save_note(
                &first.id,
                r#"{"type":"doc"}"#.into(),
                "Ide Projek Rust\nBikin aplikasi catatan minimalis".into(),
            )
            .unwrap();

        thread::sleep(Duration::from_millis(5));

        let second = store.create_note().unwrap();
        store
            .save_note(
                &second.id,
                r#"{"type":"doc"}"#.into(),
                "Resep Kopi\n18 gram biji kopi".into(),
            )
            .unwrap();

        // Most recently updated first when neither is pinned
        let list = store.list_notes(None).unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].id, second.id);
        assert_eq!(list[1].id, first.id);

        // Pinning first note moves it to top without changing its updated_at
        let before_pin = store.get_note(&first.id).unwrap().updated_at;
        let pinned_summary = store.toggle_pin_note(&first.id).unwrap();
        assert!(pinned_summary.pinned);
        assert_eq!(pinned_summary.updated_at, before_pin);

        let list_after_pin = store.list_notes(None).unwrap();
        assert_eq!(list_after_pin[0].id, first.id);
        assert_eq!(list_after_pin[1].id, second.id);

        // Case-insensitive search matches body plain_text as well as title
        let search_body = store.list_notes(Some("MINIMALIS")).unwrap();
        assert_eq!(search_body.len(), 1);
        assert_eq!(search_body[0].id, first.id);

        // Corrupt JSON file in notes/ is skipped cleanly
        fs::write(dir.path().join("notes").join("broken.json"), "{not-valid-json").unwrap();
        let list_with_corrupt = store.list_notes(None).unwrap();
        assert_eq!(list_with_corrupt.len(), 2);
    }
}
