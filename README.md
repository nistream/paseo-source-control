# Paseo Source Control

A planned general-purpose Paseo plugin for SVN working copies and Git repositories, including nested repositories and mixed SVN/Git workspaces.

**Status: planning and handover only. No plugin implementation exists yet.**

The goal is a source-control panel in Paseo's right-hand Explorer with a repository selector, working-copy status, diffs, history, and eventually appropriate history graphs. Users should be able to keep their workspace rooted at a parent directory while inspecting repositories below or above it.

Start with [the implementation handover](playground/HANDOVER.md). Local integration-test details live in the ignored `playground/LOCAL_TEST_PROJECT.md`; a portable example is provided in [playground/local-test-project.example.json](playground/local-test-project.example.json).

## Proposed first release

- SVN and Git adapters behind a common repository model.
- Explicit repository configuration, followed by bounded discovery.
- Explorer panel with repository selection, status, diffs, and paginated history.
- Clear separation between repository root and the workspace scope being inspected.
- Desktop/web and compact mobile layouts using Paseo's supported plugin APIs.

Commit/update/revert/merge actions and SVN branch/copy/merge graphs need separate design and validation after the read-only foundation works.

## Development

The next implementation agent should verify the installed Paseo version and current plugin contracts before scaffolding. This repository is not yet installable. No plugin has been installed or enabled by this setup task.

- [Paseo plugin quickstart](https://paseo.sh/docs/plugins.md)
- [Plugin reference](https://paseo.sh/docs/plugins/reference.md)
- [Plugin publishing](https://paseo.sh/docs/plugins/publishing.md)

License selection is pending; no license has been granted by this initial setup.
