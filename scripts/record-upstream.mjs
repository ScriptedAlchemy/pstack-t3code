#!/usr/bin/env node
// Run after reviewing a sync and advancing UPSTREAM.json; never fetches or changes the pin.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pin = JSON.parse(readFileSync(resolve(root, 'UPSTREAM.json'), 'utf8'));
if (!/^[0-9a-f]{40}$/.test(pin.commit) || pin.subdirectory !== 'pstack') throw new Error('Invalid upstream pin');
const git = (...args) => execFileSync('git', args, { cwd: root });
const upstreamPlugin = JSON.parse(git('show', `${pin.commit}:${pin.subdirectory}/plugin.json`).toString());
if (upstreamPlugin.version !== pin.version) throw new Error('Version differs from pinned upstream manifest');
const files = {};
for (const entry of git('ls-tree', '-rz', pin.commit, '--', pin.subdirectory).toString().split('\0').filter(Boolean)) {
  const [metadata, path] = entry.split('\t');
  const [mode, type, blob] = metadata.split(' ');
  if (type !== 'blob') throw new Error(`Unsupported upstream entry ${path}`);
  files[path.slice(pin.subdirectory.length + 1)] = { blob, sha256: createHash('sha256').update(git('cat-file', 'blob', blob)).digest('hex'), executable: mode === '100755' };
}
if (!Object.keys(files).length) throw new Error('Empty upstream tree');
writeFileSync(resolve(root, 'upstream-inventory.json'), JSON.stringify({ commit: pin.commit, files }, null, 2) + '\n');
writeFileSync(resolve(root, 'plugins/pstack/UPSTREAM.json'), JSON.stringify(pin, null, 2) + '\n');
console.log(`inventory: ${Object.keys(files).length} upstream files at ${pin.commit}`);
