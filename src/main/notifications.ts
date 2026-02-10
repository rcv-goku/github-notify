import { Notification, shell } from 'electron';
import { GitHubPR, NotificationMode } from '../shared/types';
import { speak } from './tts';

const MAX_INDIVIDUAL_NOTIFICATIONS = 5;

function showToast(pr: GitHubPR): void {
  const notification = new Notification({
    title: `${pr.repoFullName} #${pr.number}`,
    body: `${pr.title}\nby @${pr.author}`,
  });

  notification.on('click', () => {
    shell.openExternal(pr.url);
  });

  notification.show();
}

function showSummaryToast(count: number): void {
  const notification = new Notification({
    title: 'GitHub Notify',
    body: `${count} more new pull requests need your attention`,
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
): Promise<void> {
  if (prs.length === 0) return;

  const toNotifyIndividually = prs.slice(0, MAX_INDIVIDUAL_NOTIFICATIONS);
  const remaining = prs.length - MAX_INDIVIDUAL_NOTIFICATIONS;

  if (mode === NotificationMode.Toast || mode === NotificationMode.Both) {
    for (const pr of toNotifyIndividually) {
      showToast(pr);
    }
    if (remaining > 0) {
      showSummaryToast(remaining);
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
