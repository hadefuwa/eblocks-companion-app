// Preload script for Electron
// This runs in a context that has access to both the DOM and Node.js APIs
// but with context isolation enabled

const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// certain Node.js APIs without exposing the entire Node.js API
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  // IPC methods for Arduino CLI and serial port operations
  getPorts: () => ipcRenderer.invoke('get-ports'),
  uploadCode: (data) => ipcRenderer.invoke('upload-code', data),
  checkCLI: () => ipcRenderer.invoke('check-cli'),
  
  // Serial port methods
  serialConnect: (data) => ipcRenderer.invoke('serial-connect', data),
  serialDisconnect: (data) => ipcRenderer.invoke('serial-disconnect', data),
  serialGetData: (data) => ipcRenderer.invoke('serial-get-data', data),
  serialSend: (data) => ipcRenderer.invoke('serial-send', data),
  
  // Listen for serial data events
  onSerialData: (callback) => {
    ipcRenderer.on('serial-data', (event, data) => callback(data))
  },
  
  // Remove serial data listener
  removeSerialDataListener: () => {
    ipcRenderer.removeAllListeners('serial-data')
  }
})
