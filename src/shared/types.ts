export enum NotificationMode {
  Toast = 'toast',
  TTS = 'tts',
  Both = 'both',
}

export enum TrayState {
  Normal = 'normal',
  Error = 'error',
  Unconfigured = 'unconfigured',
}

export interface AppSettings {
  pollInterval: number;
  notificationMode: NotificationMode;
  autoStart: boolean;
  filters: string[];
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string;
  repoFullName: string;
  author: string;
  url: string;
  createdAt: string;
}

export interface SeenEntry {
  key: string;
  seenAt: number;
}

export interface ElectronAPI {
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  saveToken: (token: string) => Promise<void>;
  hasToken: () => Promise<boolean>;
  testConnection: (token?: string) => Promise<{ success: boolean; username?: string; message: string }>;
  onSettingsSaved: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
