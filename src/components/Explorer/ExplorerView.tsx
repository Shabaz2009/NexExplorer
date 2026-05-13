import React from 'react';
import { useExplorerStore } from '../../store/explorerStore';
import FileGrid from './FileGrid';
import FileDetails from './FileDetails';
import LocalSharePanel from './LocalSharePanel';
import DualPaneView from './DualPaneView';

const ExplorerView: React.FC = () => {
  const { viewMode, currentPath } = useExplorerStore();

  // Special routes
  if (currentPath === 'localshare://') {
    return <LocalSharePanel />;
  }

  switch (viewMode) {
    case 'dualpane':
      return <DualPaneView />;
    case 'details':
      return <FileDetails />;
    case 'xl':
    case 'lg':
    case 'md':
    case 'sm':
    case 'list':
    case 'content':
    default:
      return <FileGrid />;
  }
};

export default ExplorerView;
