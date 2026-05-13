import React from 'react';
import { useExplorerStore } from '../../store/explorerStore';
import { List, Grip } from 'lucide-react';

const ViewToggle: React.FC = () => {
  const { viewMode, setViewMode } = useExplorerStore();

  return (
    <div className="flex items-center gap-1 border border-border rounded px-1 py-0.5 bg-bg-secondary">
      <button 
        className={`p-1 rounded ${viewMode === 'details' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
        onClick={() => setViewMode('details')}
        title="Details"
      >
        <List size={14} strokeWidth={2} />
      </button>
      <button 
        className={`p-1 rounded ${['md', 'lg', 'xl'].includes(viewMode) ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}
        onClick={() => setViewMode('md')}
        title="Large icons"
      >
        <Grip size={14} strokeWidth={2} />
      </button>
    </div>
  );
};

export default ViewToggle;
