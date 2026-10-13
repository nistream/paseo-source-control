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

1. **Scaffold and selection** (implemented and verified): strict TypeScript plugin, compatibility requirements, typed repository descriptors, manual repository configuration, bounded discovery, Explorer/tab/Command Center registration. Root and scope remain distinct; same root under different VCS kinds remains distinct. Support `.git` files and empty/no-repository cases.
2. **Status and diffs** (implemented): Git staged/unstaged/untracked and SVN text/property/missing/conflict/unversioned status; bounded text diffs; explicit binary/large/error states. Tests cover NUL-separated Git paths, SVN XML, spaces/Unicode, renames, deletions, conflicts, property-only changes, scope and cancellation. Add meaningful synthetic adapter integration tests.
3. **History** (implemented): bounded pagination and commit/revision detail, including changed paths and diff where supported. Network failures remain actionable; no SVN updates or silent authentication prompts. Keep histories per repository and discard stale selection responses.
4. **Delivery** (implemented, reviewed and verified): English README, architecture, overview, install/prerequisite/limits instructions; typecheck and focused test suite; packaging validation; install/reload on enabled local daemon; wide and compact light/dark verification through the Paseo browser where available; read-only comparison on the ignored integration fixture. Record evidence and limitations honestly. Do not select a license or publish to a package registry without the owner's decision.

## Completion record

- Initial working changes were committed and pushed to `main` (`04c523b`). The language rule change was pushed separately (`40fe7f5`) before implementation.
- Implementation followed the plan on `feat/source-control-foundation`. The original Implementer provider encountered a session lifecycle error and then a stalled shell operation; both workers were stopped before the matching configured Codex fallback continued the preserved scaffold. No quota failure was assumed.
- Backend checkpoint `978ddc0` was reviewed. One blocking issue was reproduced: valid unkeyed requests escaped disposal. Fix `6b73895` tracks every operation, rejects post-disposal work, and independently passed nine backend tests and additional disposal checks.
- Full implementation checkpoint `fbe166b` independently passed typecheck, ten tests, runtime bundles, package validation, and whitespace checks.
- Final configuration QA found automatic discovery overwrote explicit labels and lexical workspace association rejected symlink aliases. Fix `9b422d1` independently passed twelve tests and typecheck, including explicit priority, canonical aliases, distinct ancestor/full-root scopes, and unavailable association warnings.
- The coordinator installed and reloaded `source-control` on the already enabled local daemon. The runtime reports `running`; no global plugin setting was changed and no daemon was restarted.
- Independent synthetic adapter checks covered overlapping SVN/Git, nested Git, ancestor scope, both Git staging states, property/conflict states, binary and oversized previews, literal special filenames, complete pagination, and revision scope isolation. Read-only private integration discovery and status matched separately captured CLI expectations. Proprietary outputs remained outside the repository. Normalized SVN entries were compared because raw XML ordering varies between identical calls.
- Live Paseo browser checks covered workspace and Explorer placement, independent repository selection, staged/unstaged diffs, SVN property diffs and conflict display, oversized content, Git history pagination (25 plus 2 entries), Git commit details, SVN history and scoped revision details. Neither sibling paths nor sibling content appeared in the SVN detail view.
- Configuration editor checks verified invalid JSON rejection, persistence of a custom label with a symlinked workspace association, synchronization between the workspace and Explorer instances, and revision conflict rejection. A stale second draft stayed open and could not overwrite the first save. Original host configuration was restored afterward.
- Layout/theme checks used the real panel DOM and accessibility snapshots in the Paseo browser: desktop 1440×1000 used 13px text/16px padding; compact 390×844 used 12px text/10px padding. Repository buttons fit without horizontal overflow. The Explorer content measured 309px with 275px buttons and loaded status without errors. Light and dark theme text colors followed the host palette. The original System theme preference was restored.
- Browser screenshot capture failed with an unpainted webview and transient host timeouts. A fresh tab restored automation. No screenshot artifact or pixel-level visual review is claimed; the layout evidence above is from rendered DOM measurements and accessibility/interaction checks.

- Cleanup completed: temporary QA browser tabs, the synthetic Paseo workspace/project, generated repositories, and private temporary expectation files were removed. No real integration working copy was modified.

## Remaining work

- Native iOS/Android devices and non-macOS daemon integration tests.
- Optional exportable screenshots and pixel-level visual review when browser capture is available.
- History graphs and mutation features require separate design and acceptance; they are not implemented.
- License selection and registry publishing remain owner decisions. The npm package remains private.
