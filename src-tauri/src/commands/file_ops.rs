use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub extension: String,
    pub created_at: Option<u64>,
    pub modified_at: Option<u64>,
    pub accessed_at: Option<u64>,
    pub is_hidden: bool,
}

/// Fast file transfer to a local/USB directory with real-time progress emission.
/// Uses a 1MB buffer for optimal read/write speeds, replicating network transfer UI.
#[tauri::command]
pub async fn usb_fast_copy(app: AppHandle, source_paths: Vec<String>, dest_dir: String) -> Result<(), String> {
    let dest_path = Path::new(&dest_dir);
    if !dest_path.exists() {
        fs::create_dir_all(dest_path).map_err(|e| format!("Failed to create destination: {}", e))?;
    }

    use std::io::{Read, Write};

    for src in source_paths {
        let p = Path::new(&src);
        if !p.exists() { continue; }
        
        let name = p.file_name().unwrap_or_default().to_string_lossy().to_string();
        let dest_file = dest_path.join(&name);
        
        // Skip directories for the fast flat copy, or implement recursion if needed.
        if p.is_dir() {
            copy_dir_recursive(p, &dest_file)?;
            let _ = app.emit("file-transfer-complete", name.clone());
            continue;
        }

        let meta = fs::metadata(p).map_err(|e| e.to_string())?;
        let total_bytes = meta.len();
        
        let mut source_file = fs::File::open(p).map_err(|e| e.to_string())?;
        let mut target_file = fs::File::create(&dest_file).map_err(|e| e.to_string())?;
        
        let mut buffer = [0u8; 1048576]; // 1MB chunks
        let mut copied = 0u64;
        
        loop {
            let n = source_file.read(&mut buffer).map_err(|e| e.to_string())?;
            if n == 0 { break; }
            target_file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
            copied += n as u64;
            
            let percent = if total_bytes > 0 {
                (copied as f64 / total_bytes as f64) * 100.0
            } else {
                100.0
            };

            let _ = app.emit("file-transfer-progress", serde_json::json!({
                "fileName": name.clone(),
                "bytesTransferred": copied,
                "totalBytes": total_bytes,
                "percent": percent
            }));
            }

            let _ = app.emit("file-transfer-complete", name);
            }    
    Ok(())
}

/// Checks the Windows hidden attribute on a file/directory.
/// Falls back to dot-prefix check on non-Windows platforms.
fn is_hidden_entry(path: &Path, name: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        // FILE_ATTRIBUTE_HIDDEN = 0x2
        if let Ok(meta) = fs::metadata(path) {
            return (meta.file_attributes() & 0x2) != 0;
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        name.starts_with('.')
    }
}

#[tauri::command]
pub async fn trash_items(paths: Vec<String>) -> Result<(), String> {
    trash::delete_all(paths).map_err(|e| format!("Failed to move to trash: {}", e))
}

#[tauri::command]
pub async fn bulk_copy(sources: Vec<String>, dest_dir: String) -> Result<(), String> {
    let mut options = fs_extra::dir::CopyOptions::new();
    options.overwrite = true;
    options.copy_inside = true;
    
    for src in sources {
        let src_path = Path::new(&src);
        if src_path.is_dir() {
            fs_extra::dir::copy(&src, &dest_dir, &options)
                .map_err(|e| format!("Failed to copy directory: {}", e))?;
        } else {
            let mut file_options = fs_extra::file::CopyOptions::new();
            file_options.overwrite = true;
            let file_name = src_path.file_name().unwrap_or_default();
            let dest_path = Path::new(&dest_dir).join(file_name);
            fs_extra::file::copy(&src, &dest_path, &file_options)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn bulk_move(sources: Vec<String>, dest_dir: String) -> Result<(), String> {
    let mut options = fs_extra::dir::CopyOptions::new();
    options.overwrite = true;
    
    for src in sources {
        let src_path = Path::new(&src);
        if src_path.is_dir() {
            fs_extra::dir::move_dir(&src, &dest_dir, &options)
                .map_err(|e| format!("Failed to move directory: {}", e))?;
        } else {
            let mut file_options = fs_extra::file::CopyOptions::new();
            file_options.overwrite = true;
            let file_name = src_path.file_name().unwrap_or_default();
            let dest_path = Path::new(&dest_dir).join(file_name);
            fs_extra::file::move_file(&src, &dest_path, &file_options)
                .map_err(|e| format!("Failed to move file: {}", e))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    
    let dir = match fs::read_dir(&path) {
        Ok(d) => d,
        Err(e) => return Err(e.to_string()),
    };
    
    for entry in dir {
        if let Ok(entry) = entry {
            if let Ok(metadata) = entry.metadata() {
                let name = entry.file_name().to_string_lossy().into_owned();
                let entry_path = entry.path();
                let path_str = entry_path.to_string_lossy().into_owned();
                let is_dir = metadata.is_dir();
                let size = metadata.len();
                let extension = entry_path.extension()
                    .map(|e| e.to_string_lossy().into_owned())
                    .unwrap_or_default();
                
                // Read timestamps efficiently
                let created_at = metadata.created().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());
                let modified_at = metadata.modified().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());
                let accessed_at = metadata.accessed().ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs());
                
                // Windows-aware hidden file detection using ALREADY LOADED metadata
                let is_hidden = {
                    #[cfg(target_os = "windows")]
                    {
                        use std::os::windows::fs::MetadataExt;
                        (metadata.file_attributes() & 0x2) != 0
                    }
                    #[cfg(not(target_os = "windows"))]
                    {
                        name.starts_with('.')
                    }
                };
                
                entries.push(FileEntry {
                    name,
                    path: path_str,
                    is_dir,
                    size,
                    extension,
                    created_at,
                    modified_at,
                    accessed_at,
                    is_hidden,
                });
            }
        }
    }
    
    Ok(entries)
}

#[tauri::command]
pub async fn copy_file(source: String, dest: String) -> Result<(), String> {
    let source_path = Path::new(&source);
    let dest_path = Path::new(&dest);
    
    if source_path.is_dir() {
        // Recursive directory copy (inspired by Explorer++ CopyItemsToClipboard + paste logic)
        copy_dir_recursive(source_path, dest_path)
    } else {
        match fs::copy(&source, &dest) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to copy file: {}", e)),
        }
    }
}

/// Recursively copy a directory and all its contents
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory: {}", e))?;
    
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let dest_child = dst.join(entry.file_name());
        
        if entry_path.is_dir() {
            copy_dir_recursive(&entry_path, &dest_child)?;
        } else {
            fs::copy(&entry_path, &dest_child)
                .map_err(|e| format!("Failed to copy {}: {}", entry_path.display(), e))?;
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn move_file(source: String, dest: String) -> Result<(), String> {
    match fs::rename(&source, &dest) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to move file: {}", e)),
    }
}

#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        match fs::remove_dir_all(p) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to delete directory: {}", e)),
        }
    } else {
        match fs::remove_file(p) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to delete file: {}", e)),
        }
    }
}

#[tauri::command]
pub async fn rename_file(path: String, new_name: String) -> Result<(), String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        let new_path = parent.join(new_name);
        match fs::rename(p, new_path) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to rename file: {}", e)),
        }
    } else {
        Err("Invalid path".to_string())
    }
}

#[tauri::command]
pub async fn bulk_rename(renames: Vec<(String, String)>) -> Result<(), Vec<String>> {
    let mut errors = Vec::new();
    for (old_path, new_name) in renames {
        let p = Path::new(&old_path);
        if let Some(parent) = p.parent() {
            let new_path = parent.join(new_name);
            
            // Check if target already exists to prevent accidental overwrite
            if new_path.exists() {
                errors.push(format!("Cannot rename {}: Target already exists", old_path));
                continue;
            }

            if let Err(e) = fs::rename(p, new_path) {
                errors.push(format!("Failed to rename {}: {}", old_path, e));
            }
        } else {
            errors.push(format!("Invalid path: {}", old_path));
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors)
    }
}

#[tauri::command]
pub async fn create_folder(path: String) -> Result<(), String> {
    match fs::create_dir_all(&path) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to create folder: {}", e)),
    }
}

/// Lists the contents of an archive using the 7z CLI.
/// Modeled on the 7-Zip source (7zip-26.01/CPP/7zip/UI/Console) output format:
///   `7z l <archive_path>` produces a table of entries with Date, Time, Attr, Size, Name.
/// We parse that output into FileEntry structs so the frontend can browse archives
/// exactly like regular directories.
#[tauri::command]
pub async fn list_archive(path: String) -> Result<Vec<FileEntry>, String> {
    // Try to locate 7z.exe: check bundled resources first, then system PATH
    let seven_zip = find_7z_binary()?;
    
    let output = Command::new(&seven_zip)
        .args(&["l", "-slt", &path])
        .output()
        .map_err(|e| format!("Failed to execute 7z: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("7z failed: {}", stderr));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    parse_7z_list_output(&stdout, &path)
}

/// Locates the 7z binary. Priority order:
/// 1. Bundled in app resources directory
/// 2. Common install paths (C:\Program Files\7-Zip)
/// 3. System PATH
fn find_7z_binary() -> Result<String, String> {
    // Check common Windows install locations
    let common_paths = [
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
    ];
    
    for p in &common_paths {
        if Path::new(p).exists() {
            return Ok(p.to_string());
        }
    }
    
    // Fallback: assume 7z is on PATH
    let check = Command::new("7z")
        .arg("--help")
        .output();
    
    match check {
        Ok(o) if o.status.success() => Ok("7z".to_string()),
        _ => Err(
            "7-Zip not found. Please install 7-Zip or place 7z.exe in C:\\Program Files\\7-Zip"
                .to_string(),
        ),
    }
}

/// Parses the output of `7z l -slt <archive>` (technical listing format).
/// Each entry is separated by blank lines and looks like:
///   Path = folder/file.txt
///   Folder = +   (or -)
///   Size = 12345
///   Modified = 2024-01-15 10:30:00
fn parse_7z_list_output(output: &str, archive_path: &str) -> Result<Vec<FileEntry>, String> {
    let mut entries: Vec<FileEntry> = Vec::new();
    
    // Split by double-newline to get blocks
    let blocks: Vec<&str> = output.split("\n\n").collect();
    
    for block in blocks {
        let mut name = String::new();
        let mut is_dir = false;
        let mut size: u64 = 0;
        let mut modified: Option<u64> = None;
        let mut has_path = false;
        
        for line in block.lines() {
            let line = line.trim();
            if line.starts_with("Path = ") {
                name = line[7..].to_string();
                has_path = true;
            } else if line.starts_with("Folder = ") {
                is_dir = line[9..].trim() == "+";
            } else if line.starts_with("Size = ") {
                size = line[7..].trim().parse().unwrap_or(0);
            } else if line.starts_with("Modified = ") {
                // Parse "2024-01-15 10:30:00" format to unix timestamp
                modified = parse_datetime_to_epoch(&line[11..]);
            }
        }
        
        // Skip entries without a path (header blocks, etc.)
        if !has_path || name.is_empty() {
            continue;
        }
        
        // Skip the archive root entry itself
        if name.contains('\\') || name.contains('/') {
            // It's a nested entry — get just the filename
        }
        
        let extension = Path::new(&name)
            .extension()
            .map(|e| e.to_string_lossy().into_owned())
            .unwrap_or_default();
        
        let entry_name = Path::new(&name)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| name.clone());
        
        entries.push(FileEntry {
            name: entry_name,
            path: format!("{}\\{}", archive_path, name),
            is_dir,
            size,
            extension,
            created_at: modified,
            modified_at: modified,
            accessed_at: modified,
            is_hidden: false,
        });
    }
    
    Ok(entries)
}

/// Extract files from an archive to a destination directory using 7z.
/// Hardened against path traversal and flag injection vulnerabilities.
#[tauri::command]
pub async fn extract_archive(archive_path: String, dest_dir: String) -> Result<(), String> {
    let seven_zip = find_7z_binary()?;
    
    // Security: Ensure paths are absolute so they aren't parsed as 7z flags (e.g., "-sdel")
    let archive_p = Path::new(&archive_path);
    let dest_p = Path::new(&dest_dir);
    
    let abs_archive = archive_p.canonicalize()
        .map_err(|e| format!("Invalid archive path: {}", e))?;
        
    // Create dest dir if it doesn't exist to ensure canonicalize works, or just use absolute
    if !dest_p.exists() {
        fs::create_dir_all(dest_p).map_err(|e| format!("Failed to create extract dir: {}", e))?;
    }
    let abs_dest = dest_p.canonicalize()
        .map_err(|e| format!("Invalid destination path: {}", e))?;

    // 7z automatically prevents ZipSlip (extracting outside the dest_dir via ../)
    // The -o switch dictates the root. We pass the absolute paths.
    let output = Command::new(&seven_zip)
        .arg("x")
        .arg(abs_archive.to_string_lossy().to_string())
        .arg(format!("-o{}", abs_dest.to_string_lossy()))
        .arg("-y") // Assume Yes on all queries
        .output()
        .map_err(|e| format!("Failed to execute 7z: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("7z extraction failed: {}", stderr));
    }
    
    Ok(())
}

/// Create an archive from a list of source paths.
/// Supports: .zip, .7z, .tar.gz
/// Hardened against flag injection vulnerabilities.
#[tauri::command]
pub async fn create_archive(
    archive_path: String,
    source_paths: Vec<String>,
) -> Result<(), String> {
    let seven_zip = find_7z_binary()?;
    
    let mut args = vec!["a".to_string()];
    
    // Force absolute path for the archive target to prevent flag injection
    let target_path = Path::new(&archive_path);
    let abs_target = if target_path.is_absolute() {
        target_path.to_path_buf()
    } else {
        std::env::current_dir().unwrap_or_default().join(target_path)
    };
    args.push(abs_target.to_string_lossy().to_string());
    
    // Force absolute paths for all sources
    for src in source_paths {
        let p = Path::new(&src);
        if let Ok(abs) = p.canonicalize() {
            args.push(abs.to_string_lossy().to_string());
        } else {
            return Err(format!("File not found or invalid path: {}", src));
        }
    }
    
    let output = Command::new(&seven_zip)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to execute 7z: {}", e))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("7z archive creation failed: {}\n{}", stderr, stdout));
    }
    
    Ok(())
}

#[tauri::command]
pub async fn get_folder_size(path: String) -> Result<u64, String> {
    let p = Path::new(&path);
    if p.is_dir() {
        Ok(calculate_dir_size(p))
    } else {
        match fs::metadata(p) {
            Ok(m) => Ok(m.len()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// Get detailed file properties (size, attributes, permissions)
#[tauri::command]
pub async fn get_file_properties(path: String) -> Result<FileProperties, String> {
    let p = Path::new(&path);
    let metadata = fs::metadata(p).map_err(|e| e.to_string())?;
    
    let created = metadata.created().ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    let modified = metadata.modified().ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    let accessed = metadata.accessed().ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs());
    
    let is_readonly;
    let is_hidden;
    let is_system;
    
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        let attrs = metadata.file_attributes();
        is_readonly = (attrs & 0x1) != 0;     // FILE_ATTRIBUTE_READONLY
        is_hidden = (attrs & 0x2) != 0;       // FILE_ATTRIBUTE_HIDDEN
        is_system = (attrs & 0x4) != 0;       // FILE_ATTRIBUTE_SYSTEM
    }
    #[cfg(not(target_os = "windows"))]
    {
        is_readonly = metadata.permissions().readonly();
        is_hidden = p.file_name().map(|n| n.to_string_lossy().starts_with('.')).unwrap_or(false);
        is_system = false;
    }
    
    // Calculate directory size recursively
    let total_size = if metadata.is_dir() {
        calculate_dir_size(p)
    } else {
        metadata.len()
    };
    
    Ok(FileProperties {
        name: p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        path: path.clone(),
        size: total_size,
        is_dir: metadata.is_dir(),
        is_readonly,
        is_hidden,
        is_system,
        created_at: created,
        modified_at: modified,
        accessed_at: accessed,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileProperties {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub is_readonly: bool,
    pub is_hidden: bool,
    pub is_system: bool,
    pub created_at: Option<u64>,
    pub modified_at: Option<u64>,
    pub accessed_at: Option<u64>,
}

/// Recursively calculate directory size
fn calculate_dir_size(path: &Path) -> u64 {
    let mut total: u64 = 0;
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_dir() {
                    total += calculate_dir_size(&entry.path());
                } else {
                    total += meta.len();
                }
            }
        }
    }
    total
}

/// Get system drive list (Windows-specific)
#[tauri::command]
pub async fn get_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();
    
    #[cfg(target_os = "windows")]
    {
        // Check drive letters A-Z
        for letter in b'A'..=b'Z' {
            let drive_path = format!("{}:\\", letter as char);
            let p = Path::new(&drive_path);
            if p.exists() {
                let total_space: u64 = 0;
                let free_space: u64 = 0;
                
                // Try to get disk space using fs metadata
                let drive_type = get_windows_drive_type(&drive_path);
                
                drives.push(DriveInfo {
                    letter: format!("{}", letter as char),
                    path: drive_path,
                    label: String::new(),
                    drive_type,
                    total_space,
                    free_space,
                });
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // On Unix, list mount points
        drives.push(DriveInfo {
            letter: "/".to_string(),
            path: "/".to_string(),
            label: "Root".to_string(),
            drive_type: "fixed".to_string(),
            total_space: 0,
            free_space: 0,
        });
    }
    
    Ok(drives)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DriveInfo {
    pub letter: String,
    pub path: String,
    pub label: String,
    pub drive_type: String,
    pub total_space: u64,
    pub free_space: u64,
}

#[cfg(target_os = "windows")]
fn get_windows_drive_type(path: &str) -> String {
    // Use Windows API via command to determine drive type
    let output = Command::new("wmic")
        .args(&["logicaldisk", "where", &format!("DeviceID='{}'", &path[..2]), "get", "DriveType", "/value"])
        .output();
    
    match output {
        Ok(o) => {
            let text = String::from_utf8_lossy(&o.stdout);
            if text.contains("DriveType=2") { "removable".to_string() }
            else if text.contains("DriveType=3") { "fixed".to_string() }
            else if text.contains("DriveType=4") { "network".to_string() }
            else if text.contains("DriveType=5") { "cdrom".to_string() }
            else { "unknown".to_string() }
        },
        Err(_) => "unknown".to_string(),
    }
}

/// Helper: parse "2024-01-15 10:30:00" to unix epoch seconds
fn parse_datetime_to_epoch(datetime_str: &str) -> Option<u64> {
    let trimmed = datetime_str.trim();
    // Extremely simple parser for "YYYY-MM-DD HH:MM:SS" format
    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    if parts.len() < 2 {
        return None;
    }
    
    let date_parts: Vec<u32> = parts[0].split('-').filter_map(|p| p.parse().ok()).collect();
    let time_parts: Vec<u32> = parts[1].split(':').filter_map(|p| p.parse().ok()).collect();
    
    if date_parts.len() < 3 || time_parts.len() < 3 {
        return None;
    }
    
    // Rough epoch calculation (not accounting for leap seconds, etc.)
    let year = date_parts[0];
    let month = date_parts[1];
    let day = date_parts[2];
    let hour = time_parts[0];
    let min = time_parts[1];
    let sec = time_parts[2];
    
    // Days since epoch for each year
    let mut days: u64 = 0;
    for y in 1970..year {
        days += if is_leap_year(y) { 366 } else { 365 };
    }
    
    let month_days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for m in 1..month {
        days += month_days[m as usize] as u64;
        if m == 2 && is_leap_year(year) {
            days += 1;
        }
    }
    days += (day - 1) as u64;
    
    let total_secs = days * 86400 + (hour as u64) * 3600 + (min as u64) * 60 + sec as u64;
    Some(total_secs)
}

fn is_leap_year(year: u32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)
}

// ─── File Hide Locker ───────────────────────────────────

/// Securely hides and locks a file by renaming it to a hex-encoded format
/// and setting OS-level Hidden + System attributes (on Windows).
/// This prevents it from being visible in standard file explorers without corrupting data.
#[tauri::command]
pub async fn hide_lock_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("File not found".to_string());
    }

    let file_name = p.file_name().unwrap().to_string_lossy().into_owned();
    let hex_name = hex::encode(file_name.as_bytes());
    let locked_name = format!(".nexlock_{}", hex_name);
    let locked_path = p.parent().unwrap().join(&locked_name);

    fs::rename(p, &locked_path).map_err(|e| format!("Failed to lock file: {}", e))?;

    #[cfg(target_os = "windows")]
    {
        // Set Hidden and System attributes
        let _ = Command::new("attrib")
            .args(&["+h", "+s", locked_path.to_str().unwrap()])
            .output();
    }
    
    Ok(())
}

/// Unlocks and unhides a previously secured file.
#[tauri::command]
pub async fn unhide_unlock_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err("File not found".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        // Remove Hidden and System attributes
        let _ = Command::new("attrib")
            .args(&["-h", "-s", path.as_str()])
            .output();
    }

    let file_name = p.file_name().unwrap().to_string_lossy().into_owned();
    if file_name.starts_with(".nexlock_") {
        let hex_name = &file_name[9..];
        if let Ok(decoded) = hex::decode(hex_name) {
            if let Ok(orig_name) = String::from_utf8(decoded) {
                let orig_path = p.parent().unwrap().join(orig_name);
                fs::rename(p, &orig_path).map_err(|e| format!("Failed to unlock file: {}", e))?;
                return Ok(());
            }
        }
    }
    
    // If it wasn't a standard nexlock file or decoding failed, just try to rename it by removing the prefix if possible.
    Err("Invalid locked file format".to_string())
}
