import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { QRCodeSVG } from 'qrcode.react';
import './ServerPanel.css';

interface ServerConfig {
  server_type: 'http' | 'https' | 'lan' | 'upnp';
  share_path: string;
  port: number;
  allow_upload: boolean;
  allow_delete: boolean;
  enable_discovery: boolean;
  hostname?: string;
}

interface ServerStatus {
  running: boolean;
  server_type: string;
  local_ip: string;
  port: number;
  hostname: string;
  local_url: string;
  hostname_url: string;
  external_url: string | null;
  upnp_mapped: boolean;
  share_path: string;
  files_count: number;
  bytes_sent: number;
  bytes_received: number;
  disk_total: number;
  disk_free: number;
  connected_devices: Device[];
}

interface Device {
  hostname: string;
  ip: string;
  port: number;
  server_type: string;
  discovered_at: string;
}

interface ServerTypeInfo {
  id: string;
  label: string;
  description: string;
  defaultPort: number;
  icon: string;
}

const SERVER_TYPES: ServerTypeInfo[] = [
  {
    id: 'http',
    label: 'HTTP',
    description: 'Standard web server. Works in any browser. Best for most uses.',
    defaultPort: 8080,
    icon: '🌐',
  },
  {
    id: 'https',
    label: 'HTTPS (Secure)',
    description: 'Encrypted web server. Self-signed cert. Secure local transfers.',
    defaultPort: 8443,
    icon: '🔒',
  },
  {
    id: 'lan',
    label: 'LAN (TCP — Fastest)',
    description: 'Raw TCP protocol. Maximum speed. Both devices need NexExplorer.',
    defaultPort: 9090,
    icon: '⚡',
  },
  {
    id: 'upnp',
    label: 'UPnP (Remote Access)',
    description: 'HTTP + automatic port forwarding. Accessible from the internet.',
    defaultPort: 8080,
    icon: '📡',
  },
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function ServerPanel() {
  const [selectedType, setSelectedType] = useState<string>('http');
  const [sharePath, setSharePath] = useState<string>('');
  const [port, setPort] = useState<number>(8080);
  const [allowUpload, setAllowUpload] = useState(true);
  const [allowDelete, setAllowDelete] = useState(false);
  const [enableDiscovery, setEnableDiscovery] = useState(true);

  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [, setPrevStats] = useState<{ sent: number, recv: number, time: number } | null>(null);
  const [speed, setSpeed] = useState<{ sent: number, recv: number }>({ sent: 0, recv: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  // Refresh status periodically
  const refreshStatus = useCallback(async () => {
    try {
      const s = await invoke<ServerStatus>('get_server_status');
      if (s.running) {
        const now = Date.now();
        setPrevStats(prev => {
          if (prev) {
            const timeDiff = (now - prev.time) / 1000; // seconds
            if (timeDiff > 0) {
              setSpeed({
                sent: Math.max(0, (s.bytes_sent - prev.sent) / timeDiff),
                recv: Math.max(0, (s.bytes_received - prev.recv) / timeDiff)
              });
            }
          }
          return { sent: s.bytes_sent, recv: s.bytes_received, time: now };
        });
        setStatus(s);
      } else {
        setStatus(null);
        setSpeed({ sent: 0, recv: 0 });
        setPrevStats(null);
      }
    } catch (e) {
      console.error('Status error:', e);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 3000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Update port when server type changes
  useEffect(() => {
    const typeInfo = SERVER_TYPES.find(t => t.id === selectedType);
    if (typeInfo) setPort(typeInfo.defaultPort);
  }, [selectedType]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const config: ServerConfig = {
        server_type: selectedType as any,
        share_path: sharePath,
        port,
        allow_upload: allowUpload,
        allow_delete: allowDelete,
        enable_discovery: enableDiscovery,
      };
      const result = await invoke<ServerStatus>('start_server', { config });
      setStatus(result);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    setError(null);
    try {
      await invoke('stop_server');
      setStatus(null);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const found = await invoke<Device[]>('discover_devices', { timeoutSecs: 5 });
      setDevices(found);
    } catch (e) {
      console.error('Discovery error:', e);
    } finally {
      setDiscovering(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const isRunning = status?.running ?? false;
  const typeInfo = SERVER_TYPES.find(t => t.id === selectedType);
  const [selectedQRType, setSelectedQRType] = useState<'local' | 'hostname' | 'external'>('local');

  const qrValue = status ? (
    selectedQRType === 'external' && status.external_url ? status.external_url :
    selectedQRType === 'hostname' ? status.hostname_url :
    status.local_url
  ) : '';

  return (
    <div className="server-panel">
      {/* Header */}
      <div className="sp-header">
        <h2>🌐 Local Server</h2>
        <div className={`sp-status-badge ${isRunning ? 'running' : 'stopped'}`}>
          <span className="sp-status-dot" />
          {isRunning ? 'Running' : 'Stopped'}
        </div>
      </div>

      {/* Server Type Selection */}
      <div className="sp-section">
        <label className="sp-label">Server Type</label>
        <div className="sp-type-grid">
          {SERVER_TYPES.map(type => (
            <button
              key={type.id}
              className={`sp-type-card ${selectedType === type.id ? 'active' : ''}`}
              onClick={() => setSelectedType(type.id)}
              disabled={isRunning}
            >
              <span className="sp-type-icon">{type.icon}</span>
              <span className="sp-type-name">{type.label}</span>
            </button>
          ))}
        </div>
        {typeInfo && (
          <p className="sp-type-desc">{typeInfo.description}</p>
        )}
      </div>

      {/* Configuration */}
      <div className="sp-section">
        <label className="sp-label">Share Path</label>
        <input
          type="text"
          className="sp-input"
          value={sharePath}
          onChange={e => setSharePath(e.target.value)}
          placeholder="C:\Users\User\Downloads"
          disabled={isRunning}
        />

        <label className="sp-label">Port</label>
        <input
          type="number"
          className="sp-input sp-port-input"
          value={port}
          onChange={e => setPort(parseInt(e.target.value) || 8080)}
          min={1024}
          max={65535}
          disabled={isRunning}
        />

        <div className="sp-toggles">
          <label className="sp-toggle">
            <input
              type="checkbox"
              checked={allowUpload}
              onChange={e => setAllowUpload(e.target.checked)}
              disabled={isRunning}
            />
            <span>Allow Upload</span>
          </label>
          <label className="sp-toggle">
            <input
              type="checkbox"
              checked={allowDelete}
              onChange={e => setAllowDelete(e.target.checked)}
              disabled={isRunning}
            />
            <span>Allow Delete</span>
          </label>
          <label className="sp-toggle">
            <input
              type="checkbox"
              checked={enableDiscovery}
              onChange={e => setEnableDiscovery(e.target.checked)}
              disabled={isRunning}
            />
            <span>Auto Discovery</span>
          </label>
        </div>
      </div>

      {/* Start/Stop Buttons */}
      <div className="sp-actions">
        {!isRunning ? (
          <button
            className="sp-btn sp-btn-start"
            onClick={handleStart}
            disabled={loading || !sharePath}
          >
            {loading ? '⏳ Starting...' : '▶ Start Server'}
          </button>
        ) : (
          <button
            className="sp-btn sp-btn-stop"
            onClick={handleStop}
            disabled={loading}
          >
            {loading ? '⏳ Stopping...' : '■ Stop Server'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="sp-error">
          ❌ {error}
        </div>
      )}

      {/* Running Server Info */}
      {isRunning && status && (
        <div className="sp-section sp-server-info">
          <h3>📡 Server Info</h3>

          <div className="sp-server-info-layout">
            <div className="sp-info-grid">
              <div className="sp-info-item">
                <span className="sp-info-label">Local URL</span>
                <span className="sp-info-value sp-url" onClick={() => copyToClipboard(status.local_url)} title="Copy URL">
                  <span className="sp-url-text">{status.local_url}</span>
                  <span className="sp-copy-icon">📋</span>
                </span>
              </div>
              <div className="sp-info-item">
                <span className="sp-info-label">Hostname</span>
                <span className="sp-info-value sp-url" onClick={() => copyToClipboard(status.hostname_url)} title="Copy URL">
                  <span className="sp-url-text">{status.hostname_url}</span>
                  <span className="sp-copy-icon">📋</span>
                </span>
              </div>
              {status.external_url && (
                <div className="sp-info-item sp-upnp-info">
                  <span className="sp-info-label">External URL (UPnP)</span>
                  <span className="sp-info-value sp-url" onClick={() => copyToClipboard(status.external_url!)} title="Copy URL">
                    <span className="sp-url-text">{status.external_url}</span>
                    <span className="sp-copy-icon">📋</span>
                  </span>
                </div>
              )}
              
              <div className="sp-info-item sp-storage-item">
                <span className="sp-info-label">Storage Usage</span>
                <div className="sp-storage-container">
                  <span className="sp-storage-value">
                    {formatBytes(status.disk_total - status.disk_free)} / {formatBytes(status.disk_total)}
                  </span>
                  <span className="sp-storage-free">
                    {formatBytes(status.disk_free)} free space
                  </span>
                </div>
              </div>

              <div className="sp-info-item">
                <span className="sp-info-label">Live Traffic</span>
                <div className="sp-traffic-container">
                  <div className="sp-traffic-sent">
                    <span>↑ {formatBytes(status.bytes_sent)}</span>
                    <span className="sp-traffic-speed">({formatBytes(speed.sent)}/s)</span>
                  </div>
                  <div className="sp-traffic-recv">
                    <span>↓ {formatBytes(status.bytes_received)}</span>
                    <span className="sp-traffic-speed">({formatBytes(speed.recv)}/s)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Dynamic QR Code Card Section */}
            <div className="sp-qr-section">
              <span className="sp-qr-header-label">📱 Scan QR to Connect</span>
              <div className="sp-qr-tabs">
                <button
                  className={`sp-qr-tab-btn ${selectedQRType === 'local' ? 'active' : ''}`}
                  onClick={() => setSelectedQRType('local')}
                >
                  Local IP
                </button>
                <button
                  className={`sp-qr-tab-btn ${selectedQRType === 'hostname' ? 'active' : ''}`}
                  onClick={() => setSelectedQRType('hostname')}
                >
                  Hostname
                </button>
                {status.external_url && (
                  <button
                    className={`sp-qr-tab-btn ${selectedQRType === 'external' ? 'active' : ''}`}
                    onClick={() => setSelectedQRType('external')}
                  >
                    UPnP External
                  </button>
                )}
              </div>

              <div className="sp-qr-card">
                <QRCodeSVG value={qrValue} size={150} marginSize={2} />
              </div>

              <div className="sp-qr-url-badge" onClick={() => copyToClipboard(qrValue)} title="Copy URL">
                <span className="sp-qr-url-text">{qrValue}</span>
                <span className="sp-qr-copy-icon">📋</span>
              </div>
            </div>
          </div>

          {/* Quick QR hint */}
          <div className="sp-hint">
            💡 Scan the QR Code or open <strong>{qrValue}</strong> in any network device's browser to browse, send, and receive files instantly!
          </div>
        </div>
      )}



      {/* Device Discovery */}
      <div className="sp-section">
        <div className="sp-discovery-header">
          <h3>🔍 Discovered Devices</h3>
          <button
            className="sp-btn sp-btn-sm"
            onClick={handleDiscover}
            disabled={discovering}
          >
            {discovering ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {devices.length === 0 ? (
          <p className="sp-empty">No devices found. Click Scan to discover NexExplorer instances.</p>
        ) : (
          <div className="sp-device-list">
            {devices.map((device, i) => (
              <div key={i} className="sp-device-item">
                <span className="sp-device-icon">
                  {device.hostname.includes('android') || device.hostname.includes('redmi')
                    ? '📱' : '💻'}
                </span>
                <div className="sp-device-info">
                  <span className="sp-device-name">{device.hostname}</span>
                  <span className="sp-device-url">
                    http://{device.ip}:{device.port}
                  </span>
                </div>
                <button
                  className="sp-btn sp-btn-sm"
                  onClick={() => copyToClipboard(`http://${device.ip}:${device.port}`)}
                >
                  📋
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
