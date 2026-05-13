import React from 'react';
import { HardDrive, Home, Download, FileText, Image, Music, Video, Star, Box, Wifi } from 'lucide-react';
import { useExplorerStore } from '../../store/explorerStore';

const Sidebar: React.FC = () => {
  const { currentPath, setCurrentPath } = useExplorerStore();
  
  // Basic naive helper for styling active states
  const isActive = (pathSnippet: string) => currentPath.toLowerCase().includes(pathSnippet.toLowerCase());
  return (
    <div className="w-60 bg-bg-tertiary border-r border-border flex flex-col overflow-y-auto overflow-x-hidden">
      <div className="p-2 space-y-0.5">
        
        {/* Quick Access */}
        <div className="mb-4">
          <div className="px-2 py-1 text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">Quick Access</div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover text-sm text-text-primary">
            <Star size={16} className="text-warning" />
            <span>Favorites</span>
          </button>
          <button 
            onClick={() => setCurrentPath('C:\\Users\\User\\Desktop')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isActive('desktop') ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <Home size={16} className="text-accent" />
            <span>Desktop</span>
          </button>
          <button 
            onClick={() => setCurrentPath('C:\\Users\\User\\Downloads')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isActive('downloads') ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <Download size={16} className="text-accent" />
            <span>Downloads</span>
          </button>
          <button 
            onClick={() => setCurrentPath('C:\\Users\\User\\Documents')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isActive('documents') ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <FileText size={16} className="text-accent" />
            <span>Documents</span>
          </button>
          <button 
            onClick={() => setCurrentPath('C:\\Users\\User\\Pictures')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isActive('pictures') ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <Image size={16} className="text-accent" />
            <span>Pictures</span>
          </button>
          <button 
            onClick={() => setCurrentPath('C:\\Users\\User\\Music')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isActive('music') ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <Music size={16} className="text-accent" />
            <span>Music</span>
          </button>
          <button 
            onClick={() => setCurrentPath('C:\\Users\\User\\Videos')}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isActive('videos') ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <Video size={16} className="text-accent" />
            <span>Videos</span>
          </button>
        </div>

        {/* This PC */}
        <div className="mb-4">
          <div className="px-2 py-1 text-xs font-semibold text-text-muted mb-1 uppercase tracking-wider">This PC</div>
          <button 
            onClick={() => setCurrentPath('C:\\')}
            className={`w-full flex flex-col px-2 py-1.5 rounded text-sm text-left ${currentPath === 'C:\\' ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-text-secondary" />
              <span>Windows (C:)</span>
            </div>
            <div className="mt-1.5 w-full h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-accent w-3/4"></div>
            </div>
          </button>
          <button 
            onClick={() => setCurrentPath('D:\\')}
            className={`w-full flex flex-col px-2 py-1.5 rounded text-sm text-left mt-1 ${currentPath === 'D:\\' ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <div className="flex items-center gap-2">
              <HardDrive size={16} className="text-text-secondary" />
              <span>Data (D:)</span>
            </div>
            <div className="mt-1.5 w-full h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full bg-accent w-1/4"></div>
            </div>
          </button>
        </div>

        {/* Archives */}
        <div className="mb-4">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-bg-hover text-sm text-text-primary">
            <Box size={16} className="text-text-secondary" />
            <span>Archives</span>
          </button>
        </div>

        {/* LocalShare */}
        <div className="mb-2">
          <button 
            onClick={() => setCurrentPath('localshare://')}
            className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm ${currentPath === 'localshare://' ? 'bg-bg-hover text-text-primary' : 'hover:bg-bg-hover text-text-primary'}`}
          >
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-accent" />
              <span>LocalShare</span>
            </div>
            <span className="text-xs bg-accent text-white px-1.5 rounded-full">3</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default Sidebar;
