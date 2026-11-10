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
npm version 0.1.0 --no-git-tag-version      # root package.json is the version source (the build uses it)
npm version 0.1.0 --no-git-tag-version -w @transcript-editor/desktop   # keep the app package in step
# edit CHANGELOG.md: move Unreleased entries under the new version and date
# commit on a branch, open a PR, merge it when CI is green (main is not pushed directly)
git switch main && git pull --ff-only origin main
gh run list --branch main --limit 1          # must be success
git tag -a v0.1.0 -m v0.1.0
git push origin v0.1.0                       # always name the remote and the ref explicitly
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

If the release workflow fails before the draft is published, fix it through a PR, then delete only that
tag and draft (`gh release delete v0.1.0 --yes --cleanup-tag`) and tag the new `main` commit again.
Never delete a published release or a tag that users may have downloaded.

## Verification record of the first build

Verified locally on Linux x64: unit and integration tests, the real Electron E2E suite, `dist:dir`, AppImage and
deb, the packaged app's `--smoke-test`. Since then CI (`.github/workflows/ci.yml`) is green on Ubuntu, Windows and
macOS, including the Linux E2E suite under Xvfb and the packaged Linux smoke test. **Not verified**: signing, the
installers on real macOS and Windows machines, the Electron 41 behaviour on a real macOS 12 (Intel).
