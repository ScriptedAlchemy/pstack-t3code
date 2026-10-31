#!/usr/bin/env node
// Idempotent mechanical translations; semantic changes are reviewed using PORTING.md.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.argv[2] ? join(process.argv[2], 'plugins', 'pstack') : join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'pstack');
const walk = dir => readdirSync(dir).flatMap(name => name === 'node_modules' || name === '.DS_Store' ? [] : statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]);
const skills = readdirSync(join(root, 'skills')).filter(name => existsSync(join(root, 'skills', name, 'SKILL.md')));
const spawnPreamble = "Use `delegate_task` for every spawn. Arena runners, architect runners, and interrogate reviewers are panels: one child per seat, including fallbacks. An `unavailable` seat is not a target: retain its panel position, refresh capabilities, report the blocked seat, and do not launch it until a valid target is resolved. Every other role is a pool: pick the seat whose model best fits the job; spread same-role children in a wave across seats. Arena cross-judges prefer a different model family. Copy the chosen target from `<t3_pstack>` exactly, including all options; `inherit` means the parent model and omits `target`. If a pool spawn is rejected, report it and try the next seat; never invent targets or change options. Repeat fallback notes and report provider, model, or option mismatches. If a required role is missing, stop that spawn. Call `orchestrator_capabilities` before the first delegation and again when availability changes or a target is rejected. Resolved roles are a snapshot. An explicit user change supersedes it; validate the requested target and options against fresh capabilities. After setup writes new choices, do not reuse the older snapshot for changed roles. Start each brief with the absolute `<pstack>` and `<models>` paths; include the relevant resolved role lines when children will delegate. Retain every `taskId`. With `mode: \"async\"`, spawn the wave and end the turn; completion wakes the parent. Do not poll children. Use `mode: \"wait\"` only when this turn needs the result; a wait timeout does not cancel the child. Cancel replaced or unneeded work with `task_cancel`.";
const edits = [
  [/bootstrap\.ts/g, 'install-dependencies.ts'],
  [/bugbot-triage\.md/g, 'review-bot-triage.md'],
  [/@cursor-skill\/poteto-mode-tools/g, '@pstack-t3code/poteto-mode-tools'],
  [/@cursor-skill\/statechart/g, '@pstack-t3code/statechart'],
  [/\bAskQuestion\b|\bAskUserQuestion\b/g, "the harness question tool"],
  [/`Task`|`Agent`/g, '`delegate_task`'],
  [/\bTask (tool|subagent|call)\b/g, 'delegate_task $1'],
  [/`subagent_type: generalPurpose`/g, '`role: "general"`'],
  [/`readonly: true`/g, '`role: "research"` with "Do not edit files, commit, or push" in the brief'],
  [/`readonly: false`/g, 'normal child permissions'],
  [/`environment: "cloud"`/g, '`isolation: "worktree"`'],
  [/`environment: "local"`/g, 'the shared checkout'],
  [/`run_in_background: true`/g, '`mode: "async"`'],
  [/`file_attachments`/g, 'paths in the brief'],
  [/(?:~\/)?\.cursor\/rules\/pstack-models\.mdc|`pstack-models\.mdc`/g, '<models>'],
  [/\.cursor\/skills\//g, '.agents/skills/'],
  [/\.cursor\/rules\/[\w-]+\.mdc/g, 'AGENTS.md'],
  [/-fast\b/g, ''],
  [/Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the \*\*poteto-mode\*\* skill\./g, "Copy the role's resolved target from `<t3_pstack>` exactly, including all options."],
  [/^icon:.*\n|^color:.*\n|^is_background:.*\n/gm, ''],
];
let count = 0;
for (const path of walk(root).filter(p => !/\.(png|jpe?g|gif|ico|woff2?|pdf)$/.test(p))) {
  const before = readFileSync(path, 'utf8');
  const preambleUpdated = before.replace(/Use `delegate_task` for every spawn\.[^\n]*?Cancel replaced or unneeded work with `task_cancel`\./g, spawnPreamble);
  const custom = /^skills\/automate-(?:maintainer|team)\//.test(relative(root, path));
  let after = custom ? preambleUpdated : edits.reduce((s, [pattern, replacement]) => s.replace(pattern, replacement), preambleUpdated);
  if (!custom && path.endsWith('.md')) after = after.replace(new RegExp(`(?<![\\w:./@$-])/(${skills.join('|')})(?![\\w/-]|\\.\\w)`, 'g'), '$$pstack:$1');
  // Upstream links to bundled files become relative links, preserving local offline reads.
  if (!custom) after = after.replace(/https:\/\/github\.com\/cursor\/plugins\/blob\/main\/pstack\/([^\s)]+)(?=\))/g, (url, target) => {
    const [file, anchor = ''] = target.split('#');
    return existsSync(join(root, file)) ? relative(dirname(path), join(root, file)) + (anchor ? '#' + anchor : '') : url;
  });
  if (after !== before) { writeFileSync(path, after); count++; }
}
console.log(`codemod: ${count} files changed`);
