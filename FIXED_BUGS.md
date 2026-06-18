# Bug Fixes — June 16, 2026

## Build Compilation Errors Fixed

### Overview
Fixed 8 critical Rust compilation errors that were preventing the GitHub Actions build from succeeding. All errors were in the LAN server module and related dependencies.

---

## Fixed Errors

### 1. Missing Axum Multipart Feature
**File:** `src-tauri/Cargo.toml`  
**Error:** `unresolved import 'axum::extract::Multipart'`  
**Fix:** Enabled the `multipart` feature flag for axum dependency
```toml
axum = { version = "0.7", features = ["multipart"] }
```

### 2. FileEntry Type Not in Scope
**File:** `src-tauri/src/commands/tools.rs`  
**Error:** `cannot find type 'FileEntry' in this scope`  
**Fix:** Used fully qualified path for FileEntry in DuplicateGroup struct
```rust
pub files: Vec<super::file_ops::FileEntry>,
```

### 3. Borrow of Moved Value
**File:** `src-tauri/src/lan_server/manager.rs`  
**Error:** `borrow of moved value: 'external_url'`  
**Fix:** Computed `upnp_mapped` before moving `external_url` into the struct
```rust
let upnp_mapped = external_url.is_some();
// Then use both values in ServerStatus initialization
```

### 4. Missing Struct Field
**File:** `src-tauri/src/lan_server/https_server.rs`  
**Error:** `missing field 'bytes_received' in initializer of 'HttpState'`  
**Fix:** Added the missing `bytes_received` field initialization
```rust
bytes_received: Arc::new(std::sync::atomic::AtomicU64::new(0)),
```

### 5. Type Mismatch — SocketAddr Expected
**File:** `src-tauri/src/lan_server/https_server.rs`  
**Error:** `expected 'SocketAddr', found 'String'`  
**Fix:** 
- Added `use std::net::SocketAddr;` import
- Parsed the address string to SocketAddr
```rust
let addr: SocketAddr = format!("0.0.0.0:{}", port).parse().unwrap();
axum_server::bind_rustls(addr, tls_config)
```

### 6. Missing Graceful Shutdown Method
**File:** `src-tauri/src/lan_server/https_server.rs`  
**Error:** `no method named 'with_graceful_shutdown' found`  
**Fix:** Replaced chained method with Handle-based graceful shutdown pattern
```rust
let handle = axum_server::Handle::new();
let handle_clone = handle.clone();

tokio::spawn(async move {
    let _ = rx.await;
    handle_clone.graceful_shutdown(Some(std::time::Duration::from_secs(5)));
});

axum_server::bind_rustls(addr, tls_config)
    .handle(handle)
    .serve(app.into_make_service())
    .await
```

### 7. rcgen API Type Change
**File:** `src-tauri/src/lan_server/https_server.rs`  
**Error:** `expected 'Ia5String', found 'String'`  
**Fix:** Wrapped hostname string with `Ia5String::try_from()` for rcgen 0.13 compatibility
```rust
params
    .subject_alt_names
    .push(rcgen::SanType::DnsName(
        rcgen::Ia5String::try_from(hostname.to_string())
            .map_err(|e| ServerError::Tls(format!("Invalid hostname for SAN: {}", e)))?,
    ));
```

### 8. Cannot Move Out of Shared Reference
**File:** `src-tauri/src/lan_server/discovery.rs`  
**Error:** `cannot move out of a shared reference`  
**Fix:** Replaced `.ok_or_else()` with pattern matching on `Arc<Option<_>>`
```rust
let mdns = match self.mdns.as_ref() {
    Some(d) => d,
    None => return Err(ServerError::Network("mDNS not available".into())),
};
```

---

## Warnings Remaining
16 compiler warnings remain (unused imports, unused variables, unused `mut`). These are non-critical and don't prevent compilation:
- Unused imports in `localsend.rs`, `http_server.rs`, `https_server.rs`, `tcp_server.rs`, `discovery.rs`, `commands.rs`, `mod.rs`
- Unused variables in `file_ops.rs`, `localsend.rs`, `manager.rs`, `tcp_server.rs`
- Unused `mut` in `tcp_server.rs`

These can be cleaned up in a future refactor but don't affect functionality.

---

## Build Status
✅ **All compilation errors resolved**  
✅ **Project should now build successfully on GitHub Actions**  
⚠️ **16 warnings remain (non-blocking)**

---

## Testing
To verify the fixes locally:
```bash
npm install
npm run tauri build
```

The build should complete successfully and generate executables in `src-tauri/target/release/`.

---

**Fixed by:** Kiro AI Assistant  
**Date:** June 16, 2026  
**Affected Module:** LAN Server (HTTP/HTTPS/Discovery)
