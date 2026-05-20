/// Raw TCP/LAN server — fastest possible file transfer
/// Uses a simple binary protocol for minimal overhead
///
/// Protocol: NEX-LAN v1
/// Frame: [1 byte version][1 byte cmd][4 bytes payload_len BE][N bytes payload]
///
/// Commands (client → server):
///   0x01 LIST   — List directory (payload = path string)
///   0x02 GET    — Download file (payload = file path string)
///   0x03 PUT    — Upload file (payload = [4 bytes name_len][name][data])
///   0x04 INFO   — Server info (no payload)
///   0x05 PING   — Keep-alive (no payload)
///
/// Responses (server → client):
///   0x81 OK     — Success (payload = response data)
///   0x82 ERROR  — Error (payload = error message string)
///   0x83 CHUNK  — File chunk (payload = [4 bytes seq][chunk_data])
///   0x84 EOF    — End of file stream (no payload)

use bytes::{Buf, BytesMut};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

use super::config::*;
use super::errors::*;

const PROTO_VERSION: u8 = 1;
const CMD_LIST: u8 = 0x01;
const CMD_GET: u8 = 0x02;
const CMD_PUT: u8 = 0x03;
const CMD_INFO: u8 = 0x04;
const CMD_PING: u8 = 0x05;
const RESP_OK: u8 = 0x81;
const RESP_ERROR: u8 = 0x82;
const RESP_CHUNK: u8 = 0x83;
const RESP_EOF: u8 = 0x84;

const CHUNK_SIZE: usize = 1048576; // 1MB chunks for optimized low-power/high-speed transfer

#[derive(Clone)]
pub struct TcpState {
    pub share_path: PathBuf,
    pub hostname: String,
    pub allow_upload: bool,
    pub bytes_sent: Arc<std::sync::atomic::AtomicU64>,
    pub bytes_received: Arc<std::sync::atomic::AtomicU64>,
}

/// Start the raw TCP LAN server
pub async fn start_tcp_server(
    config: &ServerConfig,
    hostname: &str,
) -> ServerResult<(oneshot::Sender<()>, u16)> {
    let port = config.port;
    let share_path = config.share_path.clone();

    if !share_path.exists() {
        return Err(ServerError::InvalidSharePath(share_path.display().to_string()));
    }

    let listener = TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                ServerError::PortInUse(port)
            } else {
                ServerError::Io(e)
            }
        })?;

    let state = TcpState {
        share_path: share_path.clone(),
        hostname: hostname.to_string(),
        allow_upload: config.allow_upload,
        bytes_sent: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        bytes_received: Arc::new(std::sync::atomic::AtomicU64::new(0)),
    };

    let (tx, rx) = oneshot::channel::<()>();
    let shutdown = Arc::new(tokio::sync::Notify::new());
    let shutdown_clone = shutdown.clone();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                accept_result = listener.accept() => {
                    match accept_result {
                        Ok((socket, _addr)) => {
                            let state = state.clone();
                            tokio::spawn(handle_tcp_client(socket, state));
                        }
                        Err(e) => {
                            log::error!("TCP accept error: {}", e);
                        }
                    }
                }
                _ = shutdown_clone.notified() => {
                    break;
                }
            }
        }
    });

    // Wrap shutdown in a oneshot-compatible way
    let (tx2, rx2) = oneshot::channel::<()>();
    tokio::spawn(async move {
        let _ = rx.await;
        shutdown.notify_waiters();
        let _ = tx2.send(());
    });

    Ok((tx, port))
}

async fn handle_tcp_client(mut socket: TcpStream, state: TcpState) {
    let mut buf = BytesMut::with_capacity(4096);

    loop {
        // Read frame header: version (1) + cmd (1) + payload_len (4) = 6 bytes
        let mut header = [0u8; 6];
        match socket.read_exact(&mut header).await {
            Ok(0) => break, // Connection closed
            Ok(_) => {}
            Err(_) => break,
        }

        let version = header[0];
        let cmd = header[1];
        let payload_len = u32::from_be_bytes([header[2], header[3], header[4], header[5]]) as usize;

        if version != PROTO_VERSION {
            send_error(&mut socket, "Unsupported protocol version").await;
            break;
        }

        // Read payload
        let mut payload = vec![0u8; payload_len];
        if payload_len > 0 {
            if socket.read_exact(&mut payload).await.is_err() {
                break;
            }
        }

        // Handle command
        match cmd {
            CMD_PING => {
                send_ok(&mut socket, b"pong").await;
            }
            CMD_INFO => {
                let info = serde_json::json!({
                    "hostname": state.hostname,
                    "server_type": "lan",
                    "share_path": state.share_path.display().to_string(),
                    "allow_upload": state.allow_upload,
                    "version": env!("CARGO_PKG_VERSION"),
                });
                let data = serde_json::to_vec(&info).unwrap_or_default();
                send_ok(&mut socket, &data).await;
            }
            CMD_LIST => {
                let sub_path = String::from_utf8_lossy(&payload).to_string();
                handle_list(&mut socket, &state, &sub_path).await;
            }
            CMD_GET => {
                let file_path = String::from_utf8_lossy(&payload).to_string();
                handle_get(&mut socket, &state, &file_path).await;
            }
            CMD_PUT => {
                if state.allow_upload {
                    handle_put(&mut socket, &state, &payload).await;
                } else {
                    send_error(&mut socket, "Upload disabled").await;
                }
            }
            _ => {
                send_error(&mut socket, "Unknown command").await;
            }
        }
    }
}

async fn handle_list(socket: &mut TcpStream, state: &TcpState, sub_path: &str) {
    let full_path = state.share_path.join(sub_path);

    let canonical = match full_path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            send_error(socket, "Path not found").await;
            return;
        }
    };

    let canonical_root = match state.share_path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            send_error(socket, "Server error").await;
            return;
        }
    };

    // Prevent path traversal
    if !canonical.starts_with(&canonical_root) {
        send_error(socket, "Access denied").await;
        return;
    }

    let mut files = Vec::new();
    if let Ok(mut entries) = tokio::fs::read_dir(&canonical).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let name_str = entry.file_name().to_string_lossy().into_owned();
            
            // Security & Privacy Filters
            if name_str.starts_with('.') 
                || name_str.starts_with('$')
                || name_str == "System Volume Information" 
                || name_str == "node_modules" 
                || name_str == "target" 
                || name_str.ends_with(".sys") 
                || name_str.ends_with(".tmp") {
                continue;
            }

            if let Ok(metadata) = entry.metadata().await {
                files.push(serde_json::json!({
                    "name": name_str,
                    "is_dir": metadata.is_dir(),
                    "size": metadata.len(),
                }));
            }
        }
    }

    let data = serde_json::to_vec(&serde_json::json!({ "files": files })).unwrap_or_default();
    send_ok(socket, &data).await;
}

async fn handle_get(socket: &mut TcpStream, state: &TcpState, file_path: &str) {
    let full_path = state.share_path.join(file_path);

    let canonical = match full_path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            send_error(socket, "File not found").await;
            return;
        }
    };

    let canonical_root = match state.share_path.canonicalize() {
        Ok(p) => p,
        Err(_) => {
            send_error(socket, "Server error").await;
            return;
        }
    };

    if !canonical.starts_with(&canonical_root) || !canonical.is_file() {
        send_error(socket, "Access denied or not a file").await;
        return;
    }

    // Stream file in chunks
    let mut file = match tokio::fs::File::open(&canonical).await {
        Ok(f) => f,
        Err(_) => {
            send_error(socket, "Cannot open file").await;
            return;
        }
    };

    let mut seq: u32 = 0;
    let mut buffer = vec![0u8; CHUNK_SIZE];

    loop {
        match file.read(&mut buffer).await {
            Ok(0) => break, // EOF
            Ok(n) => {
                let mut chunk_payload = Vec::with_capacity(4 + n);
                chunk_payload.extend_from_slice(&seq.to_be_bytes());
                chunk_payload.extend_from_slice(&buffer[..n]);

                send_frame(socket, RESP_CHUNK, &chunk_payload).await;
                state
                    .bytes_sent
                    .fetch_add(n as u64, std::sync::atomic::Ordering::Relaxed);
                seq += 1;
            }
            Err(_) => {
                send_error(socket, "Read error").await;
                return;
            }
        }
    }

    // Send EOF
    send_frame(socket, RESP_EOF, &[]).await;
}

async fn handle_put(socket: &mut TcpStream, state: &TcpState, payload: &[u8]) {
    if payload.len() < 4 {
        send_error(socket, "Invalid upload format").await;
        return;
    }

    let name_len = u32::from_be_bytes([payload[0], payload[1], payload[2], payload[3]]) as usize;
    if payload.len() < 4 + name_len {
        send_error(socket, "Invalid upload format").await;
        return;
    }

    let name = String::from_utf8_lossy(&payload[4..4 + name_len]).to_string();
    let data = &payload[4 + name_len..];

    let dest = state.share_path.join(&name);
    match tokio::fs::write(&dest, data).await {
        Ok(_) => {
            state.bytes_received.fetch_add(data.len() as u64, std::sync::atomic::Ordering::Relaxed);
            send_ok(socket, format!("Uploaded {}", name).as_bytes()).await;
        }
        Err(e) => send_error(socket, &format!("Write error: {}", e)).await,
    }
}

// ─── Frame Helpers ──────────────────────────────────────

async fn send_frame(socket: &mut TcpStream, cmd: u8, payload: &[u8]) {
    let len = payload.len() as u32;
    let mut frame = Vec::with_capacity(6 + payload.len());
    frame.push(PROTO_VERSION);
    frame.push(cmd);
    frame.extend_from_slice(&len.to_be_bytes());
    frame.extend_from_slice(payload);

    let _ = socket.write_all(&frame).await;
    let _ = socket.flush().await;
}

async fn send_ok(socket: &mut TcpStream, payload: &[u8]) {
    send_frame(socket, RESP_OK, payload).await;
}

async fn send_error(socket: &mut TcpStream, msg: &str) {
    send_frame(socket, RESP_ERROR, msg.as_bytes()).await;
}
