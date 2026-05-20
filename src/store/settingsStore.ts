import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AccentColor = 'indigo' | 'cyan' | 'emerald' | 'rose' | 'amber' | 'violet';
export type FontSize = 'small' | 'medium' | 'large';

interface SettingsState {
  isSettingsOpen: boolean;
  theme: 'dark' | 'light' | 'system';
  accentColor: AccentColor;
  fontSize: FontSize;
  compactMode: boolean;
  disableAnimations: boolean;
  doubleClickToOpen: boolean;
  confirmDelete: boolean;
  rememberLastLocation: boolean;
  disableThumbnails: boolean;
  disablePreviews: boolean;
  maxFilesBeforePaginate: number;
  shellIntegration: boolean;

  localShareAlias: string;
  localShareSaveDirectory: string;
  localSharePort: number;
  localShareAutoAccept: boolean;

  openSettings: () => void;
  closeSettings: () => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setAccentColor: (color: AccentColor) => void;
  setFontSize: (size: FontSize) => void;
  setCompactMode: (enabled: boolean) => void;
  setDisableAnimations: (disabled: boolean) => void;
  setDoubleClickToOpen: (enabled: boolean) => void;
  setConfirmDelete: (enabled: boolean) => void;
  setRememberLastLocation: (enabled: boolean) => void;
  setDisableThumbnails: (disabled: boolean) => void;
  setDisablePreviews: (disabled: boolean) => void;
  setMaxFilesBeforePaginate: (count: number) => void;
  setShellIntegration: (enabled: boolean) => void;

  setLocalShareAlias: (alias: string) => void;
  setLocalShareSaveDirectory: (dir: string) => void;
  setLocalSharePort: (port: number) => void;
  setLocalShareAutoAccept: (autoAccept: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      isSettingsOpen: false,
      theme: 'dark',
      accentColor: 'indigo',
      fontSize: 'medium',
      compactMode: false,
      disableAnimations: false,
      doubleClickToOpen: true,
      confirmDelete: true,
      rememberLastLocation: true,
      disableThumbnails: false,
      disablePreviews: false,
      maxFilesBeforePaginate: 1000,
      shellIntegration: false,

      localShareAlias: '',
      localShareSaveDirectory: '',
      localSharePort: 53317,
      localShareAutoAccept: true,

      openSettings: () => set({ isSettingsOpen: true }),
      closeSettings: () => set({ isSettingsOpen: false }),
      setTheme: (theme) => set({ theme }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setFontSize: (fontSize) => set({ fontSize }),
      setCompactMode: (compactMode) => set({ compactMode }),
      setDisableAnimations: (disableAnimations) => set({ disableAnimations }),
      setDoubleClickToOpen: (doubleClickToOpen) => set({ doubleClickToOpen }),
      setConfirmDelete: (confirmDelete) => set({ confirmDelete }),
      setRememberLastLocation: (rememberLastLocation) => set({ rememberLastLocation }),
      setDisableThumbnails: (disableThumbnails) => set({ disableThumbnails }),
      setDisablePreviews: (disablePreviews) => set({ disablePreviews }),
      setMaxFilesBeforePaginate: (maxFilesBeforePaginate) => set({ maxFilesBeforePaginate }),
      setShellIntegration: (shellIntegration) => set({ shellIntegration }),

      setLocalShareAlias: (localShareAlias) => set({ localShareAlias }),
      setLocalShareSaveDirectory: (localShareSaveDirectory) => set({ localShareSaveDirectory }),
      setLocalSharePort: (localSharePort) => set({ localSharePort }),
      setLocalShareAutoAccept: (localShareAutoAccept) => set({ localShareAutoAccept }),
    }),
    {
      name: 'nex-settings',
    }
  )
);
