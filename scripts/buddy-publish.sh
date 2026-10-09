#!/usr/bin/env bash
# Run only in the disposable Actions checkout. Recompute after branch movement.
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != 'true' ]]; then
  echo 'Buddy publishing requires the disposable GitHub Actions checkout.' >&2
  exit 1
fi
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
for attempt in 1 2 3; do
  git fetch --no-tags origin main:refs/remotes/origin/main
  git reset --hard refs/remotes/origin/main
  base_head=$(git rev-parse HEAD)
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf 'close_issue=\n' >> "$GITHUB_OUTPUT"
  fi
  node --test tests/buddy.test.mjs
  node scripts/buddy.mjs update
  git add -- state/buddy.json bot-buddy.svg
  if git diff --cached --quiet; then
    exit 0
  fi
  git commit -m 'chore: update Bot Buddy'
  if git push origin HEAD:main; then
    exit 0
  fi
  git fetch --no-tags origin main:refs/remotes/origin/main
  if [[ "$(git rev-parse refs/remotes/origin/main)" == "$base_head" ]]; then
    echo 'Push failed without branch movement; stopping safely.' >&2
    exit 1
  fi
  echo "Main moved during attempt $attempt; regenerating against persisted state."
done
echo 'Main kept moving; no state was force-pushed and no issue was closed.' >&2
exit 1
