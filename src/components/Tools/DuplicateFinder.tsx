import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Copy, X, Trash2, CheckCircle2, AlertCircle, FileSearch } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { FileEntry } from '../../hooks/useFileSystem';

interface DuplicateGroup {
  hash: string;
  files: FileEntry[];
  size: number;
}

const DuplicateFinder: React.FC<{ initialPath: string, onClose: () => void }> = ({ initialPath, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());

  useEffect(() => {
    const scan = async () => {
      try {
        const result = await invoke<DuplicateGroup[]>('find_duplicates', { path: initialPath });
        setGroups(result.sort((a, b) => (b.size * b.files.length) - (a.size * a.files.length)));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    scan();
  }, [initialPath]);

  const toggleDelete = (path: string) => {
    const next = new Set(selectedToDelete);
    next.has(path) ? next.delete(path) : next.add(path);
    setSelectedToDelete(next);
  };

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteSelected = async () => {
    // B8 fix: route through trash_items (recycle bin) instead of delete_file.
    // B4 fix: use state-driven confirmation instead of blocking confirm().
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setConfirmingDelete(false);
    for (const path of selectedToDelete) {
      try {
        await invoke('trash_items', { paths: [path] });
      } catch (e) {
        console.error(`Failed to trash ${path}:`, e);
      }
    }
    onClose();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[110] bg-bg-primary flex flex-col items-center justify-center p-10">
        <div className="w-24 h-24 bg-accent/10 text-accent rounded-3xl flex items-center justify-center mb-6 animate-pulse">
          <FileSearch size={48} />
        </div>
        <h2 className="text-xl font-bold mb-2">Finding Duplicates...</h2>
        <p className="text-text-muted text-sm text-center max-w-md">Scanning contents of {initialPath}</p>
      </div>
    );
  }

  const totalSavings = Array.from(selectedToDelete).reduce((acc, path) => {
    const file = groups.flatMap(g => g.files).find(f => f.path === path);
    return acc + (file?.size || 0);
  }, 0);

  return (
    <div className="fixed inset-0 z-[110] bg-bg-primary flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-bg-secondary flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent text-white rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
            <Copy size={20} />
          </div>
          <div>
            <h2 className="font-bold text-sm">Duplicate File Finder</h2>
            <div className="text-[10px] text-text-muted font-mono">{initialPath}</div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary hover:text-text-primary">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-6">
        {groups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-text-muted">
            <CheckCircle2 size={48} className="mb-4 opacity-20 text-success" />
            <p className="font-medium">No duplicates found. Your drive is clean!</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-accent">Optimization Summary</h3>
                <p className="text-xs text-text-muted mt-1">Found {groups.length} groups of identical files.</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-black text-accent">{formatBytes(totalSavings)}</div>
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Potential Savings</div>
              </div>
            </div>

            <div className="space-y-4">
              {groups.map((group) => (
                <div key={group.hash} className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 bg-bg-tertiary border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-text-primary truncate max-w-[200px]">{group.files[0].name}</span>
                      <span className="text-[10px] bg-bg-primary px-2 py-0.5 rounded text-text-muted border border-border">{formatBytes(group.size)} each</span>
                    </div>
                    <span className="text-[10px] font-bold text-accent">{group.files.length} copies</span>
                  </div>
                  <div className="divide-y divide-border/30">
                    {group.files.map((file) => (
                      <div 
                        key={file.path} 
                        className={`px-4 py-3 flex items-center justify-between hover:bg-bg-hover transition-colors cursor-pointer ${selectedToDelete.has(file.path) ? 'bg-error/5' : ''}`}
                        onClick={() => toggleDelete(file.path)}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-text-secondary truncate">{file.path}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selectedToDelete.has(file.path) ? 'bg-error border-error' : 'border-border'}`}>
                          {selectedToDelete.has(file.path) && <Trash2 size={12} className="text-white" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-border bg-bg-secondary flex justify-between items-center">
        <div className="flex items-center gap-2 text-text-muted text-xs">
          <AlertCircle size={14} />
          <span>Keep at least one copy of each file!</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 hover:bg-bg-hover rounded-xl text-xs font-bold transition-all"
          >
            Cancel
          </button>
          {confirmingDelete && (
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-4 py-2 hover:bg-bg-hover rounded-xl text-xs font-bold text-text-secondary transition-all"
            >
              Never mind
            </button>
          )}
          <button 
            disabled={selectedToDelete.size === 0}
            onClick={deleteSelected}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
              selectedToDelete.size > 0 
                ? confirmingDelete
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/30 animate-pulse'
                  : 'bg-error text-white hover:bg-red-600 shadow-error/20'
                : 'bg-bg-tertiary text-text-muted cursor-not-allowed opacity-50'
            }`}
          >
            <Trash2 size={14} />
            {confirmingDelete
              ? `Confirm Trash ${selectedToDelete.size} Files?`
              : `Delete ${selectedToDelete.size} Files`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateFinder;
