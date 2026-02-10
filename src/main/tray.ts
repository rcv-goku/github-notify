import { Tray, Menu, nativeImage, MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { TrayState } from '../shared/types';

let tray: Tray | null = null;
let currentState: TrayState = TrayState.Unconfigured;
let isPaused = false;

interface TrayCallbacks {
  onCheckNow: () => void;
  onOpenSettings: () => void;
  onTogglePause: () => void;
  onOpenLogs: () => void;
  onQuit: () => void;
}

let callbacks: TrayCallbacks;

function getIconPath(state: TrayState): string {
  const iconMap: Record<TrayState, string> = {
    [TrayState.Normal]: 'tray-icon.png',
    [TrayState.Error]: 'tray-icon-error.png',
    [TrayState.Unconfigured]: 'tray-icon-unconfigured.png',
  };
  return path.join(__dirname, '../../assets', iconMap[state]);
}

function buildContextMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Check Now',
      click: () => callbacks.onCheckNow(),
      enabled: !isPaused && currentState !== TrayState.Unconfigured,
    },
    {
      label: isPaused ? 'Resume Polling' : 'Pause Polling',
      click: () => {
        isPaused = !isPaused;
        callbacks.onTogglePause();
        updateContextMenu();
      },
      enabled: currentState !== TrayState.Unconfigured,
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => callbacks.onOpenSettings(),
    },
    {
      label: 'Open Logs',
      click: () => callbacks.onOpenLogs(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => callbacks.onQuit(),
    },
  ];
  return Menu.buildFromTemplate(template);
}

function updateContextMenu(): void {
  if (tray) {
    tray.setContextMenu(buildContextMenu());
  }
}

export function createTray(cbs: TrayCallbacks): Tray {
  callbacks = cbs;

  const iconPath = getIconPath(currentState);
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('GitHub Notify - Not configured');
  tray.setContextMenu(buildContextMenu());

  tray.on('click', () => {
    tray?.popUpContextMenu();
  });

  return tray;
}

export function setTrayState(state: TrayState): void {
  if (currentState === state) return;
  currentState = state;
  if (!tray) return;

  const iconPath = getIconPath(state);
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) {
    tray.setImage(icon);
  }
  updateContextMenu();
}

export function setTrayTooltip(tooltip: string): void {
  tray?.setToolTip(tooltip);
}

export function getIsPaused(): boolean {
  return isPaused;
}

