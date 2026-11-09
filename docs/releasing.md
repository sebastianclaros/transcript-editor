# Releasing

Releases are cut by pushing a tag `vX.Y.Z`. GitHub Actions builds Windows, macOS (Intel and Apple Silicon)
and Linux installers and creates a **draft** release; you publish it by hand after checking the assets.

## Pre-release gate

- `npm run check` is green and CI is green on `main`.
- **macOS floor**: Electron's release notes say macOS 13 becomes the minimum from Electron 44; Electron 41
  (pinned) still runs on macOS 12 Monterey, the last system a 2017 MacBook Air can run. Re-check this before
  upgrading Electron (ADR 0002). It was confirmed from documentation only, not on a real Mac.
- Smoke test the unsigned macOS build on the oldest Mac you have.

## Steps

```bash
npm version 0.1.0 --no-git-tag-version      # root package.json is the single version source
# edit CHANGELOG.md: move Unreleased entries under the new version and date
git commit -am "chore(release): v0.1.0"
git tag v0.1.0
git push origin main v0.1.0                  # only after CI is green
```

The release workflow fails if the tag and the root version differ. It uploads the artifacts and a
`SHA256SUMS` file to a draft release.

## Artifact names

| OS      | Files                                                                                        |
| ------- | -------------------------------------------------------------------------------------------- |
| Linux   | `transcript-editor-<v>-linux-x86_64.AppImage`, `transcript-editor-<v>-linux-amd64.deb`       |
| macOS   | `transcript-editor-<v>-mac-x64.dmg` / `.zip`, `transcript-editor-<v>-mac-arm64.dmg` / `.zip` |
| Windows | `transcript-editor-<v>-win-setup-x64.exe`, `transcript-editor-<v>-win-x64.zip`               |

`apps/desktop/scripts/check-artifacts.cjs` verifies the names after a local build.

## Unsigned builds

Signing is not set up yet (needs an Apple Developer ID and a Windows certificate). Users must:

- macOS: right-click, _Open_, or `xattr -dr com.apple.quarantine "/Applications/Transcript Editor.app"`.
  Apple Silicon refuses binaries with no signature at all, so the macOS build ad-hoc signs (`codesign -s -`).
  Check with `codesign -dv --verbose=2 <app>` on the arm64 build.
- Windows: SmartScreen _More info_, _Run anyway_.
- Linux: `chmod +x` the AppImage.

The update check is **notify-only** (it opens the releases page) because macOS auto-update needs signed builds.
To prepare signing, set the secrets `CSC_LINK`, `CSC_KEY_PASSWORD` and the `APPLE_*` variables (placeholders
exist in `scripts/notarize.cjs` and the entitlements file) and enable notarization.

## Building personal copies in a fork (no secrets)

Run the _Release_ workflow manually (`workflow_dispatch`) with `publish` set to `false`: it builds unsigned
artifacts and attaches them to the run. Locally: `npm ci && npm run dist` on each OS (macOS builds need macOS).

## Pushing the workflow files

Workflow files live in a separate commit because a token without the `workflow` scope cannot push them.
If `git push` rejects `.github/workflows/*`, keep them on a local branch (`ci-workflows`), create a token
(classic) with scopes `repo`, `project` and `workflow` (or a fine-grained token with Workflows read/write),
then `git push origin ci-workflows:main` once `main` is up to date, or open a pull request from that branch.

## Verification record of the first build

Verified locally on Linux x64: unit and integration tests, the real Electron E2E suite, `dist:dir`, AppImage and
deb, the packaged app's `--smoke-test`. **Not verified**: macOS and Windows builds, signing, the GitHub Actions
workflows (never executed), the Electron 41 behaviour on a real macOS 12.
