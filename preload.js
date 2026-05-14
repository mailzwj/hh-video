const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectImage: () => ipcRenderer.invoke('select-image'),
  onOpenSettings: (callback) => ipcRenderer.on('open-settings', (_, settings) => callback(settings)),
})
