#!/usr/bin/env bash
# Creates the public GitHub repo, pushes, and sets up labels, milestones, roadmap issues and a Project board.
# Idempotent: every step checks before creating and a failing step is logged and skipped.
# Requires: gh (authenticated), git, node. Never force-pushes. Does NOT create tags.
#
#   scripts/gh-bootstrap.sh            # everything
#   PUSH_REF=<commit> scripts/gh-bootstrap.sh   # push this commit as main (default: HEAD)
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="${REPO:-sebastianclaros/transcript-editor}"
OWNER="${REPO%%/*}"
PUSH_REF="${PUSH_REF:-HEAD}"
DESC="Local-first desktop app to correct interview transcripts while listening to the audio"

log() { printf '[bootstrap] %s\n' "$*"; }
try() { "$@" || log "FAILED (skipped): $*"; }

# 1. Hard gate: privacy scan over the tree and the whole history.
node scripts/privacy-scan.mjs || { log "privacy scan failed: aborting before any push"; exit 1; }

# 2. Repository
if gh repo view "$REPO" >/dev/null 2>&1; then
  log "repo $REPO exists"
else
  try gh repo create "$REPO" --public --description "$DESC" --source=. --remote=origin
fi
# Safety gate: only ever push to the intended repo through `origin`. Never reuse a remote pointing elsewhere.
EXPECTED_URL="https://github.com/$REPO.git"
if git remote get-url origin >/dev/null 2>&1; then
  actual="$(git remote get-url origin)"
  case "$actual" in
    "$EXPECTED_URL" | "${EXPECTED_URL%.git}" | "git@github.com:$REPO.git") ;;
    *) log "origin points to '$actual', expected '$EXPECTED_URL': aborting before any push"; exit 1 ;;
  esac
else
  git remote add origin "$EXPECTED_URL" || { log "cannot add origin"; exit 1; }
fi
try gh repo edit "$REPO" --description "$DESC" --enable-issues --enable-discussions \
  --add-topic electron --add-topic transcription --add-topic react --add-topic typescript \
  --add-topic local-first --add-topic interview --add-topic open-source

# 3. Push (the commit after PUSH_REF, e.g. the CI commit, is pushed separately; see docs/releasing.md)
try git push -u origin "$PUSH_REF:refs/heads/main"

# 4. Labels from .github/labels.yml
node -e '
const fs=require("fs");
// Entries start at "- " in column 0 and may span several lines (prettier wraps long ones).
for (const entry of fs.readFileSync(".github/labels.yml","utf8").split(/^- /m).slice(1)) {
  const name=entry.match(/name:\s*"([^"]+)"/), color=entry.match(/color:\s*"([^"]+)"/);
  const desc=entry.match(/description:\s*"([^"]*)"/);
  if (name && color) console.log([name[1],color[1],desc ? desc[1] : ""].join("\t"));
}' | while IFS=$'\t' read -r name color desc; do
  gh label create "$name" --color "$color" --description "$desc" --repo "$REPO" --force >/dev/null 2>&1 \
    && log "label: $name" || log "label failed: $name"
done

# 5. Milestones
MILESTONES=("v0.1 MVP desktop (local)" "v0.2 Settings, i18n polish and export" "v0.3 Drive BYO connection" "v0.4 Local-first sync" "v1.0 Signed releases and auto-update" "Future")
existing="$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq '.[].title' 2>/dev/null || true)"
for m in "${MILESTONES[@]}"; do
  if grep -Fxq "$m" <<<"$existing"; then log "milestone exists: $m"; else
    try gh api "repos/$REPO/milestones" -f title="$m" >/dev/null
  fi
done

# 6. Issues: milestone | title | labels | spec
ISSUES=$(cat <<'EOF'
v0.1 MVP desktop (local)|First release v0.1.0 checklist|type: chore,area: packaging|packaging-and-releases
v0.1 MVP desktop (local)|Verify Playwright E2E seeking in CI|type: chore,area: player|hotkeys-and-player
v0.1 MVP desktop (local)|Enable asar integrity fuse after packaged-build verification|type: chore,area: packaging|packaging-and-releases
v0.1 MVP desktop (local)|Confirm minimum macOS of the pinned Electron against a 2017 MacBook Air|type: chore,area: packaging|packaging-and-releases
v0.2 Settings, i18n polish and export|Settings screen (language, auto-scroll, theme)|type: feature,area: storage|local-storage-and-memory
v0.2 Settings, i18n polish and export|Export to txt, docx and srt|type: feature,area: editor|plugin-or-export-api
v0.2 Settings, i18n polish and export|Accessibility audit of player and dialogs|type: chore,area: player|hotkeys-and-player
v0.2 Settings, i18n polish and export|Light theme|type: feature,area: editor|transcript-playback
v0.2 Settings, i18n polish and export|Format override in the file mapping dialog|type: feature,area: storage|project-open-flow
v0.2 Settings, i18n polish and export|Kiro hooks for lint and test|type: chore,area: docs|packaging-and-releases
v0.3 Drive BYO connection|Guidance for the mounted Google Drive for desktop folder|type: docs,area: drive|google-drive-connection
v0.3 Drive BYO connection|BYO Client ID mode|type: feature,area: drive|byo-and-build-time-client-id
v0.3 Drive BYO connection|Build-time GOOGLE_CLIENT_ID variable, .env.example and Actions variable|type: feature,area: drive|byo-and-build-time-client-id
v0.3 Drive BYO connection|Desktop OAuth with loopback and PKCE|type: feature,area: drive|google-drive-connection
v0.3 Drive BYO connection|Decide scopes: drive.file versus drive|type: chore,area: drive,blocked/google-cloud|google-drive-connection
v0.3 Drive BYO connection|Store the refresh token with safeStorage|type: feature,area: drive|google-drive-connection
v0.3 Drive BYO connection|Root folder chosen at connect time and stored in config.json|type: feature,area: drive|google-drive-connection
v0.4 Local-first sync|Sync manifest in userData|type: feature,area: drive|drive-local-first-sync
v0.4 Local-first sync|Incremental sync with changes.list|type: feature,area: drive|drive-local-first-sync
v0.4 Local-first sync|Side-by-side conflict dialog|type: feature,area: drive|drive-local-first-sync
v0.4 Local-first sync|Offline queue and "pendiente de subir" state|type: feature,area: drive|drive-local-first-sync
v1.0 Signed releases and auto-update|macOS signing and notarization|type: feature,area: packaging,blocked/signing-certs|signing-and-auto-update
v1.0 Signed releases and auto-update|Windows code signing|type: feature,area: packaging,blocked/signing-certs|signing-and-auto-update
v1.0 Signed releases and auto-update|Auto-update download mode|type: feature,area: packaging|signing-and-auto-update
v1.0 Signed releases and auto-update|Merge multiple audios in the app|type: feature,area: editor|merge-multiple-audios
Future|Cloud / web edition|type: feature,area: storage|cloud-web-edition
Future|In-app speaker diarization|type: feature,area: speakers|speaker-diarization-in-app
Future|Multiple sub-folders per project|type: feature,area: storage|project-open-flow
EOF
)
existing_issues="$(gh issue list --repo "$REPO" --state all --limit 300 --json title --jq '.[].title' 2>/dev/null || true)"
ISSUE_URLS=()
while IFS='|' read -r milestone title labels spec; do
  [ -z "$title" ] && continue
  if grep -Fxq "$title" <<<"$existing_issues"; then log "issue exists: $title"; continue; fi
  body="Part of the roadmap milestone **$milestone**.

Spec: [\`.kiro/specs/$spec\`](https://github.com/$REPO/tree/main/.kiro/specs/$spec)

Acceptance criteria: see \`requirements.md\` in the spec (EARS). Summary of done: the behaviour is implemented,
covered by tests, documented, and the spec tasks are ticked."
  url="$(gh issue create --repo "$REPO" --title "$title" --body "$body" --milestone "$milestone" --label "$labels" 2>/dev/null)" \
    && { log "issue: $title"; ISSUE_URLS+=("$url"); } || log "issue failed: $title"
done <<<"$ISSUES"

# 7. Project board (needs the "project" scope)
if gh project list --owner "$OWNER" --format json --jq '.projects[].title' 2>/dev/null | grep -Fxq "Roadmap"; then
  log "project Roadmap exists"
else
  num="$(gh project create --owner "$OWNER" --title "Roadmap" --format json --jq '.number' 2>/dev/null || true)"
  if [ -n "$num" ]; then
    log "project created: $num"
    for u in "${ISSUE_URLS[@]:-}"; do [ -n "$u" ] && try gh project item-add "$num" --owner "$OWNER" --url "$u" >/dev/null; done
  else
    log "project creation failed (skipped)"
  fi
fi
log "done"
