use serde::{Deserialize, Serialize};
use std::net::{UdpSocket, TcpListener, TcpStream, SocketAddr};
use std::io::{Read, Write, BufRead, BufReader};
use std::sync::{Arc, Mutex, OnceLock};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::path::Path;
use std::fs;
use tauri::Emitter;

/// NexDrop Protocol 2.1 Constants
/// Compatible with standard LocalSend protocol for local network file sharing.
pub const MULTICAST_IP: &str = "224.0.0.167";
pub const PORT: u16 = 53317;
pub const PROTOCOL_VERSION: &str = "2.1";

/// Global guards to prevent duplicate listener binds across re-mounts
static RECEIVER_RUNNING: AtomicBool = AtomicBool::new(false);
static DISCOVERY_RUNNING: AtomicBool = AtomicBool::new(false);

/// Dynamic save directory that can be updated while the receiver thread is active
static SAVE_DIR: OnceLock<Arc<Mutex<String>>> = OnceLock::new();

/// Multicast DTO
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MulticastDto {
    pub alias: String,
    pub version: Option<String>,
    pub device_model: Option<String>,
    pub device_type: Option<String>,
    pub fingerprint: String,
    pub port: Option<u16>,
    pub protocol: Option<String>,
    pub download: Option<bool>,
    pub announcement: Option<bool>,
    pub announce: Option<bool>,
}

/// Device representation
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Device {
    pub ip: String,
    pub version: String,
    pub port: u16,
    pub https: bool,
    pub fingerprint: String,
    pub alias: String,
    pub device_model: Option<String>,
    pub device_type: String,
    pub download: bool,
}

/// File transfer metadata
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileTransferInfo {
    pub file_name: String,
    pub file_size: u64,
    pub sender_alias: String,
    pub sender_ip: String,
}

/// Transfer progress event
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub file_name: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub percent: f64,
}

/// Start UDP multicast listener for device discovery.
/// - Binds to the multicast group 224.0.0.167:53317
/// - Parses incoming JSON as MulticastDto
/// - Emits "device-discovered" events to the frontend
/// - Guarded: only the first call actually binds; subsequent calls return Ok immediately
#[tauri::command]
pub async fn start_nexdrop_discovery(app: tauri::AppHandle) -> Result<(), String> {
    // Already running — skip duplicate bind
    if DISCOVERY_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let socket = match UdpSocket::bind(("0.0.0.0", PORT)) {
        Ok(s) => s,
        Err(e) => {
            DISCOVERY_RUNNING.store(false, Ordering::SeqCst);
            return Err(format!("Failed to bind to UDP port {}: {}", PORT, e));
        }
    };

    let multicast_addr: std::net::Ipv4Addr = MULTICAST_IP.parse().unwrap();
    if let Err(e) = socket.join_multicast_v4(&multicast_addr, &std::net::Ipv4Addr::UNSPECIFIED) {
        DISCOVERY_RUNNING.store(false, Ordering::SeqCst);
        return Err(format!("Failed to join multicast group: {}", e));
    }

    // Set a read timeout so the thread isn't stuck forever
    let _ = socket.set_read_timeout(Some(std::time::Duration::from_secs(30)));

    let app_clone = app.clone();
    
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match socket.recv_from(&mut buf) {
                Ok((size, addr)) => {
                    if let Ok(json_str) = std::str::from_utf8(&buf[..size]) {
                        if let Ok(dto) = serde_json::from_str::<MulticastDto>(json_str) {
                            let device = Device {
                                ip: addr.ip().to_string(),
                                version: dto.version.unwrap_or_else(|| "1.0".to_string()),
                                port: dto.port.unwrap_or(PORT),
                                https: dto.protocol.as_deref() == Some("https"),
                                fingerprint: dto.fingerprint.clone(),
                                alias: dto.alias.clone(),
                                device_model: dto.device_model.clone(),
                                device_type: dto.device_type.unwrap_or_else(|| "desktop".to_string()),
                                download: dto.download.unwrap_or(false),
                            };
                            
                            let _ = app_clone.emit("device-discovered", device.clone());

                            // If this is an announcement, respond back
                            if dto.announcement == Some(true) || dto.announce == Some(true) {
                                let response = MulticastDto {
                                    alias: get_hostname(),
                                    version: Some(PROTOCOL_VERSION.to_string()),
                                    device_model: Some(get_hostname()),
                                    device_type: Some("desktop".to_string()),
                                    fingerprint: get_device_fingerprint(),
                                    port: Some(PORT),
                                    protocol: Some("http".to_string()),
                                    download: Some(true),
                                    announcement: Some(false),
                                    announce: Some(false),
                                };
                                
                                if let Ok(response_json) = serde_json::to_string(&response) {
                                    let target = format!("{}:{}", MULTICAST_IP, PORT);
                                    let send_socket = UdpSocket::bind("0.0.0.0:0").ok();
                                    if let Some(s) = send_socket {
                                        let _ = s.send_to(response_json.as_bytes(), &target);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    // Timeout — continue listening
                    continue;
                }
                Err(e) => {
                    eprintln!("UDP receive error: {}", e);
                    break;
                }
            }
        }
        // Thread exited — allow future restart
        DISCOVERY_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(())
}

#[tauri::command]
pub async fn send_text_via_nexdrop(
    text: String,
    target_ip: String,
    target_port: u16,
) -> Result<(), String> {
    let addr: SocketAddr = format!("{}:{}", target_ip, target_port + 1)
        .parse()
        .map_err(|e| format!("Invalid socket address {}:{}: {}", target_ip, target_port + 1, e))?;

    let mut stream = TcpStream::connect_timeout(&addr, std::time::Duration::from_secs(10))
        .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;
    
    let info = FileTransferInfo {
        file_name: "Text Content".to_string(),
        file_size: text.len() as u64,
        sender_alias: get_hostname(),
        sender_ip: "0.0.0.0".to_string(),
    };
    
    let header = serde_json::to_string(&info)
        .map_err(|e| format!("Serialization error: {}", e))?;
    stream.write_all(format!("{}\n", header).as_bytes())
        .map_err(|e| format!("Failed to send header: {}", e))?;
    stream.write_all(text.as_bytes())
        .map_err(|e| format!("Failed to send text: {}", e))?;
    
    Ok(())
}

/// Send a multicast announcement to the network.
/// Sends 3 announcements with increasing delays (100ms, 500ms, 2000ms) for reliability.
#[tauri::command]
pub async fn send_nexdrop_announcement() -> Result<(), String> {
    let socket = match UdpSocket::bind("0.0.0.0:0") {
        Ok(s) => s,
        Err(e) => return Err(format!("Failed to bind socket: {}", e)),
    };

    let dto = MulticastDto {
        alias: "NexExplorer".to_string(),
        version: Some(PROTOCOL_VERSION.to_string()),
        device_model: Some(get_hostname()),
        device_type: Some("desktop".to_string()),
        fingerprint: get_device_fingerprint(),
        port: Some(PORT),
        protocol: Some("http".to_string()),
        download: Some(true),
        announcement: Some(true),
        announce: Some(true),
    };

    let msg = serde_json::to_string(&dto)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    let addr = format!("{}:{}", MULTICAST_IP, PORT);
    
    // Send 3 times with increasing delays
    let delays = [100, 500, 2000];
    for delay in delays {
        std::thread::sleep(std::time::Duration::from_millis(delay));
        if let Err(e) = socket.send_to(msg.as_bytes(), &addr) {
            eprintln!("Multicast send error: {}", e);
        }
    }

    Ok(())
}

/// Start HTTP file receive server.
/// Listens on PORT+1 for incoming file transfers via TCP.
/// Guarded: only the first call binds the TCP listener; subsequent calls
/// update the dynamic save directory without rebinding.
#[tauri::command]
pub async fn start_nexdrop_receiver(
    app: tauri::AppHandle,
    save_dir: String,
) -> Result<(), String> {
    // Initialize or update the dynamic save directory
    let dir_lock = SAVE_DIR.get_or_init(|| Arc::new(Mutex::new(save_dir.clone())));
    {
        let mut dir = dir_lock.lock().map_err(|e| format!("Lock error: {}", e))?;
        *dir = save_dir;
    }

    // Already running — save dir updated above, so just return
    if RECEIVER_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(());
    }

    let listener = match TcpListener::bind(format!("0.0.0.0:{}", PORT + 1)) {
        Ok(l) => l,
        Err(e) => {
            RECEIVER_RUNNING.store(false, Ordering::SeqCst);
            return Err(format!("Failed to bind TCP: {}", e));
        }
    };

    let app_clone = app.clone();
    let save_dir_arc = dir_lock.clone();
    
    thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(stream) = stream {
                let app_inner = app_clone.clone();
                let dir_ref = save_dir_arc.clone();
                
                thread::spawn(move || {
                    let current_save_dir = {
                        dir_ref.lock().map(|d| d.clone()).unwrap_or_default()
                    };
                    if let Err(e) = handle_file_receive(stream, &current_save_dir, &app_inner) {
                        eprintln!("File receive error: {}", e);
                    }
                });
            }
        }
        // Listener dropped — allow future restart
        RECEIVER_RUNNING.store(false, Ordering::SeqCst);
    });
    
    Ok(())
}

/// Handle an incoming file transfer over TCP.
/// Simple HTTP-like protocol: first line is metadata JSON, rest is file bytes.
fn handle_file_receive(
    stream: TcpStream,
    save_dir: &str,
    app: &tauri::AppHandle,
) -> Result<(), String> {
    let mut reader = BufReader::new(&stream);
    
    // Read the first line as JSON metadata
    let mut header_line = String::new();
    reader.read_line(&mut header_line).map_err(|e| e.to_string())?;
    
    let info: FileTransferInfo = serde_json::from_str(&header_line.trim())
        .map_err(|e| format!("Invalid transfer header: {}", e))?;
    
    // Emit incoming transfer notification
    let _ = app.emit("file-transfer-incoming", info.clone());
    
    // Security: sanitize file_name to prevent path traversal (e.g. "../../evil.exe")
    // Only use the basename — strip any directory components from the sender's file_name.
    let safe_name = Path::new(&info.file_name)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "received_file".to_string());
    let file_path = Path::new(save_dir).join(&safe_name);
    let mut file = fs::File::create(&file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    let mut total_read: u64 = 0;
    let mut buf = [0u8; 8192];
    
    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        total_read += n as u64;
        
        let progress = TransferProgress {
            file_name: info.file_name.clone(),
            bytes_transferred: total_read,
            total_bytes: info.file_size,
            percent: if info.file_size > 0 {
                (total_read as f64 / info.file_size as f64) * 100.0
            } else {
                100.0
            },
        };
        let _ = app.emit("file-transfer-progress", progress);
    }
    
    let _ = app.emit("file-transfer-complete", info.file_name.clone());
    
    Ok(())
}

/// Send a file to a discovered device over TCP.
#[tauri::command]
pub async fn send_file_via_nexdrop(
    app: tauri::AppHandle,
    file_path: String,
    target_ip: String,
    target_port: u16,
) -> Result<(), String> {
    let path = Path::new(&file_path);
    
    let file_name = path.file_name()
        .ok_or("Invalid file path")?
        .to_string_lossy()
        .into_owned();
    
    let metadata = fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    let file_size = metadata.len();
    
    // Connect to the target device's receive port
    let addr: SocketAddr = format!("{}:{}", target_ip, target_port + 1)
        .parse()
        .map_err(|e| format!("Invalid address: {}", e))?;
    
    let mut stream = TcpStream::connect_timeout(&addr, std::time::Duration::from_secs(10))
        .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;
    
    // Send metadata header as JSON line
    let info = FileTransferInfo {
        file_name: file_name.clone(),
        file_size,
        sender_alias: "NexExplorer".to_string(),
        sender_ip: "0.0.0.0".to_string(),
    };
    
    let header = serde_json::to_string(&info)
        .map_err(|e| format!("Serialization error: {}", e))?;
    stream.write_all(format!("{}\n", header).as_bytes())
        .map_err(|e| e.to_string())?;
    
    // Stream the file contents
    let mut file = fs::File::open(&file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let mut buf = [0u8; 8192];
    let mut total_sent: u64 = 0;
    
    loop {
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        
        stream.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        total_sent += n as u64;
        
        let progress = TransferProgress {
            file_name: file_name.clone(),
            bytes_transferred: total_sent,
            total_bytes: file_size,
            percent: if file_size > 0 {
                (total_sent as f64 / file_size as f64) * 100.0
            } else {
                100.0
            },
        };
        let _ = app.emit("file-send-progress", progress);
    }
    
    let _ = app.emit("file-send-complete", file_name);
    
    Ok(())
}

/// Get hostname for device identification
fn get_hostname() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMPUTERNAME").unwrap_or_else(|_| "Windows PC".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOSTNAME")
            .or_else(|_| std::env::var("USER"))
            .unwrap_or_else(|_| "Unknown".to_string())
    }
}

/// Generate a stable device fingerprint
fn get_device_fingerprint() -> String {
    // Use machine-specific data for a deterministic fingerprint
    let hostname = get_hostname();
    // Simple hash
    format!("nex-{:x}", hostname.bytes().fold(0u64, |acc, b| acc.wrapping_mul(31).wrapping_add(b as u64)))
}
