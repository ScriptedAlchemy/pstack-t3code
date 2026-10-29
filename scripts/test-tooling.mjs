import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
const scripts = dirname(fileURLToPath(import.meta.url));
const fixture = run => {
  const root = mkdtempSync(join(tmpdir(), 'pstack-t3-gate-'));
  const skill = join(root, 'plugins/pstack/skills/demo/SKILL.md');
  mkdirSync(dirname(skill), { recursive: true });
  mkdirSync(join(root, 'scripts'));
  writeFileSync(join(root, 'scripts/native-allowlist.json'), '[]\n');
  const set = (body, name = 'demo') => writeFileSync(skill, `---\nname: ${name}\n---\n\n${body}\n`);
  const gate = () => spawnSync(process.execPath, [join(scripts, 'check-native.mjs'), root], { encoding: 'utf8' });
  try { run({ root, skill, set, gate }); } finally { rmSync(root, { recursive: true, force: true }); }
};
test('native gate rejects foreign tools, fields, speed selection, stale links, and mismatched names', () => fixture(({ set, gate }) => {
  for (const body of ['`Task`', 'AskQuestion', 'a todolist', 'generalPurpose', 'readonly: false', 'environment: "cloud"', 'cloud_base_branch', 'run_in_background', '`resume`', 'file_attachments', 'grok-4.7-xhigh', '.cursor/skills/', '~/.cursor/projects/', 'Bugbot', '/loop', 'update_state', 'watch-pr --poll', 'bootstrap', 'Custom Mode', 'create-skill', 'cursor-team-kit', '-fast', 'fastMode', 'serviceTier', '/demo', '[missing](gone.md)']) {
    set(body);
    assert.equal(gate().status, 1, body);
  }
  set('Native skill.', 'other');
  assert.equal(gate().status, 1);
  set('<<<<<<< port\nconflict\n=======\nother\n>>>>>>> upstream');
  assert.equal(gate().status, 1);
}));
test('native gate accepts resolved targets, composer chips, and local links; scans extensionless helpers', () => fixture(({ root, set, gate }) => {
  set('Use `$pstack:demo` with `delegate_task` and the role in `<t3_pstack>`. Read [self](SKILL.md).');
  assert.equal(gate().status, 0, gate().stderr);
  writeFileSync(join(root, 'plugins/pstack/helper'), '#!/usr/bin/env node\n// Cursor integration\n');
  assert.equal(gate().status, 1);
}));
test('allowlist exceptions require an exact path and full line and cannot go stale', () => fixture(({ root, set, gate }) => {
  set('Cursor source credit.');
  const allow = [{ path: 'skills/demo/SKILL.md', text: 'Cursor source credit.', reason: 'Attribution fixture.' }];
  writeFileSync(join(root, 'scripts/native-allowlist.json'), JSON.stringify(allow));
  assert.equal(gate().status, 0);
  set('Cursor source credit. Now use Cursor.');
  assert.equal(gate().status, 1);
  set('Native text.');
  assert.match(gate().stderr, /stale allowlist/);
}));
test('codemod applies mechanical translations and is idempotent', () => fixture(({ root, skill, set }) => {
  set('Use /demo with `Task`, AskQuestion, `run_in_background: true`, and `environment: "cloud"`.\nUse `delegate_task` for every spawn. Old rules. Cancel replaced or unneeded work with `task_cancel`.');
  execFileSync(process.execPath, [join(scripts, 'codemod.mjs'), root]);
  const result = readFileSync(skill, 'utf8');
  assert.match(result, /\$pstack:demo/);
  assert.match(result, /`delegate_task`/);
  assert.match(result, /mode: "async"/);
  assert.match(result, /isolation: "worktree"/);
  assert.match(result, /panels: one child per seat, including fallbacks/);
  assert.match(result, /Every other role is a pool/);
  assert.match(result, /If a pool spawn is rejected, report it and try the next seat/);
  const second = execFileSync(process.execPath, [join(scripts, 'codemod.mjs'), root], { encoding: 'utf8' });
  assert.match(second, /0 files changed/);
  assert.equal(readFileSync(skill, 'utf8'), result);
}));
test('shipping pack remains codemod-idempotent', () => {
  const result = execFileSync(process.execPath, [join(scripts, 'codemod.mjs')], { encoding: 'utf8' });
  assert.match(result, /0 files changed/);
});
test('upstream sync three-way merges native edits and never touches custom skills or advances the pin', () => {
  const root = mkdtempSync(join(tmpdir(), 'pstack-t3-sync-'));
  const git = (...args) => execFileSync('/usr/bin/git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (path, text) => { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); };
  try {
    git('init', '-b', 'upstream-fixture');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    put('pstack/skills/demo/SKILL.md', '---\nname: demo\n---\n\nUse `Task`.\nBase behavior.\n');
    git('add', '.'); git('commit', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    put('pstack/skills/demo/SKILL.md', '---\nname: demo\n---\n\nUse `Task`.\nBase behavior.\nNew upstream behavior.\n');
    for (const name of ['automate-maintainer', 'automate-team']) put(`pstack/skills/${name}/SKILL.md`, 'Upstream collision.\n');
    git('add', '.'); git('commit', '-m', 'upstream change');
    const target = git('rev-parse', 'HEAD');
    git('checkout', '--orphan', 'port'); git('rm', '-rf', '.');
    for (const script of ['sync-upstream.sh', 'codemod.mjs']) put(`scripts/${script}`, readFileSync(join(scripts, script), 'utf8'));
    put('plugins/pstack/skills/demo/SKILL.md', '---\nname: demo\n---\n\nUse `delegate_task`.\nBase behavior.\n');
    for (const name of ['automate-maintainer', 'automate-team']) put(`plugins/pstack/skills/${name}/SKILL.md`, `---\nname: ${name}\n---\n\nCursor is source data, not a mechanical edit.\n`);
    const pin = JSON.stringify({ commit: base });
    put('UPSTREAM.json', pin);
    git('remote', 'add', 'upstream', 'https://github.com/cursor/plugins.git');
    git('add', '.'); git('commit', '-m', 'native port');
    // Intercept only fetch; fixture commits already provide the target without a network request.
    const bin = mkdtempSync(join(tmpdir(), 'pstack-t3-git-'));
    try {
      writeFileSync(join(bin, 'git'), '#!/bin/sh\nif [ "$1" = fetch ]; then exit 0; fi\nexec /usr/bin/git "$@"\n', { mode: 0o755 });
      const result = spawnSync('bash', ['scripts/sync-upstream.sh', target], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(readFileSync(join(root, 'plugins/pstack/skills/demo/SKILL.md'), 'utf8'), '---\nname: demo\n---\n\nUse `delegate_task`.\nBase behavior.\nNew upstream behavior.\n');
      for (const name of ['automate-maintainer', 'automate-team']) assert.match(readFileSync(join(root, `plugins/pstack/skills/${name}/SKILL.md`), 'utf8'), /Cursor is source data/);
      assert.equal(readFileSync(join(root, 'UPSTREAM.json'), 'utf8'), pin);
      assert.match(result.stdout, /review by hand.*automate-maintainer/);
    } finally { rmSync(bin, { recursive: true, force: true }); }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
