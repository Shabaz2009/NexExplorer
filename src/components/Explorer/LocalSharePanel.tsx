import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Wifi, Send, Smartphone, Monitor, Laptop, Tablet, RefreshCw } from 'lucide-react';

interface Device {
  ip: string;
  version: string;
  port: number;
  https: boolean;
  fingerprint: string;
  alias: string;
  device_model: string | null;
  device_type: string;
  download: boolean;
}

interface TransferProgress {
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
}

const getDeviceIcon = (type_: string) => {
  switch (type_) {
    case 'mobile': return <Smartphone size={20} />;
    case 'tablet': return <Tablet size={20} />;
    case 'laptop': return <Laptop size={20} />;
    default: return <Monitor size={20} />;
  }
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const LocalSharePanel: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);

  useEffect(() => {
    // Listen for discovered devices
    const unlisten = listen<Device>('device-discovered', (event) => {
      setDevices(prev => {
        const exists = prev.find(d => d.fingerprint === event.payload.fingerprint);
        if (exists) return prev;
        return [...prev, event.payload];
      });
    });

    // Listen for transfer progress
    const unlistenProgress = listen<TransferProgress>('file-transfer-progress', (event) => {
      setTransfers(prev => {
        const idx = prev.findIndex(t => t.fileName === event.payload.fileName);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = event.payload;
          return updated;
        }
        return [...prev, event.payload];
      });
    });

    // Listen for transfer completion
    const unlistenComplete = listen<string>('file-transfer-complete', (event) => {
      setTransfers(prev => prev.filter(t => t.fileName !== event.payload));
    });

    return () => {
      unlisten.then(fn => fn());
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
    };
  }, []);

  const startScanning = async () => {
    setIsScanning(true);
    try {
      await invoke('start_discovery');
      await invoke('send_multicast_announcement');
    } catch (e) {
      console.error('Discovery failed:', e);
    }
    setTimeout(() => setIsScanning(false), 5000);
  };

  const sendToDevice = async (device: Device) => {
    // TODO: Open file picker dialog and send selected file
    console.log('Send to device:', device.alias, device.ip);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-text-primary bg-bg-primary overflow-auto">
      <div className="max-w-2xl w-full text-center mb-10">
        <div className="w-20 h-20 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-5">
          <Wifi size={40} strokeWidth={1.5} />
        </div>
        <h1 className="text-2xl font-light mb-3">LocalShare</h1>
        <p className="text-text-secondary text-sm">
          Discover and transfer files securely across your local network via UDP multicast (port 53317).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6 w-full max-w-3xl">
        {/* Nearby Devices */}
        <div className="bg-bg-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Nearby Devices</h3>
            <button 
              onClick={startScanning}
              className={`p-1.5 rounded-md hover:bg-bg-hover transition-colors ${isScanning ? 'animate-spin text-accent' : 'text-text-secondary'}`}
            >
              <RefreshCw size={16} />
            </button>
          </div>
          
          <div className="space-y-2 min-h-[120px]">
            {devices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
                <Wifi size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No devices found</p>
                <button 
                  onClick={startScanning}
                  className="mt-3 px-4 py-1.5 bg-accent text-white rounded text-sm hover:bg-accent-hover transition-colors"
                >
                  Start Scanning
                </button>
              </div>
            ) : (
              devices.map((device) => (
                <div 
                  key={device.fingerprint}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-bg-hover cursor-pointer border border-transparent hover:border-border transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-success/10 text-success rounded-full flex items-center justify-center">
                      {getDeviceIcon(device.device_type)}
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-sm">{device.alias}</div>
                      <div className="text-xs text-text-secondary">{device.ip}:{device.port}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => sendToDevice(device)}
                    className="px-3 py-1.5 bg-accent text-white rounded text-xs hover:bg-accent-hover transition-colors flex items-center gap-1.5"
                  >
                    <Send size={12} /> Send
                  </button>
                </div>
              ))
            )}
          </div>

          {isScanning && (
            <div className="mt-4 flex justify-center">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                Scanning for devices...
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4">
          {/* Your Device */}
          <div className="bg-bg-secondary border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Your Device</h3>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent/20 text-accent rounded-full flex items-center justify-center text-sm font-bold">
                N
              </div>
              <div>
                <div className="font-medium text-sm">NexExplorer</div>
                <div className="text-xs text-text-secondary">Protocol v{PROTOCOL_VERSION}</div>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm">Discoverable</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isDiscoverable}
                    onChange={() => setIsDiscoverable(!isDiscoverable)}
                  />
                  <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Active Transfers */}
          {transfers.length > 0 && (
            <div className="bg-bg-secondary border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-3">Transfers</h3>
              <div className="space-y-3">
                {transfers.map((t) => (
                  <div key={t.fileName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate">{t.fileName}</span>
                      <span className="text-text-secondary">{t.percent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-bg-hover rounded-full h-1.5">
                      <div 
                        className="bg-accent h-1.5 rounded-full transition-all"
                        style={{ width: `${t.percent}%` }}
                      />
                    </div>
                    <div className="text-xs text-text-secondary">
                      {formatBytes(t.bytesTransferred)} / {formatBytes(t.totalBytes)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PROTOCOL_VERSION = '2.1';

export default LocalSharePanel;
