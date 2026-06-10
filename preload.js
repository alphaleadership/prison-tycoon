const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  save: data => ipcRenderer.invoke('save', data),
  load: ()   => ipcRenderer.invoke('load'),
});
