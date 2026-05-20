export type NativeCommandArgs = Record<string, unknown>;

export function isElectron() {
  return Boolean(window.nex);
}

export async function invokeNative<T>(command: string, args?: NativeCommandArgs): Promise<T> {
  if (!window.nex) {
    throw new Error('NexExplorer native bridge is not available. Run the app with Electron.');
  }

  return window.nex.invoke<T>(command, args);
}

export async function openNativePath(path: string): Promise<void> {
  if (!window.nex) {
    window.open(`file:///${path.replace(/\\/g, '/')}`, '_blank');
    return;
  }

  await window.nex.openPath(path);
}
