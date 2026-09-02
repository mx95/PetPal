#!/usr/bin/env bash
# Sync a server-side git clone without prompting for HTTPS credentials.
# Prefer ci-rsync-to-server.sh from GitHub Actions; keep this for manual server deploys.
set -euo pipefail

PETPAL_ROOT="${1:?PETPAL_ROOT required}"
DEPLOY_BRANCH="${2:-main}"
MAX_ATTEMPTS="${3:-5}"

export GIT_TERMINAL_PROMPT=0

git -C "$PETPAL_ROOT" config credential.helper ""
git -C "$PETPAL_ROOT" config --global --add safe.directory "$PETPAL_ROOT" 2>/dev/null || true

lock_file="$PETPAL_ROOT/.git/deploy.lock"
exec 9>"$lock_file"
if ! flock -w 180 9; then
  printf '[git-sync] Could not acquire deploy lock within 180s\n' >&2
  exit 1
fi

rm -f "$PETPAL_ROOT/.git/index.lock"

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  git -C "$PETPAL_ROOT" update-ref -d "refs/remotes/origin/${DEPLOY_BRANCH}" 2>/dev/null || true
  if git -C "$PETPAL_ROOT" fetch --prune \
    "https://github.com/mx95/PetPal.git" "+refs/heads/${DEPLOY_BRANCH}:refs/remotes/origin/${DEPLOY_BRANCH}" \
    && git -C "$PETPAL_ROOT" checkout "$DEPLOY_BRANCH" \
    && git -C "$PETPAL_ROOT" reset --hard "origin/${DEPLOY_BRANCH}"; then
    printf '[git-sync] OK at %s\n' "$(git -C "$PETPAL_ROOT" rev-parse --short HEAD)"
    exit 0
  fi
  printf '[git-sync] attempt %s/%s failed — retrying in %ss\n' "$attempt" "$MAX_ATTEMPTS" "$((attempt * 5))"
  sleep $((attempt * 5))
  attempt=$((attempt + 1))
done

printf '[git-sync] failed after %s attempts\n' "$MAX_ATTEMPTS" >&2
exit 1
