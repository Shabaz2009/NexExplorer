import React from 'react';
import { File, Folder, Image as ImageIcon, Music, Video, Archive } from 'lucide-react';
import { useFileSystem, FileEntry } from '../../hooks/useFileSystem';
import { useExplorerStore } from '../../store/explorerStore';
import { useContextMenu } from '../../hooks/useContextMenu';
import ContextMenu from './ContextMenu';

const FileGrid: React.FC = () => {
  const { files, loading, error } = useFileSystem();
  const { setCurrentPath, currentPath } = useExplorerStore();
  const { isOpen, position, target, openContextMenu, closeContextMenu } = useContextMenu();

  const getIcon = (entry: FileEntry) => {
    if (entry.is_dir) return <Folder size={48} className="text-accent mb-2" fill="currentColor" fillOpacity={0.2} strokeWidth={1.5} />;
    
    const ext = entry.extension.toLowerCase();
    if (['zip', '7z', 'tar', 'gz', 'rar'].includes(ext)) {
      return <Archive size={48} className="text-warning mb-2" strokeWidth={1.5} />;
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return <ImageIcon size={48} className="text-success mb-2" strokeWidth={1.5} />;
    }
    if (['mp3', 'wav', 'flac'].includes(ext)) {
      return <Music size={48} className="text-purple-500 mb-2" strokeWidth={1.5} />;
    }
    if (['mp4', 'mkv', 'avi'].includes(ext)) {
      return <Video size={48} className="text-pink-500 mb-2" strokeWidth={1.5} />;
    }
    return <File size={48} className="text-text-secondary mb-2" strokeWidth={1.5} />;
  };

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
    }
  };

  if (loading) {
    return <div className="p-4 text-text-secondary">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full text-text-secondary" onContextMenu={(e) => openContextMenu(e, { type: 'empty' })}>
        <div className="text-error mb-2 text-lg">Access Denied or Directory Not Found</div>
        <div>{error}</div>
        {currentPath !== 'C:\\' && (
          <button 
            className="mt-4 px-4 py-2 bg-accent text-white rounded hover:bg-accent-hover"
            onClick={() => setCurrentPath('C:\\')}
          >
            Go to C:\
          </button>
        )}
        <ContextMenu isOpen={isOpen} position={position} target={target} onClose={closeContextMenu} />
      </div>
    );
  }

  return (
    <div 
      className="p-4 grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 h-full content-start"
      onContextMenu={(e) => openContextMenu(e, { type: 'empty' })}
    >
      {files.map(file => (
        <div 
          key={file.path} 
          onDoubleClick={() => handleDoubleClick(file)}
          onContextMenu={(e) => openContextMenu(e, { type: 'file', entry: file })}
          className="flex flex-col items-center justify-start p-2 rounded hover:bg-bg-hover cursor-pointer border border-transparent hover:border-border transition-colors group"
          title={file.name}
        >
          {getIcon(file)}
          <span className="text-xs text-center w-full truncate px-1 group-hover:text-clip group-hover:whitespace-normal break-words line-clamp-2">
            {file.name}
          </span>
        </div>
      ))}
      <ContextMenu isOpen={isOpen} position={position} target={target} onClose={closeContextMenu} />
    </div>
  );
};

export default FileGrid;
