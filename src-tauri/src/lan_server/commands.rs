/// Tauri command definitions
/// These are the functions callable from the React frontend

use std::sync::Arc;
use tokio::sync::Mutex;

use super::config::*;
use super::errors::*;
use super::manager::ServerManager;

/// Global state type for Tauri
pub type AppState = Arc<Mutex<ServerManager>>;

/// Create the app state
pub fn create_state() -> AppState {
    Arc::new(Mutex::new(ServerManager::new()))
}

// ─── Tauri Commands ─────────────────────────────────────

#[tauri::command]
pub async fn start_server(
    state: tauri::State<'_, AppState>,
    config: ServerConfig,
) -> Result<ServerStatus, String> {
    let manager = state.lock().await;
    manager
        .start(config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_server(
    state: tauri::State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.lock().await;
    manager
        .stop()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_server_status(
    state: tauri::State<'_, AppState>,
) -> Result<ServerStatus, String> {
    let manager = state.lock().await;
    Ok(manager.status().await)
}

#[tauri::command]
pub async fn is_server_running(
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let manager = state.lock().await;
    Ok(manager.is_running().await)
}

#[tauri::command]
pub async fn discover_devices(
    state: tauri::State<'_, AppState>,
    timeout_secs: Option<u64>,
) -> Result<Vec<DiscoveredDevice>, String> {
    let manager = state.lock().await;
    manager
        .discover(timeout_secs.unwrap_or(5))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_server_types() -> Vec<ServerType> {
    ServerType::all()
}

#[tauri::command]
pub fn get_default_port(server_type: ServerType) -> u16 {
    server_type.default_port()
}

#[tauri::command]
pub fn get_local_ip() -> String {
    local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "127.0.0.1".into())
}

#[tauri::command]
pub fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "nexexplorer".into())
}
