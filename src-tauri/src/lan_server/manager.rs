/// ServerManager — unified controller for all server types
/// This is the main entry point for the NexExplorer server functionality
///
/// Provides:
/// - Start/stop any server type (HTTP, HTTPS, LAN, UPnP)
/// - Status monitoring
/// - Device discovery
/// - Graceful shutdown
/// - Auto-fallback

use std::sync::Arc;
use tokio::sync::{Mutex, oneshot};
use sysinfo::Disks;

use super::config::*;
use super::errors::*;
use super::discovery::DiscoveryManager;

/// Internal server state
struct InnerState {
    running: bool,
    server_type: Option<ServerType>,
    shutdown_tx: Option<oneshot::Sender<()>>,
    local_ip: String,
    port: u16,
    hostname: String,
    share_path: std::path::PathBuf,
    upnp_state: Option<super::upnp::UpnpState>,
    discovery: Option<DiscoveryManager>,
    
    // Real-time tracking
    bytes_sent_ref: Option<Arc<std::sync::atomic::AtomicU64>>,
    bytes_received_ref: Option<Arc<std::sync::atomic::AtomicU64>>,
}

/// Main server manager — thread-safe, Tauri-compatible
pub struct ServerManager {
    inner: Arc<Mutex<InnerState>>,
}

impl ServerManager {
    pub fn new() -> Self {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "nexexplorer".to_string());

        let local_ip = local_ip_address::local_ip()
            .map(|ip| ip.to_string())
            .unwrap_or_else(|_| "127.0.0.1".to_string());

        Self {
            inner: Arc::new(Mutex::new(InnerState {
                running: false,
                server_type: None,
                shutdown_tx: None,
                local_ip,
                port: 0,
                hostname,
                share_path: std::path::PathBuf::default(),
                upnp_state: None,
                discovery: None,
                bytes_sent_ref: None,
                bytes_received_ref: None,
            })),
        }
    }

    /// Start a server with the given configuration
    pub async fn start(&self, config: ServerConfig) -> ServerResult<ServerStatus> {
        let mut inner = self.inner.lock().await;

        if inner.running {
            return Err(ServerError::AlreadyRunning(inner.port));
        }

        // Validate share path
        if !config.share_path.exists() {
            return Err(ServerError::InvalidSharePath(
                config.share_path.display().to_string(),
            ));
        }

        // Detect local IP if needed
        if let Ok(ip) = local_ip_address::local_ip() {
            inner.local_ip = ip.to_string();
        }
        if let Some(ref h) = config.hostname {
            inner.hostname = h.clone();
        }

        let port = config.port;
        let hostname = inner.hostname.clone();
        let local_ip = inner.local_ip.clone();
        let share_path = config.share_path.clone();
        let server_type = config.server_type.clone();

        // Currently, we don't have the refs returned from start_xyz_server
        // For now, let's keep them as dummy arcs so we don't break the signature.
        // If we want real-time tracking, we need to adjust the start functions to return them.
        let bytes_sent = Arc::new(std::sync::atomic::AtomicU64::new(0));
        let bytes_received = Arc::new(std::sync::atomic::AtomicU64::new(0));

        // Start the appropriate server
        let result = match config.server_type {
            ServerType::Http => {
                super::http_server::start_http_server(&config, &hostname).await
            }
            ServerType::Https => {
                super::https_server::start_https_server(&config, &hostname).await
            }
            ServerType::Lan => {
                super::tcp_server::start_tcp_server(&config, &hostname).await
            }
            ServerType::Upnp => {
                let (upnp_state, port) =
                    super::upnp::start_upnp_server(&config, &hostname).await?;
                inner.upnp_state = Some(upnp_state);
                Ok((oneshot::channel().0, port)) // UPnP manages its own shutdown
            }
        };

        match result {
            Ok((shutdown_tx, bound_port)) => {
                // Start discovery if enabled
                if config.enable_discovery {
                    let discovery = DiscoveryManager::new(&hostname);
                    let _ = discovery.start_broadcast(bound_port, &config.server_type).await;
                    inner.discovery = Some(discovery);
                }

                inner.running = true;
                inner.server_type = Some(server_type.clone());
                inner.shutdown_tx = Some(shutdown_tx);
                inner.port = bound_port;
                inner.share_path = share_path.clone();
                inner.bytes_sent_ref = Some(bytes_sent);
                inner.bytes_received_ref = Some(bytes_received);

                let protocol = config.server_type.protocol_str();
                let local_url = format!("{}://{}:{}", protocol, local_ip, bound_port);
                let hostname_url = format!("{}://{}:{}", protocol, hostname, bound_port);

                let external_url = if config.server_type == ServerType::Upnp {
                    inner.upnp_state.as_ref().and_then(|s| {
                        s.external_ip.as_ref().map(|ip| {
                            format!(
                                "http://{}:{}",
                                ip,
                                s.external_port.unwrap_or(bound_port)
                            )
                        })
                    })
                } else {
                    None
                };
                
                // Get disk info
                let mut disk_total = 0;
                let mut disk_free = 0;
                let disks = Disks::new_with_refreshed_list();
                if let Some(canonical) = share_path.canonicalize().ok() {
                    let path_str = canonical.to_string_lossy().to_string();
                    for disk in &disks {
                        if path_str.starts_with(&disk.mount_point().to_string_lossy().to_string()) {
                            disk_total = disk.total_space();
                            disk_free = disk.available_space();
                            break;
                        }
                    }
                }

                let upnp_mapped = external_url.is_some();
                Ok(ServerStatus {
                    running: true,
                    server_type,
                    local_ip,
                    port: bound_port,
                    hostname,
                    local_url,
                    hostname_url,
                    external_url,
                    upnp_mapped,
                    share_path,
                    files_count: count_files(&config.share_path),
                    bytes_sent: 0,
                    bytes_received: 0,
                    disk_total,
                    disk_free,
                    connected_devices: Vec::new(),
                })
            }
            Err(e) => Err(e),
        }
    }

    /// Stop the running server
    pub async fn stop(&self) -> ServerResult<()> {
        let mut inner = self.inner.lock().await;

        if !inner.running {
            return Err(ServerError::NotRunning);
        }

        // Stop discovery
        if let Some(discovery) = &inner.discovery {
            let _ = discovery.stop_broadcast().await;
        }
        inner.discovery = None;

        // Stop UPnP
        if let Some(ref mut upnp_state) = inner.upnp_state {
            let _ = super::upnp::stop_upnp_server(upnp_state).await;
        }
        inner.upnp_state = None;

        // Send shutdown signal
        if let Some(tx) = inner.shutdown_tx.take() {
            let _ = tx.send(());
        }

        inner.running = false;
        inner.server_type = None;
        inner.port = 0;
        inner.bytes_sent_ref = None;
        inner.bytes_received_ref = None;

        Ok(())
    }

    /// Get current server status
    pub async fn status(&self) -> ServerStatus {
        let inner = self.inner.lock().await;

        let discovered = if let Some(ref discovery) = inner.discovery {
            discovery.get_discovered().await
        } else {
            Vec::new()
        };

        let protocol = inner
            .server_type
            .as_ref()
            .map(|st| st.protocol_str())
            .unwrap_or("http");
            
        let bytes_sent = inner.bytes_sent_ref.as_ref().map(|a| a.load(std::sync::atomic::Ordering::Relaxed)).unwrap_or(0);
        let bytes_received = inner.bytes_received_ref.as_ref().map(|a| a.load(std::sync::atomic::Ordering::Relaxed)).unwrap_or(0);
        
        let mut disk_total = 0;
        let mut disk_free = 0;
        let disks = Disks::new_with_refreshed_list();
        if let Some(canonical) = inner.share_path.canonicalize().ok() {
            let path_str = canonical.to_string_lossy().to_string();
            for disk in &disks {
                if path_str.starts_with(&disk.mount_point().to_string_lossy().to_string()) {
                    disk_total = disk.total_space();
                    disk_free = disk.available_space();
                    break;
                }
            }
        }

        ServerStatus {
            running: inner.running,
            server_type: inner.server_type.clone().unwrap_or(ServerType::Http),
            local_ip: inner.local_ip.clone(),
            port: inner.port,
            hostname: inner.hostname.clone(),
            local_url: format!("{}://{}:{}", protocol, inner.local_ip, inner.port),
            hostname_url: format!("{}://{}:{}", protocol, inner.hostname, inner.port),
            external_url: inner.upnp_state.as_ref().and_then(|s| {
                s.external_ip.as_ref().map(|ip| {
                    format!(
                        "http://{}:{}",
                        ip,
                        s.external_port.unwrap_or(inner.port)
                    )
                })
            }),
            upnp_mapped: inner.upnp_state.is_some()
                && inner.upnp_state.as_ref().unwrap().external_port.is_some(),
            share_path: inner.share_path.clone(),
            files_count: if inner.share_path.exists() {
                count_files(&inner.share_path)
            } else {
                0
            },
            bytes_sent,
            bytes_received,
            disk_total,
            disk_free,
            connected_devices: discovered,
        }
    }

    /// Check if server is running
    pub async fn is_running(&self) -> bool {
        self.inner.lock().await.running
    }

    /// Discover devices on the network
    pub async fn discover(&self, timeout_secs: u64) -> ServerResult<Vec<DiscoveredDevice>> {
        let inner = self.inner.lock().await;

        if let Some(ref discovery) = inner.discovery {
            discovery.discover_devices(timeout_secs).await
        } else {
            // Create temporary discovery
            let discovery = DiscoveryManager::new(&inner.hostname);
            discovery.discover_devices(timeout_secs).await
        }
    }
}

/// Recursively count files in a directory
fn count_files(path: &std::path::Path) -> u64 {
    let mut count = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_dir() {
                    count += count_files(&entry.path());
                } else {
                    count += 1;
                }
            }
        }
    }
    count
}
