import { create } from 'zustand';

interface ClipboardState {
  paths: string[];
  operation: 'copy' | 'cut' | null;
  setClipboard: (paths: string[], operation: 'copy' | 'cut') => void;
  clearClipboard: () => void;
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  paths: [],
  operation: null,
  setClipboard: (paths, operation) => set({ paths, operation }),
  clearClipboard: () => set({ paths: [], operation: null })
}));
