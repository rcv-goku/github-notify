import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import { GitHubPR } from '../shared/types';
import { log } from './logger';

const ThrottledOctokit = Octokit.plugin(throttling);

let octokit: InstanceType<typeof ThrottledOctokit> | null = null;
let cachedUsername: string | null = null;

interface ETagCache {
  etag: string | null;
  data: GitHubPR[];
}

const etagCaches: Record<string, ETagCache> = {
  assigned: { etag: null, data: [] },
  reviewRequested: { etag: null, data: [] },
};

function parseSearchResults(items: Array<Record<string, unknown>>): GitHubPR[] {
  return items
    .filter((item) => item.pull_request)
    .map((item) => {
      const repoUrl = item.repository_url as string;
      const repoMatch = repoUrl.match(/repos\/(.+)$/);
      const repoFullName = repoMatch ? repoMatch[1] : 'unknown/unknown';
      const user = item.user as { login: string } | null;
      const prLinks = item.pull_request as { html_url?: string };

      return {
        id: item.id as number,
        number: item.number as number,
        title: item.title as string,
        body: ((item.body as string) || '').substring(0, 500),
        repoFullName,
        author: user?.login || 'unknown',
        url: prLinks.html_url || (item.html_url as string),
        createdAt: item.created_at as string,
      };
    });
}

export function initOctokit(token: string): void {
  cachedUsername = null;
  octokit = new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const opts = options as { method: string; url: string };
        log(`Rate limit hit for ${opts.method} ${opts.url}`);
        if (retryCount < 2) {
          log(`Retrying after ${retryAfter} seconds`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (_retryAfter, options) => {
        const opts = options as { method: string; url: string };
        log(`Secondary rate limit for ${opts.method} ${opts.url}`);
        return false;
      },
    },
  });
}

export async function getAuthenticatedUser(): Promise<string> {
  if (cachedUsername) return cachedUsername;
  if (!octokit) throw new Error('Octokit not initialized');

  const { data } = await octokit.rest.users.getAuthenticated();
  cachedUsername = data.login;
  return cachedUsername;
}

async function searchPRs(
  query: string,
  cacheKey: string,
): Promise<{ prs: GitHubPR[]; changed: boolean }> {
  if (!octokit) throw new Error('Octokit not initialized');

  const cache = etagCaches[cacheKey];
  const headers: Record<string, string> = {};
  if (cache.etag) {
    headers['if-none-match'] = cache.etag;
  }

  try {
    const response = await octokit.request('GET /search/issues', {
      q: query,
      sort: 'updated',
      order: 'desc',
      per_page: 100,
      headers,
    });

    const etag = (response.headers as Record<string, string>).etag || null;
    const items = (response.data as { items: Array<Record<string, unknown>> }).items;
    const prs = parseSearchResults(items);

    etagCaches[cacheKey] = { etag, data: prs };
    return { prs, changed: true };
  } catch (error: unknown) {
    const err = error as { status?: number };
    if (err.status === 304) {
      return { prs: cache.data, changed: false };
    }
    throw error;
  }
}

export async function fetchAssignedPRs(username: string): Promise<{ prs: GitHubPR[]; changed: boolean }> {
  return searchPRs(`is:pr is:open assignee:${username}`, 'assigned');
}

export async function fetchReviewRequestedPRs(username: string): Promise<{ prs: GitHubPR[]; changed: boolean }> {
  return searchPRs(`is:pr is:open review-requested:${username}`, 'reviewRequested');
}

export async function testConnection(token: string): Promise<{ success: boolean; username?: string; message: string }> {
  try {
    const tempOctokit = new Octokit({ auth: token });
    const { data } = await tempOctokit.rest.users.getAuthenticated();
    return { success: true, username: data.login, message: `Connected as ${data.login}` };
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    if (err.status === 401) {
      return { success: false, message: 'Invalid token. Please check your PAT.' };
    }
    return { success: false, message: err.message || 'Connection failed' };
  }
}

export function deduplicatePRs(assigned: GitHubPR[], reviewRequested: GitHubPR[]): GitHubPR[] {
  const seen = new Set<string>();
  const result: GitHubPR[] = [];

  for (const pr of [...assigned, ...reviewRequested]) {
    const key = `${pr.repoFullName}#${pr.number}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pr);
    }
  }

  return result;
}
