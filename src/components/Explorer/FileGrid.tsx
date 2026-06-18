import React, { useState, memo } from 'react';
import { File, Folder, Image as ImageIcon, Music, Video, Archive, FileText, Code } from 'lucide-react';
import { useFileSystem, FileEntry } from '../../hooks/useFileSystem';
import { useExplorerStore } from '../../store/explorerStore';
import { useSelectionStore } from '../../store/selectionStore';
import { useContextMenu } from '../../hooks/useContextMenu';
import { useSettingsStore } from '../../store/settingsStore';
import ContextMenu from './ContextMenu';
import { VirtualizedGrid } from '../UI/VirtualizedContainer';

const FileItem = memo(({ 
  file, 
  index, 
  isSelected, 
  onDoubleClick, 
  onClick, 
  onContextMenu 
}: { 
  file: FileEntry, 
  index: number, 
  isSelected: boolean,
  onDoubleClick: (file: FileEntry) => void,
  onClick: (e: React.MouseEvent, file: FileEntry, index: number) => void,
  onContextMenu: (e: React.MouseEvent, file: FileEntry, index: number) => void
}) => {
  const getIcon = (entry: FileEntry) => {
    const iconSize = 40;
    if (entry.is_dir) return <Folder size={iconSize} className="text-accent mb-3 drop-shadow-xl" fill="currentColor" fillOpacity={0.2} strokeWidth={1.2} />;
    
    const ext = entry.extension.toLowerCase();
    if (['zip', '7z', 'tar', 'gz', 'rar'].includes(ext)) {
      return <Archive size={iconSize} className="text-amber-500 mb-3 drop-shadow-lg" strokeWidth={1.2} />;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return <ImageIcon size={iconSize} className="text-emerald-500 mb-3 drop-shadow-lg" strokeWidth={1.2} />;
    }
    if (['mp3', 'wav', 'flac'].includes(ext)) {
      return <Music size={iconSize} className="text-indigo-500 mb-3 drop-shadow-lg" strokeWidth={1.2} />;
    }
    if (['mp4', 'mkv', 'avi', 'mov'].includes(ext)) {
      return <Video size={iconSize} className="text-rose-500 mb-3 drop-shadow-lg" strokeWidth={1.2} />;
    }
    if (['txt', 'md', 'log', 'pdf', 'doc', 'docx'].includes(ext)) {
      return <FileText size={iconSize} className="text-sky-500 mb-3 drop-shadow-lg" strokeWidth={1.2} />;
    }
    if (['js', 'ts', 'jsx', 'tsx', 'rs', 'py', 'c', 'cpp', 'h', 'json', 'yaml', 'toml', 'html', 'css'].includes(ext)) {
      return <Code size={iconSize} className="text-violet-500 mb-3 drop-shadow-lg" strokeWidth={1.2} />;
    }
    return <File size={iconSize} className="text-text-muted mb-3 drop-shadow-sm" strokeWidth={1.2} />;
  };

  return (
    <div 
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(file);
      }}
      onClick={(e) => onClick(e, file, index)}
      onContextMenu={(e) => onContextMenu(e, file, index)}
      className={`flex flex-col items-center justify-start p-4 rounded-2xl glass-card cursor-pointer border hover:border-accent/40 hover:bg-bg-hover group interactive select-none w-full h-full ${isSelected ? 'bg-accent/10 border-accent/50' : 'border-border/50'}`}
      title={file.name}
    >
      <div className="transform group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300 ease-out pointer-events-none">
        {getIcon(file)}
      </div>
      <span className="text-[11px] font-medium text-center w-full px-1 text-text-secondary group-hover:text-text-primary break-all line-clamp-2 leading-tight mt-1">
        {file.name}
      </span>
      
      {isSelected && (
        <div className="absolute inset-0 rounded-2xl border-2 border-accent transition-all pointer-events-none" />
      )}
    </div>
  );
});

const FileGrid: React.FC = () => {
  const { files, loading, error } = useFileSystem();
  const { setCurrentPath } = useExplorerStore();
  const { selectedPaths, toggleSelection, clearSelection, selectAll } = useSelectionStore();
  const { isOpen, position, target, openContextMenu, closeContextMenu } = useContextMenu();
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Marquee state
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // When doubleClickToOpen is false, single-click navigates into directories
  // (like macOS Finder single-click mode). Files always need double-click.
  const doubleClickToOpen = useSettingsStore(s => s.doubleClickToOpen);

  const handleDoubleClick = async (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
    } else {
      // Open files with the OS default application (like Windows Explorer)
      try {
        const { openPath } = await import('@tauri-apps/plugin-opener');
        await openPath(entry.path);
      } catch (err) {
        console.error('Failed to open file:', err);
      }
    }
  };

  const handleSelect = (e: React.MouseEvent, file: FileEntry, index: number) => {
    e.stopPropagation();

    // Single-click-to-open directories when setting is disabled
    if (!doubleClickToOpen && file.is_dir && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setCurrentPath(file.path);
      return;
    }

    if (e.shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangePaths = files.slice(start, end + 1).map(f => f.path);
      const newSelection = (e.ctrlKey || e.metaKey) ? new Set(selectedPaths) : new Set<string>();
      rangePaths.forEach(p => newSelection.add(p));
      selectAll(Array.from(newSelection));
    } else {
      toggleSelection(file.path, e.ctrlKey || e.metaKey);
      setLastSelectedIndex(index);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, file: FileEntry, index: number) => {
    e.stopPropagation();
    if (!selectedPaths.has(file.path)) {
      selectAll([file.path]);
      setLastSelectedIndex(index);
    }
    openContextMenu(e, { type: 'file', entry: file });
  };

  // Marquee logic
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('virtual-grid-container')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    
    setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
    if (!e.ctrlKey && !e.metaKey) clearSelection();
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!marquee) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + e.currentTarget.scrollLeft;
    const y = e.clientY - rect.top + e.currentTarget.scrollTop;
    
    setMarquee(prev => prev ? { ...prev, currentX: x, currentY: y } : null);

    // Calculate selection
    const x1 = Math.min(marquee.startX, x);
    const y1 = Math.min(marquee.startY, y);
    const x2 = Math.max(marquee.startX, x);
    const y2 = Math.max(marquee.startY, y);

    const itemWidth = 110;
    const itemHeight = 120;
    const gap = 16;
    const padding = 16;
    
    const containerWidth = rect.width;
    const itemsPerRow = Math.max(1, Math.floor((containerWidth - gap) / (itemWidth + gap)));

    const newSelected = new Set(e.ctrlKey || e.metaKey ? selectedPaths : []);
    
    files.forEach((file, i) => {
      const row = Math.floor(i / itemsPerRow);
      const col = i % itemsPerRow;
      const itemX = padding + col * (itemWidth + gap);
      const itemY = padding + row * (itemHeight + gap);
      
      const intersects = x1 < itemX + itemWidth && x2 > itemX && y1 < itemY + itemHeight && y2 > itemY;
      if (intersects) {
        newSelected.add(file.path);
      }
    });

    selectAll(Array.from(newSelected));
  };

  const onMouseUp = () => setMarquee(null);

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full space-y-4 animate-pulse">
        <div className="w-12 h-12 rounded-full border-4 border-accent border-t-transparent animate-spin"></div>
        <div className="text-text-secondary font-medium tracking-wide">Scanning filesystem...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-text-secondary" onContextMenu={(e) => openContextMenu(e, { type: 'empty' })}>
        <div className="bg-error/10 p-8 rounded-2xl border border-error/20 flex flex-col items-center max-w-md text-center">
          <div className="text-error mb-4 font-bold text-xl uppercase tracking-tighter">Access Inhibited</div>
          <p className="text-sm opacity-80 leading-relaxed mb-6">{error}</p>
          <div className="flex gap-3">
            <button 
              className="px-6 py-2 bg-accent text-white rounded-xl hover:bg-accent-hover interactive font-semibold shadow-lg shadow-accent/20"
              onClick={() => setCurrentPath('C:\\')}
            >
              System Root
            </button>
            <button 
              className="px-6 py-2 bg-bg-tertiary text-text-primary rounded-xl hover:bg-bg-hover interactive border border-border"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        </div>
        <ContextMenu isOpen={isOpen} position={position} target={target} onClose={closeContextMenu} />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative"
      onContextMenu={(e) => openContextMenu(e, { type: 'empty' })}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <VirtualizedGrid 
        items={files}
        itemWidth={110}
        itemHeight={120}
        gap={16}
        containerClassName="virtual-grid-container"
        renderItem={(file, idx) => (
          <FileItem 
            file={file}
            index={idx}
            isSelected={selectedPaths.has(file.path)}
            onDoubleClick={handleDoubleClick}
            onClick={handleSelect}
            onContextMenu={handleContextMenu}
          />
        )}
      />

      {marquee && (
        <div 
          className="absolute border border-accent bg-accent/20 pointer-events-none z-50 rounded-sm"
          style={{
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY) - (containerRef.current?.scrollTop || 0),
            width: Math.abs(marquee.startX - marquee.currentX),
            height: Math.abs(marquee.startY - marquee.currentY)
          }}
        />
      )}

      <ContextMenu isOpen={isOpen} position={position} target={target} onClose={closeContextMenu} />
    </div>
  );
};

export default FileGrid;
