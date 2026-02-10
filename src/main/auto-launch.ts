import { app } from 'electron';

export function setAutoLaunch(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
  });
}

export function getAutoLaunchEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
