import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useExplorerStore } from '../../store/explorerStore';

const AddressBar: React.FC = () => {
  const { currentPath, setCurrentPath } = useExplorerStore();
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(currentPath);

  useEffect(() => {
    setInputValue(currentPath);
  }, [currentPath]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setCurrentPath(inputValue);
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setInputValue(currentPath);
      setIsEditing(false);
    }
  };

  // Basic path parsing for breadcrumbs (Windows style)
  const segments = currentPath.split('\\').filter(Boolean);
  
  const navigateToSegment = (index: number) => {
    const newPath = segments.slice(0, index + 1).join('\\') + '\\';
    setCurrentPath(newPath);
  };

  return (
    <div 
      className="flex-1 flex items-center h-7 bg-bg-secondary border border-border rounded hover:border-text-muted transition-colors cursor-text group overflow-hidden"
      onClick={() => {
        if (!isEditing) setIsEditing(true);
      }}
    >
      {isEditing ? (
        <input 
          autoFocus
          className="w-full h-full bg-transparent outline-none px-2 text-sm text-text-primary"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setIsEditing(false)}
        />
      ) : (
        <div className="flex items-center text-sm px-2 w-full overflow-hidden">
          {segments.map((segment, index) => (
            <React.Fragment key={index}>
              <span 
                className="hover:bg-bg-hover px-1 rounded cursor-pointer truncate max-w-[150px]"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateToSegment(index);
                }}
              >
                {segment}
              </span>
              {index < segments.length - 1 && (
                <ChevronRight size={14} className="text-text-muted mx-0.5 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
          {segments.length === 0 && <span className="text-text-muted">This PC</span>}
        </div>
      )}
    </div>
  );
};

export default AddressBar;
