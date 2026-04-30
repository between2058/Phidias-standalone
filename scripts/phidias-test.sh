#!/bin/sh
set -e
npm install -g pnpm@${PNPM_VERSION:-10.2.0} --prefix /tmp/pnpm-global
export PATH=/tmp/pnpm-global/bin:$PATH
pnpm install --frozen-lockfile
npm run test
