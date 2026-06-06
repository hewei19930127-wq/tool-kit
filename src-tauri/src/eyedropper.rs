#[cfg(target_os = "macos")]
#[tauri::command]
pub async fn pick_color(app: tauri::AppHandle) -> Result<String, String> {
    use block2::RcBlock;
    use objc2::rc::Retained;
    use objc2_app_kit::{NSColor, NSColorSampler, NSColorSpace};
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel::<Option<String>>();

    app.run_on_main_thread(move || {
        let sampler = NSColorSampler::new();
        let handler = RcBlock::new(move |color: *mut NSColor| {
            let hex = if color.is_null() {
                None
            } else if let Some(color) = unsafe { Retained::retain(color) } {
                let srgb = color.colorUsingColorSpace(&NSColorSpace::sRGBColorSpace());
                srgb.map(|converted| {
                    let r = (converted.redComponent().clamp(0.0, 1.0) * 255.0).round() as u8;
                    let g = (converted.greenComponent().clamp(0.0, 1.0) * 255.0).round() as u8;
                    let b = (converted.blueComponent().clamp(0.0, 1.0) * 255.0).round() as u8;
                    format!("#{:02x}{:02x}{:02x}", r, g, b)
                })
            } else {
                None
            };
            let _ = tx.send(hex);
        });

        unsafe { sampler.showSamplerWithSelectionHandler(&handler) };
    })
    .map_err(|error| error.to_string())?;

    match rx.recv() {
        Ok(Some(hex)) => Ok(hex),
        Ok(None) => Err("No color picked".into()),
        Err(_) => Err("Color sampler closed without a result".into()),
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub async fn pick_color(_app: tauri::AppHandle) -> Result<String, String> {
    Err("Eyedropper is only available on macOS".into())
}
