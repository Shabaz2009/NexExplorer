import { create } from 'zustand';
import { ViewMode, SortField } from './explorerStore';

export interface TabState {
  id: string;
  path: string;
  title: string;
  viewMode: ViewMode;
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
}

interface TabStore {
  tabs: TabState[];
  activeTabId: string;
  
  addTab: (path: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateActiveTab: (updates: Partial<TabState>) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useTabStore = create<TabStore>((set) => ({
  tabs: [
    {
      id: generateId(),
      path: 'C:\\',
      title: 'Local Disk (C:)',
      viewMode: 'md',
      sortBy: 'name',
      sortDirection: 'asc',
    }
  ],
  activeTabId: '', // Set immediately after creation
  
  addTab: (path) => set((state) => {
    const id = generateId();
    // Default title from path
    const segments = path.split('\\').filter(Boolean);
    const title = segments.length > 0 ? segments[segments.length - 1] : 'New Tab';
    
    return {
      tabs: [...state.tabs, {
        id,
        path,
        title,
        viewMode: 'md',
        sortBy: 'name',
        sortDirection: 'asc'
      }],
      activeTabId: id
    };
  }),
  
  closeTab: (id) => set((state) => {
    if (state.tabs.length <= 1) return state; // Don't close last tab
    
    const newTabs = state.tabs.filter(t => t.id !== id);
    let newActiveId = state.activeTabId;
    
    if (state.activeTabId === id) {
      const closedIndex = state.tabs.findIndex(t => t.id === id);
      newActiveId = newTabs[Math.max(0, closedIndex - 1)].id;
    }
    
    return { tabs: newTabs, activeTabId: newActiveId };
  }),
  
  setActiveTab: (id) => set({ activeTabId: id }),
  
  updateActiveTab: (updates) => set((state) => ({
    tabs: state.tabs.map(tab => 
      tab.id === state.activeTabId 
        ? { ...tab, ...updates, title: updates.path ? updates.path.split('\\').filter(Boolean).pop() || tab.title : tab.title } 
        : tab
    )
  }))
}));
