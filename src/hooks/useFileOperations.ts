import { invoke } from '@tauri-apps/api/core';
import { useSelectionStore } from '../store/selectionStore';
import { useClipboardStore } from '../store/clipboardStore';
import { useExplorerStore } from '../store/explorerStore';
import { useFileSystem } from './useFileSystem';
import { toast } from 'sonner';

export function useFileOperations() {
  const { selectedPaths, clearSelection } = useSelectionStore();
  const { setClipboard, paths: clipboardPaths, operation: clipboardOp, clearClipboard } = useClipboardStore();
  const { currentPath } = useExplorerStore();
  const { refresh } = useFileSystem();

  const handleCopy = () => {
    if (selectedPaths.size === 0) return;
    setClipboard(Array.from(selectedPaths), 'copy');
    toast.success(`Copied ${selectedPaths.size} items`);
  };

  const handleCut = () => {
    if (selectedPaths.size === 0) return;
    setClipboard(Array.from(selectedPaths), 'cut');
    toast.success(`Cut ${selectedPaths.size} items`);
  };

  const handlePaste = async () => {
    if (clipboardPaths.length === 0 || !clipboardOp) return;

    try {
      if (clipboardOp === 'copy') {
        await invoke('bulk_copy', { sources: clipboardPaths, dest_dir: currentPath });
        toast.success(`Pasted ${clipboardPaths.length} items`);
      } else {
        await invoke('bulk_move', { sources: clipboardPaths, dest_dir: currentPath });
        toast.success(`Moved ${clipboardPaths.length} items`);
        clearClipboard();
      }
      refresh();
    } catch (err) {
      console.error('Paste failed:', err);
      toast.error(`Paste failed: ${err}`);
    }
  };

  const handleTrash = async () => {
    if (selectedPaths.size === 0) return;
    
    try {
      await invoke('trash_items', { paths: Array.from(selectedPaths) });
      toast.success(`Moved ${selectedPaths.size} items to Recycle Bin`);
      clearSelection();
      refresh();
    } catch (err) {
      console.error('Trash failed:', err);
      toast.error(`Failed to delete: ${err}`);
    }
  };

  const handleRename = async () => {
    if (selectedPaths.size !== 1) return;
    // For now we will just use a prompt, later a rename input in the grid
    const oldPath = Array.from(selectedPaths)[0];
    const oldName = oldPath.split('\\').pop() || '';
    const newName = prompt('Enter new name:', oldName);
    
    if (newName && newName !== oldName) {
      try {
        await invoke('rename_file', { path: oldPath, new_name: newName });
        refresh();
        clearSelection();
      } catch (err) {
        toast.error(`Rename failed: ${err}`);
      }
    }
  };

  return {
    handleCopy,
    handleCut,
    handlePaste,
    handleTrash,
    handleRename,
    canPaste: clipboardPaths.length > 0
  };
}
