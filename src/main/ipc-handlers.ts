import { ipcMain } from 'electron';
import { getSettings, saveSettings, saveToken, hasToken } from './store';
import { testConnection } from './github-api';
import { AppSettings } from '../shared/types';

export function registerIpcHandlers(onSettingsChanged: () => void): void {
  ipcMain.handle('settings:get', async () => {
    return getSettings();
  });

  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    saveSettings(settings);
    onSettingsChanged();
  });

  ipcMain.handle('token:save', async (_event, token: string) => {
    saveToken(token);
  });

  ipcMain.handle('token:has', async () => {
    return hasToken();
  });

  ipcMain.handle('token:test', async (_event, token: string) => {
    return testConnection(token);
  });
}
