import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PropertiesDialog from './PropertiesDialog';
import HashChecker from '../Dialogs/HashChecker';
import DiskAnalyzer from '../Tools/DiskAnalyzer';
import DuplicateFinder from '../Tools/DuplicateFinder';
import BatchRenamer from '../Tools/BatchRenamer';
import { useFileOperations } from '../../hooks/useFileOperations';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useSelectionStore } from '../../store/selectionStore';
import { useNexDropStore } from '../../store/nexDropStore';
import { useExplorerStore } from '../../store/explorerStore';

/**
 * ContextMenu — Inspired by Explorer++ ShellBrowserContextMenuDelegate
 */

interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  target: any;
  onClose: () => void;
  onAction?: (verb: string, target: any) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, target, onClose, onAction }) => {
  const [showProperties, setShowProperties] = useState(false);
  const [showHashChecker, setShowHashChecker] = useState(false);
  const [showDiskAnalyzer, setShowDiskAnalyzer] = useState(false);
  const [showDuplicateFinder, setShowDuplicateFinder] = useState(false);
  const [showBatchRenamer, setShowBatchRenamer] = useState(false);
  const { handleCopy, handleCut, handlePaste, handleTrash, handleRename } = useFileOperations();
  const { refresh } = useFileSystem();
  const { selectedPaths } = useSelectionStore();
  const { addQueuedPaths } = useNexDropStore();
  const { navigateTo } = useExplorerStore();

  if (!isOpen && !showProperties && !showHashChecker && !showDiskAnalyzer && !showDuplicateFinder && !showBatchRenamer) return null;

  const isMulti = selectedPaths.size > 1;
  const isFile = target?.type === 'file';
  const filePath = target?.path || target?.entry?.path || '';
  const isDir = target?.entry?.is_dir || false;
  const fileName = target?.entry?.name || '';
  const isLockedFile = fileName.startsWith('.nexlock_');

  const handleNexDropSend = () => {
    const paths = isMulti ? Array.from(selectedPaths) : [filePath];
    addQueuedPaths(paths);
    navigateTo('nexdrop://');
    onClose();
  };

  const handleVerb = async (verb: string) => {
    switch (verb) {
      case 'copy': handleCopy(); break;
      case 'cut': handleCut(); break;
      case 'paste': await handlePaste(); break;
      case 'rename': await handleRename(); break;
      case 'delete': await handleTrash(); break;
      case 'refresh': refresh(); break;
    }
    onAction?.(verb, target);
    onClose();
  };

  const handleDelete = async () => {
    if (isMulti) {
      handleVerb('delete');
      return;
    }
    if (filePath) {
      try {
        await invoke('delete_file', { path: filePath });
        handleVerb('delete');
      } catch (e) {
        console.error('Delete failed:', e);
      }
    }
    onClose();
  };

  const handleExtract = async () => {
    if (filePath) {
      try {
        const destDir = filePath.replace(/\.[^.]+$/, '');
        await invoke('extract_archive', { archivePath: filePath, destDir });
        handleVerb('extract');
      } catch (e) {
        console.error('Extract failed:', e);
      }
    }
    onClose();
  };

  const handleCompress = async (ext: string = '.zip') => {
    if (filePath) {
      try {
        const destArchive = `${filePath}${ext}`;
        await invoke('create_archive', { archivePath: destArchive, sourcePaths: [filePath] });
        handleVerb('compress');
      } catch (e) {
        console.error(`Compress to ${ext} failed:`, e);
      }
    }
    onClose();
  };

  const handleHideLock = async () => {
    if (filePath) {
      try {
        await invoke('hide_lock_file', { path: filePath });
        handleVerb('hide_lock');
      } catch (e) {
        console.error('Hide & Lock failed:', e);
      }
    }
    onClose();
  };

  const handleUnlock = async () => {
    if (filePath) {
      try {
        await invoke('unhide_unlock_file', { path: filePath });
        handleVerb('unlock');
      } catch (e) {
        console.error('Unlock failed:', e);
      }
    }
    onClose();
  };

  const isArchive = /\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(filePath);

  if (showProperties) {
    return <PropertiesDialog filePath={filePath} onClose={() => setShowProperties(false)} />;
  }

  if (showHashChecker) {
    return <HashChecker path={filePath} onClose={() => setShowHashChecker(false)} />;
  }

  if (showDiskAnalyzer) {
    return <DiskAnalyzer initialPath={filePath || 'C:\\'} onClose={() => setShowDiskAnalyzer(false)} />;
  }

  if (showDuplicateFinder) {
    return <DuplicateFinder initialPath={filePath || 'C:\\'} onClose={() => setShowDuplicateFinder(false)} />;
  }

  if (showBatchRenamer) {
    return <BatchRenamer paths={Array.from(selectedPaths)} onClose={() => setShowBatchRenamer(false)} />;
  }

  return (
    <div 
      className="fixed z-50 bg-bg-secondary/95 backdrop-blur-lg border border-border rounded-xl shadow-2xl py-1 w-64 text-sm text-text-primary overflow-hidden"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {isFile ? (
        <>
          {isMulti ? (
            <div className="px-4 py-2 text-text-muted text-xs font-bold uppercase tracking-wider bg-bg-tertiary/30 border-b border-border mb-1">
              {selectedPaths.size} Items Selected
            </div>
          ) : (
            <>
              <button 
                onClick={() => handleVerb('open')}
                className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group font-bold"
              >
                <span>Open</span>
                <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">Enter</span>
              </button>
              <div className="h-px bg-border my-1"></div>
            </>
          )}
          
          {!isMulti && isArchive ? (
            <button 
              onClick={handleExtract}
              className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
            >
              <span>📦 Extract Here</span>
              <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] font-mono">7Z</span>
            </button>
          ) : !isMulti && (
            <>
              <button 
                onClick={() => handleCompress('.zip')}
                className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
              >
                <span>🗜️ Compress to .zip</span>
                <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] font-mono">ZIP</span>
              </button>
              <button 
                onClick={() => handleCompress('.7z')}
                className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
              >
                <span>🗜️ Compress to .7z</span>
                <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] font-mono">7Z</span>
              </button>
            </>
          )}

          {!isMulti && <div className="h-px bg-border/50 my-1 mx-2"></div>}
          
          {!isMulti && (isLockedFile ? (
            <button 
              onClick={handleUnlock}
              className="w-full px-4 py-2 text-left hover:bg-success hover:text-white flex justify-between items-center group text-success"
            >
              <span className="font-semibold">🔓 Unlock & Unhide</span>
            </button>
          ) : (
            <button 
              onClick={handleHideLock}
              className="w-full px-4 py-2 text-left hover:bg-amber-500 hover:text-white flex justify-between items-center group text-amber-500"
            >
              <span className="font-semibold">🔒 Secure Hide & Lock</span>
            </button>
          ))}

          {!isMulti && <div className="h-px bg-border my-1"></div>}

          {!isMulti && !isDir && (
            <button 
              onClick={() => { onClose(); setShowHashChecker(true); }}
              className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
            >
              <span>🔐 Check Hash</span>
            </button>
          )}

          {!isMulti && isDir && (
            <>
              <button 
                onClick={() => { onClose(); setShowDiskAnalyzer(true); }}
                className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
              >
                <span>📊 Analyze Space</span>
              </button>
              <button 
                onClick={() => { onClose(); setShowDuplicateFinder(true); }}
                className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
              >
                <span>🔍 Find Duplicates</span>
              </button>
            </>
          )}
          
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={handleNexDropSend}
            className="w-full px-4 py-2 text-left bg-accent/10 hover:bg-accent hover:text-accent-text text-accent font-semibold transition-colors"
          >
            📤 Send via NexDrop
          </button>
          
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('cut')}
            className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
          >
            <span>Cut</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">Ctrl+X</span>
          </button>
          <button 
            onClick={() => handleVerb('copy')}
            className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
          >
            <span>Copy</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">Ctrl+C</span>
          </button>
          
          <div className="h-px bg-border my-1"></div>
          
          {isMulti ? (
            <button 
              onClick={() => { onClose(); setShowBatchRenamer(true); }}
              className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group font-semibold text-accent"
            >
              <span>Batch Rename</span>
              <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">Alt+R</span>
            </button>
          ) : (
            <button 
              onClick={() => handleVerb('rename')}
              className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
            >
              <span>Rename</span>
              <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">F2</span>
            </button>
          )}

          <button 
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left hover:bg-error hover:text-white flex justify-between items-center group text-error transition-colors"
          >
            <span className="font-semibold">Delete</span>
            <span className="text-text-muted group-hover:text-white opacity-70 text-[10px] tracking-wider uppercase">Del</span>
          </button>
          
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => { onClose(); setShowProperties(true); }}
            className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
          >
            <span>Properties</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">Alt+Enter</span>
          </button>
        </>
      ) : (
        <>
          <button onClick={() => { onClose(); setShowDiskAnalyzer(true); }} className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text">📊 Analyze Disk Space</button>
          <button onClick={() => { onClose(); setShowDuplicateFinder(true); }} className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text">🔍 Find Duplicates</button>
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('refresh')}
            className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
          >
            <span>Refresh</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">F5</span>
          </button>
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('paste')}
            className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text flex justify-between items-center group"
          >
            <span>Paste</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-[10px] tracking-wider uppercase">Ctrl+V</span>
          </button>
          <div className="h-px bg-border my-1"></div>
          <button onClick={() => handleVerb('new-folder')} className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-text">New Folder</button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;
