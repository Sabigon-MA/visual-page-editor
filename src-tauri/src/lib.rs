mod tune;

use tauri::{Emitter, Manager, RunEvent};

// 起動時に渡されたファイル（.vpe をダブルクリックして起動したとき）
fn file_arg(args: &[String]) -> Option<String> {
  args.iter().skip(1).find(|a| !a.starts_with('-')).cloned()
}

#[tauri::command]
fn startup_file() -> Option<String> {
  file_arg(&std::env::args().collect::<Vec<_>>())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 2つ目の起動は、すでに開いているウィンドウでファイルを開く
    .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
      if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.set_focus();
        if let Some(path) = file_arg(&args) {
          let _ = w.emit("open-file", path);
        }
      }
    }))
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .manage(tune::Tune::default())
    .invoke_handler(tauri::generate_handler![
      startup_file,
      tune::tune_start,
      tune::tune_status,
      tune::tune_stop,
      tune::tune_read,
      tune::tune_write
    ])
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|app, event| {
      // 終了するときは、見た目調整で起動した開発サーバーも止める
      if let RunEvent::Exit = event {
        app.state::<tune::Tune>().stop();
      }
    });
}
