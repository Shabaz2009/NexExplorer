import { useState, useEffect, useCallback } from 'react';
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

  // B2 fix: memoize loadDirectory so the search event handler and the
  // useEffect below always close over the current showHidden value.
  const loadDirectory = useCallback(async (path: string, search?: string) => {
    setLoading(true);
    setError(null);
    try {
      let entries: FileEntry[] = [];
      
      if (search) {
        entries = await invoke('recursive_search', { path, query: search });
      } else if (path.startsWith('http://') || path.startsWith('https://')) {
        // Handle Remote LAN Server Path
        // ... (rest of remote logic)
        const urlObj = new URL(path);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
        const subPath = decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
        
        const response = await fetch(`${baseUrl}/api/files?path=${encodeURIComponent(subPath)}`);
        if (!response.ok) throw new Error('Failed to fetch remote directory');
        
        const data = await response.json();
        
        entries = (data.files || []).map((f: any) => ({
          name: f.name,
          path: `${baseUrl}/${f.path}`,
          is_dir: f.is_dir,
          size: f.size,
          extension: f.name.split('.').pop() || '',
          created_at: null,
          modified_at: new Date(f.modified).getTime() / 1000,
          accessed_at: null,
          is_hidden: f.name.startsWith('.'),
        }));
      } else {
        const isArchive = /\.(zip|rar|7z|tar|gz)(\\|\/|$)/i.test(path);
        if (isArchive) {
          entries = await invoke('list_archive', { path });
        } else {
          entries = await invoke('read_dir', { path });
        }
      }
      
      if (!showHidden && !search) {
        entries = entries.filter(e => !e.is_hidden);
      }
      
      if (!search) {
        entries.sort((a, b) => {
          if (a.is_dir && !b.is_dir) return -1;
          if (!a.is_dir && b.is_dir) return 1;
          return a.name.localeCompare(b.name);
        });
      }
      
      setFiles(entries);
    } catch (err) {
      console.error('Failed to load directory:', err);
      setError(err as string);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  useEffect(() => {
    const handleSearch = (e: any) => {
      loadDirectory(currentPath, e.detail);
    };
    window.addEventListener('nex-search', handleSearch);
    
    loadDirectory(currentPath);
    
    return () => window.removeEventListener('nex-search', handleSearch);
  // loadDirectory is in deps so the search handler is always fresh after
  // showHidden toggles (B2 fix).
  }, [currentPath, loadDirectory]);

  return { files, loading, error, refresh: () => loadDirectory(currentPath) };
}
