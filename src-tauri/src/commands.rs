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
