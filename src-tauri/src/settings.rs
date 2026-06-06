use std::str::FromStr;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[tauri::command]
pub fn set_hotkey(app: tauri::AppHandle, accelerator: String) -> Result<(), String> {
    let shortcut = Shortcut::from_str(&accelerator).map_err(|error| error.to_string())?;
    let shortcuts = app.global_shortcut();

    shortcuts
        .unregister_all()
        .map_err(|error| error.to_string())?;
    shortcuts
        .register(shortcut)
        .map_err(|error| error.to_string())?;

    Ok(())
}
