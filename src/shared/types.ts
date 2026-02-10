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

export type NotificationSound = 'none' | 'default' | 'custom';

export interface AppSettings {
  pollInterval: number;
  notificationMode: NotificationMode;
  notificationSound: NotificationSound;
  customSoundPath: string;
  autoStart: boolean;
  filters: string[];
}

export interface GitHubPR {
  number: number;
  title: string;
  repoFullName: string;
  author: string;
  url: string;
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
  openSoundFileDialog: () => Promise<string | null>;
}

export function getPRKey(pr: GitHubPR): string {
  return `${pr.repoFullName}#${pr.number}`;
}

export function isOctokitError(error: unknown): error is { status: number; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
