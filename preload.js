const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBT', {
  listDevices: () => ipcRenderer.invoke('bt:list-devices'),
  connect: (deviceName) => ipcRenderer.invoke('bt:connect', deviceName),
  disconnect: () => ipcRenderer.invoke('bt:disconnect'),
  send: (line) => ipcRenderer.invoke('bt:send', line),
  onData: (callback) => {
    ipcRenderer.on('bt:data', (event, data) => callback(data));
  },
});
