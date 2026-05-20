import { useEffect } from 'react';
import { useExplorerStore } from '../store/explorerStore';
import { useSelectionStore } from '../store/selectionStore';

export function useKeyboard() {
  const { currentPath, setCurrentPath, quickLookFile, setQuickLookFile } = useExplorerStore();
  const { selectedPaths } = useSelectionStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Quick Look: Space
      if (e.key === ' ' && !quickLookFile) {
        e.preventDefault();
        if (selectedPaths.size > 0) {
          const firstSelected = Array.from(selectedPaths)[0];
          setQuickLookFile(firstSelected);
        }
      }

      // Close Quick Look: Escape
      if (e.key === 'Escape' && quickLookFile) {
        e.preventDefault();
        setQuickLookFile(null);
      }

      // Focus Address bar: Ctrl+L or Alt+D
      if ((e.ctrlKey && e.key === 'l') || (e.altKey && e.key === 'd')) {
        e.preventDefault();
        // Implement address bar focus logic
      }

      // Go Up: Alt+Up or Backspace
      if ((e.altKey && e.key === 'ArrowUp') || e.key === 'Backspace') {
        // Prevent backspace from navigating if we are in an input/textarea
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }

        const segments = currentPath.split('\\').filter(Boolean);
        if (segments.length > 0) {
          segments.pop();
          let newPath = segments.join('\\');
          if (newPath === '') newPath = 'C:\\'; // Default to root for now
          else newPath += '\\';
          setCurrentPath(newPath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPath, setCurrentPath, quickLookFile, setQuickLookFile, selectedPaths]);
}
