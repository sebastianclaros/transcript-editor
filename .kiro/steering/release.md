---
inclusion: fileMatch
fileMatchPattern: "{.github/**,apps/desktop/electron-builder.config.cjs,apps/desktop/scripts/**}"
---

# Release rules

- Tags `vX.Y.Z` trigger `release.yml`; the root `package.json` version must equal the tag. Releases stay DRAFT.
- Artifact names are fixed in `electron-builder.config.cjs` and checked by `apps/desktop/scripts/check-artifacts.cjs`.
- Builds are unsigned for now; macOS builds are ad-hoc signed. Updates are notify-only. Do not enable the asar
  integrity fuse before verifying packaged macOS and Windows builds.
- Before tagging, check the pinned Electron's minimum macOS (a 2017 MacBook Air tops out at macOS 12).
- Workflow files are committed separately; a token without the `workflow` scope cannot push them (`docs/releasing.md`).
- Pin GitHub Actions to full commit SHAs when verifiable.
