import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useExplorerStore } from '../store/explorerStore';

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  extension: string;
  created_at: number | null;
  modified_at: number | null;
  accessed_at: number | null;
  is_hidden: boolean;
}

export function useFileSystem() {
  const { currentPath, showHidden } = useExplorerStore();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      let entries: FileEntry[] = [];
      
      // Basic check if path is an archive (e.g. C:\test.zip or inside an archive C:\test.zip\\folder)
      // For now, if the path contains .zip, .rar, .7z we call list_archive
      const isArchive = /\.(zip|rar|7z|tar|gz)(\\|\/|$)/i.test(path);
      
      if (isArchive) {
        entries = await invoke('list_archive', { path });
      } else {
        entries = await invoke('read_dir', { path });
      }
      
      if (!showHidden) {
        entries = entries.filter(e => !e.is_hidden);
      }
      
      // Basic sorting: folders first, then by name
      entries.sort((a, b) => {
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;
        return a.name.localeCompare(b.name);
      });
      
      setFiles(entries);
    } catch (err) {
      console.error('Failed to load directory:', err);
      setError(err as string);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, showHidden]);

  return { files, loading, error, refresh: () => loadDirectory(currentPath) };
}
