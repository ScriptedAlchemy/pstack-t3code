#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = join(root, 'plugins/pstack');
const json = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const pin = json('UPSTREAM.json');
const inventory = json('upstream-inventory.json');
const replacements = json('scripts/replaced-upstream.json');
assert.equal(inventory.commit, pin.commit, 'inventory must match reviewed pin');
assert.deepEqual(json('plugins/pstack/UPSTREAM.json'), pin, 'runtime pin must match repository pin');
assert.match(json('plugins/pstack/plugin.json').version, new RegExp(`^${pin.version.replaceAll('.', '\\.')}\\-t3code\\.[1-9][0-9]*$`), 'native manifest version must include the upstream version and port revision');
let unchanged = 0, adapted = 0;
for (const [path, original] of Object.entries(inventory.files)) {
  const replacement = replacements[path];
  if (replacement) assert.ok(replacement.reason, `${path} replacement needs a reason`);
  const target = join(plugin, replacement?.path ?? path);
  assert.ok(existsSync(target) && statSync(target).isFile() && statSync(target).size, `missing upstream counterpart: ${path}`);
  assert.equal(Boolean(statSync(target).mode & 0o111), original.executable, `executable mode differs: ${path}`);
  const hash = createHash('sha256').update(readFileSync(target)).digest('hex');
  if (!replacement) hash === original.sha256 ? unchanged++ : adapted++;
}
for (const path of Object.keys(replacements)) assert.ok(inventory.files[path], `stale replacement: ${path}`);
const upstreamSkills = Object.keys(inventory.files).filter(p => /^skills\/[^/]+\/SKILL.md$/.test(p)).map(p => p.split('/')[1]);
const actualSkills = readdirSync(join(plugin, 'skills')).filter(n => existsSync(join(plugin, 'skills', n, 'SKILL.md')));
assert.deepEqual(actualSkills.sort(), [...upstreamSkills, 'automate-maintainer', 'automate-team'].sort(), 'every upstream skill plus exactly two custom skills');
const setup = readFileSync(join(plugin, 'skills/setup-pstack/SKILL.md'), 'utf8');
// Mirror packages/pstack/src/roles.ts: first fence under ### 5. is the server contract.
const block = setup.match(/^### 5\.[^\n]*\n([\s\S]*?)(?=^### |$(?![\s\S]))/m)?.[1].match(/^```[^\n]*\n([\s\S]*?)^```/m)?.[1];
assert.ok(block, 'setup defaults must remain parseable');
const roles = block.split('\n').flatMap(l => l.trim().match(/^([^#][^:]*):\s*(\S.*)$/) ? [l.trim()] : []);
assert.deepEqual(roles, json('scripts/role-defaults.json'), 'preserve all 17 role labels and defaults without automatic priority selection');
console.log(`parity: ${Object.keys(inventory.files).length} upstream files: ${unchanged} unchanged, ${adapted} adapted, ${Object.keys(replacements).length} explicitly replaced; ${actualSkills.length} skills; ${roles.length} roles`);
