import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { log } from './logger';

export function playCustomSound(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    log(`Custom sound file not found: ${filePath}`);
    return;
  }

  const escaped = filePath.replace(/'/g, "''");
  execFile(
    'powershell',
    ['-NoProfile', '-Command', `(New-Object Media.SoundPlayer '${escaped}').PlaySync()`],
    (error) => {
      if (error) {
        log(`Failed to play custom sound: ${error.message}`);
      }
    },
  );
}
