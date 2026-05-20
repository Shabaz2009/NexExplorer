import React, { useMemo } from 'react';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useSelectionStore } from '../../store/selectionStore';
import { useExplorerStore } from '../../store/explorerStore';
import { formatBytes, formatDate } from '../../utils/formatters';
import { Folder, File, Settings, FileText, Image as ImageIcon, Music, Video, Archive, Code } from 'lucide-react';

const DetailsPane: React.FC = () => {
  const { files } = useFileSystem();
  const { selectedPaths } = useSelectionStore();
  const { showDetailsPane } = useExplorerStore();

  if (!showDetailsPane) return null;

  const getIcon = (item: any) => {
    if (item.is_dir) return <Folder size={64} className="text-accent drop-shadow-md" fill="currentColor" fillOpacity={0.2} strokeWidth={1} />;
    
    // Guess by extension for nice icons
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return <ImageIcon size={64} className="text-blue-500 drop-shadow-md" strokeWidth={1} />;
    if (ext && ['mp4', 'mkv', 'avi', 'mov'].includes(ext)) return <Video size={64} className="text-purple-500 drop-shadow-md" strokeWidth={1} />;
    if (ext && ['mp3', 'wav', 'flac', 'ogg'].includes(ext)) return <Music size={64} className="text-red-500 drop-shadow-md" strokeWidth={1} />;
    if (ext && ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <Archive size={64} className="text-orange-500 drop-shadow-md" strokeWidth={1} />;
    if (ext && ['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'py', 'rs'].includes(ext)) return <Code size={64} className="text-green-500 drop-shadow-md" strokeWidth={1} />;
    
    return <File size={64} className="text-gray-400 drop-shadow-md" strokeWidth={1} />;
  };

  const selectedItem = useMemo(() => {
    if (selectedPaths.size !== 1) return null;
    const path = Array.from(selectedPaths)[0];
    return files.find(f => f.path === path);
  }, [files, selectedPaths]);

  const selectedFiles = useMemo(() => {
    return files.filter(f => selectedPaths.has(f.path));
  }, [files, selectedPaths]);

  return (
    <div className="w-80 h-full bg-bg-primary border-l border-border flex flex-col pt-8 animate-in slide-in-from-right-8 duration-200">
      {selectedItem ? (
        <div className="flex flex-col h-full px-5 pb-5 overflow-y-auto custom-scrollbar">
          <div className="flex justify-center items-center py-6 pb-2">
            {getIcon(selectedItem)}
          </div>
          
          <h2 className="text-sm font-semibold text-text-primary mb-6 pt-2 break-all text-center">
            {selectedItem.name}
          </h2>

          <div className="text-xs font-semibold text-text-primary mb-3 uppercase tracking-wider text-text-muted">Properties</div>
          
          <div className="space-y-4 bg-bg-tertiary p-4 rounded-xl border border-border/50 shadow-inner">
            <div>
              <div className="text-text-muted text-[10px] uppercase font-bold mb-0.5">Type</div>
              <div className="text-xs text-text-primary capitalize font-medium">{selectedItem.is_dir ? 'File folder' : `${selectedItem.name.split('.').pop() || 'File'} file`}</div>
            </div>
            
            {!selectedItem.is_dir && (
              <div>
                <div className="text-text-muted text-[10px] uppercase font-bold mb-0.5">Size</div>
                <div className="text-xs text-text-primary font-mono">{formatBytes(selectedItem.size)}</div>
              </div>
            )}
            
            <div>
              <div className="text-text-muted text-[10px] uppercase font-bold mb-0.5">Location</div>
              <div className="text-[11px] text-text-secondary break-all opacity-80">{selectedItem.path}</div>
            </div>
            
            <div>
              <div className="text-text-muted text-[10px] uppercase font-bold mb-0.5">Modified</div>
              <div className="text-xs text-text-primary">
                {selectedItem.modified_at ? formatDate(selectedItem.modified_at) : 'Unknown'}
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-center">
            <button className="flex items-center justify-center gap-2 px-6 py-2 w-full rounded-xl border border-border bg-bg-secondary hover:bg-bg-hover hover:border-accent/40 hover:text-accent transition-all text-xs font-bold text-text-primary shadow-sm interactive">
              <Settings size={14} />
              Advanced Properties
            </button>
          </div>
        </div>
      ) : selectedPaths.size > 1 ? (
        <div className="flex flex-col h-full px-5 pb-5">
            <div className="flex justify-center items-center py-6 pb-2 relative">
               <File size={64} className="text-accent/60 drop-shadow-md absolute -ml-6" strokeWidth={1} />
               <File size={64} className="text-accent drop-shadow-xl z-10" fill="currentColor" fillOpacity={0.1} strokeWidth={1} />
               <File size={64} className="text-accent/40 drop-shadow-sm absolute ml-6" strokeWidth={1} />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-1 pt-2 text-center">
              {selectedPaths.size} items selected
            </h2>
            <div className="text-center text-[10px] text-text-muted font-bold uppercase tracking-widest mb-6">
              Multiple Selection
            </div>

            <div className="bg-bg-tertiary p-4 rounded-xl border border-border/50 text-center shadow-inner">
               <div className="text-[10px] text-text-muted uppercase font-bold mb-1">Combined Size</div>
               <div className="text-sm font-mono text-accent">
                 {formatBytes(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
               </div>
            </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm pb-20">
          <FileText size={48} className="text-border mb-4 drop-shadow-sm opacity-50" strokeWidth={1} />
          <span className="font-medium text-xs">Select an item to view its details</span>
        </div>
      )}
    </div>
  );
};

export default DetailsPane;
