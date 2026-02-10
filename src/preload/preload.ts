import { contextBridge, ipcRenderer } from 'electron';
import { ElectronAPI, AppSettings } from '../shared/types';

const api: ElectronAPI = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('settings:save', settings),
  saveToken: (token: string) => ipcRenderer.invoke('token:save', token),
  hasToken: () => ipcRenderer.invoke('token:has'),
  testConnection: (token?: string) => ipcRenderer.invoke('token:test', token),
  onSettingsSaved: (callback: () => void) => {
    ipcRenderer.on('settings:saved', () => callback());
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
