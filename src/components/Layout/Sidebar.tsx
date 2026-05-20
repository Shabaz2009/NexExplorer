import React, { useEffect, useState } from 'react';
import { Home, Download, FileText, Image, Music, Video, Star, Wifi, Settings, Shield, Monitor } from 'lucide-react';
import { useExplorerStore } from '../../store/explorerStore';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { desktopDir, downloadDir, documentDir, pictureDir, audioDir, videoDir } from '@tauri-apps/api/path';
import SidebarTreeItem from './SidebarTreeItem';

interface DriveInfo {
  letter: string;
  path: string;
  label: string;
  drive_type: string;
}

interface NavItem {
  name: string;
  path: string;
  icon: any;
  color: string;
}

const Sidebar: React.FC = () => {
  const { currentPath, navigateTo } = useExplorerStore();
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  
  const isActive = (pathSnippet: string) => currentPath.toLowerCase().includes(pathSnippet.toLowerCase());

  useEffect(() => {
    const loadDrives = async () => {
      try {
        const driveList = await invoke<DriveInfo[]>('get_drives');
        setDrives(driveList);
      } catch (err) {
        console.error('Failed to load drives:', err);
      }
    };
    
    const loadPaths = async () => {
      try {
        setNavItems([
          { name: 'Desktop', path: await desktopDir(), icon: Home, color: 'text-accent' },
          { name: 'Downloads', path: await downloadDir(), icon: Download, color: 'text-sky-500' },
          { name: 'Documents', path: await documentDir(), icon: FileText, color: 'text-indigo-500' },
          { name: 'Pictures', path: await pictureDir(), icon: Image, color: 'text-emerald-500' },
          { name: 'Music', path: await audioDir(), icon: Music, color: 'text-violet-500' },
          { name: 'Videos', path: await videoDir(), icon: Video, color: 'text-rose-500' },
        ]);
      } catch (err) {
        console.error('Failed to load system paths:', err);
      }
    };
    
    loadDrives();
    loadPaths();
  }, []);

  return (
    <div className="h-full flex flex-col glass border-r border-border/50">
      {/* Branded Header */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 mb-8 group cursor-default">
          <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-xl shadow-accent/20 group-hover:scale-105 interactive border border-white/10 bg-bg-tertiary">
            <img src="/logo.png" alt="NexExplorer" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-text-primary">NexExplorer</h1>
            <p className="text-[10px] text-accent font-bold uppercase tracking-[0.2em] opacity-80">v1.0.0</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-3 pb-4 space-y-6 overflow-y-auto custom-scrollbar">
        {/* Quick Access */}
        <section>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Favorites</span>
            <Star size={10} className="text-text-muted opacity-50" />
          </div>
          <div className="space-y-1">
            {navItems.map((item) => (
              <motion.button 
                key={item.name}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigateTo(item.path)}
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

        {/* This PC / Tree View */}
        <section>
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">This PC</span>
            <Monitor size={10} className="text-text-muted opacity-50" />
          </div>
          <div className="space-y-0.5">
            {drives.map((drive) => (
              <SidebarTreeItem 
                key={drive.path}
                name={drive.label || `Local Disk (${drive.letter}:)`}
                path={drive.path}
                isDrive={true}
              />
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
            onClick={() => navigateTo('localshare://')}
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
