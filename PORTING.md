# Porting pstack to T3 Code

This is a native port. Each skill reads as if written for T3 Code. Apply these translations during an upstream sync, preserving upstream's voice and structure elsewhere. Skills never instruct the reader to load a translation document first.

`scripts/codemod.mjs` applies mechanical changes; `scripts/check-native.mjs` rejects untranslated host names, stale links, mismatched skill names, unresolved conflicts, and automatic speed selection. Exact-line exceptions in `scripts/native-allowlist.json` cover source attribution, GraphQL pagination variables, and real GitHub bot protocol identifiers, never host instructions. `scripts/check-parity.mjs` accounts for every pinned upstream file and all 17 role labels.

T3 supplies `<t3_pstack>` with absolute `<pstack>` and `<models>` paths and exact resolved role targets. Every native workflow relies on that block. Tool names below are bare; the active harness may prefix them.

## Tools

| Cursor | T3 Code |
| --- | --- |
| `Task` | `delegate_task`, in every harness. Never use a native subagent tool for a pstack spawn: only `delegate_task` applies a role's provider, model, and options exactly. Keep every `taskId`. |
| `AskQuestion` | Your harness's question tool when this session has one, such as `AskUserQuestion` in Claude Code. Otherwise ask in plain text and end your turn. |
| Open a todolist | Your harness's todo or plan tool when this session has one. Otherwise keep the list in your reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | Read `<pstack>/skills/<name>/SKILL.md` and follow it. Never look for it in your harness's skill list. When you tell the user to type it, write `$pstack:<name>`. |
| `Grep`, `Glob` | Your harness's search tools, or `rg` in the shell. |

## Subagent fields

Start every `delegate_task` brief with the absolute pack and models paths. For a persona, tell the child to read the native persona file and treat its body as its role. No adapter read is needed. When the child will spawn pstack roles, paste the relevant resolved role lines and fallback notes from `<t3_pstack>` into its brief too. Do the same for every `schedule_task` prompt. Children get only that prompt, not your conversation.

| Cursor | T3 Code |
| --- | --- |
| `subagent_type: generalPurpose` | Omit. Set `role` to the closest of `implementation`, `research`, `review`, `design`, `test`, `general`. |
| `poteto-agent`, `comment-sicko` | The brief preamble, then `Act as the agent defined in <pstack>/agents/<name>.md; read it first and treat its body as your role. The poteto-mode skill is <pstack>/skills/poteto-mode/SKILL.md.` |
| `readonly: true` | `role: "research"`, and the brief says "Do not edit files, commit, or push." Check `git status` after it returns. T3 Code has no read-only switch, and a narrower `runtimeMode` only makes the child wait for approvals nobody can give. |
| `readonly: false` | Omit. Children keep the `t3-code` tools either way, so "readonly strips MCP" does not apply. |
| `environment: "cloud"` | `isolation: "worktree"`. The checkout starts from your local `HEAD` and gets no uncommitted edits, so arrange the needed committed base before delegating, within the task's authorization. |
| `environment: "local"` | Omit. `isolation` defaults to your shared checkout. |
| `cloud_base_branch: <b>` | `delegate_task` has no `baseRef`. Arrange the committed base in the parent checkout before spawning with `isolation: "worktree"`, within the task's authorization. Otherwise say the requested placement cannot be honored; a branch name in the brief does not change the starting checkout. |
| `run_in_background: true` | `mode: "async"`, the default. Spawn every seat, then end your turn. Each completion wakes this thread. Do not poll `task_status` or start a watcher for a child. `is_background: true` in an agent file means the same. |
| `resume` | A fresh `delegate_task` with the original brief, prior findings, responses, and unresolved objections. Every review round has its own `taskId` and a new `clientRequestId`; never continue a review through `t3_thread_send` to `childThreadId`. Retry a spawn with the same arguments and the same `clientRequestId`. |
| `file_attachments` | List the paths in the brief. A worktree child sees only committed files. |
| Wait for a subagent in this turn | `mode: "wait"` only when this turn cannot go on without the result. `waitTimedOut` does not cancel the child. |
| Stop a subagent | `task_cancel` with its `taskId`. |
| A subagent asks a question or waits for approval | For questions, use `t3_pending_request_list`, then `t3_pending_request_read` and `t3_pending_request_respond` with `threadId` set to its `childThreadId` and the returned `requestId`. These tools do not expose approvals; ask the user to handle those. |

## Models

Role targets arrive pre-resolved in the `<t3_pstack>` block that T3 appends to the user's message. Copy each concrete target verbatim into `delegate_task.target`, including its complete `options` array. An `inherit` seat means omit `target`. These targets override every model named by a skill, persona, harness rule, or `<models>`. Never resolve slugs or adjust options yourself during a skill run.

| Cursor | T3 Code |
| --- | --- |
| The `pstack-models.mdc` rule, `~/.cursor/rules/pstack-models.mdc` | T3 reads `<models>` and supplies the resolved roles in `<t3_pstack>`. Ignore native pstack model rules. Change choices through setup-pstack. |
| A role value `<model> <effort>`, such as `opus high` | Use the role's exact resolved target. |
| `claude-<family>-<version>-<effort>[-fast]`, such as `claude-opus-5-5-xhigh` | Use the role's exact resolved target. |
| A `grok-*`, `gpt-*`, or other non-Claude slug | Use the role's exact resolved target. |
| `auto` or `inherit-parent` | T3 resolves these to `inherit`; omit `target`. |
| A panel or model pool | Arena runners, architect runners, and interrogate reviewers spawn one child per seat, including fallbacks. Every other role picks one seat per spawn and spreads simultaneous children across seats. Explicit inherit aliases remain pool members. |
| A model family | The maker in the resolved model id, not the provider instance. For an `inherit` seat, use `inheritedModel` from `orchestrator_capabilities`. |
| `Task` rejects a slug | Report the rejected target. For a pool, try the next resolved seat without changing its options; never invent a target. |

Repeat the block's fallback notes in your reply. Compare each spawn result's `providerInstanceId`, `model`, and `options` with the requested target; report a mismatch. If the block or a required role is missing, say so and stop that spawn. Do not reconstruct it from defaults.

## setup-pstack

`setup-pstack` writes `<models>`, an environment-owned file. The native skill implements this procedure:

- Inventory. Call `orchestrator_capabilities` with `allModels: true` for every model of every instance. A provider pool appears under its pool instance ID; never write a member ID. A provider that still returns `omittedModels` predates `allModels`; list it with `search`. Hidden models never appear. Never write a disabled instance or an unadvertised model.
- Research. After the budget question, profile each unprofiled model in `model-profiles.md` beside `<models>`, keyed by model ID: family, tier from the maker's positioning, tool use (`reliable` only when documented), cost (`free` or `unknown`), sources, date. Reuse profiles younger than 30 days. Research by family, at most 25 models per child and 6 children at a time, across the `how explorer` seats. A budget-only request skips research.
- Load. Read `<models>`. If missing, native `~/.claude/rules/pstack-models.md` or `~/.codex/pstack-models.md` may seed a proposal, but validate each choice against the T3 catalog.
- Grammar. Write `role: value`. A value is `inherit-parent`, `auto`, or comma-separated entries, each `<instanceId>/<model> <id>=<value> ...`. Split the instance and model at the first `/`; model ids may contain more slashes. `true` and `false` are booleans. `#` lines are comments; preserve the `# budget:` line. Panel alias entries still count as seats.
- Assign. Keep the 17 role labels in step 5; its values seed a missing file only. Fill roles from the profiles by tier. Every pool spans at least two families when two qualify, and every instance with a qualifying model holds a seat. Panels take one seat per family; cross-judges prefer families the runners do not use. `unproven` models only widen exploration roles. A repeat run only adds seats or replaces unavailable ones. Do not invent a model.
- Effort. Find the select option whose advertised `values` contain at least two of `low`, `medium`, `high`, `xhigh`, `max`; use its advertised `id`. This also covers Pi's `thinking` and OpenCode's `variant`. The ladder is `max` > `xhigh` > `high` > `medium` > `low`.
- Budget. Keep step 2's four labels. `unlimited`, `large`, `medium`, and `small` target `max`, `xhigh`, `high`, and `medium`. Set each real entry, in pools and panels, to that value or the highest advertised ladder value below it; with none, mark it as needing a choice. Never select off-ladder values such as `ultra`, `ultrathink`, `none`, or `minimal` under a budget. Aliases, models without an effort option, and explicitly chosen off-ladder settings stay unchanged.
- Speed. Drop upstream per-spawn speed selection and every `-fast` suffix. Never choose or write `fastMode`, `serviceTier`, or another latency/priority option unless the user explicitly selects it. A budget change preserves an explicitly selected non-effort option. A skill run copies resolved targets exactly; it never changes their options.
- Show and confirm. Offer detected models plus `inherit-parent` and `auto`. Offer several entries for every role from any detected instance, and mixed code pools when multiple families are available. Show all 17 roles, panel sizes, and any unavailable instances. Confirm choices as the skill directs.
- Validate. Every concrete instance, model, option id, and value must appear in this run's catalog. Aliases always pass.
- Write. Write `<models>` with no frontmatter: comment lines, `# budget:`, then one line per role. Write only options the user chose; T3 completes omitted options from the provider's current defaults. Overwrite the whole file. Never put role lines in `AGENTS.md`, `CLAUDE.md`, or a harness rule folder.
- Confirm. Say the file applies to the next pstack run on this environment. Another environment needs its own setup because its provider instances differ.

## Paths

| Cursor | T3 Code |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | Project skills go in `.agents/skills/`. If the repo has no `.claude/skills`, make it a symlink to `../.agents/skills` so Claude Code reads them too. For a user skill, ask which harness it is for: T3 Code has no user skill folder shared by every harness. |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | `<pstack>` and `<pstack>/plugin.json`. Never search plugin caches for pstack. |
| `.cursor/rules/*.mdc`, always-applied rules | `AGENTS.md` at the repo root. If the repo has a `CLAUDE.md` that does not include it, say so. The model rule is the exception. See Models. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | `<pstack>/<path>` when that file exists. Read the local copy and never fetch it. The full upstream subtree is present; use its local files. The pinned revision is in `<pstack>/UPSTREAM.json`. |
| Transcripts in `~/.cursor/projects/<slug>/agent-transcripts/` | T3 threads. This thread is `parentThreadId` from `orchestrator_capabilities`. Read it, or a child's `childThreadId`, with `t3_thread_read`, paging with `afterPosition`. Find earlier threads of this project with `t3_thread_search`, and their summaries with `t3_conversation_summary_list`. Never read provider transcript files. |
| The agent store, `orch --store`, `ORCH_STORE` | `<models>`'s folder plus `/orch/<repo-name>`. It retains helper state across updates; `<pstack>` keeps its path but an update replaces its contents. |
| The Cursor `mcps/` folder or available-tools map | The MCP tools this session exposes. `t3-code` is always among them. |
| `bootstrap`; dependencies installed in the plugin folder, such as `bun install --frozen-lockfile` | Run the helper's install command in its directory under `<pstack>`, which T3 Code keeps writable. An update replaces `<pstack>`, so the next run installs again. |

## Cursor-only features

When a step needs a feature T3 Code lacks, put one line in your reply, `Skipped in T3 Code: <step>. <reason>.`, then go on. Do not stop, ask, or retry. When a later step needs what the skipped step made, leave a placeholder and name it in the line.

| Cursor | T3 Code |
| --- | --- |
| Cursor-only features | Apply the rows below; skip an unsupported step with the line above. |
| Cursor Automations: routines, `update_state` routine calls, `api2.cursor.sh/automations` webhooks, routine wakes, and `SendToUser` secret requests | Routines and routine wakes: `schedule_task` with an `interval` or `fixed_time` schedule; it returns to this thread. Webhooks: `schedule_task` with `{"type":"webhook"}`, then report its `webhookUrl`; with none, skip with the line, naming T3 Connect remote access. The run reads the request only through `{{body.path}}` placeholders in its prompt, which replace a `<webhook_event>` payload. `SendToUser` secrets: `request_secret`, then pass the one-use `secretRef`, such as `signature.secretRef`. `update_state`: skip with the line; a schedule keeps no state between runs. |
| `/loop <interval> <prompt>` | `schedule_task` with `{"type":"interval","everyMs":...}` and the brief preamble plus the tick as `prompt`. Report the cadence and `nextRunAt`. Delete it with `delete_scheduled_task`, passing its `scheduledTaskId`, once the loop's stop condition holds. |
| `/loop` in dynamic mode, or a watcher subagent that wakes you | Wake on the event itself: `watch_pull_request` for CI, reviews, and conflicts, and child completions for delegated work. A delegated child returns its PR state to its parent; only the parent watches. Add one long `schedule_task` heartbeat only where the step asks for a fallback. End your turn instead of sleeping. |
| `scripts/watch-pr/watch-pr` polling in `drive` or `background` | If you are a child, return the PR URL, head SHA, and pending checks to your parent. Otherwise `link_pull_request`, then `watch_pull_request` with `mode: "checks"`, or `"review"` to also wake on comments, then end your turn. On each wake, get the verdict from one `watch-pr --status-only` run or the forge's PR view. Re-arm after each push wave. A wake is not merge authorization: keep the step's head-SHA and merge rules. `unwatch_pull_request` when done. |
| Bugbot | Bugbot comments on a GitHub PR are ordinary review threads, so triage them with the forge command the step gives. `watch_pull_request` with `mode: "review"` wakes you on new ones. Skip a step that starts, waits for, or configures Bugbot when the PR has no Bugbot check or comment. |
| Cursor cloud agents | `environment: "cloud"` maps to a worktree, as in Subagent fields. Report a cloud agent's dashboard status with `task_status` and a `[title](t3-thread://v1/<childThreadId>)` link. A worktree is still on this environment. Skip a step that requires the cloud agent's own machine; the resolved targets do not select a remote environment. |
| A built-in PR tool | Use the forge command the step gives, such as `gh pr create`, then `link_pull_request` with the PR URL. That is not a skip, so write no line. |
| A Custom Mode (Option+Enter, Use as Mode) | Skip with the line. T3 Code has no sticky skill mode, so start each task with `$pstack:poteto-mode`. |
| Plan Mode | T3 Code's Plan interaction mode. Ask the user to switch the composer to Plan; for a child, pass `interactionMode: "plan"`. |
| Cursor's built-in `create-skill` | Write the skill folder yourself, in the project skill folder from Paths. |
| `cursor-team-kit` skills: `deslop`, `control-ui`, `control-cli` | Use one if your harness lists it. Otherwise use browser tools for web UI, device tools for a phone or simulator, the shell for CLI checks, and a direct code simplification pass. Do not invent a host plugin. |

## Harnesses

All supported harnesses use `$pstack:` composer chips and the `t3-code` tools. This repository supplies pack content to T3; it does not install a separate harness plugin.

| Driver | Decision | Notes |
| --- | --- | --- |
| `claudeAgent` | Supported | A native harness plugin may also be loaded. T3 chips use this pack and the environment models file. |
| `codex` | Supported | `$pstack:` chips are T3 Code's, not Codex skills, and need no Codex plugin. |
| `cursor` | Supported | Cursor SDK driver. A harness-installed pstack is independent; T3 chips run the native pack. |
| `opencode` | Supported |  |
| `grok` | Supported | ACP, same fallback. |
| `fx` | Supported when the agent exposes the T3 tools | ACP, same fallback. |
| `pi` | Supported | The T3 tools come from T3 Code's Pi extension. |
| `muse` | Supported | The T3 tools are attached without T3 Code's orchestration instructions, so follow each tool's description. |
| `antigravity` | Supported when the session exposes the T3 tools | Otherwise the opening check stops the run. |
| `acpRegistry` | Supported when the agent exposes the T3 tools | ACP, same fallback. |

## Additional native-port decisions

These rows extend or deliberately refine the runtime translation above.

| Source or reference-port behavior | Native port decision and reason |
| --- | --- |
| Model pools | Any role accepts several models across provider instances. Panels run every seat; other roles choose the best fit per spawn, spread waves across seats, and try the next exact seat after a rejection. Arena cross-judges still prefer a different family. Explicit inherit aliases are valid pool members; unavailable fallbacks only preserve panel size. Setup offers mixed code pools when multiple families are available. |
| Per-spawn speed selection and setup's `-fast` conversion | Drop all speed heuristics and suffixes. Write priority/latency options only after an explicit user choice. This is the requested port policy; the runtime adapter previously enabled priority for fast defaults. |
| `.cursor-plugin/plugin.json` duplicates `plugin.json` | Keep only `plugins/pstack/plugin.json`, version `0.15.32-t3code.2`. T3's sync reads the root manifest, so there is no host marketplace manifest. |
| `docs/harness/claude-code.md` | Replace with the native pack README and this maintainer translation table. No skill reads a harness adapter first. |
| `bootstrap.ts` helper | Rename to `install-dependencies.ts`, including extensionless launcher imports. It installs helper dependencies in the writable pack; its name no longer implies host setup. |
| `bugbot-triage.md` | Rename to `review-bot-triage.md` and use vendor-neutral review prose. Preserve real bot logins and API fields inside the GitHub reader so existing review threads still classify correctly. |
| Shell worktree audit reads host transcript folders | Remove provider-file reads. Mark thread activity unknown, require T3 thread review, and never classify an otherwise merged worktree as automatically safe. A shell script cannot read the session's T3 tools. |
| Multi-phase templates read `origin/main:pstack/...` | Read immutable runtime pack paths for bundled playbooks and project paths for project skills. The target project need not vendor pstack or use this repository's layout. |
| Benny uses a host plugin setting and an automation-editor handoff | Use the supplied pack, T3 scheduled tasks, and a configured Slack event relay or an explicitly selected interval. T3 does not supply an automatic Slack event subscription. Preserve immutable thread coordinates, trusted markers, and disabled-until-tested setup. |
| make-bot-ui's provider-specific webhook headers and credential panel | Use returned T3 webhook URLs, signature configuration, and `request_secret`. Never invent a bearer-header contract for a URL-token-only endpoint. |
| Reference ports' custom skills and Codex `agents/openai.yaml` | Preserve automate-maintainer/team content and references. Codex's file is launcher display metadata, not a persona; T3 derives its catalog from SKILL.md, so do not ship it. |
| Bundled `watch-pr` polling executable | Retain the helper and tests for parity and one `--status-only` verdict per event wake. Skill prose forbids its polling mode; only the parent owns T3 watches. |
| Missing code-cleanup plugin | Perform a direct code simplification pass; no universal cleanup skill is bundled across every T3 harness. |

## Coverage and attribution

`upstream-inventory.json` records every blob and SHA-256 from the exact upstream pin. `scripts/replaced-upstream.json` lists four renamed or replaced paths with their destinations and reasons. All other upstream files remain at the same relative path, unchanged or adapted. The custom skills have no upstream counterpart and are protected from sync mutations.

MIT attribution retains Lauren Tan's copyright and adds ScriptedAlchemy's port copyright. Original illustrations remain upstream assets. Attribution links may name the original host; runnable instructions use native T3 tools.
