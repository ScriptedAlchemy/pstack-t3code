# pstack-t3code

A native T3 Code port of [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/99b609a72323b70204eab407c622f436e858e112/pstack): skills, playbooks, principles, and agent personas, plus the custom **automate-maintainer** and **automate-team** skills.

Pinned upstream version **0.15.32**, commit `99b609a72323b70204eab407c622f436e858e112`. Native manifest version **0.15.32-t3code.2**. The pack contains all 58 upstream skills plus the two custom skills.

## Use in T3 Code

The pack lives in [`plugins/pstack/`](plugins/pstack/). T3 must vendor this native tree and expose its `$pstack:` composer chips. Start with `$pstack:setup-pstack`, then `$pstack:poteto-mode <task>` or `$pstack:poteto-help`. Read the [guide](plugins/pstack/docs/guide/README.md) and [complete skill list](plugins/pstack/README.md#skills).

This repository publishes pack content; cloning it does not replace an installed T3 pack. The T3-side follow-up must repoint the sync source to `plugins/pstack/`, remove the injected adapter read, and update its checks to validate native content. The 17 role labels and setup default-block format remain compatible with the current parser.

T3 supplies absolute pack/models paths and resolved delegate targets in `<t3_pstack>`. Skills copy targets exactly, preserve inherited panel seats, and use `delegate_task` across harnesses. Setup stores environment-specific choices in the supplied models file. The port never chooses priority or latency options automatically.

## Custom skills

- [`automate-maintainer`](plugins/pstack/skills/automate-maintainer/SKILL.md) captures named GitHub maintainers' observed engineering conventions with per-person evidence and held-out evaluation.
- [`automate-team`](plugins/pstack/skills/automate-team/SKILL.md) discovers a repository's active core before producing a team mode, preserving ownership, disagreements, and source visibility.

Both are preserved on upstream sync. They are also listed in the [customization guide](plugins/pstack/docs/guide/09-make-it-yours.md) and [help skill](plugins/pstack/skills/poteto-help/SKILL.md).

## Validate and update

With Node.js and Bun on PATH, run `scripts/test.sh`. It checks native wording, every relative Markdown link, skill names, file parity, the 17 role defaults, codemod idempotence, and the bundled helper suites. It installs helper dependencies with the committed frozen lockfile when missing. Statechart tests report optional runtime prerequisites as skips; see their output for missing TLC, rendering, or platform tools.

[PORTING.md](PORTING.md) owns translations and native-port decisions. [UPDATING.md](UPDATING.md) describes three-way upstream sync. [UPSTREAM.json](UPSTREAM.json) and [upstream-inventory.json](upstream-inventory.json) record the reviewed snapshot.

MIT licensed. Copyright Lauren Tan and ScriptedAlchemy. This port builds on the native structure and tooling of [pstack-claude](https://github.com/ScriptedAlchemy/pstack-claude), with host-neutral custom content compared against [pstack-codex](https://github.com/ScriptedAlchemy/pstack-codex).
