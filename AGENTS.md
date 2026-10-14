# AI agent working guidelines

This file contains only the repository-level rules that AI agents must follow. Project descriptions, directory structure, development commands, and verification methods belong in the project documentation and should not be repeated here.

## Coding style

- Follow the official Google Style Guide for languages it covers.
- For other languages, follow the project's existing style and conventions.
- When modifying existing code, preserve consistency within its module and avoid unrelated formatting or style refactors.

## Project memory

Maintain one source of truth for each category of project memory:

- `AGENTS.md`: repository-level rules, agent roles, and memory boundaries.
- `README.md`: a concise entry point for human readers, containing only:
  - What the project does.
  - How to deploy, run, and use the service.
  - Other essential information for developers or maintainers.
  - Links to important documentation under `docs/`.
- `docs/architecture.md`: current architecture, model boundaries, important files, and enduring implementation facts.
- `docs/plans/`: proposed work, task status, acceptance criteria, and implementation handoffs.
- `docs/decisions/`: non-obvious decisions whose rationale needs to be preserved.
- `docs/references/`: external protocols, research, and comparisons.
- `docs/reviews/`: use only when the user explicitly requests creating or saving review documents.
- `docs/integration/`: temporary server/client communication, not a source of truth for project memory.
- Code and tests: the definitive source of truth for implemented behavior.

When behavior changes:

- Update `docs/architecture.md` when architecture, model boundaries, or enduring implementation facts change.
- For work covered by an existing plan, update that plan's status and results before handoff.
- Add `docs/decisions/<topic>.md` only for a new decision whose rationale needs to be preserved.
- Update `README.md` when its descriptions of purpose, deployment, operation, usage, or important documentation links change.
- Do not duplicate enduring architecture facts in agent skills, plans, `README.md`, or this file. Plans may record context needed for the current task and reference the appropriate enduring source of truth.
- Do not treat temporary communication as long-term project memory.

When sources of truth conflict:

1. Give the user's current explicit requirements highest priority.
2. Verify implemented behavior against current code and tests.
3. Correct documentation that disagrees with the actual state.
4. Do not silently choose the most convenient version or ignore a discovered conflict.

## Git behavior

- Make changes on a branch other than `main` or `master` by default.
- Do not overwrite, revert, or commit the user's unrelated existing changes.
- Check the current branch after modifying code or documentation:
  - On a branch other than `main` or `master`, automatically commit task-related files for review.
  - On `main` or `master`, do not automatically commit.
- Include only files related to the current task in each commit.
- Use Conventional Commits.
- Before merging, consolidate trivial commits that share a goal and have no independent value into a meaningful history.
- Use `--no-ff` when merging into the target branch.

## Language rules

- Respond in the language used by the user in their current message.
- Write repository Markdown documentation in English.
- Preserve product names, technical terms, protocol names, framework names, and code identifiers.
