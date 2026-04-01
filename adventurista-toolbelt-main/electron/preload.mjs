import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('adventuristaDesktop', {
  platform: process.platform,
  isElectron: true,
});
