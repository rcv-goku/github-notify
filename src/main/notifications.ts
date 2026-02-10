import { Notification, shell } from 'electron';
import { GitHubPR, NotificationMode, NotificationSound } from '../shared/types';
import { speak } from './tts';
import { playCustomSound } from './sound';

const MAX_INDIVIDUAL_NOTIFICATIONS = 5;

function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'github.com';
  } catch {
    return false;
  }
}

function showToast(pr: GitHubPR, silent: boolean): void {
  const notification = new Notification({
    title: `${pr.repoFullName} #${pr.number}`,
    body: `${pr.title}\nby @${pr.author}`,
    silent,
  });

  notification.on('click', () => {
    if (isValidGitHubUrl(pr.url)) {
      shell.openExternal(pr.url);
    }
  });

  notification.show();
}

function showSummaryToast(count: number, silent: boolean): void {
  const notification = new Notification({
    title: 'GitHub Notify',
    body: `${count} more new pull requests need your attention`,
    silent,
  });

  notification.show();
}

function buildTTSText(pr: GitHubPR): string {
  const title = pr.title.length > 100 ? pr.title.substring(0, 100) + '...' : pr.title;
  return `New pull request in ${pr.repoFullName}: ${title}, by ${pr.author}`;
}

export async function notifyNewPRs(
  prs: GitHubPR[],
  mode: NotificationMode,
  sound: NotificationSound,
  customSoundPath: string,
): Promise<void> {
  if (prs.length === 0) return;

  const toNotifyIndividually = prs.slice(0, MAX_INDIVIDUAL_NOTIFICATIONS);
  const remaining = prs.length - MAX_INDIVIDUAL_NOTIFICATIONS;

  // Suppress toast sound when using custom sound or no sound
  const silentToast = sound !== 'default';

  if (sound === 'custom' && customSoundPath) {
    playCustomSound(customSoundPath);
  }

  if (mode === NotificationMode.Toast || mode === NotificationMode.Both) {
    for (const pr of toNotifyIndividually) {
      showToast(pr, silentToast);
    }
    if (remaining > 0) {
      showSummaryToast(remaining, silentToast);
    }
  }

  if (mode === NotificationMode.TTS || mode === NotificationMode.Both) {
    for (const pr of toNotifyIndividually) {
      const text = buildTTSText(pr);
      try {
        await speak(text);
      } catch {
        break;
      }
    }
    if (remaining > 0) {
      try {
        await speak(`And ${remaining} more pull requests need your attention.`);
      } catch {
        // TTS failed, continue silently
      }
    }
  }
}
