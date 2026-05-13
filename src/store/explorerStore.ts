import { create } from 'zustand';

export type ViewMode = 'xl' | 'lg' | 'md' | 'sm' | 'list' | 'details' | 'content' | 'dualpane';
export type SortField = 'name' | 'dateModified' | 'type' | 'size' | 'dateCreated';
export type GroupField = 'none' | 'name' | 'date' | 'type' | 'size';

interface ExplorerState {
  currentPath: string;
  viewMode: ViewMode;
  iconSize: number; // 48 to 256
  sortBy: SortField;
  sortDirection: 'asc' | 'desc';
  groupBy: GroupField;
  showHidden: boolean;
  showExtensions: boolean;
  showPreviewPane: boolean;
  showDetailsPane: boolean;
  // Inspired by Explorer++ Config.h: bool dualPane = false
  dualPane: boolean;
  // Navigation history stack
  history: string[];
  historyIndex: number;

  setCurrentPath: (path: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setIconSize: (size: number) => void;
  setSort: (by: SortField, direction: 'asc' | 'desc') => void;
  setGroupBy: (by: GroupField) => void;
  toggleHidden: () => void;
  toggleExtensions: () => void;
  togglePreviewPane: () => void;
  toggleDetailsPane: () => void;
  toggleDualPane: () => void;
  navigateTo: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  currentPath: 'C:\\',
  viewMode: 'md',
  iconSize: 96,
  sortBy: 'name',
  sortDirection: 'asc',
  groupBy: 'none',
  showHidden: false,
  showExtensions: true,
  showPreviewPane: false,
  showDetailsPane: false,
  dualPane: false,
  history: ['C:\\'],
  historyIndex: 0,

  setCurrentPath: (path) => set({ currentPath: path }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setIconSize: (size) => set({ iconSize: size }),
  setSort: (by, direction) => set({ sortBy: by, sortDirection: direction }),
  setGroupBy: (by) => set({ groupBy: by }),
  toggleHidden: () => set((state) => ({ showHidden: !state.showHidden })),
  toggleExtensions: () => set((state) => ({ showExtensions: !state.showExtensions })),
  togglePreviewPane: () => set((state) => ({ showPreviewPane: !state.showPreviewPane })),
  toggleDetailsPane: () => set((state) => ({ showDetailsPane: !state.showDetailsPane })),
  toggleDualPane: () => set((state) => ({ 
    dualPane: !state.dualPane,
    viewMode: !state.dualPane ? 'dualpane' : 'md',
  })),

  navigateTo: (path) => {
    const state = get();
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(path);
    set({ 
      currentPath: path, 
      history: newHistory, 
      historyIndex: newHistory.length - 1 
    });
  },

  goBack: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      set({ 
        currentPath: state.history[newIndex], 
        historyIndex: newIndex 
      });
    }
  },

  goForward: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      set({ 
        currentPath: state.history[newIndex], 
        historyIndex: newIndex 
      });
    }
  },

  goUp: () => {
    const state = get();
    const parts = state.currentPath.split('\\').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('\\') + '\\';
      get().navigateTo(parentPath);
    }
  },
}));
