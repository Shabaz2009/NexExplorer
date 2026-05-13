import { create } from 'zustand';

interface SelectionState {
  selectedPaths: Set<string>;
  toggleSelection: (path: string, multi: boolean) => void;
  selectAll: (paths: string[]) => void;
  clearSelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedPaths: new Set(),
  
  toggleSelection: (path, multi) => set((state) => {
    const newSelection = multi ? new Set(state.selectedPaths) : new Set<string>();
    if (newSelection.has(path)) {
      newSelection.delete(path);
    } else {
      newSelection.add(path);
    }
    return { selectedPaths: newSelection };
  }),
  
  selectAll: (paths) => set({ selectedPaths: new Set(paths) }),
  clearSelection: () => set({ selectedPaths: new Set() })
}));
