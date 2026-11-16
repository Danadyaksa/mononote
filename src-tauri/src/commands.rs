use crate::models::{Note, NoteSummary};
use crate::storage::NoteStore;
use tauri::{State, WebviewWindow};

#[tauri::command]
pub fn list_notes(
    store: State<'_, std::sync::Mutex<NoteStore>>,
    query: Option<String>,
) -> Result<Vec<NoteSummary>, String> {
    store
        .lock()
        .map_err(|_| "Gagal mengakses penyimpanan catatan".to_string())?
        .list_notes(query.as_deref())
}

#[tauri::command]
pub fn get_note(
    store: State<'_, std::sync::Mutex<NoteStore>>,
    id: String,
) -> Result<Note, String> {
    store
        .lock()
        .map_err(|_| "Gagal mengakses penyimpanan catatan".to_string())?
        .get_note(&id)
}

#[tauri::command]
pub fn create_note(store: State<'_, std::sync::Mutex<NoteStore>>) -> Result<Note, String> {
    store
        .lock()
        .map_err(|_| "Gagal mengakses penyimpanan catatan".to_string())?
        .create_note()
}

#[tauri::command]
pub fn save_note(
    store: State<'_, std::sync::Mutex<NoteStore>>,
    id: String,
    content_json: String,
    plain_text: String,
) -> Result<NoteSummary, String> {
    store
        .lock()
        .map_err(|_| "Gagal mengakses penyimpanan catatan".to_string())?
        .save_note(&id, content_json, plain_text)
}

#[tauri::command]
pub fn toggle_pin_note(
    store: State<'_, std::sync::Mutex<NoteStore>>,
    id: String,
) -> Result<NoteSummary, String> {
    store
        .lock()
        .map_err(|_| "Gagal mengakses penyimpanan catatan".to_string())?
        .toggle_pin_note(&id)
}

#[tauri::command]
pub fn delete_note(
    store: State<'_, std::sync::Mutex<NoteStore>>,
    id: String,
) -> Result<(), String> {
    store
        .lock()
        .map_err(|_| "Gagal mengakses penyimpanan catatan".to_string())?
        .delete_note(&id)
}

#[tauri::command]
pub fn set_always_on_top(window: WebviewWindow, always_on_top: bool) -> Result<bool, String> {
    window
        .set_always_on_top(always_on_top)
        .map_err(|e| format!("Gagal mengatur mode Pin Layar: {e}"))?;
    Ok(always_on_top)
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFileData {
    pub path: String,
    pub filename: String,
    pub content: String,
}

#[tauri::command]
pub fn open_markdown_file_dialog() -> Result<Option<MarkdownFileData>, String> {
    let file = rfd::FileDialog::new()
        .add_filter("Markdown / Text", &["md", "markdown", "txt"])
        .pick_file();

    if let Some(path_buf) = file {
        let path = path_buf.to_string_lossy().to_string();
        let filename = path_buf
            .file_name()
            .map(|f| f.to_string_lossy().to_string())
            .unwrap_or_else(|| "Catatan.md".to_string());
        let content = std::fs::read_to_string(&path_buf)
            .map_err(|e| format!("Gagal membaca file: {}", e))?;

        Ok(Some(MarkdownFileData {
            path,
            filename,
            content,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<MarkdownFileData, String> {
    let path_buf = std::path::PathBuf::from(&path);
    if !path_buf.exists() {
        return Err("File tidak ditemukan".to_string());
    }
    let filename = path_buf
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "Catatan.md".to_string());
    let content = std::fs::read_to_string(&path_buf)
        .map_err(|e| format!("Gagal membaca file: {}", e))?;

    Ok(MarkdownFileData {
        path,
        filename,
        content,
    })
}

#[tauri::command]
pub fn save_markdown_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content)
        .map_err(|e| format!("Gagal menyimpan file: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn save_as_markdown_dialog(
    default_filename: Option<String>,
    content: String,
) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().add_filter("Markdown", &["md"]);
    if let Some(name) = default_filename {
        let clean_name = if name.ends_with(".md") {
            name
        } else {
            format!("{}.md", name)
        };
        dialog = dialog.set_file_name(&clean_name);
    }

    if let Some(path_buf) = dialog.save_file() {
        let path = path_buf.to_string_lossy().to_string();
        std::fs::write(&path_buf, content)
            .map_err(|e| format!("Gagal menyimpan file: {}", e))?;
        Ok(Some(path))
    } else {
        Ok(None)
    }
}
