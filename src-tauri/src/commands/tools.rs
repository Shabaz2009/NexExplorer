use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, BufReader};
use std::path::{Path, PathBuf};
use sha2::{Sha256, Digest};
use md5;
use hex;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileHashes {
    pub md5: String,
    pub sha256: String,
}

#[tauri::command]
pub async fn recursive_search(path: String, query: String) -> Result<Vec<super::file_ops::FileEntry>, String> {
    let mut entries = Vec::new();
    let query_lower = query.to_lowercase();

    for entry in WalkDir::new(&path)
        .max_depth(5) // Limit depth to prevent infinite loops/long waits
        .into_iter()
        .filter_map(|e| e.ok()) {
        
        let name = entry.file_name().to_string_lossy().to_string();
        if name.to_lowercase().contains(&query_lower) {
            if let Ok(metadata) = entry.metadata() {
                let path_str = entry.path().to_string_lossy().into_owned();
                let is_dir = metadata.is_dir();
                let size = metadata.len();
                let extension = entry.path().extension()
                    .map(|e| e.to_string_lossy().into_owned())
                    .unwrap_or_default();
                
                entries.push(super::file_ops::FileEntry {
                    name,
                    path: path_str,
                    is_dir,
                    size,
                    extension,
                    created_at: None,
                    modified_at: None,
                    accessed_at: None,
                    is_hidden: false,
                });
            }
        }

        if entries.len() > 500 { break; } // Limit results for performance
    }
    Ok(entries)
}

#[tauri::command]
pub async fn calculate_file_hashes(path: String) -> Result<FileHashes, String> {
    // Stream file in 8KB chunks to avoid loading the entire file into memory.
    // A 4GB file previously allocated 4GB of RAM here — now uses ~8KB.
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut reader = BufReader::new(file);
    let mut md5_ctx = md5::Context::new();
    let mut sha256_hasher = Sha256::new();
    let mut buf = [0u8; 8192];

    loop {
        let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        md5_ctx.consume(&buf[..n]);
        sha256_hasher.update(&buf[..n]);
    }

    Ok(FileHashes {
        md5: format!("{:x}", md5_ctx.compute()),
        sha256: hex::encode(sha256_hasher.finalize()),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DiskNode {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub children: Option<Vec<DiskNode>>,
    pub is_dir: bool,
}

#[tauri::command]
pub async fn analyze_disk_space(path: String) -> Result<DiskNode, String> {
    let p = Path::new(&path);
    if !p.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    Ok(build_disk_node(p))
}

fn build_disk_node(path: &Path) -> DiskNode {
    let name = path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned());
    let path_str = path.to_string_lossy().into_owned();
    
    let mut size: u64 = 0;
    let mut children = Vec::new();
    
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if let Ok(meta) = entry_path.metadata() {
                if meta.is_dir() {
                    let child = build_disk_node(&entry_path);
                    size += child.size;
                    children.push(child);
                } else {
                    let file_size = meta.len();
                    size += file_size;
                    children.push(DiskNode {
                        name: entry_path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
                        path: entry_path.to_string_lossy().into_owned(),
                        size: file_size,
                        children: None,
                        is_dir: false,
                    });
                }
            }
        }
    }
    
    // Sort children by size descending
    children.sort_by(|a, b| b.size.cmp(&a.size));
    
    DiskNode {
        name,
        path: path_str,
        size,
        children: Some(children),
        is_dir: true,
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub files: Vec<super::file_ops::FileEntry>,
    pub size: u64,
}

#[tauri::command]
pub async fn find_duplicates(path: String) -> Result<Vec<DuplicateGroup>, String> {
    use std::collections::HashMap;
    use crate::commands::file_ops::FileEntry;
    
    let mut size_groups: HashMap<u64, Vec<PathBuf>> = HashMap::new();
    
    // 1. Walk directory and group by size
    for entry in WalkDir::new(&path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(meta) = entry.metadata() {
                let size = meta.len();
                if size > 0 {
                    size_groups.entry(size).or_default().push(entry.path().to_path_buf());
                }
            }
        }
    }
    
    // 2. For groups with >1 file, hash and group by hash
    let mut hash_groups: HashMap<String, Vec<FileEntry>> = HashMap::new();
    
    for (size, paths) in size_groups {
        if paths.len() > 1 {
            for p in paths {
                // Stream file in 8KB chunks instead of loading entire file into RAM.
                // Previously fs::read(&p) would OOM on large files.
                if let Ok(file) = fs::File::open(&p) {
                    let mut reader = BufReader::new(file);
                    let mut hasher = Sha256::new();
                    let mut buf = [0u8; 8192];
                    let mut ok = true;
                    loop {
                        match reader.read(&mut buf) {
                            Ok(0) => break,
                            Ok(n) => hasher.update(&buf[..n]),
                            Err(_) => { ok = false; break; }
                        }
                    }
                    if !ok { continue; }
                    let hash = hex::encode(hasher.finalize());
                    
                    let meta = match fs::metadata(&p) {
                        Ok(m) => m,
                        Err(_) => continue,
                    };
                    let created = meta.created().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs());
                    let modified = meta.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs());
                    let accessed = meta.accessed().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs());

                    hash_groups.entry(hash).or_default().push(FileEntry {
                        name: p.file_name().unwrap().to_string_lossy().into_owned(),
                        path: p.to_string_lossy().into_owned(),
                        is_dir: false,
                        size,
                        extension: p.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default(),
                        created_at: created,
                        modified_at: modified,
                        accessed_at: accessed,
                        is_hidden: false,
                    });
                }
            }
        }
    }
    
    // 3. Convert to result format
    let result: Vec<DuplicateGroup> = hash_groups.into_iter()
        .filter(|(_, files)| files.len() > 1)
        .map(|(hash, files)| {
            let size = files[0].size;
            DuplicateGroup { hash, files, size }
        })
        .collect();
        
    Ok(result)
}
