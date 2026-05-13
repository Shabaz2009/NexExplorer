import React, { useEffect } from 'react';
import { useTabStore } from '../../store/tabStore';
import { X, Plus } from 'lucide-react';

const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useTabStore();

  useEffect(() => {
    if (!activeTabId && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [activeTabId, tabs, setActiveTab]);

  return (
    <div className="flex items-end h-9 bg-bg-tertiary px-2 gap-1 overflow-x-auto no-scrollbar">
      {tabs.map((tab) => (
        <div 
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`group flex items-center gap-2 px-3 h-8 min-w-[120px] max-w-[200px] rounded-t-lg border-t border-x cursor-pointer transition-colors ${
            activeTabId === tab.id 
              ? 'bg-bg-primary border-border text-text-primary z-10' 
              : 'bg-transparent border-transparent text-text-secondary hover:bg-bg-hover'
          }`}
        >
          <span className="truncate flex-1 text-[13px]">{tab.title || 'Local Disk (C:)'}</span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            className={`p-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity ${
              activeTabId === tab.id ? 'hover:bg-bg-hover' : 'hover:bg-bg-tertiary'
            }`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button 
        onClick={() => addTab('C:\\')}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-bg-hover text-text-secondary mb-0.5 ml-1"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

export default TabBar;
