import React from 'react';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useSelectionStore } from '../../store/selectionStore';
import { formatBytes } from '../../utils/formatters';
import ViewToggle from '../Explorer/ViewToggle';

const StatusBar: React.FC = () => {
  const { files } = useFileSystem();
  const { selectedPaths } = useSelectionStore();

  // Calculate selected size
  const selectedSize = Array.from(selectedPaths).reduce((acc, path) => {
    const file = files.find(f => f.path === path);
    return acc + (file?.size || 0);
  }, 0);

  // Note: in a real implementation we would fetch drive space from rust
  // For now we will mock it or leave it generic

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
        <span>Disk: 256 GB free</span>
        <ViewToggle />
      </div>
    </div>
  );
};

export default StatusBar;
