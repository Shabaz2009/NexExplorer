const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nex', {
  invoke: (command, args) => ipcRenderer.invoke('nex:invoke', command, args),
  openPath: (path) => ipcRenderer.invoke('nex:open-path', path),
  window: {
    minimize: () => ipcRenderer.invoke('nex:window', 'minimize'),
    toggleMaximize: () => ipcRenderer.invoke('nex:window', 'toggleMaximize'),
    close: () => ipcRenderer.invoke('nex:window', 'close'),
    isMaximized: () => ipcRenderer.invoke('nex:window', 'isMaximized'),
  },
  onEvent: (eventName, callback) => {
    const listener = (_event, message) => {
      if (message.event === eventName) callback(message.payload);
    };
    ipcRenderer.on('nex:event', listener);
    return () => ipcRenderer.removeListener('nex:event', listener);
  },
});
