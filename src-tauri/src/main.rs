// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod lan_server;

use lan_server::commands::{self as lan_commands, AppState};

fn main() {
    // Initialize server state
    let server_state: AppState = lan_commands::create_state();

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(server_state)
        .invoke_handler(tauri::generate_handler![
            // File operations (inspired by Explorer++ ShellBrowser)
            commands::file_ops::read_dir,
            commands::file_ops::copy_file,
            commands::file_ops::move_file,
            commands::file_ops::delete_file,
            commands::file_ops::rename_file,
            commands::file_ops::bulk_rename,
            commands::file_ops::create_folder,
            commands::file_ops::get_folder_size,
            commands::file_ops::get_file_properties,
            commands::file_ops::get_drives,
            commands::file_ops::hide_lock_file,
            commands::file_ops::unhide_unlock_file,
            commands::file_ops::usb_fast_copy,
            commands::file_ops::bulk_copy,
            commands::file_ops::bulk_move,
            commands::file_ops::trash_items,
            // Archive operations (powered by 7-Zip CLI)
            commands::file_ops::list_archive,
            commands::file_ops::extract_archive,
            commands::file_ops::create_archive,
            // LocalShare device discovery (ported from LocalSend protocol 2.1)
            commands::localsend::start_discovery,
            commands::localsend::send_multicast_announcement,
            commands::localsend::start_file_receiver,
            commands::localsend::send_file_to_device,
            commands::localsend::send_text_to_device,
            // Shell extension (inspired by PeaZip.ShellEx)
            commands::shell_ex::register_shell_extension,
            commands::shell_ex::unregister_shell_extension,
            // Advanced tools
            commands::tools::calculate_file_hashes,
            commands::tools::analyze_disk_space,
            commands::tools::find_duplicates,
            commands::tools::recursive_search,
            // ── LAN Server Commands ──
            lan_commands::start_server,
            lan_commands::stop_server,
            lan_commands::get_server_status,
            lan_commands::is_server_running,
            lan_commands::discover_devices,
            lan_commands::get_server_types,
            lan_commands::get_default_port,
            lan_commands::get_local_ip,
            lan_commands::get_hostname,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
