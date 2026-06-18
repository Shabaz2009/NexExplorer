import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useExplorerStore } from '../../store/explorerStore';
import { FileEntry } from '../../hooks/useFileSystem';
import { Folder, FileText, ChevronRight } from 'lucide-react';

/**
 * DualPaneView — Inspired by Explorer++ dual pane mode (Config.h: bool dualPane = false)
 * 
 * Provides a side-by-side file browser for efficient file management operations
 * like drag-and-drop copying/moving between directories.
 */

interface PaneProps {
  initialPath: string;
  isActive: boolean;
  onActivate: () => void;
}

const getFileIcon = (entry: FileEntry) => {
  if (entry.is_dir) return <Folder size={16} className="text-yellow-400" />;
  
  const ext = entry.extension.toLowerCase();
  const colors: Record<string, string> = {
    pdf: 'text-red-400', doc: 'text-blue-400', docx: 'text-blue-400',
    xls: 'text-green-400', xlsx: 'text-green-400', png: 'text-purple-400',
    jpg: 'text-purple-400', mp4: 'text-pink-400', zip: 'text-orange-400',
    '7z': 'text-orange-400', rar: 'text-orange-400',
  };
  
  return <FileText size={16} className={colors[ext] || 'text-text-secondary'} />;
};

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const Pane: React.FC<PaneProps> = ({ initialPath, isActive, onActivate }) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  
  // We need a local file system hook for this pane
  const [files, setFiles] = React.useState<FileEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  
  React.useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const entries: FileEntry[] = await invoke('read_dir', { path: currentPath });
        entries.sort((a, b) => {
          if (a.is_dir && !b.is_dir) return -1;
          if (!a.is_dir && b.is_dir) return 1;
          return a.name.localeCompare(b.name);
        });
        setFiles(entries);
      } catch (e) {
        console.error(e);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentPath]);

  const navigate = async (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
      setSelected(new Set());
    } else {
      // Open files with the OS default application
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener');
        await openPath(entry.path);
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    }
  };

  const goUp = () => {
    const parts = currentPath.split('\\').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      setCurrentPath(parts.join('\\') + '\\');
    }
  };

  const pathSegments = currentPath.split('\\').filter(Boolean);

  return (
    <div 
      className={`flex-1 flex flex-col border rounded-lg overflow-hidden transition-colors ${
        isActive ? 'border-accent' : 'border-border'
      }`}
      onClick={onActivate}
    >
      {/* Pane breadcrumb */}
      <div className="flex items-center gap-1 px-3 py-2 bg-bg-tertiary border-b border-border text-xs overflow-x-auto no-scrollbar">
        {pathSegments.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={12} className="text-text-muted flex-shrink-0" />}
            <button 
              onClick={() => setCurrentPath(pathSegments.slice(0, i + 1).join('\\') + '\\')}
              className="hover:text-accent transition-colors truncate flex-shrink-0"
            >
              {seg}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-5 h-5 border-2 border-accent border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-secondary border-b border-border">
              <tr className="text-text-secondary">
                <th className="text-left py-1.5 px-3 font-medium">Name</th>
                <th className="text-right py-1.5 px-3 font-medium w-20">Size</th>
              </tr>
            </thead>
            <tbody>
              {/* Go up row */}
              <tr 
                className="hover:bg-bg-hover cursor-pointer border-b border-border/30"
                onDoubleClick={goUp}
              >
                <td className="py-1 px-3 flex items-center gap-2">
                  <Folder size={14} className="text-text-secondary" />
                  <span className="text-text-secondary">..</span>
                </td>
                <td></td>
              </tr>
              {files.map((file) => (
                <tr 
                  key={file.path}
                  className={`hover:bg-bg-hover cursor-pointer border-b border-border/30 ${
                    selected.has(file.path) ? 'bg-accent/10' : ''
                  }`}
                  onClick={(e) => {
                    if (e.ctrlKey) {
                      const newSel = new Set(selected);
                      newSel.has(file.path) ? newSel.delete(file.path) : newSel.add(file.path);
                      setSelected(newSel);
                    } else {
                      setSelected(new Set([file.path]));
                    }
                  }}
                  onDoubleClick={() => navigate(file)}
                >
                  <td className="py-1 px-3 flex items-center gap-2">
                    {getFileIcon(file)}
                    <span className="truncate">{file.name}</span>
                  </td>
                  <td className="text-right py-1 px-3 text-text-secondary">
                    {!file.is_dir && formatSize(file.size)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pane footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-tertiary border-t border-border text-xs text-text-secondary">
        <span>{files.length} items</span>
        <span>{selected.size} selected</span>
      </div>
    </div>
  );
};

const DualPaneView: React.FC = () => {
  const { currentPath } = useExplorerStore();
  const [activePane, setActivePane] = useState<'left' | 'right'>('left');

  return (
    <div className="flex h-full gap-1 p-1">
      <Pane 
        initialPath={currentPath}
        isActive={activePane === 'left'}
        onActivate={() => setActivePane('left')}
      />
      <Pane 
        initialPath={currentPath}
        isActive={activePane === 'right'}
        onActivate={() => setActivePane('right')}
      />
    </div>
  );
};

export default DualPaneView;
