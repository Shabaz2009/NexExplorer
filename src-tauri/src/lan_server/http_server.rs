use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Json, Response},
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::oneshot;
use tower_http::cors::CorsLayer;

use super::config::*;
use super::errors::*;
use super::web_ui;

/// Shared state for HTTP server
#[derive(Clone)]
pub struct HttpState {
    pub share_path: PathBuf,
    pub hostname: String,
    pub allow_upload: bool,
    pub allow_delete: bool,
    pub bytes_sent: Arc<std::sync::atomic::AtomicU64>,
    pub bytes_received: Arc<std::sync::atomic::AtomicU64>,
}


/// Query parameters for file listing
#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub path: Option<String>,
}

// ─── Start HTTP Server ──────────────────────────────────

pub async fn start_http_server(
    config: &ServerConfig,
    hostname: &str,
) -> ServerResult<(oneshot::Sender<()>, u16)> {
    let port = config.port;
    let share_path = config.share_path.clone();

    // Verify share path exists
    if !share_path.exists() {
        return Err(ServerError::InvalidSharePath(share_path.display().to_string()));
    }

    let state = HttpState {
        share_path: share_path.clone(),
        hostname: hostname.to_string(),
        allow_upload: config.allow_upload,
        allow_delete: config.allow_delete,
        bytes_sent: Arc::new(std::sync::atomic::AtomicU64::new(0)),
        bytes_received: Arc::new(std::sync::atomic::AtomicU64::new(0)),
    };

    let app = Router::new()
        .route("/", get(root_handler))
        .route("/api/info", get(info_handler))
        .route("/api/files", get(list_handler))
        .route("/api/download/*path", get(download_handler))
        .route("/api/upload", post(upload_handler))
        .route("/api/delete/*path", delete(delete_handler))
        .route("/api/mkdir", post(mkdir_handler))
        .route("/api/rename", post(rename_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    // Bind to port
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .map_err(|e| {
            if e.kind() == std::io::ErrorKind::AddrInUse {
                ServerError::PortInUse(port)
            } else {
                ServerError::Io(e)
            }
        })?;

    let (tx, rx) = oneshot::channel::<()>();

    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await
            .ok();
    });

    Ok((tx, port))
}

// ─── Route Handlers ─────────────────────────────────────

/// GET / — File browser web UI
pub async fn root_handler(State(state): State<HttpState>) -> Html<String> {
    Html(web_ui::generate_html(
        &state.hostname,
        "HTTP",
        state.allow_upload,
        state.allow_delete,
    ))
}

/// GET /api/info — Server information
pub async fn info_handler(State(state): State<HttpState>) -> Json<ServerInfoResponse> {
    Json(ServerInfoResponse {
        hostname: state.hostname.clone(),
        server_type: ServerType::Http,
        share_path: state.share_path.display().to_string(),
        allow_upload: state.allow_upload,
        allow_delete: state.allow_delete,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// GET /api/files?path=subdir — List directory contents
pub async fn list_handler(
    State(state): State<HttpState>,
    Query(query): Query<ListQuery>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let sub_path = query.path.unwrap_or_default();
    let full_path = state.share_path.join(&sub_path);

    // Security: ensure path is within share directory and exists
    let canonical = full_path
        .canonicalize()
        .map_err(|_| StatusCode::NOT_FOUND)?;
    
    let canonical_root = state
        .share_path
        .canonicalize()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // Prevent path traversal escapes
    if !canonical.starts_with(&canonical_root) {
        return Err(StatusCode::FORBIDDEN);
    }

    if !canonical.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let mut files = Vec::new();
    let mut read_dir = tokio::fs::read_dir(&canonical)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    while let Ok(Some(entry)) = read_dir.next_entry().await {
        let name_str = entry.file_name().to_string_lossy().into_owned();
        
        // Security & UX: Filter out hidden files, system files, and common build dirs
        if name_str.starts_with('.') 
            || name_str.starts_with('$')
            || name_str == "System Volume Information" 
            || name_str == "node_modules" 
            || name_str == "target" 
            || name_str.ends_with(".sys") 
            || name_str.ends_with(".tmp") {
            continue;
        }

        let metadata = match entry.metadata().await {
            Ok(m) => m,
            Err(_) => continue, // Skip files we can't read metadata for
        };

        let is_dir = metadata.is_dir();
        let size = metadata.len();
        
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| {
                chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                    .map(|dt| dt.format("%Y-%m-%d %H:%M").to_string())
                    .unwrap_or_default()
            })
            .unwrap_or_default();

        // Build the relative path for the frontend
        let relative = if sub_path.is_empty() {
            name_str.clone()
        } else {
            format!("{}/{}", sub_path, name_str)
        };

        // Determine mime type for files
        let mime_type = if !is_dir {
            mime_guess::from_path(&name_str).first().map(|m| m.to_string())
        } else {
            None
        };

        files.push(FileInfo {
            name: name_str,
            path: relative,
            is_dir,
            size,
            modified,
            mime_type,
        });
    }

    Ok(Json(serde_json::json!({ "files": files })))
}

/// GET /api/download/*path — Download a file (streaming)
pub async fn download_handler(
    State(state): State<HttpState>,
    Path(file_path): Path<String>,
) -> Result<Response, StatusCode> {
    let full_path = state.share_path.join(&file_path);

    // Security check
    let canonical = full_path
        .canonicalize()
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let canonical_root = state
        .share_path
        .canonicalize()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !canonical.starts_with(&canonical_root) {
        return Err(StatusCode::FORBIDDEN);
    }

    if !canonical.is_file() {
        return Err(StatusCode::NOT_FOUND);
    }

    let metadata = tokio::fs::metadata(&canonical)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mime_type = mime_guess::from_path(&canonical)
        .first()
        .map(|m| m.to_string())
        .unwrap_or_else(|| "application/octet-stream".to_string());

    let file = tokio::fs::File::open(&canonical)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let stream = tokio_util::io::ReaderStream::new(file);
    let body = Body::from_stream(stream);

    // Track bytes
    let size = metadata.len();
    state
        .bytes_sent
        .fetch_add(size, std::sync::atomic::Ordering::Relaxed);

    Ok((
        [
            (header::CONTENT_TYPE, mime_type),
            (
                header::CONTENT_DISPOSITION,
                format!(
                    "attachment; filename=\"{}\"",
                    canonical
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                ),
            ),
            (
                header::CONTENT_LENGTH,
                size.to_string(),
            ),
        ],
        body,
    )
        .into_response())
}

/// POST /api/upload — Upload files (multipart)
pub async fn upload_handler(
    State(state): State<HttpState>,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !state.allow_upload {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Upload is disabled" })),
        ));
    }

    let mut uploaded = Vec::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))))?
    {
        let name = field.name().unwrap_or("file").to_string();
        let filename = field
            .file_name()
            .unwrap_or("unknown")
            .to_string();

        let data = field
            .bytes()
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": e.to_string() }))))?;

        // Security: sanitize filename to prevent path traversal (e.g. "../../evil.exe")
        let safe_filename = std::path::Path::new(&filename)
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "uploaded_file".to_string());
        let dest = state.share_path.join(&safe_filename);
        tokio::fs::write(&dest, &data)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))))?;

        state.bytes_received.fetch_add(data.len() as u64, std::sync::atomic::Ordering::Relaxed);
        uploaded.push(filename);
    }

    Ok(Json(serde_json::json!({
        "uploaded": uploaded,
        "count": uploaded.len()
    })))
}

/// DELETE /api/delete/*path — Delete a file
pub async fn delete_handler(
    State(state): State<HttpState>,
    Path(file_path): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    if !state.allow_delete {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Delete is disabled" })),
        ));
    }

    let full_path = state.share_path.join(&file_path);

    let canonical = full_path
        .canonicalize()
        .map_err(|_| (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Not found" }))))?;
    let canonical_root = state
        .share_path
        .canonicalize()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))))?;

    if !canonical.starts_with(&canonical_root) {
        return Err((
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({ "error": "Access denied" })),
        ));
    }

    if canonical.is_dir() {
        tokio::fs::remove_dir_all(&canonical).await
    } else {
        tokio::fs::remove_file(&canonical).await
    }
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))))?;

    Ok(Json(serde_json::json!({ "deleted": file_path })))
}

/// POST /api/mkdir — Create directory
pub async fn mkdir_handler(
    State(state): State<HttpState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let path = body["path"].as_str().unwrap_or("");
    let name = body["name"].as_str().unwrap_or("");

    if name.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Name is required" })),
        ));
    }

    let full_path = state.share_path.join(path).join(name);

    // Security: verify new directory stays within the share root
    // We create the dir first, then canonicalize to check containment
    tokio::fs::create_dir_all(&full_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))))?;
    let canonical = full_path.canonicalize()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Path error" }))))?;
    let canonical_root = state.share_path.canonicalize()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))))?;
    if !canonical.starts_with(&canonical_root) {
        // Undo the directory creation if it escaped the share root
        let _ = tokio::fs::remove_dir(&canonical).await;
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Access denied" }))));
    }

    Ok(Json(serde_json::json!({ "created": name })))
}

/// POST /api/rename — Rename file or folder
pub async fn rename_handler(
    State(state): State<HttpState>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let from = body["from"].as_str().unwrap_or("");
    let to = body["to"].as_str().unwrap_or("");

    if from.is_empty() || to.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Both from and to are required" })),
        ));
    }

    let from_path = state.share_path.join(from);
    let to_path = state.share_path.join(to);

    // Security: verify both paths stay within the share root
    let canonical_from = from_path.canonicalize()
        .map_err(|_| (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "Source not found" }))))?;
    let canonical_root = state.share_path.canonicalize()
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": "Internal error" }))))?;
    if !canonical_from.starts_with(&canonical_root) {
        return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Access denied" }))));
    }
    // For destination, check parent exists and is within root
    if let Some(to_parent) = to_path.parent() {
        if to_parent.exists() {
            let canonical_to_parent = to_parent.canonicalize()
                .map_err(|_| (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "Invalid destination" }))))?;
            if !canonical_to_parent.starts_with(&canonical_root) {
                return Err((StatusCode::FORBIDDEN, Json(serde_json::json!({ "error": "Access denied" }))));
            }
        }
    }

    tokio::fs::rename(&from_path, &to_path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))))?;

    Ok(Json(serde_json::json!({ "renamed": to })))
}
