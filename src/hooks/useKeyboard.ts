import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useExplorerStore } from '../store/explorerStore';
import { useSelectionStore } from '../store/selectionStore';
import { useClipboardStore } from '../store/clipboardStore';
import { useFileSystem } from './useFileSystem';
import { useFileOperations } from './useFileOperations';
import { toast } from 'sonner';

interface UseKeyboardOptions {
  onRequestNewFolder?: () => void;
}

export function useKeyboard(options: UseKeyboardOptions = {}) {
  const { onRequestNewFolder } = options;
  const { currentPath, setCurrentPath, quickLookFile, setQuickLookFile, goBack, goForward, toggleHidden } = useExplorerStore();
  const { selectedPaths, clearSelection, selectAll } = useSelectionStore();
  const { setClipboard, paths: clipboardPaths, operation: clipboardOp, clearClipboard } = useClipboardStore();
  const { files, refresh } = useFileSystem();
  const { handleRename } = useFileOperations();

  useEffect(() => {
    const isEditing = () => {
      const tag = document.activeElement?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA';
    };

    const handleKeyDown = (e: KeyboardEvent) => {

      // ─── Quick Look: Space ─────────────────────────────────
      if (e.key === ' ' && !quickLookFile && !isEditing()) {
        e.preventDefault();
        if (selectedPaths.size > 0) {
          const firstSelected = Array.from(selectedPaths)[0];
          setQuickLookFile(firstSelected);
        }
      }

      // ─── Close Quick Look / dialogs: Escape ────────────────
      if (e.key === 'Escape' && quickLookFile) {
        e.preventDefault();
        setQuickLookFile(null);
      }

      // ─── Open selected: Enter ────────────────────────────
      // Navigates into directories or opens files with the OS default app
      if (e.key === 'Enter' && !isEditing() && selectedPaths.size > 0) {
        e.preventDefault();
        const firstSelected = Array.from(selectedPaths)[0];
        const selectedFile = files.find(f => f.path === firstSelected);
        if (selectedFile) {
          if (selectedFile.is_dir) {
            setCurrentPath(selectedFile.path);
          } else {
            (async () => {
              try {
                const { openPath } = await import('@tauri-apps/plugin-opener');
                await openPath(selectedFile.path);
              } catch (err) {
                console.error('Failed to open file:', err);
              }
            })();
          }
        }
      }

      // ─── Focus Address bar: Ctrl+L or Alt+D ────────────────
      if ((e.ctrlKey && e.key === 'l') || (e.altKey && e.key === 'd')) {
        e.preventDefault();
        const addressInput = document.querySelector<HTMLInputElement>('[data-address-bar]');
        addressInput?.focus();
        addressInput?.select();
      }

      // ─── Focus Search: Ctrl+F ──────────────────────────────
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder="Search..."]');
        searchInput?.focus();
        searchInput?.select();
      }

      // ─── Go Up: Alt+Up or Backspace ────────────────────────
      // Guard the whole branch with !isEditing() so we never hijack typing —
      // previously only the Backspace half was guarded, so Alt+Up fired mid-edit.
      if (!isEditing() && ((e.altKey && e.key === 'ArrowUp') || e.key === 'Backspace')) {
        const segments = currentPath.split('\\').filter(Boolean);
        if (segments.length > 0) {
          segments.pop();
          let newPath = segments.join('\\');
          if (newPath === '') newPath = 'C:\\';
          else newPath += '\\';
          setCurrentPath(newPath);
        }
      }

      // ─── Navigate Back: Alt+Left ───────────────────────────
      // (Ctrl+Z = undo is tracked as B9/Task E and not yet wired up.)
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      }

      // ─── Navigate Forward: Alt+Right ───────────────────────
      // (Ctrl+Y = redo is tracked as B9/Task E and not yet wired up.)
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        goForward();
      }

      // ─── Copy: Ctrl+C ─────────────────────────────────────
      if (e.ctrlKey && e.key === 'c' && !isEditing()) {
        e.preventDefault();
        if (selectedPaths.size > 0) {
          setClipboard(Array.from(selectedPaths), 'copy');
          toast.success(`Copied ${selectedPaths.size} items`);
        }
      }

      // ─── Cut: Ctrl+X ──────────────────────────────────────
      if (e.ctrlKey && e.key === 'x' && !isEditing()) {
        e.preventDefault();
        if (selectedPaths.size > 0) {
          setClipboard(Array.from(selectedPaths), 'cut');
          toast.success(`Cut ${selectedPaths.size} items`);
        }
      }

      // ─── Paste: Ctrl+V ────────────────────────────────────
      if (e.ctrlKey && e.key === 'v' && !isEditing()) {
        e.preventDefault();
        if (clipboardPaths.length > 0 && clipboardOp) {
          (async () => {
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
              toast.error(`Paste failed: ${err}`);
            }
          })();
        }
      }

      // ─── Select All: Ctrl+A ───────────────────────────────
      if (e.ctrlKey && e.key === 'a' && !isEditing()) {
        e.preventDefault();
        selectAll(files.map(f => f.path));
      }

      // ─── Delete: Del key ──────────────────────────────────
      if (e.key === 'Delete' && !isEditing()) {
        e.preventDefault();
        if (selectedPaths.size > 0) {
          (async () => {
            // Respect the user's confirmDelete preference from Settings
            const { confirmDelete } = await import('../store/settingsStore').then(m => m.useSettingsStore.getState());
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
              toast.error(`Delete failed: ${err}`);
            }
          })();
        }
      }

      // ─── Rename: F2 ──────────────────────────────────────
      // Delegate to useFileOperations.handleRename so there's a single rename
      // code path (and a single place to fix B3's blocking prompt() later).
      if (e.key === 'F2' && !isEditing()) {
        e.preventDefault();
        if (selectedPaths.size === 1) {
          handleRename();
        }
      }

      // ─── Refresh: F5 ─────────────────────────────────────
      if (e.key === 'F5') {
        e.preventDefault();
        refresh();
      }

      // ─── New Folder: Ctrl+Shift+N ─────────────────────────
      if (e.ctrlKey && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        // Delegate to parent component's InputDialog instead of blocking prompt()
        onRequestNewFolder?.();
      }

      // ─── Toggle Hidden Files: Ctrl+H ──────────────────────
      if (e.ctrlKey && e.key === 'h' && !isEditing()) {
        e.preventDefault();
        toggleHidden();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentPath, setCurrentPath, quickLookFile, setQuickLookFile,
    selectedPaths, goBack, goForward, toggleHidden,
    setClipboard, clipboardPaths, clipboardOp, clearClipboard,
    clearSelection, selectAll, files, refresh, handleRename,
    onRequestNewFolder,
  ]);
}
