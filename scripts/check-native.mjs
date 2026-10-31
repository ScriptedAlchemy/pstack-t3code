#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = process.argv[2] ? resolve(process.argv[2]) : resolve(dirname(fileURLToPath(import.meta.url)), '..');
const plugin = join(root, 'plugins/pstack');
const allow = JSON.parse(readFileSync(join(root, 'scripts/native-allowlist.json'), 'utf8'));
const walk = dir => readdirSync(dir).flatMap(n => n === 'node_modules' || n === '.DS_Store' ? [] : statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]);
const files = walk(plugin);
const skills = readdirSync(join(plugin, 'skills')).filter(n => existsSync(join(plugin, 'skills', n, 'SKILL.md')));
const bareCommand = new RegExp(`(?<![\\w:./@$-])/(${skills.join('|')})(?![\\w/-]|\\.\\w)`);
const rules = [
  [bareCommand, '$pstack:<name> composer chip'],
  [/\/add-plugin|\/in-cloud|\/automate(?![\w/-])|Option\+Enter|Alt\+Enter|Use as Mode|claude plugin/, 'native T3 invocation or scheduling'],
  [/\bcursor\b|\.cursor|cursor-team-kit/i, 'native T3 Code name or source attribution'],
  [/`Task`|\bTask (tool|subagent|call)|`Agent`|subagent_type|generalPurpose|readonly: (true|false)|readonly\/Ask|readonly strips MCP/, 'delegate_task with role and brief'],
  [/AskQuestion|AskUserQuestion|\btodo ?list\b/i, 'harness question or plan tool'],
  [/environment: ["'](?:cloud|local)|cloud_base_branch|run_in_background|is_background|file_attachments|`resume`/, 'native delegate_task lifecycle'],
  [/\.mdc\b|always-applied rule|agent-transcripts|\.claude\/projects/, 'AGENTS.md, <models>, or T3 thread tools'],
  [/Bugbot|[Cc]loud [Aa]gents?|built-in PR tool|SendToUser|update_state/, 'native review, schedule, or secret tools'],
  [/(?<![\w./])\/loop(?![\w/-]|\.(?:[\w.]|\/))|Custom Mode|\bcreate-skill\b|\bbootstrap\b|\bdeslop\b|control-(?:ui|cli)\b/, 'native T3 scheduling, skills, verification'],
  [/fast or standard speed|fast mode|standard speed|-fast\b|fastMode|serviceTier/i, 'no automatic speed selection'],
  [/docs\/harness|read .*adapter.*first/i, 'native skill text'],
  [/~\/\.claude\/rules|~\/\.codex\/pstack-models|~\/\.agents\/skills/, 'runtime role targets and harness-specific user skills'],
];
const findings = [];
const used = new Set();
for (const file of files) {
  const path = relative(plugin, file);
  if (/\.(?:png|jpe?g|gif|ico|woff2?|pdf)$/.test(path)) continue;
  const text = readFileSync(file, 'utf8');
  if (path !== 'skills/setup-pstack/SKILL.md' && /\b(?:claude-[a-z]+-\d|grok-\d|gpt-\d)/.test(text)) findings.push(`${path}: use a runtime role target, not a hard-coded model slug`);
  for (const [i, line] of text.split('\n').entries()) {
    if (path.endsWith('.md') && /\bwatch-pr\b/.test(line) && !line.includes('--status-only')) findings.push(`${path}:${i + 1}: watch-pr requires --status-only; use T3 events for waiting`);
    for (const [pattern, fix] of rules) if ((pattern !== bareCommand || path.endsWith('.md')) && pattern.test(line)) {
      const index = allow.findIndex(a => a.path === path && a.text === line && a.reason);
      if (index >= 0) used.add(index);
      else findings.push(`${path}:${i + 1}: ${line.trim()} -> ${fix}`);
    }
  }
  if (path.endsWith('.md')) for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = decodeURI(href.replace(/[#?].*/, ''));
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('<pstack>')) continue;
    if (!existsSync(resolve(dirname(file), target))) findings.push(`${path}: missing link ${href}`);
  }
  if (path.endsWith('/SKILL.md')) {
    const folder = dirname(file).split('/').at(-1);
    const name = text.match(/^---\n[\s\S]*?^name:\s*["']?([^"'\n]+)/m)?.[1].trim();
    if (name !== folder) findings.push(`${path}: name ${JSON.stringify(name)} differs from folder ${folder}`);
  }
  if (/^(?:<{7}|={7}|>{7})(?: |$)/m.test(text)) findings.push(`${path}: unresolved merge markers`);
}
allow.forEach((a, i) => { if (!used.has(i)) findings.push(`stale allowlist entry: ${a.path}: ${a.text}`); });
findings.forEach(f => console.error(`FAIL ${f}`));
console.log(`native: ${files.length} files, ${files.filter(f => /\/skills\/[^/]+\/SKILL.md$/.test(f) && relative(plugin, f).startsWith('skills/')).length} skills, ${findings.length} findings`);
process.exitCode = findings.length ? 1 : 0;
