import { invoke } from '@tauri-apps/api/core';
import { useSelectionStore } from '../store/selectionStore';
import { useClipboardStore } from '../store/clipboardStore';
import { useExplorerStore } from '../store/explorerStore';
import { useFileSystem } from './useFileSystem';
import { toast } from 'sonner';

/**
 * File operations hook — handles copy, cut, paste, trash, and rename.
 * 
 * `handleRename` no longer calls window.prompt() (which freezes the Tauri
 * webview). Instead it calls `onRequestRename(oldPath, oldName)` so the
 * parent component can open a non-blocking InputDialog.
 */
interface UseFileOperationsOptions {
  onRequestRename?: (oldPath: string, oldName: string) => void;
}

export function useFileOperations(options: UseFileOperationsOptions = {}) {
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
    
    // Respect the user's confirmDelete preference from Settings
    const { confirmDelete } = (await import('../store/settingsStore')).useSettingsStore.getState();
    if (confirmDelete) {
      const { ask } = await import('@tauri-apps/plugin-dialog');
      const confirmed = await ask(
        `Move ${selectedPaths.size} item(s) to the Recycle Bin?`,
        { title: 'Confirm Delete', kind: 'warning' }
      );
      if (!confirmed) return;
    }

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

  const handleRename = () => {
    if (selectedPaths.size !== 1) return;
    const oldPath = Array.from(selectedPaths)[0];
    const oldName = oldPath.split('\\').pop() || '';

    if (options.onRequestRename) {
      // Non-blocking: parent opens InputDialog
      options.onRequestRename(oldPath, oldName);
    }
  };

  /** Called by InputDialog after the user confirms a new name. */
  const executeRename = async (oldPath: string, newName: string) => {
    try {
      await invoke('rename_file', { path: oldPath, new_name: newName });
      refresh();
      clearSelection();
      toast.success(`Renamed to "${newName}"`);
    } catch (err) {
      toast.error(`Rename failed: ${err}`);
    }
  };

  return {
    handleCopy,
    handleCut,
    handlePaste,
    handleTrash,
    handleRename,
    executeRename,
    canPaste: clipboardPaths.length > 0
  };
}

