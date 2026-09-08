const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('offline', {
  isElectron: true,
  close: () => ipcRenderer.send('offline:close'),
})
