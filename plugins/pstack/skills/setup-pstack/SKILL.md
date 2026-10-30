---
name: setup-pstack
description: Configure pstack's per-role models and reasoning budget for this T3 environment. Use for $pstack:setup-pstack, configure pstack models, pstack budget, or changing pstack's model choices.
---

# Setup pstack

Write the models file at the absolute `<models>` path from `<t3_pstack>`. T3 resolves that file against this environment's providers and appends exact role targets to the next pstack invocation. Skills use those targets directly.

### 1. Inventory every provider and model

Call `orchestrator_capabilities` with `allModels: true`. It lists every enabled instance, and a provider pool appears once under its pool instance ID with its members hidden. Use the pool ID as the instance, never a member. Keep instances with `canRunChildTask: true` and no `constraints`, and report the rest with their reason. Record each model's ID, label, and advertised options. Never write a disabled instance, unadvertised model, option ID, or option value. If the tools remain unavailable after the harness's documented fallback, say `pstack needs the t3-code tools, which this session does not expose.` and stop. `inherit-parent` and `auto` always remain valid.

### 2. Load state and research the models

Read `<models>`. Preserve its `# budget:` line and current choices. Drop roles absent from step 5, and report them. If the file is missing, start from the defaults below. A native harness's existing model sheet may seed a proposal only when the user identifies it; validate every choice against this environment's catalog.

Profiles live in `model-profiles.md` beside `<models>`, one section per `<instanceId>/<model>`: maker family, effort option and ladder, context size, cost tier (free, subscription, metered), tier (`frontier`, `strong`, `fast`), tool-use reliability (`reliable`, `unproven`, `unreliable`), strengths, weaknesses, sources, and the research date. Reuse a profile younger than 30 days. Research every other model.

Research in parallel with `delegate_task`, one `role: "research"` child per instance with models to profile. Spread the children across the `how explorer` seats in `<t3_pstack>`, or omit `target` when the role is missing. Each brief lists that instance's model IDs, labels, and options, asks for the profile fields above from the maker's model card, release notes, and reputable benchmarks, and says "Do not edit files, commit, or push." Free, preview, or community models with no public evidence of agentic tool use are `unproven`. Write the returned profiles to the file, then wait for every child before step 3.

### 3. Budget, assign, and confirm

**(a) Ask for a budget.** Use the harness question tool if available; otherwise ask in plain text and end the turn. Name the recorded budget, or say that `large` matches the defaults. Offer these exact labels:

- `unlimited — max reasoning`
- `large — xhigh reasoning`
- `medium — high reasoning`
- `small — medium reasoning`

**(b) Assign seats across providers.** Fill every role from the profiles so pstack spreads work across every capable provider, not one:

- Judgment roles (`judgment and prose`, `hardest tasks`, `how explainer`, `why synthesizer`, `reflect judgment, divergent, synthesizer`) take `frontier` models.
- Code roles (`feature, refactoring`, `bug-fix`, `perf-issue`, `hillclimb`) take `frontier` or `strong` models with `reliable` tool use.
- Exploration roles (`how explorer`, `why investigators`, `reflect tooling`, `swarm workers`) take `strong` or `fast` models, and add `fast` or free seats to widen coverage.
- Panels (`arena runners`, `architect runners`, `interrogate reviewers`) take the strongest model of each family, one seat per family, two to four seats. `arena cross-judge pool` takes `frontier` models from families other than the runners'.
- Every pool gets seats from at least two families when two qualify, best seat first. Spread families so simultaneous roles do not all land on one provider.
- `unreliable` models never hold a seat. `unproven` models only join exploration roles and `swarm workers`, and never as their only seat.

On a repeat run, keep the current choices unless a profile shows a new or better qualifying model, and show each change beside the old value.

Find the advertised select option whose values contain at least two of `low`, `medium`, `high`, `xhigh`, `max`. Use its actual ID, including `thinking` or `variant` where advertised. Budgets target `max`, `xhigh`, `high`, or `medium` respectively. Set every concrete entry, in pools and panels, to the requested value or the highest advertised ladder value below it. With none, mark the entry as needing a choice. Aliases, models without an effort option, and explicitly chosen off-ladder settings stay unchanged. Never select off-ladder settings under a budget.

Do not choose a latency or priority option automatically. Write such an option only when the user explicitly selects it. A budget change preserves any explicitly selected non-effort options.

**(c) Show and confirm.** Show a table of every inventoried model with its instance, tier, tool-use rating, and cost tier, then all 17 roles with their seats and chosen options, marking unavailable entries. Let the user change any role to several models from any detected provider instance, plus `inherit-parent` and `auto` for the parent model. Arena runners, architect runners, and interrogate reviewers are panels that run every seat; all other roles are pools that pick one seat per spawn and spread simultaneous children across seats. A swarm model race still needs explicitly resolved arm targets.

### 4. Validate

Validate every concrete instance, model, option ID, and value against this run's catalog. Never replace an unavailable choice silently. Ask for a valid choice. Aliases always pass.

### 5. Write the models file

The following default role block is also the server's machine-readable catalog. Keep these labels and the first fenced block under this heading intact. These are selection defaults, not literal models-file entries; resolve them to advertised instances and option IDs before writing.

```
feature, refactoring: grok-4.7-xhigh
bug-fix: grok-4.7-xhigh
perf-issue: grok-4.7-xhigh
hillclimb: grok-4.7-xhigh
judgment and prose: claude-opus-5-5-xhigh
hardest tasks: claude-opus-5-5-xhigh
how explorer: grok-4.7-xhigh
how explainer: claude-opus-5-5-xhigh
why investigators: grok-4.7-xhigh
why synthesizer: claude-opus-5-5-xhigh
reflect tooling: grok-4.7-xhigh
reflect judgment, divergent, synthesizer: claude-opus-5-5-xhigh
arena runners: claude-opus-5-5-xhigh, grok-4.7-xhigh
arena cross-judge pool: claude-opus-5-5-xhigh, grok-4.7-xhigh
swarm workers: grok-4.7-xhigh
architect runners: claude-opus-5-5-xhigh, grok-4.7-xhigh
interrogate reviewers: claude-opus-5-5-xhigh, grok-4.7-xhigh
```

Overwrite `<models>` with no frontmatter: comment lines, `# budget: <label> (<effort>)`, and one `role: value` line per role. Each value is a comma-separated list of entries: `inherit-parent`, `auto`, or `<instanceId>/<model> <optionId>=<value> ...`. Split instance from model at the first `/`; model IDs may contain more slashes. Booleans are `true` and `false`. `#` starts a comment. Only write options the user chose; T3 completes omissions from the provider's current defaults. Never write role lines into `AGENTS.md`, `CLAUDE.md`, or a harness rule folder.

### 6. Confirm

Say where the file was written and that it applies to the next pstack run in this environment. Another environment needs its own setup because provider instances differ.

### 7. Offer a verification skill (optional)

Check for a project `verify-*` skill or another real-app driver. If missing, offer once to generate one through [create-verification-skill](../create-verification-skill/SKILL.md). On yes, read and follow that file. On no, continue without pushing.

### 8. Offer a formal verification skill (optional)

If the project has no formal verifier skill, offer once to generate one through [create-formal-verification-skill](../create-formal-verification-skill/SKILL.md). On yes, read and follow it. On no, continue.
