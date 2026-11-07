pub mod commands;
pub mod models;
pub mod storage;

use storage::NoteStore;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("Gagal menentukan folder AppData: {e}"))?;
            let store = NoteStore::new(app_data_dir);
            store.ensure_initialized()?;
            app.manage(std::sync::Mutex::new(store));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_notes,
            commands::get_note,
            commands::create_note,
            commands::save_note,
            commands::toggle_pin_note,
            commands::delete_note,
            commands::set_always_on_top,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
