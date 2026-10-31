#!/usr/bin/env bash
set -euo pipefail
root=$(CDPATH='' cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
node scripts/check-native.mjs
node scripts/check-parity.mjs
node --test scripts/test-tooling.mjs
statechart=plugins/pstack/skills/statechart/scripts
if [[ ! -d "$statechart/node_modules" ]]; then
  (cd "$statechart" && bun install --frozen-lockfile)
fi
(cd "$statechart" && node --disable-warning=ExperimentalWarning --test --test-concurrency=1 --test-timeout=90000 test/*.test.ts)
helpers=plugins/pstack/skills/poteto-mode/scripts
if [[ ! -d "$helpers/node_modules" ]]; then
  (cd "$helpers" && bun install --frozen-lockfile)
fi
(cd "$helpers" && bun run test && bun run typecheck)
echo 'pstack-t3code: all checks passed'
