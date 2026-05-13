import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import PropertiesDialog from './PropertiesDialog';

/**
 * ContextMenu — Inspired by Explorer++ ShellBrowserContextMenuDelegate
 * 
 * Handles verb-based actions: "rename", "copy", "cut", "delete", "properties"
 * Each verb maps to a Tauri command invocation, mirroring the
 * MaybeHandleShellMenuItem pattern from Explorer++.
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

  if (!isOpen && !showProperties) return null;

  const isFile = target?.type === 'file';
  const filePath = target?.path || '';

  const handleVerb = (verb: string) => {
    onAction?.(verb, target);
    onClose();
  };

  const handleDelete = async () => {
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

  const isArchive = /\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(filePath);

  if (showProperties) {
    return (
      <PropertiesDialog 
        filePath={filePath} 
        onClose={() => setShowProperties(false)} 
      />
    );
  }

  return (
    <div 
      className="fixed z-50 bg-bg-secondary/95 backdrop-blur-lg border border-border rounded-lg shadow-2xl py-1 w-60 text-sm text-text-primary"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {isFile ? (
        <>
          <button 
            onClick={() => handleVerb('open')}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group font-medium"
          >
            <span>Open</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">Enter</span>
          </button>
          
          {isArchive && (
            <>
              <div className="h-px bg-border my-1"></div>
              <button 
                onClick={handleExtract}
                className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group"
              >
                <span>📦 Extract Here</span>
                <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">7z</span>
              </button>
              <button 
                onClick={() => handleVerb('browse-archive')}
                className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text"
              >
                <span>📂 Browse Archive</span>
              </button>
            </>
          )}
          
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('localshare-send')}
            className="w-full px-4 py-1.5 text-left bg-bg-primary hover:bg-accent hover:text-accent-text text-accent font-medium"
          >
            📤 Send via LocalShare
          </button>
          
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('cut')}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group"
          >
            <span>Cut</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">Ctrl+X</span>
          </button>
          <button 
            onClick={() => handleVerb('copy')}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group"
          >
            <span>Copy</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">Ctrl+C</span>
          </button>
          <button 
            onClick={() => handleVerb('copy-path')}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text"
          >
            <span>Copy Path</span>
          </button>
          
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('rename')}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group"
          >
            <span>Rename</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">F2</span>
          </button>
          <button 
            onClick={handleDelete}
            className="w-full px-4 py-1.5 text-left hover:bg-error hover:text-white flex justify-between group"
          >
            <span>Delete</span>
            <span className="text-text-muted group-hover:text-white opacity-70 text-xs">Del</span>
          </button>
          
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => { onClose(); setShowProperties(true); }}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group"
          >
            <span>Properties</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">Alt+Enter</span>
          </button>
        </>
      ) : (
        <>
          <button onClick={() => handleVerb('view')} className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text">View ▾</button>
          <button onClick={() => handleVerb('sort')} className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text">Sort by ▾</button>
          <button onClick={() => handleVerb('group')} className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text">Group by ▾</button>
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('refresh')}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group"
          >
            <span>Refresh</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">F5</span>
          </button>
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => handleVerb('paste')}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text flex justify-between group"
          >
            <span>Paste</span>
            <span className="text-text-muted group-hover:text-accent-text opacity-70 text-xs">Ctrl+V</span>
          </button>
          <div className="h-px bg-border my-1"></div>
          <button onClick={() => handleVerb('new-folder')} className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text">New Folder</button>
          <button onClick={() => handleVerb('new-file')} className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text">New File</button>
          <div className="h-px bg-border my-1"></div>
          <button 
            onClick={() => { onClose(); setShowProperties(true); }}
            className="w-full px-4 py-1.5 text-left hover:bg-accent hover:text-accent-text"
          >
            Properties
          </button>
        </>
      )}
    </div>
  );
};

export default ContextMenu;
