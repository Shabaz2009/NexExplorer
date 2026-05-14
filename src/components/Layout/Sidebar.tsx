import React from 'react';
import { HardDrive, Home, Download, FileText, Image, Music, Video, Star, Box, Wifi, Compass, Layers, Settings, Shield } from 'lucide-react';
import { useExplorerStore } from '../../store/explorerStore';
import { motion } from 'framer-motion';

const Sidebar: React.FC = () => {
  const { currentPath, setCurrentPath } = useExplorerStore();
  
  const isActive = (pathSnippet: string) => currentPath.toLowerCase().includes(pathSnippet.toLowerCase());

  const navItems = [
    { name: 'Desktop', path: 'C:\\Users\\User\\Desktop', icon: Home, color: 'text-accent' },
    { name: 'Downloads', path: 'C:\\Users\\User\\Downloads', icon: Download, color: 'text-sky-500' },
    { name: 'Documents', path: 'C:\\Users\\User\\Documents', icon: FileText, color: 'text-indigo-500' },
    { name: 'Pictures', path: 'C:\\Users\\User\\Pictures', icon: Image, color: 'text-emerald-500' },
    { name: 'Music', path: 'C:\\Users\\User\\Music', icon: Music, color: 'text-violet-500' },
    { name: 'Videos', path: 'C:\\Users\\User\\Videos', icon: Video, color: 'text-rose-500' },
  ];

  return (
    <div className="h-full flex flex-col glass border-r border-border/50">
      {/* Branded Header */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 mb-8 group cursor-default">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-lg shadow-accent/40 group-hover:scale-110 interactive">
            <Compass className="text-white" size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-text-primary">NexExplorer</h1>
            <p className="text-[10px] text-text-muted font-medium uppercase tracking-[0.2em]">Production</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 pb-4 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Quick Access */}
        <section>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Library</span>
            <Star size={10} className="text-text-muted opacity-50" />
          </div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <motion.button 
                key={item.name}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentPath(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium interactive ${
                  isActive(item.name.toLowerCase()) 
                    ? 'bg-accent/15 text-text-primary border border-accent/20' 
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent'
                }`}
              >
                <item.icon size={16} className={isActive(item.name.toLowerCase()) ? 'text-accent' : 'text-text-muted group-hover:text-text-primary'} />
                <span>{item.name}</span>
                {isActive(item.name.toLowerCase()) && (
                  <motion.div layoutId="active-nav" className="ml-auto w-1 h-4 bg-accent rounded-full" />
                )}
              </motion.button>
            ))}
          </div>
        </section>

        {/* This PC / Drives */}
        <section>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">System</span>
            <Layers size={10} className="text-text-muted opacity-50" />
          </div>
          <div className="space-y-2">
            {[
              { name: 'Windows (C:)', path: 'C:\\', usage: '75%' },
              { name: 'Data (D:)', path: 'D:\\', usage: '25%' }
            ].map((drive) => (
              <motion.button 
                key={drive.name}
                whileHover={{ x: 4 }}
                onClick={() => setCurrentPath(drive.path)}
                className={`w-full flex flex-col p-3 rounded-xl text-left interactive ${
                  currentPath === drive.path 
                    ? 'bg-bg-tertiary border border-border-strong text-text-primary' 
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <HardDrive size={16} className={currentPath === drive.path ? 'text-accent' : 'text-text-muted'} />
                  <span className="text-[13px] font-medium">{drive.name}</span>
                </div>
                <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden border border-border/20">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: drive.usage }}
                    className="h-full bg-accent shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                  />
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* LocalShare */}
        <section>
          <div className="px-3 mb-2">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Network</span>
          </div>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            onClick={() => setCurrentPath('localshare://')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[13px] font-semibold interactive ${
              currentPath === 'localshare://' 
                ? 'bg-accent text-white shadow-xl shadow-accent/30' 
                : 'bg-bg-tertiary/50 border border-border/50 text-text-secondary hover:text-text-primary hover:border-accent/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <Wifi size={18} className={currentPath === 'localshare://' ? 'text-white' : 'text-accent'} />
              <span>LocalShare</span>
            </div>
            <div className={`text-[10px] px-2 py-0.5 rounded-full ${currentPath === 'localshare://' ? 'bg-white/20' : 'bg-accent/20 text-accent'}`}>
              LIVE
            </div>
          </motion.button>
        </section>
      </div>

      {/* Footer Settings */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-between gap-2 px-2">
          <button className="p-2 rounded-lg hover:bg-bg-hover interactive text-text-muted hover:text-text-primary">
            <Settings size={18} />
          </button>
          <button className="p-2 rounded-lg hover:bg-bg-hover interactive text-text-muted hover:text-text-primary">
            <Shield size={18} />
          </button>
          <div className="w-px h-4 bg-border"></div>
          <div className="text-[10px] font-bold text-text-muted">v1.0.0</div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
