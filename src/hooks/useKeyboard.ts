import { useEffect } from 'react';
import { useExplorerStore } from '../store/explorerStore';

export function useKeyboard() {
  const { currentPath, setCurrentPath } = useExplorerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus Address bar: Ctrl+L or Alt+D
      if ((e.ctrlKey && e.key === 'l') || (e.altKey && e.key === 'd')) {
        e.preventDefault();
        // Implement address bar focus logic
      }

      // Go Up: Alt+Up or Backspace
      if ((e.altKey && e.key === 'ArrowUp') || e.key === 'Backspace') {
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
  }, [currentPath, setCurrentPath]);
}
