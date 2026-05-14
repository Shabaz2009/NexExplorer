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

  const segments = currentPath.split('\\').filter(Boolean);
  
  const navigateToSegment = (index: number) => {
    const isDrive = index === 0 && segments[0].endsWith(':');
    const newPath = segments.slice(0, index + 1).join('\\') + (isDrive ? '\\' : '');
    setCurrentPath(newPath);
  };

  return (
    <div 
      className="flex-1 flex items-center h-8 bg-bg-primary/40 backdrop-blur-sm border border-border/50 rounded-lg hover:border-accent/40 transition-all cursor-text group overflow-hidden shadow-inner"
      onClick={() => {
        if (!isEditing) setIsEditing(true);
      }}
    >
      {isEditing ? (
        <input 
          autoFocus
          className="w-full h-full bg-transparent outline-none px-3 text-[13px] text-text-primary font-medium"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => setIsEditing(false)}
        />
      ) : (
        <div className="flex items-center text-[13px] font-medium px-2 w-full overflow-hidden">
          <div className="flex items-center gap-0.5">
            {segments.map((segment, index) => (
              <React.Fragment key={index}>
                <button 
                  className="px-2 py-1 rounded-md hover:bg-white/10 interactive truncate max-w-[200px] text-text-secondary hover:text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToSegment(index);
                  }}
                >
                  {segment}
                </button>
                {index < segments.length - 1 && (
                  <ChevronRight size={14} className="text-text-muted/50 mx-0.5 flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
            {segments.length === 0 && <span className="text-text-muted px-2">System Root</span>}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressBar;
