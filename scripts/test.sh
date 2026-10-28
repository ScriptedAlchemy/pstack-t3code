#!/usr/bin/env bash
set -euo pipefail
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
node scripts/check-native.mjs
node scripts/check-parity.mjs
node --test scripts/test-tooling.mjs
node --test plugins/pstack/skills/statechart/scripts/test/statechart.test.mjs
helpers=plugins/pstack/skills/poteto-mode/scripts
if [[ ! -d "$helpers/node_modules" ]]; then
  (cd "$helpers" && bun install --frozen-lockfile)
fi
(cd "$helpers" && bun run test && bun run typecheck)
echo 'pstack-t3code: all checks passed'
