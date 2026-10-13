# Implementation handover: Paseo Source Control

Prepared 2026-10-13. This is the starting brief for a project-level implementation agent.

## Requested outcome and current state

The owner enjoys working in Paseo and wants SVN visibility without returning to VSCode. A second problem is that a workspace rooted above a nested local Git repository does not expose that repository in Paseo's built-in Git panel. Build a general-purpose public plugin addressing both cases, rather than a plugin hardcoded to one project.

The owner requested this repository, a clone directly under the Mac user's home directory, and this handover under `playground/`. Implementation and further documentation are explicitly left to a project-level agent. At handover, only documentation/configuration examples exist: no runtime code, dependencies, manifest, tests, installation, or active plugin.

Public repository: https://github.com/nistream/paseo-source-control

The local integration fixture is an existing Unity SVN project with a nested local Git overlay. Exact paths and installed versions are in ignored `LOCAL_TEST_PROJECT.md`. Do not copy the Unity project into this public repository.

## Product requirements

1. Support SVN-only, Git-only, multiple Git, and mixed SVN/Git workspaces through one repository selector.
2. Keep agents and workspace rooted where the user chooses. Selecting a repository must change only the plugin's inspection target.
3. Support a containing repository whose metadata lives above the workspace, as well as nested repositories below it.
4. Show VCS type, readable label, repository root, inspection scope, changed-file counts, and freshness/error state. The same file can legitimately appear under SVN and Git with different statuses.
5. Display working-copy changes and file diffs. For Git, distinguish staged, unstaged, and untracked files. For SVN, include text/property changes, additions/deletions, missing files, conflicts, and unversioned entries.
6. Provide bounded, paginated history and revision/commit details. A history list is the first milestone; graphs are still part of the longer-term goal.
7. Be useful from the right-hand Explorer, with an optional workspace tab and Command Center action.
8. Be reusable across projects, operating systems, and local or remote Paseo daemons. All filesystem access and commands run on the selected daemon, not the client device.

## Verified Paseo extension surface and limits

Current documentation checked during this setup:

- https://paseo.sh/llms.txt
- https://paseo.sh/docs/plugins.md
- https://paseo.sh/docs/plugins/reference.md
- https://paseo.sh/docs/plugins/publishing.md
- https://paseo.sh/docs/workspaces.md

The local bundled Paseo CLI reported 0.11.2. This is not proof of the version of every connected daemon or client; check the target host before installation.

`client.addWorkspacePanel` supports `context: "workspace"` and `locations: ["workspace", "explorer"]`. Command Center callbacks can use `openPanel(id, { location: "explorer" })`. Read the active workspace's directory through `useWorkspace(workspaceId, selector)`. Select only the fields needed, not the entire snapshot.

Use plugin-specific `defineRpc` contracts in `shared/`, registered daemon-side handlers in `index.server.ts`, and `useRpc` in the client. Backend code may use Node APIs and subprocesses. Normal Paseo operations should use the supported SDK.

No documented repository-provider registration or built-in Git-panel repository override was found. The proposed approach is a separate plugin panel with its own selector, adapters, and diff/history UI. Do not promise reuse of Paseo's built-in diff viewer unless a supported API is verified.

Client UI uses React Native primitives, theme colors, and compact layout. No DOM/Node access in client code. Keep code in `client/`, `server/`, and `shared/` with the proper runtime entry files. Include a manifest compatibility range based on APIs actually used; check beta semantics if targeting a beta.

Before installing/enabling, read actual host configuration. The documented global Enable plugins switch requires explicit user approval before an automated tool turns it on. Creating this repo does not authorize enabling that global switch. An existing enabled switch does not need to be enabled again.

## Proposed implementation structure

Use a common repository descriptor: stable ID, VCS kind, canonical root path, scope path, display name, and capabilities. Separate roots from scopes: SVN's working-copy root can be above the workspace while status defaults to the workspace subtree. Make broader scope an explicit user choice.

Use independent Git and SVN adapters for detection, status, diff, history, and revision details. Normalize only shared concepts; retain VCS-specific fields where semantics differ. Do not combine Git commit hashes and SVN revision numbers into one history.

Start with manually configured repository paths. Add bounded discovery of the workspace, containing roots, and nested roots next. Support `.git` directories and `.git` files (worktrees/submodules). Resolve SVN roots through `svn info` rather than expecting `.svn` at every project boundary. Skip metadata/build/dependency trees, cap traversal depth/work, deduplicate real paths, and handle symlinks carefully. Repositories with different VCS kinds can overlap and must remain distinct.

Keep configuration local to the daemon/workspace and out of public test fixtures. The JSON example in this folder describes requirements, not an implemented configuration API.

Run commands as executable plus argv with explicit cwd, timeouts, cancellation, and bounded output; avoid shell interpolation. Use safe handling for filenames beginning with dashes and SVN peg-revision syntax. Prefer machine-readable formats: Git porcelain with NUL-separated paths and SVN XML. Handle Unicode, spaces, renames, conflicts, property-only changes, binary/large files, and empty repositories.

Read-only Git calls should avoid optional index refresh locks where appropriate. Network SVN history calls should be bounded and noninteractive, expose auth/network errors, and never silently update working copies. Do not scrape browser credentials or embed tokens/passwords in plugin settings or command logs.

Cache by host/workspace/repository/scope and relevant options, cancel stale requests when selection changes, and avoid polling entire large Unity trees aggressively. Start with manual refresh; add debounced watchers or bounded polling after measurement. Clean up timers, watchers, and requests on reload/disable/disconnect.

## Suggested milestones

### 1. Scaffold and repository selection

Verify current CLI, SDK, and installed app/daemon versions. Scaffold using Paseo's supported generator without overwriting these documents. Add manifest and package scripts, typed contracts, explicit repository configuration, and Explorer panel. Test Git-only, SVN-only, and mixed layouts.

### 2. Working-copy status and diffs

Implement both adapters and meaningful parser tests. Show repo/scope labels, states, status groups, refresh, and bounded file diff rendering. Verify independent SVN and Git state for overlapping files. Clearly label unavailable binary/large diffs and errors.

### 3. History

Add pagination, revision details, and cancellation. A Git graph can use parent relationships. SVN revisions are not a Git DAG: investigate copy ancestry, branch conventions, and mergeinfo before designing a branch/merge graph. Show only verified relationships; document limitations and cost of remote queries. Do not assume every SVN repo uses trunk/branches/tags.

### 4. Packaging and documentation

Document install, prerequisites, supported Paseo versions, repository configuration, refresh/history behavior, limitations, screenshots using synthetic data, and maintenance/reload workflow. Choose a license with the owner before claiming open-source licensing. Establish CI and publishing only after the plugin works.

Mutation features (stage/commit/update/revert/merge) are not needed for the first read-only milestone. If added later, design explicit target/path review and use synthetic repositories for tests.

## Acceptance checks

- With the real test workspace still rooted at its current directory, select SVN for the project scope and Git for its nested Assets directory in the same plugin panel.
- Detect the containing SVN root above the workspace correctly; do not scan/show unrelated sibling projects by default.
- Match displayed status against equivalent CLI calls at the same scope; Git cleanliness must not imply SVN cleanliness.
- Switching repositories never changes agent cwd, creates worktrees, or mutates either working copy.
- Diffs distinguish Git staging and SVN base/property semantics; filenames and rename paths survive parsing without corruption.
- Synthetic fixtures cover ordinary Git, Git worktree metadata files, SVN-only, nested/multiple Git, mixed overlap, spaces/Unicode, deletions, conflicts, property-only changes, and no repository.
- Missing CLI, auth failure, timeout, offline host, empty history, stale selection, and binary/large content have actionable bounded UI states.
- Explorer and workspace-tab placement work, with light/dark and compact layouts verified.
- Reload/disable/disconnect cleans up resources. No local paths, private SVN URLs, proprietary changes/history, or credentials are committed.

## First action for the next agent

Read this handover and local test notes, verify the current plugin contracts and target host, then implement milestone 1. Keep progress and durable design decisions in this repository. The original external project is an integration fixture, not the plugin's source repository.
