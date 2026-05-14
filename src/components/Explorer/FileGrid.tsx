import React from 'react';
import { File, Folder, Image as ImageIcon, Music, Video, Archive, FileText, Code } from 'lucide-react';
import { useFileSystem, FileEntry } from '../../hooks/useFileSystem';
import { useExplorerStore } from '../../store/explorerStore';
import { useContextMenu } from '../../hooks/useContextMenu';
import ContextMenu from './ContextMenu';
import { motion, AnimatePresence } from 'framer-motion';

const FileGrid: React.FC = () => {
  const { files, loading, error } = useFileSystem();
  const { setCurrentPath, currentPath } = useExplorerStore();
  const { isOpen, position, target, openContextMenu, closeContextMenu } = useContextMenu();

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

  const handleDoubleClick = (entry: FileEntry) => {
    if (entry.is_dir) {
      setCurrentPath(entry.path);
    }
  };

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
      className="p-6 grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4 h-full content-start"
      onContextMenu={(e) => openContextMenu(e, { type: 'empty' })}
    >
      <AnimatePresence mode="popLayout">
        {files.map((file, idx) => (
          <motion.div 
            key={file.path} 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: Math.min(idx * 0.01, 0.2), duration: 0.2 }}
            onDoubleClick={() => handleDoubleClick(file)}
            onContextMenu={(e) => openContextMenu(e, { type: 'file', entry: file })}
            className="flex flex-col items-center justify-start p-4 rounded-2xl glass-card cursor-pointer border border-border/50 hover:border-accent/40 hover:bg-bg-hover group interactive select-none"
            title={file.name}
          >
            <div className="transform group-hover:scale-110 group-hover:-translate-y-1 transition-transform duration-300 ease-out pointer-events-none">
              {getIcon(file)}
            </div>
            <span className="text-[11px] font-medium text-center w-full truncate px-1 text-text-secondary group-hover:text-text-primary group-hover:whitespace-normal break-words line-clamp-2 leading-tight">
              {file.name}
            </span>
            
            {/* Subtle indicator for selection/focus would go here */}
            <div className="absolute inset-0 rounded-2xl border-2 border-accent/0 group-active:border-accent/30 transition-all pointer-events-none" />
          </motion.div>
        ))}
      </AnimatePresence>
      <ContextMenu isOpen={isOpen} position={position} target={target} onClose={closeContextMenu} />
    </div>
  );
};

export default FileGrid;
