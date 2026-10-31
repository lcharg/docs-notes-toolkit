# Docs and decision-notes toolkit

English | [中文](README.zh.md)

Create and continuously maintain a project's formal documentation and decision notes. Copy this entire directory into another project; no files from the source repository are required.

## Quick start

1. Choose native plugins or safe project-level installation for Claude Code, Codex and Cursor in [PLATFORMS](PLATFORMS.md); then follow [START-HERE](START-HERE.md).
2. Give the receiving coding agent the target project location and ask it to read [the bootstrap skill](skills/docs-notes-bootstrap/SKILL.md). Explicit file reading works even when the harness does not automatically discover this directory.
3. Run the bundled CLI to create usable machine configuration and bootstrap files, then use a trusted before-change snapshot and a phase gate for subsequent work. This does not install recurring checks: CI/hooks require explicit integration. See [AUTOMATION](AUTOMATION.md) for commands, diagnostics and integration.

Do not copy the source project's documentation, validation reports or temporary test fixtures. The English/Chinese README pair is supplied for readers, not a bilingual requirement for the receiving project's documents.

## Contents

| Path | Purpose |
|---|---|
| [START-HERE](START-HERE.md) | Integration instructions, copy options and onboarding prompt |
| [Platform installation](PLATFORMS.md) | Claude Code, Codex and Cursor manifests, invocation and verified limits |
| [Project installer](scripts/integrations.mjs) | Collision-safe runtime and per-tool project skill entries |
| [AUTOMATION](AUTOMATION.md) | Dependency-free CLI, configuration, phase gates and failure handling |
| [Executable checks](scripts/docs-notes.mjs) | init, check, snapshot and gate commands |
| [CLI tests](tests/cli.test.mjs) and [boundary tests](tests/boundaries.test.mjs) | Real subprocess tests for valid and invalid cases |
| [Validation scope](VALIDATION.md) | Repeatable test entry and evidence/trust limits |
| [Bootstrap](skills/docs-notes-bootstrap/SKILL.md) | Establish or adopt a project's documentation system |
| [Update](skills/docs-notes-update/SKILL.md) | Keep documentation and rationale aligned with changes |
| [Curate](skills/docs-notes-curate/SKILL.md) | Retain, consolidate and archive notes by decision value |
| [Promote](skills/docs-notes-promote/SKILL.md) | Move verified rules and procedures into formal docs |
| [Lifecycle reference](skills/docs-notes-bootstrap/references/lifecycle.md) | Shared ownership, status, retention and promotion rules |
| [Templates](skills/docs-notes-bootstrap/templates/) | Eight templates for project-specific configuration and content |
| [Acceptance scenarios](skills/docs-notes-bootstrap/tests/acceptance-scenarios.md) | Repeatable checks for adoption and later maintenance |

Keep the entire toolkit together, including `scripts/`, `templates/`, `tests/` and the four sibling skill directories. Skills call the bundled automation and shared materials; moving only the four skill directories is no longer a complete installation. Use explicit file-path reading when automatic harness discovery is unavailable.

## Requirements and limits

Node.js 20 or newer runs the bundled checks and tests using standard-library modules only; no installation step or source-repository dependency is required. Existing project rules, paths and language take precedence. Bilingual output, fixed note paths, a package manager, generators, a website and automatic skill discovery are not prerequisites.

The toolkit does not authorize deletion, commits, pushes or publication. It does not create hooks or scheduled tasks. The templates contain intentional placeholders; the agent must fill or explicitly resolve them before creating the target project's maintained documents.
