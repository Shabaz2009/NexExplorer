import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Move, Trash2, X } from 'lucide-react';

interface ProgressPayload {
  type: 'copy' | 'move' | 'delete';
  current: number;
  total: number;
  name: string;
  // Optional detailed per-file progress (emitted by main process)
  copiedBytes?: number;
  totalBytes?: number;
  speed?: number; // bytes per second
  elapsed?: number; // seconds
}

const ProgressDialog: React.FC = () => {
  const [progress, setProgress] = useState<ProgressPayload | null>(null);

  useEffect(() => {
    // @ts-ignore - nex is injected via preload
    const unsubscribe = window.nex.onEvent('progress', (payload: ProgressPayload) => {
      setProgress(payload);

      // Auto-hide when complete
      if (payload.current >= payload.total) {
        setTimeout(() => setProgress(null), 1500);
      }
    });

    // Also listen for explicit complete events (main process may send them)
    // @ts-ignore
    const unsubComplete = window.nex.onEvent('progress_complete', () => {
      setTimeout(() => setProgress(null), 800);
    });

    return () => { unsubscribe(); unsubComplete && unsubComplete(); };
  }, []);

  if (!progress) return null;

  const percentage = progress.totalBytes && progress.totalBytes > 0 && progress.copiedBytes !== undefined
    ? Math.round((progress.copiedBytes / progress.totalBytes) * 100)
    : Math.round((progress.current / progress.total) * 100);

  const formatBytesPerSec = (bytesPerSec?: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '—';
    const mb = bytesPerSec / 1024 / 1024;
    if (mb >= 1000) return `${(mb / 1024).toFixed(2)} GB/s`;
    return `${mb.toFixed(2)} MB/s`;
  };

  const formatETA = (copied?: number, total?: number, speed?: number) => {
    if (!total || !copied || !speed || speed <= 0) return '—';
    const remaining = Math.max(total - copied, 0);
    const secs = Math.ceil(remaining / speed);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getIcon = () => {
    switch (progress.type) {
      case 'copy': return <Copy size={16} className="text-blue-400" />;
      case 'move': return <Move size={16} className="text-green-400" />;
      case 'delete': return <Trash2 size={16} className="text-red-400" />;
      default: return null;
    }
  };

  const getTitle = () => {
    switch (progress.type) {
      case 'copy': return `Copying ${progress.total} items`;
      case 'move': return `Moving ${progress.total} items`;
      case 'delete': return `Deleting ${progress.total} items`;
      default: return 'Processing...';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="pointer-events-auto w-[420px] bg-bg-secondary border border-border shadow-2xl rounded-lg overflow-hidden flex flex-col"
        >
          {/* Windows-style Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-bg-tertiary border-b border-border/50">
            <div className="flex items-center gap-2">
              {getIcon()}
              <span className="text-xs font-semibold text-text-primary">{getTitle()}</span>
            </div>
            <button 
              onClick={() => setProgress(null)}
              className="p-1 rounded text-text-muted hover:bg-bg-hover hover:text-red-500 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="p-5 flex flex-col gap-5 bg-bg-primary">
            {/* Action text */}
            <div className="text-[13px] text-text-primary">
              <div className="font-medium mb-1 truncate">{getTitle()}</div>
              <div className="text-text-secondary truncate text-xs">Name: {progress.name}</div>
            </div>
            
            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-text-secondary">
                <span>{percentage}% complete</span>
              </div>
              <div className="h-4 w-full bg-border/40 rounded overflow-hidden border border-border/20">
                <motion.div 
                  className={`h-full ${progress.type === 'delete' ? 'bg-red-500' : 'bg-blue-500'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ ease: "linear", duration: 0.1 }}
                />
              </div>
            </div>
            
            {/* Details Section */}
            <div className="border border-border/40 rounded-md p-3 bg-bg-secondary text-xs text-text-secondary space-y-2">
              <div className="flex justify-between">
                <span className="text-text-muted">Speed:</span>
                <span className="font-medium text-text-primary">{formatBytesPerSec(progress.speed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Time remaining:</span>
                <span className="font-medium text-text-primary">{formatETA(progress.copiedBytes, progress.totalBytes, progress.speed)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Items remaining:</span>
                <span className="font-medium text-text-primary">{progress.total - progress.current + 1} ({progress.copiedBytes && progress.totalBytes ? `${Math.round(progress.copiedBytes / 1024 / 1024)} MB of ${Math.round(progress.totalBytes / 1024 / 1024)} MB` : ''})</span>
              </div>
            </div>
          </div>
          
          {/* Footer Actions */}
          <div className="px-4 py-3 bg-bg-tertiary border-t border-border/50 flex justify-end gap-2">
             <button 
                onClick={() => setProgress(null)}
                className="px-4 py-1.5 rounded bg-bg-hover border border-border text-xs text-text-primary hover:bg-border transition-colors"
                title="Only hides dialog"
              >
                Hide
             </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProgressDialog;
