import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Search, Settings, Moon, Sun, Monitor, Wrench, BarChart3, Copy } from 'lucide-react';
import AddressBar from './AddressBar';
import { useTheme } from '../../hooks/useTheme';
import { useExplorerStore } from '../../store/explorerStore';
import { useSettingsStore } from '../../store/settingsStore';
import DiskAnalyzer from '../Tools/DiskAnalyzer';
import DuplicateFinder from '../Tools/DuplicateFinder';

const Toolbar: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { currentPath, goBack, goForward, goUp, historyIndex, history } = useExplorerStore();
  const [showTools, setShowTools] = useState(false);
  const [activeTool, setActiveTool] = useState<'analyzer' | 'duplicates' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { openSettings } = useSettingsStore();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // We need a way to tell the explorer to show search results
      // For now we will hijack the current view logic in useFileSystem
      (window as any)._nexSearch = searchQuery;
      window.dispatchEvent(new CustomEvent('nex-search', { detail: searchQuery }));
    }
  };

  const getThemeIcon = () => {
    if (theme === 'dark') return <Moon size={16} />;
    if (theme === 'light') return <Sun size={16} />;
    return <Monitor size={16} />;
  };

  return (
    <div className="h-12 flex items-center px-2 bg-bg-primary border-b border-border gap-2 relative">
      {activeTool === 'analyzer' && <DiskAnalyzer initialPath={currentPath} onClose={() => setActiveTool(null)} />}
      {activeTool === 'duplicates' && <DuplicateFinder initialPath={currentPath} onClose={() => setActiveTool(null)} />}

      <div className="flex items-center gap-1">
        <button 
          onClick={goBack}
          disabled={historyIndex === 0}
          className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowLeft size={18} />
        </button>
        <button 
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
          className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ArrowRight size={18} />
        </button>
        <button 
          className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
          onClick={goUp}
        >
          <ArrowUp size={18} />
        </button>
      </div>

      <div className="flex-1 px-2 min-w-0">
        <AddressBar />
      </div>

      <div className="flex items-center gap-1">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="w-48 h-7 bg-bg-secondary border border-border rounded px-8 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <Search size={14} className="absolute left-2.5 top-1.5 text-text-muted" />
        </div>
        
        <div className="w-px h-6 bg-border mx-1"></div>
        
        <div className="relative">
          <button 
            onClick={() => setShowTools(!showTools)}
            className={`p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors ${showTools ? 'bg-accent/10 text-accent' : ''}`}
            title="NexTools"
          >
            <Wrench size={18} />
          </button>

          {showTools && (
            <div className="absolute right-0 mt-2 w-48 bg-bg-secondary border border-border rounded-xl shadow-2xl py-2 z-[60] glass">
              <button 
                onClick={() => { setActiveTool('analyzer'); setShowTools(false); }}
                className="w-full px-4 py-2 text-left hover:bg-accent hover:text-white flex items-center gap-3 text-xs font-bold transition-colors"
              >
                <BarChart3 size={14} /> Disk Analyzer
              </button>
              <button 
                onClick={() => { setActiveTool('duplicates'); setShowTools(false); }}
                className="w-full px-4 py-2 text-left hover:bg-accent hover:text-white flex items-center gap-3 text-xs font-bold transition-colors"
              >
                <Copy size={14} /> Duplicate Finder
              </button>
            </div>
          )}
        </div>

        <button onClick={openSettings} className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary" title="Settings">
          <Settings size={18} />
        </button>
        <button 
          onClick={cycleTheme}
          className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
          title={`Theme: ${theme}`}
        >
          {getThemeIcon()}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
