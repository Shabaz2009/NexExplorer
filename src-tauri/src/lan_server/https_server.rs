use axum::Router;
use axum::routing::{delete, get, post};
use axum_server::tls_rustls::RustlsConfig;
use rcgen::{CertificateParams, DistinguishedName, KeyPair};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::oneshot;

use super::config::*;
use super::errors::*;
use super::http_server::{self, HttpState};

/// Generate self-signed TLS certificate
fn generate_cert(hostname: &str) -> ServerResult<(String, String)> {
    let mut params = CertificateParams::default();
    let mut dn = DistinguishedName::new();
    dn.push(rcgen::DnType::CommonName, hostname);
    params.distinguished_name = dn;
    params
        .subject_alt_names
        .push(rcgen::SanType::DnsName(hostname.to_string()));
    params
        .subject_alt_names
        .push(rcgen::SanType::IpAddress("127.0.0.1".parse().unwrap()));

    let key_pair = KeyPair::generate()
        .map_err(|e| ServerError::Tls(format!("Key generation: {}", e)))?;
    let cert = params
        .self_signed(&key_pair)
        .map_err(|e| ServerError::Tls(format!("Cert signing: {}", e)))?;

    Ok((cert.pem(), key_pair.serialize_pem()))
}

/// Start HTTPS server with auto-generated self-signed certificate
pub async fn start_https_server(
    config: &ServerConfig,
    hostname: &str,
) -> ServerResult<(oneshot::Sender<()>, u16)> {
    let port = config.port;
    let share_path = config.share_path.clone();

    if !share_path.exists() {
        return Err(ServerError::InvalidSharePath(share_path.display().to_string()));
    }

    // Generate self-signed certificate
    let (cert_pem, key_pem) = generate_cert(hostname)?;

    // Write cert and key to temp files (axum-server needs file paths)
    let temp_dir = std::env::temp_dir().join("nexexplorer_tls");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let cert_path = temp_dir.join("cert.pem");
    let key_path = temp_dir.join("key.pem");
    tokio::fs::write(&cert_path, &cert_pem).await?;
    tokio::fs::write(&key_path, &key_pem).await?;

    let tls_config = RustlsConfig::from_pem_file(cert_path, key_path)
        .await
        .map_err(|e| ServerError::Tls(format!("TLS config: {}", e)))?;

    let state = HttpState {
        share_path: share_path.clone(),
        hostname: hostname.to_string(),
        allow_upload: config.allow_upload,
        allow_delete: config.allow_delete,
        bytes_sent: Arc::new(std::sync::atomic::AtomicU64::new(0)),
    };

    let app = Router::new()
        .route("/", get(http_server::root_handler))
        .route("/api/info", get(http_server::info_handler))
        .route("/api/files", get(http_server::list_handler))
        .route("/api/download/*path", get(http_server::download_handler))
        .route("/api/upload", post(http_server::upload_handler))
        .route("/api/delete/*path", delete(http_server::delete_handler))
        .route("/api/mkdir", post(http_server::mkdir_handler))
        .route("/api/rename", post(http_server::rename_handler))
        .layer(tower_http::cors::CorsLayer::permissive())
        .with_state(state);

    let (tx, rx) = oneshot::channel::<()>();

    tokio::spawn(async move {
        axum_server::bind_rustls(format!("0.0.0.0:{}", port), tls_config)
            .serve(app.into_make_service())
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await
            .ok();
    });

    Ok((tx, port))
}
