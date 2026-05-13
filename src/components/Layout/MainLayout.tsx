import React from 'react';
import TitleBar from './TitleBar';
import Toolbar from './Toolbar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';
import ExplorerView from '../Explorer/ExplorerView';
import TabBar from './TabBar';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useTabStore } from '../../store/tabStore';
import { useExplorerStore } from '../../store/explorerStore';
import { useEffect } from 'react';

const MainLayout: React.FC = () => {
  // Initialize keyboard listeners globally
  useKeyboard();

  const { tabs, activeTabId } = useTabStore();
  const { setCurrentPath, setViewMode } = useExplorerStore();
  
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      setCurrentPath(activeTab.path);
      setViewMode(activeTab.viewMode);
    }
  }, [activeTabId, tabs, setCurrentPath, setViewMode]);

  return (
    <div className="flex flex-col h-screen bg-bg-primary text-text-primary overflow-hidden">
      <TitleBar />
      <TabBar />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 bg-bg-secondary">
          {/* Action Bar (New, Cut, Copy, etc) */}
          <div className="h-10 flex items-center px-4 border-b border-border bg-bg-primary gap-2 text-sm">
            <button className="px-2 py-1 rounded hover:bg-bg-hover">New ▾</button>
            <div className="w-px h-4 bg-border mx-1"></div>
            <button className="px-2 py-1 rounded hover:bg-bg-hover">Cut</button>
            <button className="px-2 py-1 rounded hover:bg-bg-hover">Copy</button>
            <button className="px-2 py-1 rounded hover:bg-bg-hover">Paste</button>
            <button className="px-2 py-1 rounded hover:bg-bg-hover">Rename</button>
            <button className="px-2 py-1 rounded hover:bg-bg-hover">Delete</button>
            <div className="w-px h-4 bg-border mx-1"></div>
            <button className="px-2 py-1 rounded hover:bg-bg-hover">View ▾</button>
            <button className="px-2 py-1 rounded hover:bg-bg-hover">Sort ▾</button>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-auto relative">
            <ExplorerView />
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  );
};

export default MainLayout;
