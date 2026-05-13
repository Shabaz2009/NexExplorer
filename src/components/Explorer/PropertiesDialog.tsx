import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, FileText, Folder, HardDrive, Shield, Clock } from 'lucide-react';

interface FileProperties {
  name: string;
  path: string;
  size: number;
  is_dir: boolean;
  is_readonly: boolean;
  is_hidden: boolean;
  is_system: boolean;
  created_at: number | null;
  modified_at: number | null;
  accessed_at: number | null;
}

interface PropertiesDialogProps {
  filePath: string;
  onClose: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (epoch: number | null): string => {
  if (!epoch) return '—';
  return new Date(epoch * 1000).toLocaleString();
};

const PropertiesDialog: React.FC<PropertiesDialogProps> = ({ filePath, onClose }) => {
  const [props, setProps] = useState<FileProperties | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await invoke<FileProperties>('get_file_properties', { path: filePath });
        setProps(result);
      } catch (e) {
        setError(e as string);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filePath]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-bg-primary border border-border rounded-xl shadow-2xl w-[420px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Properties</h2>
          <button 
            onClick={onClose} 
            className="p-1 rounded-md hover:bg-bg-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm text-center py-4">{error}</div>
          ) : props ? (
            <div className="space-y-5">
              {/* Icon + Name */}
              <div className="flex items-center gap-4 pb-4 border-b border-border">
                <div className="w-12 h-12 bg-accent/10 text-accent rounded-lg flex items-center justify-center">
                  {props.is_dir ? <Folder size={28} /> : <FileText size={28} />}
                </div>
                <div>
                  <div className="font-medium text-base">{props.name}</div>
                  <div className="text-xs text-text-secondary truncate max-w-[300px]">{props.path}</div>
                </div>
              </div>

              {/* General Info */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <HardDrive size={14} /> General
                </h3>
                <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                  <span className="text-text-secondary">Type</span>
                  <span>{props.is_dir ? 'Folder' : `File (.${props.path.split('.').pop()})`}</span>
                  
                  <span className="text-text-secondary">Location</span>
                  <span className="truncate text-xs">{props.path.substring(0, props.path.lastIndexOf('\\'))}</span>
                  
                  <span className="text-text-secondary">Size</span>
                  <span>{formatBytes(props.size)} ({props.size.toLocaleString()} bytes)</span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <Clock size={14} /> Timestamps
                </h3>
                <div className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
                  <span className="text-text-secondary">Created</span>
                  <span>{formatDate(props.created_at)}</span>
                  
                  <span className="text-text-secondary">Modified</span>
                  <span>{formatDate(props.modified_at)}</span>
                  
                  <span className="text-text-secondary">Accessed</span>
                  <span>{formatDate(props.accessed_at)}</span>
                </div>
              </div>

              {/* Attributes */}
              <div className="space-y-3 pt-3 border-t border-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                  <Shield size={14} /> Attributes
                </h3>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-1 rounded text-xs border ${props.is_readonly ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'bg-bg-secondary border-border text-text-secondary'}`}>
                    Read-only
                  </span>
                  <span className={`px-2 py-1 rounded text-xs border ${props.is_hidden ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-bg-secondary border-border text-text-secondary'}`}>
                    Hidden
                  </span>
                  <span className={`px-2 py-1 rounded text-xs border ${props.is_system ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-bg-secondary border-border text-text-secondary'}`}>
                    System
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-bg-secondary border border-border rounded text-sm hover:bg-bg-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertiesDialog;
