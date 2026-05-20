import React, { useState, useEffect, memo } from 'react';
import { useFileSystem, FileEntry } from '../../hooks/useFileSystem';
import { formatBytes, formatDate } from '../../utils/formatters';
import { File, Folder, Loader2 } from 'lucide-react';
import { useExplorerStore } from '../../store/explorerStore';
import { useSelectionStore } from '../../store/selectionStore';
import { invoke } from '@tauri-apps/api/core';
import { VirtualizedList } from '../UI/VirtualizedContainer';

const DetailRow = memo(({ 
  file, 
  index, 
  isSelected,
  folderSize,
  isCalculating,
  onDoubleClick,
  onClick
}: { 
  file: FileEntry, 
  index: number, 
  isSelected: boolean,
  folderSize?: number,
  isCalculating: boolean,
  onDoubleClick: (file: FileEntry) => void,
  onClick: (e: React.MouseEvent, file: FileEntry, index: number) => void
}) => {
  return (
    <div 
      onDoubleClick={() => onDoubleClick(file)}
      onClick={(e) => onClick(e, file, index)}
      className={`flex items-center w-full hover:bg-bg-hover cursor-default border-b border-border/30 group transition-colors select-none h-[32px] ${isSelected ? 'bg-accent/15' : ''}`}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2 px-4 h-full">
        {file.is_dir ? 
          <Folder size={16} className="text-accent flex-shrink-0" fill="currentColor" fillOpacity={0.2} /> : 
          <File size={16} className="text-text-secondary flex-shrink-0" />
        }
        <span className="truncate text-sm">{file.name}</span>
      </div>
      <div className="w-40 px-4 text-text-secondary text-xs truncate border-l border-border/10 h-full flex items-center">{formatDate(file.modified_at)}</div>
      <div className="w-32 px-4 text-text-secondary text-xs truncate border-l border-border/10 h-full flex items-center">{file.is_dir ? 'File folder' : `${file.extension.toUpperCase() || 'FILE'} File`}</div>
      <div className="w-32 px-4 text-text-secondary text-right font-mono text-xs border-l border-border/10 h-full flex items-center justify-end">
        {file.is_dir ? (
          folderSize !== undefined ? (
            formatBytes(folderSize)
          ) : (
            <div className="flex items-center justify-end gap-1 opacity-40">
              {isCalculating && <Loader2 size={10} className="animate-spin" />}
              <span>{isCalculating ? 'calculating' : ''}</span>
            </div>
          )
        ) : (
          formatBytes(file.size)
        )}
      </div>
    </div>
  );
});

const FileDetails: React.FC = () => {
  const { files, loading, error } = useFileSystem();
  const { setCurrentPath } = useExplorerStore();
  const { selectedPaths, toggleSelection } = useSelectionStore();
  const [folderSizes, setFolderSizes] = useState<Record<string, number>>({});
  const [calculating, setCalculating] = useState<Set<string>>(new Set());

  useEffect(() => {
    const calculateSizes = async () => {
      // Only calculate sizes for directories in small batches to save CPU/RAM
      const dirs = files.filter(f => f.is_dir && folderSizes[f.path] === undefined).slice(0, 50);
      
      for (const dir of dirs) {
        if (calculating.has(dir.path)) continue;
        setCalculating(prev => new Set(prev).add(dir.path));
        
        try {
          const size = await invoke<number>('get_folder_size', { path: dir.path });
          setFolderSizes(prev => ({ ...prev, [dir.path]: size }));
        } catch (e) {
          setFolderSizes(prev => ({ ...prev, [dir.path]: 0 }));
        } finally {
          setCalculating(prev => {
            const next = new Set(prev);
            next.delete(dir.path);
            return next;
          });
        }
      }
    };

    if (files.length > 0 && files.length < 500) { // Only auto-calculate for smaller folders to save performance
      calculateSizes();
    }
  }, [files]);

  if (loading) return <div className="p-4 text-text-secondary">Loading...</div>;
  if (error) return <div className="p-4 text-error">{error}</div>;

  return (
    <div className="w-full h-full flex flex-col bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center w-full bg-bg-secondary text-text-secondary border-b border-border z-10 text-[11px] font-bold uppercase tracking-wider h-9">
        <div className="flex-1 px-4">Name</div>
        <div className="w-40 px-4 border-l border-border/30">Date modified</div>
        <div className="w-32 px-4 border-l border-border/30">Type</div>
        <div className="w-32 px-4 border-l border-border/30 text-right">Size</div>
      </div>
      
      {/* Body */}
      <div className="flex-1 min-h-0">
        <VirtualizedList 
          items={files}
          itemHeight={32}
          renderItem={(file, idx) => (
            <DetailRow 
              file={file}
              index={idx}
              isSelected={selectedPaths.has(file.path)}
              folderSize={folderSizes[file.path]}
              isCalculating={calculating.has(file.path)}
              onDoubleClick={(f) => f.is_dir && setCurrentPath(f.path)}
              onClick={(e, f) => toggleSelection(f.path, e.ctrlKey || e.metaKey)}
            />
          )}
        />
      </div>
    </div>
  );
};

export default FileDetails;
