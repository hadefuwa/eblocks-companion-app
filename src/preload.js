const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  openShop: () => ipcRenderer.invoke('open-shop-window'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
})

