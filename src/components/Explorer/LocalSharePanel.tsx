import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Wifi, Send, Smartphone, Monitor, Laptop, Tablet, RefreshCw, Shield, Globe, CheckCircle2, Server, FolderInput, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import ServerPanel from '../LocalShare/ServerPanel';
import { useLocalShareStore, TrustedDevice } from '../../store/localShareStore';
import { useExplorerStore } from '../../store/explorerStore';

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
  speed?: number;
  lastUpdate?: number;
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
  const [activeTab, setActiveTab] = useState<'localsend' | 'server'>('localsend');
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscoverable, setIsDiscoverable] = useState(true);
  const [isAutoAccept, setIsAutoAccept] = useState(false);
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [defaultUsbPath, setDefaultUsbPath] = useState<string>('C:\\Users\\User\\Downloads'); // Can be expanded to use Tauri path API

  const { trustedDevices, addTrustedDevice } = useLocalShareStore();
  const { navigateTo } = useExplorerStore();

  useEffect(() => {
    // Auto-scan on mount
    startScanning();

    const unlisten = listen<Device>('device-discovered', (event) => {
      setDevices(prev => {
        const exists = prev.find(d => d.fingerprint === event.payload.fingerprint);
        if (exists) return prev;
        
        // Auto-save discovered devices to trusted store
        addTrustedDevice({
          ip: event.payload.ip,
          alias: event.payload.alias,
          port: event.payload.port,
          device_type: event.payload.device_type,
          fingerprint: event.payload.fingerprint,
        });

        return [...prev, event.payload];
      });
    });

    const unlistenProgress = listen<TransferProgress>('file-transfer-progress', (event) => {
      const now = Date.now();
      setTransfers(prev => {
        const idx = prev.findIndex(t => t.fileName === event.payload.fileName);
        if (idx >= 0) {
          const old = prev[idx];
          const timeDiff = (now - (old.lastUpdate || now)) / 1000;
          let newSpeed = old.speed || 0;
          
          if (timeDiff > 0.5) { // update speed every 0.5s to avoid jitter
            newSpeed = (event.payload.bytesTransferred - old.bytesTransferred) / timeDiff;
          }
          
          const updated = [...prev];
          updated[idx] = { 
            ...event.payload, 
            speed: timeDiff > 0.5 ? newSpeed : old.speed, 
            lastUpdate: timeDiff > 0.5 ? now : old.lastUpdate 
          };
          return updated;
        }
        return [...prev, { ...event.payload, speed: 0, lastUpdate: now }];
      });
    });

    const unlistenComplete = listen<string>('file-transfer-complete', (event) => {
      setTransfers(prev => prev.filter(t => t.fileName !== event.payload));
    });

    const unlistenRequest = listen<any>('receive-request', (event) => {
      if (!isAutoAccept) {
        setPendingRequests(prev => [...prev, event.payload]);
      }
    });

    return () => {
      unlisten.then(fn => fn());
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
      unlistenRequest.then(fn => fn());
    };
  }, [isAutoAccept, addTrustedDevice]);

  const startScanning = async () => {
    setIsScanning(true);
    setDevices([]);
    try {
      await invoke('start_discovery');
      await invoke('send_multicast_announcement');
    } catch (e) {
      console.error('Discovery failed:', e);
    }
    setTimeout(() => setIsScanning(false), 5000);
  };

  const sendToDevice = async (device: Device | TrustedDevice) => {
    try {
      const selected = await invoke<string[]>('plugin:dialog|open', {
        multiple: true,
        title: `Send to ${device.alias}`,
      });
      
      if (selected && selected.length > 0) {
        for (const path of selected) {
          await invoke('send_file_to_device', { 
            filePath: path, 
            targetIp: device.ip, 
            targetPort: device.port 
          });
        }
      }
    } catch (e) {
      console.error('Send failed:', e);
    }
  };

  const sendToUsb = async () => {
    try {
      const selected = await invoke<string[]>('plugin:dialog|open', {
        multiple: true,
        title: `Send to Local Folder / USB`,
      });
      
      if (selected && selected.length > 0) {
        // Fast copy with progress events
        await invoke('usb_fast_copy', { 
          sourcePaths: selected, 
          destDir: defaultUsbPath 
        });
      }
    } catch (e) {
      console.error('USB copy failed:', e);
    }
  };

  const changeUsbPath = async () => {
    try {
      const selected = await invoke<string | null>('plugin:dialog|open', {
        directory: true,
        multiple: false,
        title: 'Select Default USB / Local Folder',
        defaultPath: defaultUsbPath,
      });
      if (selected) {
        setDefaultUsbPath(selected);
      }
    } catch (e) {
      console.error('Failed to change path:', e);
    }
  };

  const browseDevice = (device: Device | TrustedDevice) => {
    // Assuming the remote device is running the NexExplorer LAN server on port 8080
    navigateTo(`http://${device.ip}:8080`);
  };

  // const localIP = devices.length > 0 ? "192.168.x.x" : "Not connected"; // Ideally fetch from Tauri command get_local_ip

  return (
    <div className="w-full h-full flex flex-col items-center justify-start p-10 overflow-y-auto custom-scrollbar bg-bg-primary/50">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-6 cursor-pointer group" onClick={() => setShowQR(!showQR)}>
            <div className="w-24 h-24 bg-accent/10 text-accent rounded-3xl flex items-center justify-center shadow-2xl shadow-accent/20 border border-accent/20 rotate-3 transition-transform group-hover:scale-105 group-hover:-rotate-3">
              {showQR ? <QrCode size={44} strokeWidth={1.5} /> : <Wifi size={44} strokeWidth={1.5} className="animate-pulse" />}
            </div>
            <div className="absolute -bottom-3 -right-3 bg-bg-tertiary border border-border p-1 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[9px] font-bold px-1 text-text-muted">TAP FOR QR</span>
            </div>
          </div>
          
          <AnimatePresence>
            {showQR && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
              >
                <QRCodeSVG value={`nex://connect`} size={150} />
                <p className="text-[10px] text-black mt-2 font-bold uppercase tracking-wider">Scan to Connect</p>
              </motion.div>
            )}
          </AnimatePresence>

          <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3">LocalShare</h1>
          
          {/* Tab Switcher */}
          <div className="flex bg-bg-tertiary p-1 rounded-2xl border border-border/50 mt-4">
            <button 
              onClick={() => setActiveTab('localsend')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'localsend' 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Wifi size={14} /> LOCALSEND
            </button>
            <button 
              onClick={() => setActiveTab('server')}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'server' 
                  ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Server size={14} /> DIRECT SERVER
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'localsend' ? (
            <motion.div
              key="localsend"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Nearby Devices */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                    <Smartphone size={14} className="text-accent" /> Network Devices
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const ip = prompt('Enter manual IP:');
                        if (ip) {
                          sendToDevice({ ip, port: 53317, alias: 'Manual Device', fingerprint: '', version: '2.1', https: false, device_type: 'desktop', device_model: '', download: true });
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border/50 interactive transition-all"
                    >
                      <Globe size={12} />
                      IP
                    </button>
                    <button 
                      onClick={startScanning}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                        isScanning 
                          ? 'bg-accent/20 text-accent cursor-default' 
                          : 'bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 interactive'
                      }`}
                    >
                      <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} />
                      {isScanning ? 'SCANNING' : 'SCAN'}
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[300px] content-start">
                  <AnimatePresence mode="popLayout">
                    {/* Static USB/Local Folder Transfer Card */}
                    <motion.div 
                      key="local-usb-transfer"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="group flex flex-col p-4 glass-card rounded-2xl border-accent/30 bg-accent/[0.03] transition-all hover:bg-accent/10 hover:border-accent/60"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-colors bg-accent/20 text-accent group-hover:bg-accent group-hover:text-white">
                            <FolderInput size={20} />
                          </div>
                          <div className="text-left w-full overflow-hidden">
                            <div className="font-bold text-[13px] text-text-primary group-hover:text-accent transition-colors">Local USB / Folder</div>
                            <div className="text-[10px] font-mono text-text-muted opacity-80 mt-0.5 truncate max-w-[120px]" title={defaultUsbPath}>{defaultUsbPath}</div>
                          </div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" title="Ready" />
                      </div>
                      
                      <div className="flex gap-2 w-full mt-auto pt-2 border-t border-accent/20">
                        <button 
                          onClick={sendToUsb}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent-hover transition-colors"
                        >
                          <Send size={10} /> SEND
                        </button>
                        <button 
                          onClick={changeUsbPath}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border transition-colors"
                        >
                          CHANGE
                        </button>
                      </div>
                    </motion.div>

                    {devices.length === 0 && trustedDevices.length === 0 && !isScanning ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="col-span-full flex flex-col items-center justify-center py-10 glass-card rounded-3xl border-dashed opacity-50"
                      >
                        <Wifi size={32} className="mb-2 text-text-muted opacity-20" />
                        <p className="text-[11px] text-text-muted font-medium">No network devices found.</p>
                      </motion.div>
                    ) : (
                      // Merge live devices and trusted devices for display
                      [...new Map([...trustedDevices, ...devices].map(item => [item.ip, item])).values()].map((device, idx) => {
                        const isLive = devices.some(d => d.ip === device.ip);
                        
                        return (
                          <motion.div 
                            key={device.fingerprint || device.ip}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`group flex flex-col p-4 glass-card rounded-2xl border-border/50 transition-all ${
                              isLive ? 'hover:bg-accent/5 hover:border-accent/40' : 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-colors ${
                                  isLive ? 'bg-bg-tertiary text-accent group-hover:bg-accent group-hover:text-white' : 'bg-bg-secondary text-text-muted'
                                }`}>
                                  {getDeviceIcon(device.device_type)}
                                </div>
                                <div className="text-left">
                                  <div className={`font-bold text-[13px] transition-colors ${isLive ? 'text-text-primary group-hover:text-accent' : 'text-text-muted'}`}>
                                    {device.alias}
                                    {!isLive && <span className="ml-2 text-[9px] uppercase tracking-widest text-text-muted/50 border border-border px-1 py-0.5 rounded">Saved</span>}
                                  </div>
                                  <div className="text-[10px] font-mono text-text-muted opacity-80 mt-0.5">{device.ip}</div>
                                </div>
                              </div>
                              {isLive && (
                                <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Online" />
                              )}
                            </div>
                            
                            <div className="flex gap-2 w-full mt-auto pt-2 border-t border-border/30">
                              <button 
                                onClick={() => sendToDevice(device as any)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold bg-accent/10 hover:bg-accent text-accent hover:text-white transition-colors"
                              >
                                <Send size={10} /> SEND
                              </button>
                              <button 
                                onClick={() => browseDevice(device as any)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold bg-bg-tertiary hover:bg-bg-hover text-text-primary border border-border transition-colors"
                                title="Browse Device Storage (Requires NexExplorer LAN Server)"
                              >
                                <FolderInput size={10} /> BROWSE
                              </button>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Pending Requests */}
                <AnimatePresence>
                  {pendingRequests.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="glass-card rounded-3xl p-6 border-accent/50 bg-bg-tertiary shadow-lg shadow-accent/10"
                    >
                      <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <Shield size={14} className="text-amber-500 animate-pulse" /> Pending Transfers
                      </h3>
                      <div className="space-y-4">
                        {pendingRequests.map((req) => (
                          <div key={req.sessionId} className="space-y-2 bg-bg-primary/50 p-3 rounded-xl border border-border">
                            <div className="text-[12px] font-bold text-text-primary">
                              <span className="text-accent">{req.device}</span> wants to send files
                            </div>
                            <div className="text-[10px] text-text-muted">{Object.keys(req.files).length} file(s)</div>
                            <div className="flex gap-2 mt-2">
                              <button 
                                onClick={() => {
                                  setPendingRequests(prev => prev.filter(r => r.sessionId !== req.sessionId));
                                }}
                                className="flex-1 bg-success/20 text-success hover:bg-success hover:text-white transition-colors py-1 rounded text-[11px] font-bold"
                              >
                                ACCEPT
                              </button>
                              <button 
                                onClick={() => {
                                  setPendingRequests(prev => prev.filter(r => r.sessionId !== req.sessionId));
                                }}
                                className="flex-1 bg-error/20 text-error hover:bg-error hover:text-white transition-colors py-1 rounded text-[11px] font-bold"
                              >
                                REJECT
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Status Card */}
                <div className="glass-card rounded-3xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-accent/10 transition-colors" />
                  
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-6">Status</h3>
                  
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 bg-accent/20 text-accent rounded-2xl flex items-center justify-center text-lg font-black border border-accent/20">
                      N
                    </div>
                    <div>
                      <div className="font-bold text-[15px] text-text-primary">NexExplorer</div>
                      <div className="text-[11px] text-text-muted font-medium">This Computer</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-bg-primary/40 rounded-xl border border-border/30">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-accent" />
                        <span className="text-xs font-semibold">Discoverable</span>
                      </div>
                      <button
                        onClick={() => setIsDiscoverable(!isDiscoverable)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                          isDiscoverable ? 'bg-accent shadow-lg shadow-accent/20' : 'bg-bg-tertiary border border-border'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                          isDiscoverable ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-bg-primary/40 rounded-xl border border-border/30">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-success" />
                        <span className="text-xs font-semibold">Auto-Accept</span>
                      </div>
                      <button
                        onClick={() => setIsAutoAccept(!isAutoAccept)}
                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                          isAutoAccept ? 'bg-success shadow-lg shadow-success/20' : 'bg-bg-tertiary border border-border'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                          isAutoAccept ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Active Transfers */}
                <AnimatePresence>
                  {transfers.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="glass-card rounded-3xl p-6 border-accent/20 bg-accent/[0.02]"
                    >
                      <h3 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" /> Active Transfers
                      </h3>
                      <div className="space-y-5">
                        {transfers.map((t) => (
                          <div key={t.fileName} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold truncate max-w-[150px] text-text-primary">{t.fileName}</span>
                              <span className="text-[10px] font-black text-accent">{t.percent.toFixed(0)}%</span>
                            </div>
                            <div className="w-full bg-bg-tertiary rounded-full h-1.5 overflow-hidden border border-white/5">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${t.percent}%` }}
                                className="bg-accent h-full rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-text-muted font-mono uppercase tracking-tight">
                              <span>{formatBytes(t.bytesTransferred)} / {formatBytes(t.totalBytes)}</span>
                              <span className="text-accent">{t.speed ? `${formatBytes(t.speed)}/s` : 'Calculating...'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="server"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full flex justify-center"
            >
              <div className="glass-card rounded-3xl p-2 w-full max-w-2xl bg-bg-tertiary/30">
                <ServerPanel />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LocalSharePanel;
