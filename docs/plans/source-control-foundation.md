# Source control foundation

## Objective and scope

Implement the read-only first release described in `playground/HANDOVER.md`: a general-purpose Git/SVN Explorer panel and workspace tab that can inspect ancestor, nested, multiple, and overlapping repositories without changing the workspace or agent directory. Read the handover and ignored local test notes before work. Current baseline is `40fe7f5`; implementation uses `feat/source-control-foundation`.

History graphs and mutation actions remain future work as stated in the handover. Do not imply those features exist. A bounded history list and revision details are included in this foundation.

## Constraints

- Keep all proprietary integration paths, SVN URLs, credentials, source, status, diffs, history, and logs out of tracked files. Public fixtures and screenshots must be synthetic.
- The external integration project is read-only. Read its authoritative instructions before accessing it. Do not update, commit, revert, clean, or otherwise change its working copies.
- Use documented plugin client/server entry points and RPC contracts. Do not modify Paseo internals or override its built-in Git panel.
- All VCS commands and filesystem access run on the selected daemon. Use argv, explicit cwd, bounded output, timeout, cancellation, and noninteractive SVN. Preserve filenames, root/scope separation, and per-VCS semantics.
- Read root `pluginsEnabled` before installation. It is already true on the local daemon, verified by the coordinator; do not change it or restart the daemon.
- Write documentation in English. Keep durable facts in `docs/architecture.md`, user entry points in README, and milestone results in this plan.

## Verified setup

The local app-bundled CLI and running daemon both report Paseo 0.11.2. Current public quickstart, reference, and publishing documentation were fetched on 2026-10-13. The generator is `paseo plugin init <directory>`. Scaffold in a temporary directory to preserve existing files, then bring necessary scaffold files into this repository. The documented surfaces include `addWorkspacePanel` with workspace/explorer locations, `useWorkspace` field selectors, `addCommandCenterItem`, and `defineRpc`/`server.handle`/`useRpc`. Verify against the installed SDK types as well.

## Fleet workflow

Coordinator owns acceptance, integration verification, and final reporting. Implementer profile owns code and tests because adapters, RPC lifetime, and UI state interact across subsystem boundaries. Reviewer profile independently reviews each committed checkpoint. Only one implementer edits this workspace at a time. Follow implement → verify → commit → review → fix → review until PASS. Use matching configured fallback only on demonstrated provider failures; preserve partial work and confirm the old worker has stopped before handoff.

## Milestones and acceptance

1. **Scaffold and selection** (implemented; live UI QA pending): strict TypeScript plugin, compatibility requirements, typed repository descriptors, manual repository configuration, bounded discovery, Explorer/tab/Command Center registration. Root and scope remain distinct; same root under different VCS kinds remains distinct. Support `.git` files and empty/no-repository cases.
2. **Status and diffs** (implemented): Git staged/unstaged/untracked and SVN text/property/missing/conflict/unversioned status; bounded text diffs; explicit binary/large/error states. Tests cover NUL-separated Git paths, SVN XML, spaces/Unicode, renames, deletions, conflicts, property-only changes, scope and cancellation. Add meaningful synthetic adapter integration tests.
3. **History** (implemented): bounded pagination and commit/revision detail, including changed paths and diff where supported. Network failures remain actionable; no SVN updates or silent authentication prompts. Keep histories per repository and discard stale selection responses.
4. **Delivery** (packaged; Coordinator installation/UI/acceptance pending): English README, architecture, overview, install/prerequisite/limits instructions; typecheck and focused test suite; packaging validation; install/reload on enabled local daemon; wide and compact light/dark verification through the Paseo browser where available; read-only comparison on the ignored integration fixture. Record evidence and limitations honestly. Do not select a license or publish to a package registry without the owner's decision.

## Completion record

- Initial working changes committed and pushed to `main` (`04c523b`).
- Language requirements changed to English repository documentation and pushed (`40fe7f5`).
- Backend checkpoint: typed contracts, host settings registration, bounded discovery, validated read-only Git/SVN status/diff/history/detail RPCs and explicit cancellation implemented. Strict typecheck and eight synthetic parser/adapter/process tests pass. Client panel and delivery documentation are still in progress. No plugin is installed by this implementer.
- Coordinator independently bundled and smoke-tested the current backend against synthetic mixed repositories and the ignored read-only integration fixture. Discovery and status matched separate CLI expectations; pagination, scope isolation and bounded previews passed. This evidence predates the final commit and does not replace final review or UI QA. Private outputs remain outside the repository.
- Backend review of `978ddc0` found one blocker: omitted RPC request keys bypassed shutdown cancellation. Fixed by tracking every operation independently from the keyed cancellation map and rejecting work after disposal. A real unkeyed subprocess regression verifies shutdown abortion. UI and packaging were outside that checkpoint review.

- Client checkpoint: workspace/explorer panel and Command Center registration, shared host configuration editor with captured revision, repository selector, staged/unstaged/SVN groups, bounded diff views, paginated history and details implemented. All text uses theme colors and compact spacing adapts; live desktop/compact/light/dark verification remains with Coordinator.
- Final implementation handoff: typecheck, synthetic suite, source bundles and package contents must pass before review. Install/reload, screenshots, final private fixture comparison and final acceptance belong to Coordinator. No license selected, registry publish performed, daemon restarted or global configuration changed.
- Backend fix checkpoint `6b73895` independently passed Reviewer typecheck and nine backend tests, including additional concurrent/repeated disposal checks. Coordinator separately passed the ten-test combined suite and installed the plugin locally; the runtime reports running. Synthetic browser verification is underway; final UI/packaging review remains pending. The implementer did not install/reload or change daemon configuration.
- Final implementer checks passed: strict runtime/test TypeScript, ten synthetic tests, daemon/client esbuild bundles using the installed app's compiler, no Node imports in the client bundle, git whitespace check, and npm dry-run package with 17 public runtime/documentation files. No live UI claims are made by these build checks.
