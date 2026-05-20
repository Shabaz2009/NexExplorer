import React, { useEffect } from 'react';
import { useWindowStore } from '../../store/windowStore';
import { Window } from '@tauri-apps/api/window';

declare global {
  interface Window {
    __TAURI__?: boolean;
  }
}

const TitleBar: React.FC = () => {
  const { isFocused, setFocused } = useWindowStore();

  useEffect(() => {
    // We only execute Tauri-specific code if we are in Tauri
    if (window.__TAURI__) {
      const appWindow = new Window('main');
      
      const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
        setFocused(focused);
      });

      return () => {
        unlistenFocus.then(f => f());
      };
    }
  }, [setFocused]);

  return (
    <div 
      data-tauri-drag-region 
      className={`h-8 flex items-center justify-between select-none ${isFocused ? 'bg-bg-primary text-text-primary' : 'bg-bg-primary opacity-80 text-text-muted'}`}
    >
      <div className="flex items-center px-3 gap-2 pointer-events-none">
        <img src="/logo.png" className="w-4 h-4 object-contain" alt="NexExplorer" />
        <span className="text-xs font-semibold uppercase tracking-widest opacity-60">NexExplorer</span>
      </div>
      
      {/* Standard OS buttons are now enabled in tauri.conf.json for maximum reliability */}
      <div className="flex h-full px-4 items-center">
         <div className="w-2 h-2 rounded-full bg-accent/20 animate-pulse" />
      </div>
    </div>
  );
};

export default TitleBar;
