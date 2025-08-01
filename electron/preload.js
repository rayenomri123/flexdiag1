const { contextBridge, ipcRenderer } = require('electron');

// Expose window control APIs
contextBridge.exposeInMainWorld('windowControlsAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
});

// Expose network-related APIs
contextBridge.exposeInMainWorld('networkAPI', {
  getNetworkInterfaces: () => ipcRenderer.invoke('get-network-interfaces'),
  isEthernetConnected: () => ipcRenderer.invoke('is-ethernet-connected'),
});

// Expose database APIs for network setup
contextBridge.exposeInMainWorld('dbAPI', {
  saveNetworkSetup: (settings) => ipcRenderer.invoke('save-network-setup', settings),
  clearNetworkSetup: () => ipcRenderer.invoke('clear-network-setup'),
  fetchNetworkSetup: () => ipcRenderer.invoke('fetch-network-setup'),
  saveUdsSetup: (settings) => ipcRenderer.invoke('save-uds-setup', settings),
  clearUdsSetup: () => ipcRenderer.invoke('clear-uds-setup'),
  fetchUdsSetup: () => ipcRenderer.invoke('fetch-uds-setup'),
});

// Expose DHCP server control APIs
contextBridge.exposeInMainWorld('dhcpAPI', {
  start: () => ipcRenderer.invoke('start-dhcp'),
  stop: () => ipcRenderer.invoke('stop-dhcp'),
});

// Expose IPC methods for listening to log updates
contextBridge.exposeInMainWorld('ipcRenderer', {
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener),
});

// Expose database APIs for network mode
contextBridge.exposeInMainWorld('networkModeAPI', {
  saveMode: (mode) => ipcRenderer.invoke('save-network-mode', { mode }),
  fetchMode: () => ipcRenderer.invoke('fetch-network-mode')
});

// Expose UDS data APIs
contextBridge.exposeInMainWorld('udsAPI', {
  fetchUdsData: () => ipcRenderer.invoke('fetch-uds-data'),
  onUdsDataUpdate: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('uds-data-update', listener);
    return () => ipcRenderer.removeListener('uds-data-update', listener);
  },
});
