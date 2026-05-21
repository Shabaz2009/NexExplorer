import React from 'react';
import TitleBar from './TitleBar';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import ExplorerView from '../Explorer/ExplorerView';
import TabBar from './TabBar';
import QuickLook from '../Explorer/QuickLook';
import SettingsPanel from './SettingsPanel';
import { invoke } from '@tauri-apps/api/core';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useTabStore } from '../../store/tabStore';
import { useExplorerStore } from '../../store/explorerStore';
import { useEffect } from 'react';
import { useFileOperations } from '../../hooks/useFileOperations';

const MainLayout: React.FC = () => {
  // Initialize keyboard listeners globally
  useKeyboard();

  const { tabs, activeTabId, updateActiveTab } = useTabStore();
  const { currentPath, setCurrentPath, setViewMode, viewMode } = useExplorerStore();
  const { handleCopy, handleCut, handlePaste, handleTrash, handleRename, canPaste } = useFileOperations();
  
  // Sync tab -> explorer
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.path !== currentPath) {
      setCurrentPath(activeTab.path);
      setViewMode(activeTab.viewMode);
    }
  }, [activeTabId]); // Only when active tab changes

  // Sync explorer -> tab
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab && activeTab.path !== currentPath) {
      updateActiveTab({ path: currentPath, viewMode: viewMode });
    }
  }, [currentPath, viewMode]);

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary overflow-hidden font-sans select-none">
      <QuickLook />
      <SettingsPanel />
      {/* Title Bar - Draggable */}
      <div className="glass border-b border-border z-50">
        <TitleBar />
        <TabBar />
        <Toolbar />
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - Glass Effect */}
        <div className="w-64 border-r border-border glass bg-opacity-30 flex-shrink-0 hidden md:block">
          <Sidebar />
        </div>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-bg-secondary relative shadow-inner">
          {/* Subtle top shadow for depth */}
          <div className="absolute inset-x-0 top-0 h-8 pointer-events-none bg-gradient-to-b from-black/10 to-transparent z-10" />
          
          {/* Quick Action Bar */}
          <div className="h-12 flex items-center px-6 border-b border-border bg-bg-tertiary/50 backdrop-blur-sm gap-4 text-xs font-medium z-20 overflow-x-auto no-scrollbar whitespace-nowrap flex-shrink-0">
            <button 
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-bg-hover interactive active:scale-95 flex-shrink-0"
              onClick={() => invoke('create_folder', { path: `${currentPath}\\New Folder` })}
            >
              <span className="text-accent text-lg">+</span> New
            </button>
            <div className="w-px h-5 bg-border"></div>
            <div className="flex items-center gap-1">
              <button 
                onClick={handleCut}
                className="px-3 py-1.5 rounded-md hover:bg-bg-hover interactive active:scale-95 text-text-secondary hover:text-text-primary"
              >
                Cut
              </button>
              <button 
                onClick={handleCopy}
                className="px-3 py-1.5 rounded-md hover:bg-bg-hover interactive active:scale-95 text-text-secondary hover:text-text-primary"
              >
                Copy
              </button>
              <button 
                onClick={handlePaste}
                disabled={!canPaste}
                className="px-3 py-1.5 rounded-md hover:bg-bg-hover interactive active:scale-95 text-text-secondary hover:text-text-primary disabled:opacity-30"
              >
                Paste
              </button>
            </div>
            <div className="w-px h-5 bg-border"></div>
            <button 
              onClick={handleRename}
              className="px-3 py-1.5 rounded-md hover:bg-bg-hover interactive active:scale-95 text-text-secondary hover:text-text-primary"
            >
              Rename
            </button>
            <button 
              onClick={handleTrash}
              className="px-3 py-1.5 rounded-md hover:bg-bg-hover interactive active:scale-95 text-error/80 hover:text-error"
            >
              Delete
            </button>
            
            <div className="ml-auto flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-md hover:bg-bg-hover interactive text-text-secondary">View ▾</button>
              <button className="px-3 py-1.5 rounded-md hover:bg-bg-hover interactive text-text-secondary">Sort ▾</button>
            </div>
          </div>
          
          {/* Main Content Scroll Area */}
          <div className="flex-1 overflow-auto relative p-1">
            <div className="min-h-full">
              <ExplorerView />
            </div>
          </div>
        </main>
      </div>

      <div className="z-50 border-t border-border bg-bg-primary/95 backdrop-blur-md">
        <StatusBar />
      </div>
    </div>
  );
};

export default MainLayout;
