use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Server type the user can choose from
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ServerType {
    /// Standard HTTP server — works in any browser
    Http,
    /// HTTPS with auto-generated self-signed certificate
    Https,
    /// Raw TCP binary protocol — fastest, requires NexExplorer client
    Lan,
    /// HTTP + UPnP port forwarding — accessible from outside the LAN
    Upnp,
}

impl ServerType {
    pub fn all() -> Vec<Self> {
        vec![Self::Http, Self::Https, Self::Lan, Self::Upnp]
    }

    pub fn label(&self) -> &str {
        match self {
            Self::Http => "HTTP",
            Self::Https => "HTTPS (Secure)",
            Self::Lan => "LAN (TCP — Fastest)",
            Self::Upnp => "UPnP (Remote Access)",
        }
    }

    pub fn description(&self) -> &str {
        match self {
            Self::Http => "Standard web server. Works in any browser. Best for most uses.",
            Self::Https => "Encrypted web server. Self-signed cert. Secure local transfers.",
            Self::Lan => "Raw TCP protocol. Maximum speed. Both devices need NexExplorer.",
            Self::Upnp => "HTTP + automatic port forwarding. Accessible from the internet.",
        }
    }

    pub fn default_port(&self) -> u16 {
        match self {
            Self::Http => 8080,
            Self::Https => 8443,
            Self::Lan => 9090,
            Self::Upnp => 8080,
        }
    }

    pub fn protocol_str(&self) -> &str {
        match self {
            Self::Http | Self::Upnp => "http",
            Self::Https => "https",
            Self::Lan => "nex-lan",
        }
    }
}

/// Configuration for starting a server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    /// Which protocol to use
    pub server_type: ServerType,
    /// Directory to share
    pub share_path: PathBuf,
    /// Port to listen on
    pub port: u16,
    /// Enable file upload
    pub allow_upload: bool,
    /// Enable file delete
    pub allow_delete: bool,
    /// Enable mDNS discovery
    pub enable_discovery: bool,
    /// Custom hostname (auto-detected if empty)
    pub hostname: Option<String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            server_type: ServerType::Http,
            share_path: dirs::home_dir().unwrap_or_default(),
            port: 8080,
            allow_upload: true,
            allow_delete: false,
            enable_discovery: true,
            hostname: None,
        }
    }
}

/// Live status of a running server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub running: bool,
    pub server_type: ServerType,
    pub local_ip: String,
    pub port: u16,
    pub hostname: String,
    pub local_url: String,
    pub hostname_url: String,
    pub external_url: Option<String>,  // Only for UPnP
    pub upnp_mapped: bool,
    pub share_path: PathBuf,
    pub files_count: u64,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub disk_total: u64,
    pub disk_free: u64,
    pub connected_devices: Vec<DiscoveredDevice>,
}

/// A device discovered on the network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredDevice {
    pub hostname: String,
    pub ip: String,
    pub port: u16,
    pub server_type: ServerType,
    pub discovered_at: String,
}

/// Response for file listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: String,
    pub mime_type: Option<String>,
}

/// Response for server info endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfoResponse {
    pub hostname: String,
    pub server_type: ServerType,
    pub share_path: String,
    pub allow_upload: bool,
    pub allow_delete: bool,
    pub version: String,
}
