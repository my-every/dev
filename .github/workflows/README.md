# Windows Release Signing

This repo has two Windows release workflows:

- `windows-electron-release.yml` (OV / PFX signing on GitHub-hosted Windows)
- `windows-release-ev.yml` (EV signing on self-hosted Windows with cert in cert store)

Both workflows use the existing package script:

- `pnpm dist:win`

## 1) OV Signing (GitHub-hosted)

Workflow file:

- `.github/workflows/windows-electron-release.yml`

Required secrets:

- `WINDOWS_CSC_LINK`
- `WINDOWS_CSC_KEY_PASSWORD`

How it works:

1. Installs dependencies with `pnpm install --frozen-lockfile`
2. Builds + signs via `pnpm dist:win`
3. Verifies Authenticode signatures on produced installers
4. Uploads files and publishes on tag pushes (`v*`)

## 2) EV Signing (Self-hosted)

Workflow file:

- `.github/workflows/windows-release-ev.yml`

Required runner:

- Self-hosted Windows runner with EV token/HSM middleware installed

Required secrets:

- `WINDOWS_CSC_NAME` (preferred) or `WINDOWS_CSC_SHA1`
- `WINDOWS_CSC_KEY_PASSWORD` (only if token/provider requires PIN/password)

How it works:

1. Installs dependencies with `pnpm install --frozen-lockfile`
2. Builds + signs via `pnpm dist:win`
3. Verifies Authenticode signatures
4. Uploads files and publishes on tag pushes (`v*`)

## 3) electron-builder signing config

Configured in:

- `electron-builder.yml`

Current settings include:

- `forceCodeSigning: true`
- SHA-256 signing hash
- RFC3161 + legacy timestamp servers
- NSIS target (`x64`)

## 4) Release checklist

1. Ensure `release` environment is configured in GitHub (required reviewers if desired).
2. Ensure OV or EV secrets are set.
3. Tag release: `vX.Y.Z`.
4. Confirm workflow status is green.
5. Download installer and validate signature:
   - Publisher should match certificate subject.
   - Signature status should be `Valid`.
