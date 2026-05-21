/// mDNS device discovery
/// Broadcasts NexExplorer service on the local network
/// Discovers other NexExplorer instances
///
/// Service type: _nexexplorer._tcp.local.
///
/// Usage:
///   - Start broadcaster when server starts
///   - Discover other devices on the network
///   - Stop broadcaster when server stops

use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Arc;
use tokio::sync::Mutex;

use super::config::*;
use super::errors::*;

const SERVICE_TYPE: &str = "_nexexplorer._tcp.local.";

/// Discovery manager
pub struct DiscoveryManager {
    mdns: Arc<Option<ServiceDaemon>>,
    discovered: Arc<Mutex<Vec<DiscoveredDevice>>>,
    hostname: String,
}

impl DiscoveryManager {
    pub fn new(hostname: &str) -> Self {
        let mdns = match ServiceDaemon::new() {
            Ok(d) => Some(d),
            Err(e) => {
                log::warn!("mDNS init failed: {}", e);
                None
            }
        };

        Self {
            mdns: Arc::new(mdns),
            discovered: Arc::new(Mutex::new(Vec::new())),
            hostname: hostname.to_string(),
        }
    }

    /// Broadcast our presence on the network
    pub async fn start_broadcast(&self, port: u16, server_type: &ServerType) -> ServerResult<()> {
        let mdns = match self.mdns.as_ref() {
            Some(d) => d,
            None => return Err(ServerError::Network("mDNS not available".into())),
        };

        let local_ip = get_local_ip_addr()?;
        let service_name = format!("{}._nexexplorer._tcp.local.", self.hostname);

        let mut properties = HashMap::new();
        properties.insert("server_type".to_string(), format!("{:?}", server_type).to_lowercase());
        properties.insert("version".to_string(), env!("CARGO_PKG_VERSION").to_string());

        let service_info = mdns_sd::ServiceInfo::new(
            SERVICE_TYPE,
            &self.hostname,
            &service_name,
            &local_ip.to_string(),
            port,
            properties,
        )
        .map_err(|e| ServerError::Network(format!("mDNS service creation: {}", e)))?;

        mdns.register(service_info)
            .map_err(|e| ServerError::Network(format!("mDNS register: {}", e)))?;

        Ok(())
    }

    /// Stop broadcasting
    pub async fn stop_broadcast(&self) -> ServerResult<()> {
        if let Some(mdns) = self.mdns.as_ref() {
            let service_name = format!("{}.{}", self.hostname, SERVICE_TYPE);
            let _ = mdns.unregister(&service_name);
        }
        Ok(())
    }

    /// Scan for other NexExplorer devices on the network
    pub async fn discover_devices(&self, timeout_secs: u64) -> ServerResult<Vec<DiscoveredDevice>> {
        let devices = discover_devices_sync(timeout_secs * 1000);
        let mut cached = self.discovered.lock().await;
        *cached = devices.clone();
        Ok(devices)
    }

    /// Get discovered devices (cached)
    pub async fn get_discovered(&self) -> Vec<DiscoveredDevice> {
        self.discovered.lock().await.clone()
    }
}

fn get_local_ip_addr() -> ServerResult<IpAddr> {
    local_ip_address::local_ip()
        .map_err(|e| ServerError::Network(format!("Cannot get local IP: {}", e)))
}

// Simplified synchronous discovery for quick use
pub fn discover_devices_sync(timeout_ms: u64) -> Vec<DiscoveredDevice> {
    let mut devices = Vec::new();

    let mdns = match ServiceDaemon::new() {
        Ok(m) => m,
        Err(_) => return devices,
    };

    let receiver = match mdns.browse(SERVICE_TYPE) {
        Ok(r) => r,
        Err(_) => return devices,
    };

    let start = std::time::Instant::now();

    while start.elapsed().as_millis() < timeout_ms as u128 {
        match receiver.recv_timeout(std::time::Duration::from_millis(100)) {
            Ok(event) => match event {
                ServiceEvent::ServiceResolved(info) => {
                    let hostname = info
                        .get_fullname()
                        .replace("._nexexplorer._tcp.local.", "");
                    let port = info.get_port();

                    for addr in info.get_addresses() {
                        devices.push(DiscoveredDevice {
                            hostname: hostname.clone(),
                            ip: addr.to_string(),
                            port,
                            server_type: ServerType::Http, // Default
                            discovered_at: chrono::Utc::now()
                                .format("%Y-%m-%d %H:%M:%S")
                                .to_string(),
                        });
                    }
                }
                _ => {}
            },
            Err(_) => break,
        }
    }

    let _ = mdns.stop_browse(SERVICE_TYPE);
    devices
}
