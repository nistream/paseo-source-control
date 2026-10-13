# Paseo Source Control

A read-only Paseo plugin for Git and SVN working copies. Its Explorer panel and workspace tab show repository selection, working-copy changes, file diffs, paginated history and revision details. Ancestor repositories, nested repositories, Git worktrees and overlapping Git/SVN copies can be inspected without changing your workspace or agent directory.

The foundation is implemented and under review. The local plugin runs; live UI validation is in progress. Graphs and stage/commit/update/revert/merge actions are future work.

## Install and run

Use Paseo **0.11.2 or later** on both the client and selected daemon. Install Git and/or SVN on that daemon's `PATH`; synthetic tests require Git, SVN and `svnadmin`. The implementation is tested on macOS with Git 2.54 and SVN 1.14. Other OS hosts still need integration validation. Node 20.19+ or 22.12+ is required for the development tools.

Plugins are trusted code with access to the daemon. Inspect the source and enable plugins through Paseo's settings before installing. Run these commands on the target daemon machine, after cloning the repository:

```sh
npm ci
npm run typecheck
npm test
paseo plugin install /absolute/path/to/paseo-source-control
paseo plugin ls
```

For a remote daemon, use the CLI's `--host` option and a source path on that host. A running plugin contributes **Source Control** in the right-hand Explorer and workspace tabs. Command Center → **Open Source Control** opens the Explorer panel. Source edits require `paseo plugin reload source-control`; inspect `paseo plugin logs source-control` if loading fails. A daemon restart is unnecessary.

## Use and configure

Select a repository in the panel. The root and inspection scope are shown separately. A containing repository defaults to the workspace subtree; nested repositories default to their own roots. Git and SVN states remain independent for overlapping files. Git files changed in both index and worktree appear in both groups. SVN changes retain property, missing and conflict states.

Select a changed file for a diff, or **History** for 25 entries per page and revision details. Git merge details compare against the first parent. SVN revision paths and diff are restricted to the selected scope; relevant copy ancestry is preserved. Untracked/unversioned regular files have a bounded content preview. Binary and oversized content has an explicit unavailable state.

**Refresh** reruns discovery and invalidates this panel's status, diff and history data. History restarts at current HEAD. Data is a timestamped snapshot: there is no background polling or automatic freshness across other panels/clients. Selection changes and closing views cancel pending requests and discard late responses.

**Configure repositories** edits validated host settings JSON. Use absolute paths on the daemon. Example values below are placeholders:

```json
{
  "repositories": [
    {
      "kind": "svn",
      "rootPath": "/work/example",
      "scopePath": "/work/example/project",
      "workspacePath": "/work/example/project",
      "label": "Project SVN"
    },
    {
      "kind": "git",
      "rootPath": "/work/example/project/overlay",
      "workspacePath": "/work/example/project",
      "label": "Git overlay"
    }
  ],
  "discovery": { "maxDepth": 3, "maxEntries": 1200 }
}
```

`scopePath` must resolve inside the detected root. Omitting it preserves the automatic subtree default. Set it to the root explicitly to inspect the whole repository. `workspacePath` restricts a configured entry to that workspace; omitting it makes the entry available in every workspace on this host. Custom labels override automatic labels for identical root/scope descriptors.

Settings are shared across authorized clients on that daemon and persist through reloads. The draft captures its write revision; conflicting saves retain your draft and reject the write. Discard and reopen it to use the latest values. Settings changes rerun discovery on connected panels, but selected repositories are local to each panel. Do not put credentials in the settings document. SVN uses existing host authentication noninteractively; authentication/network errors are displayed and never trigger an update.

## Bounds and limitations

Discovery skips directory symlinks, metadata and common build/dependency directories. Depth is capped at 5 and inspected entries at 5000, with a 15-second nested traversal budget. Omitted roots can be configured explicitly. Each command times out after 15 seconds with a combined 2 MiB output cap. Status/history exceeding the cap fails visibly rather than presenting partial data as complete. Diffs and previews are capped at 256 KiB; status groups render 200 files per page.

History can contact an SVN server; working-copy status does not. Git pagination stays anchored to the initial full HEAD OID and scope, even if HEAD changes. SVN pages descend from an initial scoped HEAD revision. A repository rewritten or removed during browsing may require Refresh. SVN externals are not recursively inspected by status. Previewing directories or symlinks outside scope is unsupported; renames leaving a subtree may require explicitly choosing a broader scope for their diff. SVN branch/merge graphs are not inferred.

## Development

`npm run typecheck` checks runtime and test code. `npm test` creates temporary synthetic Git/SVN working copies, runs parser/adapter and subprocess lifetime tests, then removes those copies. `npm pack --dry-run` checks distributable contents without publishing. No proprietary integration fixture is included.

- [Architecture](docs/architecture.md)
- [Foundation plan and acceptance status](docs/plans/source-control-foundation.md)
- [Paseo plugin quickstart](https://paseo.sh/docs/plugins.md)
- [Plugin reference](https://paseo.sh/docs/plugins/reference.md)
- [Plugin publishing](https://paseo.sh/docs/plugins/publishing.md)

License selection remains pending. This repository is not published to a package registry; the package is marked private.
