import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BarChart3, X, Folder, File, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatBytes } from '../../utils/formatters';

interface DiskNode {
  name: string;
  path: string;
  size: number;
  children?: DiskNode[];
  is_dir: boolean;
}

const DiskAnalyzer: React.FC<{ initialPath: string, onClose: () => void }> = ({ initialPath, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<DiskNode[]>([]);
  const [currentView, setCurrentView] = useState<DiskNode | null>(null);

  useEffect(() => {
    const scan = async () => {
      try {
        const result = await invoke<DiskNode>('analyze_disk_space', { path: initialPath });
        setCurrentView(result);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    scan();
  }, [initialPath]);

  const drillDown = (node: DiskNode) => {
    if (node.is_dir && node.children) {
      setHistory(prev => [...prev, currentView!]);
      setCurrentView(node);
    }
  };

  const goBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory(prev => prev.slice(0, -1));
      setCurrentView(prev);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[110] bg-bg-primary flex flex-col items-center justify-center p-10">
        <div className="w-24 h-24 bg-accent/10 text-accent rounded-3xl flex items-center justify-center mb-6 animate-pulse">
          <BarChart3 size={48} />
        </div>
        <motion.h2 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xl font-bold mb-2"
        >
          Analyzing Storage...
        </motion.h2>
        <p className="text-text-muted text-sm text-center max-w-md truncate">Scanning {initialPath}</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-bg-secondary flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
            <BarChart3 size={20} />
          </div>
          <div>
            <h2 className="font-bold text-sm">Disk Space Analyzer</h2>
            <div className="text-[10px] text-text-muted font-mono truncate max-w-sm">{currentView?.path}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary hover:text-text-primary">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col p-6 gap-6">
        {/* Navigation & Summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
             {history.length > 0 && (
               <button onClick={goBack} className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary hover:bg-bg-hover rounded-lg text-xs font-bold border border-border transition-all active:scale-95">
                 <ArrowLeft size={14} /> Back
               </button>
             )}
             <div className="text-lg font-bold truncate max-w-md">{currentView?.name}</div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-lg font-black text-accent">{formatBytes(currentView?.size || 0)}</div>
            <div className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Total Size</div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto custom-scrollbar pr-2 -mr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
            <AnimatePresence mode="popLayout">
              {currentView?.children?.map((child, idx) => (
                <motion.div
                  key={child.path}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  onClick={() => drillDown(child)}
                  className={`group p-4 glass-card rounded-2xl border border-border/50 hover:border-accent/40 cursor-pointer transition-all duration-300 relative overflow-hidden ${child.is_dir ? 'hover:bg-accent/[0.03]' : 'bg-bg-tertiary/30'}`}
                >
                  <div className="absolute top-0 right-0 p-2 text-[10px] font-black text-text-muted opacity-20 group-hover:opacity-40 transition-opacity uppercase tracking-tighter">
                    {((child.size / (currentView.size || 1)) * 100).toFixed(1)}%
                  </div>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-bg-tertiary text-accent rounded-xl flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-all duration-300 shadow-inner flex-shrink-0">
                      {child.is_dir ? <Folder size={20} /> : <File size={20} />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate text-text-primary group-hover:text-accent transition-colors">{child.name}</div>
                      <div className="text-xs text-text-muted font-medium">{formatBytes(child.size)}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="w-full bg-bg-primary rounded-full h-1.5 overflow-hidden border border-white/5">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(child.size / (currentView.size || 1)) * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-accent h-full rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 border-t border-border bg-bg-tertiary/50 text-[10px] text-text-muted flex justify-between items-center">
        <div className="flex items-center gap-4">
          <span>Click folders to drill down</span>
          <span className="w-1 h-1 rounded-full bg-text-muted opacity-30" />
          <span>Showing {currentView?.children?.length || 0} items</span>
        </div>
        <span className="font-medium">Protocol NexScanner v1.0</span>
      </div>
    </div>
  );
};

export default DiskAnalyzer;
