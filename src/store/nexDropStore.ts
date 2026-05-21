import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface TrustedDevice {
  ip: string;
  alias: string;
  port: number;
  device_type: string;
  fingerprint: string;
  last_seen?: number;
}

interface NexDropState {
  queuedPaths: string[];
  setQueuedPaths: (paths: string[]) => void;
  addQueuedPaths: (paths: string[]) => void;
  removeQueuedPath: (path: string) => void;
  clearQueuedPaths: () => void;
  
  trustedDevices: TrustedDevice[];
  addTrustedDevice: (device: TrustedDevice) => void;
  removeTrustedDevice: (ip: string) => void;
}

const dedupePaths = (paths: string[]) => Array.from(new Set(paths.filter(Boolean)));

export const useNexDropStore = create<NexDropState>()(
  persist(
    (set) => ({
      queuedPaths: [],
      setQueuedPaths: (paths) => set({ queuedPaths: dedupePaths(paths) }),
      addQueuedPaths: (paths) => set((state) => ({ queuedPaths: dedupePaths([...state.queuedPaths, ...paths]) })),
      removeQueuedPath: (path) => set((state) => ({ queuedPaths: state.queuedPaths.filter((item) => item !== path) })),
      clearQueuedPaths: () => set({ queuedPaths: [] }),
      
      trustedDevices: [],
      addTrustedDevice: (device) => set((state) => {
        const existing = state.trustedDevices.findIndex(d => d.ip === device.ip);
        if (existing >= 0) {
          const newDevices = [...state.trustedDevices];
          newDevices[existing] = { ...newDevices[existing], ...device, last_seen: Date.now() };
          return { trustedDevices: newDevices };
        }
        return { trustedDevices: [...state.trustedDevices, { ...device, last_seen: Date.now() }] };
      }),
      removeTrustedDevice: (ip) => set((state) => ({
        trustedDevices: state.trustedDevices.filter(d => d.ip !== ip)
      })),
    }),
    {
      name: 'nexexplorer-nexdrop-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ trustedDevices: state.trustedDevices }),
    }
  )
);
