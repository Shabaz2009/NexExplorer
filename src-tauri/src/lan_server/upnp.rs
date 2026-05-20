/// UPnP port forwarding + HTTP server
/// Enables external (internet) access to the file server
///
/// Flow:
/// 1. Discover UPnP gateway (router)
/// 2. Add port mapping: external_port → internal_ip:internal_port
/// 3. Start HTTP server on internal port
/// 4. Return external URL for remote access
/// 5. On shutdown: remove port mapping

use igd::{search_gateway, Gateway, PortMappingProtocol};
use std::net::SocketAddrV4;
use tokio::sync::oneshot;

use super::config::*;
use super::errors::*;
use super::http_server;

/// UPnP server state
pub struct UpnpState {
    pub gateway: Option<Gateway>,
    pub external_ip: Option<String>,
    pub external_port: Option<u16>,
    pub internal_port: u16,
    pub shutdown_tx: Option<oneshot::Sender<()>>,
}

impl UpnpState {
    pub fn new() -> Self {
        Self {
            gateway: None,
            external_ip: None,
            external_port: None,
            internal_port: 0,
            shutdown_tx: None,
        }
    }
}

/// Discover UPnP gateway on the network
pub async fn discover_gateway() -> ServerResult<Gateway> {
    tokio::task::spawn_blocking(|| {
        search_gateway(Default::default())
            .map_err(|e| ServerError::Upnp(format!("No UPnP gateway found: {}", e)))
    })
    .await
    .map_err(|e| ServerError::Upnp(format!("Discovery task failed: {}", e)))?
}

/// Get external IP address from UPnP gateway
pub async fn get_external_ip(gateway: &Gateway) -> ServerResult<String> {
    let gw = gateway.clone();
    tokio::task::spawn_blocking(move || {
        gw.get_external_ip()
            .map(|ip| ip.to_string())
            .map_err(|e| ServerError::Upnp(format!("Cannot get external IP: {}", e)))
    })
    .await
    .map_err(|e| ServerError::Upnp(format!("Task failed: {}", e)))?
}

/// Add UPnP port mapping
pub async fn add_port_mapping(
    gateway: &Gateway,
    internal_port: u16,
    external_port: u16,
) -> ServerResult<()> {
    let gw = gateway.clone();
    tokio::task::spawn_blocking(move || {
        let local_ip = get_local_ip_addr()?;
        let addr = SocketAddrV4::new(local_ip, internal_port);

        gw.add_port(
            PortMappingProtocol::TCP,
            external_port,
            addr,
            0, // lease duration (0 = permanent)
            "NexExplorer File Server",
        )
        .map_err(|e| ServerError::Upnp(format!("Port mapping failed: {}", e)))
    })
    .await
    .map_err(|e| ServerError::Upnp(format!("Task failed: {}", e)))?
}

/// Remove UPnP port mapping
pub async fn remove_port_mapping(gateway: &Gateway, external_port: u16) -> ServerResult<()> {
    let gw = gateway.clone();
    tokio::task::spawn_blocking(move || {
        gw.remove_port(PortMappingProtocol::TCP, external_port)
            .map_err(|e| ServerError::Upnp(format!("Remove mapping failed: {}", e)))
    })
    .await
    .map_err(|e| ServerError::Upnp(format!("Task failed: {}", e)))?
}

/// Get local IPv4 address
fn get_local_ip_addr() -> ServerResult<std::net::Ipv4Addr> {
    local_ip_address::local_ip()
        .map_err(|e| ServerError::Network(format!("Cannot get local IP: {}", e)))
        .and_then(|ip| match ip {
            std::net::IpAddr::V4(v4) => Ok(v4),
            std::net::IpAddr::V6(_) => Err(ServerError::Network("IPv6 not supported for UPnP".into())),
        })
}

/// Start UPnP server: discover gateway + add port mapping + start HTTP server
pub async fn start_upnp_server(
    config: &ServerConfig,
    hostname: &str,
) -> ServerResult<(UpnpState, u16)> {
    let internal_port = config.port;

    // Step 1: Discover UPnP gateway
    let gateway = discover_gateway().await?;

    // Step 2: Get external IP
    let external_ip = match get_external_ip(&gateway).await {
        Ok(ip) => Some(ip),
        Err(_) => None,
    };

    // Step 3: Add port mapping
    // Try the same port first, fall back to a random one
    let external_port = internal_port;
    let mapped_port = match add_port_mapping(&gateway, internal_port, external_port).await {
        Ok(_) => external_port,
        Err(_) => {
            // Try a different port
            let alt_port = 15000 + (rand::random::<u16>() % 50000);
            match add_port_mapping(&gateway, internal_port, alt_port).await {
                Ok(_) => alt_port,
                Err(e) => {
                    return Err(ServerError::Upnp(format!(
                        "Cannot map port (tried {} and {}): {}",
                        external_port, alt_port, e
                    )));
                }
            }
        }
    };

    // Step 4: Start HTTP server on internal port
    let (shutdown_tx, port) = http_server::start_http_server(config, hostname).await?;

    let state = UpnpState {
        gateway: Some(gateway),
        external_ip,
        external_port: Some(mapped_port),
        internal_port: port,
        shutdown_tx: Some(shutdown_tx),
    };

    Ok((state, port))
}

/// Stop UPnP server: remove port mapping + stop HTTP server
pub async fn stop_upnp_server(state: &mut UpnpState) -> ServerResult<()> {
    // Remove port mapping
    if let (Some(gateway), Some(external_port)) = (&state.gateway, state.external_port) {
        let _ = remove_port_mapping(gateway, external_port).await;
    }

    // Stop HTTP server
    if let Some(tx) = state.shutdown_tx.take() {
        let _ = tx.send(());
    }

    state.gateway = None;
    state.external_ip = None;
    state.external_port = None;

    Ok(())
}
