---
title: "GitHub Tray Icon and Notification Sound Support"
type: feat
date: 2026-02-10
---

# GitHub Tray Icon and Notification Sound Support

## Overview

Two enhancements:

1. **GitHub-branded tray icons** -- Replace the placeholder tray icons with proper GitHub mark (Invertocat) icons for each state (normal, error, unconfigured), and add an app icon for the Windows executable/taskbar.
2. **Notification sound** -- Add an independent toggle to play a sound when new PRs are detected, with support for the system default sound or a user-provided `.wav` file.

## Implementation

### Phase 1: Tray Icons

- [x] Create GitHub-mark-based tray icons (16x16 PNG, with alpha transparency):
  - `assets/tray-icon.png` -- White/light GitHub mark on transparent background (normal)
  - `assets/tray-icon-error.png` -- Red-tinted GitHub mark (error state)
  - `assets/tray-icon-unconfigured.png` -- Gray/dimmed GitHub mark (unconfigured)
- [x] Create `assets/app-icon.ico` -- Multi-resolution Windows ICO (16, 32, 48, 256px) for the executable and taskbar
- [x] Add `icon` to `packagerConfig` in `forge.config.ts`

No code changes needed in `tray.ts` -- the icon filenames remain the same.

### Phase 2: Notification Sound Settings

Add sound configuration to the settings model. Sound is an independent toggle, not a notification mode.

- [x] Add fields to `AppSettings` in `src/shared/types.ts`:
  ```typescript
  notificationSound: 'none' | 'default' | 'custom';
  customSoundPath: string;
  ```
- [x] Add defaults in `src/main/store.ts`: `notificationSound: 'default'`, `customSoundPath: ''`
- [x] Add validation in `src/main/ipc-handlers.ts` for the new fields
- [x] Add UI controls in `src/renderer/settings.ts`:
  - `<select>` for sound mode (None / System Default / Custom)
  - File path input + browse button (shown only when Custom is selected)
- [x] Add IPC channel `dialog:open-sound-file` to open a file dialog for `.wav` selection
- [x] Add corresponding handler in `src/main/ipc-handlers.ts` using `dialog.showOpenDialog`
- [x] Add `openSoundFileDialog` to `ElectronAPI` interface and preload bridge

### Phase 3: Sound Playback

- [x] Update `notifyNewPRs` in `src/main/notifications.ts` to accept sound settings
- [x] When `notificationSound` is `'default'`: set `silent: false` on Electron `Notification` (Windows plays system sound)
- [x] When `notificationSound` is `'none'`: set `silent: true`
- [x] When `notificationSound` is `'custom'`: set `silent: true` on Notification, then play the `.wav` file once using PowerShell (`(New-Object Media.SoundPlayer 'path').PlaySync()`)
- [x] Create `src/main/sound.ts` with a `playSound(filePath: string)` function
- [x] Validate custom sound path exists before attempting playback
- [x] Update call site in `src/main/poller.ts` to pass sound settings

### Phase 4: Documentation

- [x] Update `README.md` configuration table with new sound settings
- [x] Add notification sound section to README

## Technical Considerations

- **System default sound**: Electron's `Notification` on Windows uses the system notification sound by default. Setting `silent: false` (or omitting it) plays it. Setting `silent: true` suppresses it.
- **Custom sound playback**: Windows has no built-in Node.js audio API. Using PowerShell's `Media.SoundPlayer` is zero-dependency and supports `.wav` files natively. The call is spawned asynchronously so it doesn't block the main process.
- **File dialog security**: The file dialog runs in the main process via `dialog.showOpenDialog`. The renderer requests it over IPC and receives only the selected path string. The selected file path is validated (must be a `.wav` file that exists on disk).
- **Sound plays once per poll cycle**: Even if 5+ PRs are detected, the sound plays only once (not per-notification).

## Files Changed

| File | Change |
|------|--------|
| `assets/tray-icon.png` | Replace with GitHub mark |
| `assets/tray-icon-error.png` | Replace with GitHub mark (error) |
| `assets/tray-icon-unconfigured.png` | Replace with GitHub mark (dimmed) |
| `assets/app-icon.ico` | New -- Windows app icon |
| `forge.config.ts` | Add `icon` to packagerConfig |
| `src/shared/types.ts` | Add `notificationSound`, `customSoundPath` to AppSettings |
| `src/main/store.ts` | Add defaults for new fields |
| `src/main/ipc-handlers.ts` | Add validation + file dialog handler |
| `src/main/sound.ts` | New -- custom sound playback |
| `src/main/notifications.ts` | Accept sound settings, set `silent` flag, play custom sound |
| `src/main/poller.ts` | Pass sound settings to `notifyNewPRs` |
| `src/preload/preload.ts` | Add `openSoundFileDialog` to bridge |
| `src/renderer/settings.ts` | Add sound mode select + custom file path UI |
| `README.md` | Document new settings |

## Acceptance Criteria

- [x] Tray icon shows GitHub mark in all three states
- [x] App executable has proper icon in taskbar and file explorer
- [x] Sound mode "System Default" plays Windows notification sound
- [x] Sound mode "None" plays no sound
- [x] Sound mode "Custom" plays the user-selected `.wav` file
- [x] Custom sound file can be selected via a file browse dialog
- [x] Sound plays once per notification batch (not per-PR)
- [x] Settings persist across app restarts
- [x] Invalid custom sound paths are handled gracefully (logged, not crashed)
- [x] TypeScript compiles with no errors

## References

- Icon loading: `src/main/tray.ts:19-26`
- Notification dispatch: `src/main/notifications.ts:34-69`
- Settings model: `src/shared/types.ts:13-18`
- Settings validation: `src/main/ipc-handlers.ts:6-19`
- Settings UI: `src/renderer/settings.ts`
- Store defaults: `src/main/store.ts:12-21`
- [Electron Notification API](https://www.electronjs.org/docs/latest/api/notification)
- [Electron dialog.showOpenDialog](https://www.electronjs.org/docs/latest/api/dialog)
