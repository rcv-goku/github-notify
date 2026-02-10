---
title: "GitHub PR Notification Tray App"
type: feat
date: 2026-02-10
---

# GitHub PR Notification Tray App

## Overview

Build a Windows system tray application using Electron and TypeScript that monitors a user's GitHub account for newly assigned pull requests. The app polls the GitHub Search API on a configurable interval, detects PRs assigned to the user (as assignee or requested reviewer), and delivers notifications via Windows toast notifications, text-to-speech, or both. A settings window allows configuration of the GitHub PAT, poll interval, notification mode, and org/repo allowlist filters.

## Problem Statement

GitHub's built-in notification system relies on email or the web UI, both of which are easy to miss during focused work. Developers who are frequently assigned PRs or requested as reviewers need an ambient, always-on notification mechanism that works at the OS level without requiring a browser tab to stay open.

## Proposed Solution

An Electron-based tray-only application that:

- Lives in the Windows system tray with no main window
- Authenticates via a Personal Access Token (PAT) stored securely with Electron's `safeStorage` API
- Polls the GitHub Search API to find open PRs where the user is assignee or requested reviewer
- Tracks "seen" PRs to only notify on genuinely new assignments
- Delivers notifications via Windows toast (with click-through to the PR in browser), text-to-speech (via `say.js` / Windows SAPI), or both
- Provides a settings window for configuration
- Optionally auto-starts with Windows

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Main Process                       │
│                                                      │
│  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │  Tray    │  │  Poller   │  │  Notification    │  │
│  │  Manager │  │  Service  │  │  Service         │  │
│  │          │  │           │  │  ├─ Toast         │  │
│  │  - Icon  │  │  - Timer  │  │  └─ TTS          │  │
│  │  - Menu  │  │  - GitHub │  │                   │  │
│  │  - State │  │    API    │  │                   │  │
│  └──────────┘  │  - Diff   │  └──────────────────┘  │
│                │    Engine │                         │
│  ┌──────────┐  └───────────┘  ┌──────────────────┐  │
│  │  Store   │                 │  IPC Handlers     │  │
│  │          │                 │                   │  │
│  │  - Safe  │                 │  - settings:get   │  │
│  │    Stor. │                 │  - settings:save  │  │
│  │  - Elec. │                 │  - token:save     │  │
│  │    Store │                 │  - token:test     │  │
│  └──────────┘                 └──────────────────┘  │
│                                                      │
├──────────────────────────────────────────────────────┤
│              Preload (contextBridge)                 │
├──────────────────────────────────────────────────────┤
│           Renderer (Settings Window)                 │
│           - Only created on demand                   │
│           - Destroyed on close                       │
└──────────────────────────────────────────────────────┘
```

**Key architectural decisions:**

1. **Tray-only app** -- No `BrowserWindow` at startup. The settings window is created on demand and destroyed on close to minimize memory footprint (~80MB savings).
2. **All business logic in the main process** -- Polling, notification dispatch, and TTS run in the main process. The renderer is only for the settings UI.
3. **`safeStorage` for PAT** -- Uses Windows DPAPI via Electron's built-in `safeStorage` API. `electron-store` for non-sensitive settings (interval, notification mode, filters).
4. **Search API with ETag caching** -- Two search queries per poll cycle (assignee + review-requested), with conditional requests to avoid rate limit consumption when nothing changes.
5. **PR ID set for "new" detection** -- Maintain a persistent set of `{repo}/{number}` identifiers. Any PR in API results not in this set triggers a notification.

### Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Framework | Electron v39.x | Latest stable, months of support, Windows-native integration |
| Language | TypeScript (strict mode) | Type safety across main/preload/renderer |
| Packaging | Electron Forge + maker-squirrel | Official Electron tooling, Windows installer |
| Build | Electron Forge Vite plugin | Fast dev server and builds |
| GitHub API | `@octokit/rest` + `@octokit/plugin-throttling` | Official GitHub SDK with rate limit handling |
| Settings storage | `electron-store` | Simple JSON persistence for preferences |
| Token storage | Electron `safeStorage` | OS-level encryption (Windows DPAPI) |
| TTS | `say.js` | Offline Windows SAPI, zero config |
| Notifications | Electron `Notification` API | Built-in, no extra dependencies |
| Auto-start | `electron-squirrel-startup` + Windows registry | Squirrel handles start menu / auto-launch |

### Project Structure

```
github-notify/
├── src/
│   ├── main/
│   │   ├── main.ts              # App entry point, tray creation, lifecycle
│   │   ├── tray.ts              # Tray icon, context menu, icon state management
│   │   ├── poller.ts            # GitHub API polling logic, timer management
│   │   ├── github-api.ts        # Octokit setup, search queries, ETag caching
│   │   ├── notifications.ts     # Toast notification dispatch, click handling
│   │   ├── tts.ts               # Text-to-speech via say.js
│   │   ├── store.ts             # electron-store + safeStorage wrapper
│   │   ├── auto-launch.ts       # Windows auto-start registration
│   │   └── ipc-handlers.ts      # All ipcMain.handle() registrations
│   ├── preload/
│   │   └── preload.ts           # contextBridge.exposeInMainWorld()
│   ├── renderer/
│   │   ├── index.html           # Settings window HTML
│   │   ├── settings.ts          # Settings UI logic
│   │   └── styles.css           # Settings window styles
│   └── shared/
│       └── types.ts             # Shared TypeScript interfaces, IPC API shape
├── assets/
│   ├── tray-icon.ico            # Normal state tray icon
│   ├── tray-icon-error.ico      # Error state tray icon
│   └── tray-icon-unconfigured.ico # No PAT configured icon
├── forge.config.ts
├── tsconfig.json
├── package.json
└── .gitignore
```

### Implementation Phases

#### Phase 1: Foundation

Scaffold the project, establish the tray app lifecycle, and implement the settings/store layer.

**Tasks and deliverables:**

- [x] Initialize Electron Forge project with Vite + TypeScript template
- [x] Configure `tsconfig.json` with strict mode, path aliases
- [x] Create `src/shared/types.ts` -- define all interfaces:
  - `AppSettings` (pollInterval, notificationMode, autoStart, filters)
  - `GitHubPR` (id, number, title, body, repoFullName, author, url, createdAt)
  - `ElectronAPI` (IPC bridge shape)
  - `TrayState` enum (normal, error, unconfigured)
  - `NotificationMode` enum (toast, tts, both)
- [x] Create `src/main/store.ts` -- `electron-store` for settings + `safeStorage` for PAT
- [x] Create `src/main/tray.ts` -- tray icon with context menu (Check Now, Settings, Pause/Resume, Quit)
- [x] Create `src/main/main.ts` -- app lifecycle:
  - `app.setAppUserModelId('com.github-notify.app')`
  - `app.requestSingleInstanceLock()` to prevent multiple instances
  - `app.on('window-all-closed', () => {})` to keep tray alive
  - `powerMonitor` listener for system resume → immediate poll
- [x] Create `src/main/ipc-handlers.ts` -- register all IPC channels
- [x] Create `src/preload/preload.ts` -- expose typed API via `contextBridge`
- [x] Create settings window (renderer) with fields for:
  - PAT input (password field with show/hide toggle)
  - "Test Connection" button
  - Poll interval (number input, min 60s, max 3600s, default 300s)
  - Notification mode selector (Toast, TTS, Both)
  - Auto-start with Windows toggle
  - Org/repo allowlist (text area, one per line)
- [x] Create tray icon assets (normal, error, unconfigured states)

**Success criteria:**

- App launches to system tray with no visible window
- Right-click menu shows all items
- Settings window opens, saves, and loads values
- PAT is encrypted via safeStorage
- Only one instance can run at a time

#### Phase 2: Core Implementation

Implement the GitHub API polling, PR diff engine, and notification delivery.

**Tasks and deliverables:**

- [x] Create `src/main/github-api.ts`:
  - Initialize Octokit with PAT + throttling plugin
  - `fetchAssignedPRs(username)` -- `is:pr is:open assignee:{user}`
  - `fetchReviewRequestedPRs(username)` -- `is:pr is:open review-requested:{user}`
  - ETag caching for conditional requests (304 = no change)
  - Response parsing into `GitHubPR[]` with deduplication by `{repoFullName}#{number}`
  - Extract authenticated user's login from `GET /user` on startup
- [x] Create `src/main/poller.ts`:
  - Timer management (start, stop, restart on settings change)
  - Poll-on-startup behavior
  - Poll-on-system-resume via `powerMonitor`
  - Guard against concurrent polls (skip if previous poll still in-flight)
  - Diff engine: compare current results against persisted "seen" set
  - Persist "seen" set to `electron-store` after each poll
  - Prune "seen" entries older than 30 days
  - Apply org/repo allowlist filter before diff
  - Update tray icon state based on poll result (normal/error)
  - Update tray tooltip with last successful poll timestamp
- [x] Create `src/main/notifications.ts`:
  - `notifyNewPRs(prs: GitHubPR[], mode: NotificationMode)` dispatcher
  - Toast: show individual notification per PR (up to 5), then summary for remainder
  - Toast content: `"[repo] #number - title"` as title, `"by @author"` as body
  - Toast click handler: `shell.openExternal(pr.url)` to open in browser
  - TTS: speak each PR, cap at 5, then summary count
  - TTS content: `"New pull request in {repo}: {title}, by {author}"`
  - Handle "both" mode: show toast first, then TTS
- [x] Create `src/main/tts.ts`:
  - Wrapper around `say.js` with Promise API
  - Queue mechanism for sequential speech
  - `stopSpeaking()` to cancel current speech
  - Truncate PR titles longer than 100 characters for TTS
- [x] Error handling:
  - 401 → change tray icon to error, show toast "GitHub token invalid", stop polling
  - Network failure → change tray icon to error, set tooltip to error message, continue polling
  - 403 rate limit → read `X-RateLimit-Reset`, pause until reset, show toast warning
  - Log all errors to a rotating log file in `app.getPath('userData')`

**Success criteria:**

- App polls GitHub on the configured interval
- New PR assignments trigger toast notifications with correct content
- Clicking a toast opens the PR in the default browser
- TTS reads PR details aloud when enabled
- Duplicate PRs (assignee + reviewer) produce only one notification
- App survives network failures, auth errors, and rate limits gracefully
- Tray icon reflects current app health state

#### Phase 3: Polish and Packaging

Auto-start, final UX touches, and Windows installer packaging.

**Tasks and deliverables:**

- [x] Create `src/main/auto-launch.ts`:
  - Register/unregister from Windows startup via Electron's `app.setLoginItemSettings()`
  - Respect the user's toggle in settings
- [x] Tray UX polish:
  - "Check Now" triggers immediate poll with spinner/feedback
  - "Pause/Resume" toggles polling on/off, updates menu label
  - Tooltip shows: app name, last poll time, number of tracked PRs, next poll countdown
  - Left-click on tray icon opens context menu (same as right-click on Windows)
- [x] Settings window polish:
  - Validation: poll interval min 60 / max 3600, PAT format validation
  - "Test Connection" shows success/failure with username
  - Changing poll interval restarts the timer immediately
  - Changing PAT triggers re-validation and immediate poll
  - Changing filters triggers immediate poll
- [x] Logging:
  - Log poll results, errors, notification events to file
  - Rotate logs (keep last 7 days or 5MB, whichever is smaller)
  - Add "Open Logs" item to tray context menu for debugging
- [x] Configure `forge.config.ts`:
  - `maker-squirrel` for Windows installer (.exe)
  - App icon, name, executable name
  - ASAR packaging enabled
  - Squirrel startup event handling (install, update, uninstall shortcuts)
- [x] Handle Squirrel lifecycle events (first-run, update, uninstall)
- [ ] Build and test the installer on Windows

**Success criteria:**

- App auto-starts with Windows when the setting is enabled
- Installer produces a working `.exe` setup file
- App updates tray tooltip with real-time status
- Logs are accessible from the tray menu
- Settings changes take effect immediately without app restart

## Alternative Approaches Considered

### Tauri instead of Electron

**Pros:** Much smaller binary (~5MB vs ~150MB), lower memory footprint, native Rust backend.
**Cons:** Less mature ecosystem, fewer examples for Windows tray apps, requires Rust knowledge for backend logic, WebView2 dependency on Windows.
**Decision:** Electron chosen for ecosystem maturity, extensive documentation, and JavaScript/TypeScript-only stack. The memory overhead is acceptable for a personal utility.

### GitHub Webhooks instead of polling

**Pros:** Real-time notifications, no rate limit concerns, no polling overhead.
**Cons:** Requires a publicly accessible server to receive webhooks, significant infrastructure overhead for a personal desktop app, webhook configuration per repository.
**Decision:** Polling chosen because it requires zero infrastructure and works entirely client-side. The 1-5 minute delay is acceptable for PR notifications.

### GitHub Notifications API as primary source

**Pros:** Purpose-built for polling with `X-Poll-Interval` and `If-Modified-Since`, notifications are ephemeral so the API is efficient.
**Cons:** Returns notification threads, not PR data -- requires additional API calls per notification to fetch PR details. Only shows unread activity, not a complete snapshot of assigned PRs. Marking notifications as read in the GitHub UI removes them from the API response.
**Decision:** Search API chosen as the primary source because it returns a complete, filterable snapshot of all assigned PRs in 1-2 API calls with no secondary lookups.

### `edge-tts` for high-quality neural voices

**Pros:** Microsoft neural voices sound significantly more natural than SAPI voices.
**Cons:** Requires internet connection, adds a dependency on Microsoft's unofficial edge TTS endpoint which could break without notice.
**Decision:** `say.js` (offline SAPI) chosen for reliability. Could be added as an optional "high quality" TTS mode in a future iteration.

## Acceptance Criteria

### Functional Requirements

- [ ] App runs as a Windows system tray application with no main window
- [ ] User can configure a GitHub PAT in the settings window
- [ ] PAT is stored encrypted using Electron's `safeStorage` API
- [ ] App polls GitHub Search API for PRs assigned to the user (as assignee or requested reviewer)
- [ ] Poll interval is configurable (60s - 3600s), default 300s
- [ ] App detects PRs not seen since the last check and notifies the user
- [ ] Toast notifications display PR title, repo name, PR number, and author
- [ ] Clicking a toast notification opens the PR in the default browser
- [ ] TTS reads PR details aloud using Windows SAPI via `say.js`
- [ ] User can choose notification mode: Toast only, TTS only, or Both
- [ ] Org/repo allowlist filters limit which PRs trigger notifications (empty = all)
- [ ] App can auto-start with Windows (configurable toggle)
- [ ] Tray icon visually indicates app state (normal, error, unconfigured)
- [ ] Tray tooltip shows last poll time and status
- [ ] Tray context menu includes: Check Now, Settings, Pause/Resume, Open Logs, Quit
- [ ] Only one instance of the app can run at a time
- [ ] App polls immediately on startup and after system wake from sleep

### Non-Functional Requirements

- [ ] App uses < 150MB RSS memory when idle (no settings window open)
- [ ] Each poll cycle completes in < 5 seconds under normal network conditions
- [ ] App handles 401 (invalid token), network failures, and 403 (rate limit) without crashing
- [ ] Errors are logged to a rotating log file in the user data directory
- [ ] PAT never appears in logs or is stored in plaintext

### Quality Gates

- [ ] TypeScript strict mode with no `any` types in application code
- [ ] App builds and packages via `npm run make` without errors
- [ ] Installer produces a working Windows `.exe`
- [ ] Manual testing confirms all notification modes work

## Dependencies and Prerequisites

| Dependency | Purpose | Version |
|---|---|---|
| Electron | App framework | ^39.0.0 |
| Electron Forge | Build/package tooling | Latest |
| `@octokit/rest` | GitHub API client | ^21.x |
| `@octokit/plugin-throttling` | Rate limit handling | ^9.x |
| `electron-store` | Settings persistence | ^10.x |
| `say` | Windows TTS via SAPI | ^0.16.x |
| TypeScript | Language | ^5.x |
| Node.js | Runtime (bundled with Electron) | v22.x (Electron 39) |

**External prerequisites:**

- GitHub Personal Access Token with `repo` scope (for private repos) or `public_repo` scope (for public only)
- Windows 10/11 (for toast notifications and SAPI TTS)

## Risk Analysis and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GitHub Search API rate limit (30 req/min) | Medium | Polling pauses temporarily | ETag caching reduces real API calls; throttling plugin handles backoff; minimum 60s poll interval enforced |
| `safeStorage` unavailable on some Windows configs | Low | App cannot store PAT securely | Check `safeStorage.isEncryptionAvailable()` at startup; fall back to prompting user to re-enter PAT each session if unavailable |
| `say.js` SAPI not available | Low | TTS fails silently | Catch TTS errors, fall back to toast-only, log the failure |
| Electron memory footprint too high | Low | User perceives app as bloated | No BrowserWindow at startup, lazy imports, destroy settings window on close |
| Squirrel installer issues on some Windows versions | Low | Installation fails | Provide a portable `.zip` alternative alongside the installer |
| GitHub API schema changes | Very Low | Queries return unexpected data | Pin Octokit version, validate response shape, handle gracefully |

## Future Considerations

- **GitHub Enterprise Server support** -- Add a configurable API base URL in settings
- **Multiple accounts** -- Support monitoring multiple GitHub accounts/PATs
- **Neural TTS** -- Add optional `edge-tts` integration for higher quality voices
- **Notification history** -- Show a list of recent notifications in a window accessible from the tray
- **Custom notification sounds** -- Allow users to pick a sound file for toast notifications
- **PR status tracking** -- Track when assigned PRs are merged/closed and optionally notify
- **Linux/macOS support** -- The core architecture is cross-platform; TTS and notifications would need platform-specific handling
- **Auto-update** -- Electron Forge supports auto-updates via Squirrel; could add an update server

## References and Research

### Internal References

- This is a greenfield project with no existing codebase conventions

### External References

- [Electron Tray API](https://www.electronjs.org/docs/latest/api/tray)
- [Electron Notification API](https://www.electronjs.org/docs/latest/api/notification)
- [Electron safeStorage API](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron powerMonitor API](https://www.electronjs.org/docs/latest/api/power-monitor)
- [Electron Forge Documentation](https://www.electronforge.io/)
- [GitHub Search API - Issues and PRs](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests)
- [GitHub Search Qualifiers](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests)
- [GitHub REST API Rate Limiting](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub Conditional Requests](https://docs.github.com/rest/guides/best-practices-for-using-the-rest-api#use-conditional-requests-if-appropriate)
- [Octokit rest.js](https://github.com/octokit/rest.js)
- [Octokit plugin-throttling](https://github.com/octokit/plugin-throttling.js)
- [electron-store](https://github.com/sindresorhus/electron-store)
- [say.js](https://www.npmjs.com/package/say)
- [Creating Tray Applications with Electron](https://dontpaniclabs.com/blog/post/2022/11/03/creating-tray-applications-with-electron/)

### Key Technical Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| "New PR" detection | Persistent set of `{repo}#{number}` IDs | Survives restarts, handles PRs created during downtime, simple to implement |
| API strategy | 2x Search API calls per poll + ETag caching | 1 call for assignee, 1 for review-requested; ETags make 304s free |
| Token storage | `safeStorage` (not keytar) | keytar is deprecated; safeStorage uses Windows DPAPI natively |
| TTS engine | `say.js` (offline SAPI) | Zero config, offline, adequate voice quality |
| Bulk notifications | Individual up to 5, then summary | Balances informativeness with avoiding notification spam |
| Filters | Allowlist (empty = all) | More intuitive for "only monitor work repos" use case |
| Seen set pruning | Remove entries older than 30 days | Prevents unbounded growth; re-notification after 30 days is acceptable |
| Poll interval bounds | 60s min, 3600s max, 300s default | Respects rate limits while being responsive |
