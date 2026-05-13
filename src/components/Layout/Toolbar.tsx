import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUp, Search, Settings, Moon, Sun, Monitor } from 'lucide-react';
import AddressBar from './AddressBar';
import { useTheme } from '../../hooks/useTheme';
import { useExplorerStore } from '../../store/explorerStore';

const Toolbar: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { currentPath, setCurrentPath } = useExplorerStore();

  const cycleTheme = () => {
    if (theme === 'system') setTheme('dark');
    else if (theme === 'dark') setTheme('light');
    else setTheme('system');
  };

  const getThemeIcon = () => {
    if (theme === 'dark') return <Moon size={16} />;
    if (theme === 'light') return <Sun size={16} />;
    return <Monitor size={16} />;
  };

  return (
    <div className="h-12 flex items-center px-2 bg-bg-primary border-b border-border gap-2">
      <div className="flex items-center gap-1">
        <button className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-50">
          <ArrowLeft size={18} />
        </button>
        <button className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary disabled:opacity-50" disabled>
          <ArrowRight size={18} />
        </button>
        <button 
          className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
          onClick={() => {
            const segments = currentPath.split('\\').filter(Boolean);
            if (segments.length > 0) {
              segments.pop();
              let newPath = segments.join('\\');
              if (newPath === '') newPath = 'C:\\'; // Default root
              else newPath += '\\';
              setCurrentPath(newPath);
            }
          }}
        >
          <ArrowUp size={18} />
        </button>
      </div>

      <div className="flex-1 px-2">
        <AddressBar />
      </div>

      <div className="flex items-center gap-1">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search..." 
            className="w-48 h-7 bg-bg-secondary border border-border rounded px-8 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <Search size={14} className="absolute left-2.5 top-1.5 text-text-muted" />
        </div>
        
        <div className="w-px h-6 bg-border mx-1"></div>
        
        <button className="p-1.5 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary">
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
