---
title: Setting up CI/CD for Electron Forge with GitHub Actions release publishing
date: 2026-02-10
category: integration-issues
tags:
  - electron
  - electron-forge
  - ci-cd
  - github-actions
  - windows-installer
  - squirrel
severity: medium
component: build-and-release
symptoms:
  - No automated release pipeline for version tags
  - Manual building and uploading of Windows installers required
root_cause: Electron Forge project lacked configured GitHub publisher and GitHub Actions workflow for automated builds on tag pushes
resolution_type: configuration
---

# Electron Forge GitHub Actions Release Workflow

## Problem

The Electron Forge app had no automated CI/CD pipeline. Releases required manually running `npm run make` locally on a Windows machine and uploading the Squirrel installer to GitHub Releases by hand.

## Root Cause

Electron Forge separates the `make` step (build installers) from `publish` (build + upload). The project had no publisher configured and no GitHub Actions workflow to automate the process on tag push.

## Solution

Three changes were needed:

### 1. Install the GitHub publisher

```bash
npm install --save-dev @electron-forge/publisher-github
```

### 2. Add publishers config to forge.config.ts

```typescript
import { PublisherGitHub } from '@electron-forge/publisher-github';

// Inside the ForgeConfig object:
publishers: [
  new PublisherGitHub({
    repository: {
      owner: 'derhally',
      name: 'github-notify',
    },
    prerelease: false,
    draft: true,
  }),
],
```

### 3. Create `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  build-and-release:
    runs-on: windows-latest

    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Publish to GitHub Releases
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run publish
```

### Creating a release

```bash
npm version patch   # bumps package.json version, creates commit + v*.*.* tag
git push origin main --tags   # triggers the workflow
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Runner | `windows-latest` | Squirrel.Windows can only build on Windows |
| Draft releases | `draft: true` | Review artifacts before making public |
| Tag pattern | `v*.*.*` | Standard semver, auto-created by `npm version` |
| Permissions | `contents: write` | Minimum needed for GitHub Releases API |
| Install command | `npm ci` | Deterministic installs from lockfile |

## Prevention Strategies

For future Electron Forge CI/CD setups, remember:

- **Squirrel.Windows requires a Windows runner.** Building on Linux/macOS will fail.
- **`contents: write` permission is required.** Default GITHUB_TOKEN is read-only.
- **Use `npm ci`, not `npm install`** in CI for reproducible builds.
- **Use `draft: true`** in the publisher to review before publishing.
- **`npm run publish` handles the full pipeline** -- package, make, and upload in one command.
- **Push tags explicitly** with `git push origin main --tags` -- a regular `git push` does not push tags.
- **`package-lock.json` must be committed** -- `npm ci` requires it.

## Common Pitfalls

- Trying to build Squirrel.Windows on a Linux or macOS runner
- Missing `contents: write` permission (releases silently fail to create)
- Using `npm install` instead of `npm ci` (non-deterministic)
- Forgetting to push tags after `npm version`
- Not having `package-lock.json` in version control

## References

- [Electron Forge GitHub Publisher docs](https://www.electronforge.io/config/publishers/github)
- [Electron Forge Build Lifecycle](https://www.electronforge.io/core-concepts/build-lifecycle)
- [GitHub Actions tag triggers](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
- [GITHUB_TOKEN permissions](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/controlling-permissions-for-github_token)
