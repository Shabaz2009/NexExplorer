use thiserror::Error;

#[derive(Debug, Error)]
pub enum ServerError {
    #[error("Server is already running on port {0}")]
    AlreadyRunning(u16),

    #[error("Server is not running")]
    NotRunning,

    #[error("Port {0} is already in use")]
    PortInUse(u16),

    #[error("Share path does not exist: {0}")]
    InvalidSharePath(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("UPnP error: {0}")]
    Upnp(String),

    #[error("TLS/Certificate error: {0}")]
    Tls(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for ServerError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type ServerResult<T> = Result<T, ServerError>;
