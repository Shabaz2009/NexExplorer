import React from 'react';
import { useFileSystem } from '../../hooks/useFileSystem';
import { formatBytes, formatDate } from '../../utils/formatters';
import { File, Folder } from 'lucide-react';
import { useExplorerStore } from '../../store/explorerStore';

const FileDetails: React.FC = () => {
  const { files, loading, error } = useFileSystem();
  const { setCurrentPath } = useExplorerStore();

  if (loading) return <div className="p-4 text-text-secondary">Loading...</div>;
  if (error) return <div className="p-4 text-error">{error}</div>;

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="sticky top-0 bg-bg-secondary text-text-secondary border-b border-border z-10 text-xs">
          <tr>
            <th className="font-normal py-1.5 px-4 min-w-[200px]">Name</th>
            <th className="font-normal py-1.5 px-4 w-32">Date modified</th>
            <th className="font-normal py-1.5 px-4 w-32">Type</th>
            <th className="font-normal py-1.5 px-4 w-32 text-right">Size</th>
          </tr>
        </thead>
        <tbody>
          {files.map(file => (
            <tr 
              key={file.path}
              onDoubleClick={() => file.is_dir && setCurrentPath(file.path)}
              className="hover:bg-bg-hover cursor-default border-b border-border/30 last:border-0 group"
            >
              <td className="py-1 px-4 flex items-center gap-2">
                {file.is_dir ? 
                  <Folder size={16} className="text-accent" fill="currentColor" fillOpacity={0.2} /> : 
                  <File size={16} className="text-text-secondary" />
                }
                <span className="truncate">{file.name}</span>
              </td>
              <td className="py-1 px-4 text-text-secondary">{formatDate(file.modified_at)}</td>
              <td className="py-1 px-4 text-text-secondary">{file.is_dir ? 'File folder' : `${file.extension.toUpperCase()} File`}</td>
              <td className="py-1 px-4 text-text-secondary text-right">{!file.is_dir ? formatBytes(file.size) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FileDetails;
