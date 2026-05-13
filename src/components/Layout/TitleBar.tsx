import React, { useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { useWindowStore } from '../../store/windowStore';
import { Window } from '@tauri-apps/api/window';

declare global {
  interface Window {
    __TAURI__?: boolean;
  }
}

const TitleBar: React.FC = () => {
  const { isMaximized, isFocused, setMaximized, setFocused } = useWindowStore();

  useEffect(() => {
    // We only execute Tauri-specific code if we are in Tauri
    if (window.__TAURI__) {
      const appWindow = new Window('main');
      
      const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
        setFocused(focused);
      });

      const unlistenResize = appWindow.onResized(() => {
        appWindow.isMaximized().then(setMaximized);
      });

      // Initial check
      appWindow.isMaximized().then(setMaximized);

      return () => {
        unlistenFocus.then(f => f());
        unlistenResize.then(f => f());
      };
    }
  }, [setFocused, setMaximized]);

  const handleMinimize = () => {
    if (window.__TAURI__) {
      new Window('main').minimize();
    }
  };

  const handleMaximize = () => {
    if (window.__TAURI__) {
      new Window('main').toggleMaximize();
    }
  };

  const handleClose = () => {
    if (window.__TAURI__) {
      new Window('main').close();
    }
  };

  return (
    <div 
      data-tauri-drag-region 
      className={`h-8 flex items-center justify-between select-none ${isFocused ? 'bg-bg-primary text-text-primary' : 'bg-bg-primary opacity-80 text-text-muted'}`}
    >
      <div className="flex items-center px-3 gap-2 pointer-events-none">
        <div className="w-4 h-4 bg-accent rounded-sm flex items-center justify-center text-[10px] text-white font-bold">N</div>
        <span className="text-xs font-semibold">NexExplorer</span>
      </div>
      
      <div className="flex h-full">
        <button 
          onClick={handleMinimize}
          className="w-11 h-full flex items-center justify-center hover:bg-bg-hover transition-colors"
          tabIndex={-1}
        >
          <Minus size={16} strokeWidth={1.5} />
        </button>
        <button 
          onClick={handleMaximize}
          className="w-11 h-full flex items-center justify-center hover:bg-bg-hover transition-colors"
          tabIndex={-1}
        >
          {isMaximized ? (
            <div className="relative w-3.5 h-3.5 border border-current mt-1 mr-1">
              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border border-current border-b-0 border-l-0"></div>
            </div>
          ) : (
            <Square size={14} strokeWidth={1.5} />
          )}
        </button>
        <button 
          onClick={handleClose}
          className="w-11 h-full flex items-center justify-center hover:bg-error hover:text-white transition-colors"
          tabIndex={-1}
        >
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;
