import React, { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Type, Search, ArrowRight, Save, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useSelectionStore } from '../../store/selectionStore';
import { motion, AnimatePresence } from 'framer-motion';

interface BatchRenamerProps {
  paths: string[];
  onClose: () => void;
}

const BatchRenamer: React.FC<BatchRenamerProps> = ({ paths, onClose }) => {
  const { refresh } = useFileSystem();
  const { clearSelection } = useSelectionStore();
  const [mode, setMode] = useState<'replace' | 'pattern'>('replace');
  const [findStr, setFindStr] = useState('');
  const [replaceStr, setReplaceStr] = useState('');
  const [patternStr, setPatternStr] = useState('File_#');
  const [startCounter, setStartCounter] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive initial files details
  const files = useMemo(() => {
    return paths.map(path => {
      const parts = path.split(/[\\/]/);
      const originalName = parts.pop() || '';
      const dir = parts.join('\\');
      const extMatch = originalName.match(/\.([^.]+)$/);
      const extension = extMatch ? `.${extMatch[1]}` : '';
      const baseName = extMatch ? originalName.slice(0, -(extMatch[1].length + 1)) : originalName;
      
      return { path, dir, originalName, baseName, extension };
    });
  }, [paths]);

  // Generate previews
  const previews = useMemo(() => {
    return files.map((file, index) => {
      let newName = file.originalName;

      if (mode === 'replace') {
        if (findStr) {
          // simple global replacement
          newName = file.originalName.split(findStr).join(replaceStr);
        }
      } else if (mode === 'pattern') {
        const counterStr = (startCounter + index).toString();
        // Replace '#' with the counter
        const base = patternStr.replace(/#/g, counterStr);
        newName = `${base}${file.extension}`;
      }

      return {
        ...file,
        newName,
        isChanged: newName !== file.originalName
      };
    });
  }, [files, mode, findStr, replaceStr, patternStr, startCounter]);

  const changedCount = previews.filter(p => p.isChanged).length;

  const handleApply = async () => {
    const renames = previews
      .filter(p => p.isChanged)
      .map(p => [p.path, p.newName]);

    if (renames.length === 0) {
      toast.info('No files to rename');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await invoke('bulk_rename', { renames });
      toast.success(`Successfully renamed ${renames.length} files`);
      refresh();
      clearSelection();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (Array.isArray(err)) {
        setError(err.join('\n'));
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-bg-primary border border-border/50 shadow-2xl rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-bg-secondary flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
              <Type size={20} />
            </div>
            <div>
              <h2 className="font-bold text-sm">Batch Rename</h2>
              <div className="text-[10px] text-text-muted font-bold tracking-widest uppercase">{files.length} ITEMS SELECTED</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Controls Sidebar */}
          <div className="w-full md:w-72 border-r border-border bg-bg-tertiary/50 p-6 flex flex-col gap-6 overflow-y-auto shrink-0">
            {/* Mode Switcher */}
            <div className="flex bg-bg-secondary rounded-lg p-1 border border-border">
              <button
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'replace' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                onClick={() => setMode('replace')}
              >
                Find & Replace
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${mode === 'pattern' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                onClick={() => setMode('pattern')}
              >
                Pattern
              </button>
            </div>

            {mode === 'replace' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Find</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      className="w-full bg-bg-primary border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent text-text-primary"
                      placeholder="Text to replace..."
                      value={findStr}
                      onChange={e => setFindStr(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Replace With</label>
                  <input
                    type="text"
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent text-text-primary"
                    placeholder="Replacement text..."
                    value={replaceStr}
                    onChange={e => setReplaceStr(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Pattern (Use # for Number)</label>
                  <input
                    type="text"
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent font-mono text-text-primary"
                    placeholder="Prefix_#_Suffix"
                    value={patternStr}
                    onChange={e => setPatternStr(e.target.value)}
                  />
                  <p className="text-[10px] text-text-muted mt-1 leading-tight">
                    Example: <span className="font-mono text-accent">Vacation_#</span> becomes <span className="font-mono text-accent">Vacation_1.jpg</span>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Start Counter At</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent font-mono text-text-primary"
                    value={startCounter}
                    onChange={e => setStartCounter(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}

            <div className="mt-auto pt-6 border-t border-border">
              <button
                onClick={handleApply}
                disabled={loading || changedCount === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-hover transition-all shadow-lg shadow-accent/20 active:scale-[0.98]"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {loading ? 'Applying...' : `Rename ${changedCount} Files`}
              </button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="flex-1 flex flex-col bg-bg-primary overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-bg-secondary/50 flex items-center text-[10px] font-bold text-text-muted tracking-widest uppercase">
              <div className="flex-1">Original Name</div>
              <div className="w-8 flex justify-center"></div>
              <div className="flex-1">New Name</div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {error && (
                <div className="mb-4 mx-2 p-3 bg-error/10 border border-error/20 rounded-lg flex items-start gap-3">
                  <AlertCircle size={16} className="text-error shrink-0 mt-0.5" />
                  <pre className="text-[11px] text-error whitespace-pre-wrap font-mono">{error}</pre>
                </div>
              )}

              <AnimatePresence>
                {previews.map((p, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.01 }}
                    key={p.path} 
                    className="flex items-center gap-2 px-3 py-2 hover:bg-bg-hover rounded-lg group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate font-mono ${p.isChanged ? 'text-error/80 line-through' : 'text-text-secondary'}`}>
                        {p.originalName}
                      </div>
                    </div>
                    
                    <div className="w-8 flex justify-center text-text-muted opacity-30 group-hover:opacity-100 transition-opacity">
                      {p.isChanged ? <ArrowRight size={14} className="text-accent" /> : <ArrowRight size={14} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate font-mono ${p.isChanged ? 'text-success font-bold' : 'text-text-secondary'}`}>
                        {p.newName}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BatchRenamer;