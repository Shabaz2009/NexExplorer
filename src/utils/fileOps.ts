import { invoke } from '@tauri-apps/api/core';
import { FileEntry } from '../hooks/useFileSystem';

export const readDir = async (path: string): Promise<FileEntry[]> => {
  return await invoke('read_dir', { path });
};

export const copyFile = async (source: string, dest: string): Promise<void> => {
  await invoke('copy_file', { source, dest });
};

export const moveFile = async (source: string, dest: string): Promise<void> => {
  await invoke('move_file', { source, dest });
};

export const deleteFile = async (path: string): Promise<void> => {
  await invoke('delete_file', { path });
};

export const renameFile = async (path: string, newName: string): Promise<void> => {
  await invoke('rename_file', { path, newName });
};

export const createFolder = async (path: string): Promise<void> => {
  await invoke('create_folder', { path });
};
