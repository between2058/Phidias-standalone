#!/bin/sh
set -e
# Usage: phidias-build-wc.sh [latest|steady]
CHANNEL="${1:-latest}"
npm install -g pnpm@${PNPM_VERSION:-10.2.0} --prefix /tmp/pnpm-global
export PATH=/tmp/pnpm-global/bin:$PATH
pnpm install --frozen-lockfile
if [ "$CHANNEL" = "steady" ]; then
  npm run build:wc:steady
else
  npm run build:wc
fi
