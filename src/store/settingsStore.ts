import { create } from 'zustand';

interface SettingsState {
  theme: 'dark' | 'light' | 'system';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  setTheme: (theme) => set({ theme }),
}));
