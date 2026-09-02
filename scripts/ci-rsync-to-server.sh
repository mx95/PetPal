#!/usr/bin/env bash
# Rsync GitHub Actions checkout to the Hetzner deploy host (no git pull on server).
set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:?DEPLOY_HOST required}"
DEPLOY_USER="${DEPLOY_USER:?DEPLOY_USER required}"
DEPLOY_PATH="${DEPLOY_PATH:-/root/PetPal}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
SSH_KEY_FILE="${SSH_KEY_FILE:?SSH_KEY_FILE required}"
SOURCE_DIR="${SOURCE_DIR:-.}"

SSH_OPTS=(
  -i "$SSH_KEY_FILE"
  -p "$DEPLOY_PORT"
  -o StrictHostKeyChecking=accept-new
  -o BatchMode=yes
)

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p '$DEPLOY_PATH'"

printf '[ci-rsync] Syncing %s → %s\n' "$(pwd)/$SOURCE_DIR" "$REMOTE"

rsync -az --delete \
  -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.git/' \
  --exclude 'petpal/node_modules/' \
  --exclude 'petpal/build/' \
  --exclude 'petpal/functions/node_modules/' \
  --exclude 'tracker-tcp-server/node_modules/' \
  --exclude 'tracker-tcp-server/data/' \
  --exclude 'petpal/.env.local' \
  --exclude 'petpal/.env.local.bak' \
  --exclude 'petpal/serviceAccount.json' \
  --exclude 'serviceAccount.json' \
  --exclude 'mobile-android/' \
  --exclude 'mobile-ios/' \
  --exclude 'export/' \
  --filter 'protect petpal/.env.local' \
  --filter 'protect petpal/.env.local.bak' \
  --filter 'protect petpal/serviceAccount.json' \
  --filter 'protect serviceAccount.json' \
  --filter 'protect tracker-tcp-server/data/' \
  --filter 'protect tracker-tcp-server/data/***' \
  "$SOURCE_DIR"/ "$REMOTE"

printf '[ci-rsync] Done\n'
