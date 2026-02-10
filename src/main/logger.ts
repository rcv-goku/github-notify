import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
let logFilePath: string | null = null;

function getLogPath(): string {
  if (!logFilePath) {
    const userDataPath = app.getPath('userData');
    logFilePath = path.join(userDataPath, 'github-notify.log');
  }
  return logFilePath;
}

function rotateIfNeeded(): void {
  try {
    const logPath = getLogPath();
    if (!fs.existsSync(logPath)) return;

    const stats = fs.statSync(logPath);
    if (stats.size > MAX_LOG_SIZE) {
      const backupPath = logPath + '.old';
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      fs.renameSync(logPath, backupPath);
    }
  } catch {
    // Ignore rotation errors
  }
}

export function log(message: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  try {
    rotateIfNeeded();
    fs.appendFileSync(getLogPath(), line);
  } catch {
    // Fallback to console if file write fails
  }
  console.log(`[GitHub Notify] ${message}`);
}

export function getLogFilePath(): string {
  return getLogPath();
}
