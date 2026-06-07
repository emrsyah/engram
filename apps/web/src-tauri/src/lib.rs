use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let window = app.get_webview_window("main").unwrap();
      // Set initial zoom level
      window.set_zoom(0.9).ok();
      // Inject zoom keyboard shortcuts into the webview
      window.eval(r#"
        (function() {
          let zoom = 0.9;
          document.addEventListener('keydown', function(e) {
            if (!e.ctrlKey && !e.metaKey) return;
            if (e.key === '=' || e.key === '+') {
              e.preventDefault();
              zoom = Math.min(zoom + 0.1, 2.0);
              document.documentElement.style.zoom = zoom;
            } else if (e.key === '-') {
              e.preventDefault();
              zoom = Math.max(zoom - 0.1, 0.4);
              document.documentElement.style.zoom = zoom;
            } else if (e.key === '0') {
              e.preventDefault();
              zoom = 0.9;
              document.documentElement.style.zoom = zoom;
            }
          });
        })();
      "#).ok();

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
