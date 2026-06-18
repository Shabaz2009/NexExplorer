import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useSelectionStore } from '../../store/selectionStore';
import { useExplorerStore } from '../../store/explorerStore';
import { formatBytes } from '../../utils/formatters';
import ViewToggle from '../Explorer/ViewToggle';

interface DriveSpace {
  path: string;
  free_space: number;
  total_space: number;
}

const StatusBar: React.FC = () => {
  const { files } = useFileSystem();
  const { selectedPaths } = useSelectionStore();
  const { currentPath } = useExplorerStore();
  const [driveSpace, setDriveSpace] = useState<DriveSpace | null>(null);

  // Optimized size calculation using a Map lookup
  const selectedSize = React.useMemo(() => {
    if (selectedPaths.size === 0) return 0;
    const fileMap = new Map(files.map(f => [f.path, f.size]));
    return Array.from(selectedPaths).reduce((acc, path) => acc + (fileMap.get(path) || 0), 0);
  }, [files, selectedPaths]);

  // Fetch real disk space for the current drive
  useEffect(() => {
    // Only fetch for real filesystem paths, not virtual routes
    if (currentPath.startsWith('nexdrop://') || currentPath.startsWith('localshare://') || currentPath.startsWith('http')) {
      setDriveSpace(null);
      return;
    }
    (async () => {
      try {
        const drives = await invoke<{ path: string; free_space: number; total_space: number }[]>('get_drives');
        // Find the drive that matches the current path's root (e.g. "C:\\")
        const driveLetter = currentPath.substring(0, 3).toUpperCase(); // "C:\\"
        const match = drives.find(d => d.path.toUpperCase() === driveLetter);
        if (match) {
          setDriveSpace({ path: match.path, free_space: match.free_space, total_space: match.total_space });
        }
      } catch {
        // Silently fail — StatusBar is non-critical
      }
    })();
  }, [currentPath]);

  return (
    <div className="h-6 bg-bg-secondary border-t border-border flex items-center px-3 text-[11px] text-text-secondary select-none">
      <div className="flex-1 flex gap-4 items-center">
        <span>{files.length} items</span>
        <div className="w-px h-3 bg-border my-auto"></div>
        <span>{selectedPaths.size} selected</span>
        {selectedPaths.size > 0 && (
          <>
            <div className="w-px h-3 bg-border my-auto"></div>
            <span>{formatBytes(selectedSize)}</span>
          </>
        )}
      </div>
      <div className="flex gap-4 items-center">
        {driveSpace && driveSpace.free_space > 0 && (
          <span>Disk: {formatBytes(driveSpace.free_space)} free</span>
        )}
        <ViewToggle />
      </div>
    </div>
  );
};

export default StatusBar;
