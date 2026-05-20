import React, { useState, useEffect, memo } from 'react';
import { ChevronRight, ChevronDown, Folder, HardDrive } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useExplorerStore } from '../../store/explorerStore';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarTreeItemProps {
  name: string;
  path: string;
  isDrive?: boolean;
  level?: number;
}

interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

const SidebarTreeItem: React.FC<SidebarTreeItemProps> = memo(({ name, path, isDrive = false, level = 0 }) => {
  const { currentPath, navigateTo } = useExplorerStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isActive = currentPath === path;

  useEffect(() => {
    if (isExpanded && children.length === 0) {
      loadChildren();
    }
  }, [isExpanded]);

  const loadChildren = async () => {
    setIsLoading(true);
    try {
      const entries = await invoke<FileEntry[]>('read_dir', { path });
      setChildren(entries.filter(e => e.is_dir).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Failed to load sidebar children:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleNavigate = () => {
    navigateTo(path);
  };

  return (
    <div className="select-none">
      <motion.div 
        whileHover={{ x: 2 }}
        onClick={handleNavigate}
        className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
          isActive 
            ? 'bg-accent/15 text-text-primary border border-accent/20' 
            : 'text-text-secondary hover:bg-white/5 hover:text-text-primary border border-transparent'
        }`}
        style={{ paddingLeft: `${(level * 12) + 8}px` }}
      >
        <div 
          onClick={handleExpand}
          className={`p-0.5 rounded hover:bg-white/10 transition-colors ${children.length === 0 && !isExpanded ? 'invisible' : ''}`}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        
        {isDrive ? (
          <HardDrive size={16} className={isActive ? 'text-accent' : 'text-text-muted'} />
        ) : (
          <Folder size={16} className={isActive ? 'text-accent' : 'text-text-muted'} />
        )}
        
        <span className="text-[13px] font-medium truncate">{name}</span>
      </motion.div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {isLoading ? (
              <div className="py-1 text-[11px] text-text-muted italic" style={{ paddingLeft: `${(level + 1) * 12 + 28}px` }}>
                Loading...
              </div>
            ) : (
              children.map(child => (
                <SidebarTreeItem 
                  key={child.path}
                  name={child.name}
                  path={child.path}
                  level={level + 1}
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default SidebarTreeItem;
