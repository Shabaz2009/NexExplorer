// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // File operations (inspired by Explorer++ ShellBrowser)
            commands::file_ops::read_dir,
            commands::file_ops::copy_file,
            commands::file_ops::move_file,
            commands::file_ops::delete_file,
            commands::file_ops::rename_file,
            commands::file_ops::create_folder,
            commands::file_ops::get_file_properties,
            commands::file_ops::get_drives,
            // Archive operations (powered by 7-Zip CLI)
            commands::file_ops::list_archive,
            commands::file_ops::extract_archive,
            commands::file_ops::create_archive,
            // LocalShare device discovery (ported from LocalSend protocol 2.1)
            commands::localsend::start_discovery,
            commands::localsend::send_multicast_announcement,
            commands::localsend::start_file_receiver,
            commands::localsend::send_file_to_device,
            // Shell extension (inspired by PeaZip.ShellEx)
            commands::shell_ex::register_shell_extension,
            commands::shell_ex::unregister_shell_extension,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
