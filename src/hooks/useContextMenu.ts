import { useState, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Point>({ x: 0, y: 0 });
  const [target, setTarget] = useState<any>(null); // Details about what was clicked

  const openContextMenu = useCallback((e: React.MouseEvent, contextData: any) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Simple bounds checking (assuming standard menu width/height)
    const menuWidth = 220;
    const menuHeight = 300;
    
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > window.innerWidth) {
      x -= menuWidth;
    }
    
    if (y + menuHeight > window.innerHeight) {
      y -= menuHeight;
    }
    
    setPosition({ x, y });
    setTarget(contextData);
    setIsOpen(true);
  }, []);

  const closeContextMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on outside click or escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClick = () => setIsOpen(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return { isOpen, position, target, openContextMenu, closeContextMenu };
}
