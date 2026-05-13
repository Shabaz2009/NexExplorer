import { create } from 'zustand';

interface WindowState {
  isMaximized: boolean;
  isFocused: boolean;
  setMaximized: (val: boolean) => void;
  setFocused: (val: boolean) => void;
}

export const useWindowStore = create<WindowState>((set) => ({
  isMaximized: false,
  isFocused: true,
  setMaximized: (val) => set({ isMaximized: val }),
  setFocused: (val) => set({ isFocused: val }),
}));
