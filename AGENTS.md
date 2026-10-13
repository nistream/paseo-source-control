# Agent instructions

Read `playground/HANDOVER.md` before implementation. If present, read the ignored `playground/LOCAL_TEST_PROJECT.md` for this machine's integration-test setup.

This is a general-purpose public Paseo plugin repository. Keep test-project paths, SVN URLs, credentials, proprietary source, diffs, logs, and history out of tracked files. Public fixtures must be synthetic.

Verify current Paseo plugin APIs and app/daemon compatibility before implementing. Use documented extension surfaces; do not patch Paseo internals or assume the built-in Git panel can accept arbitrary repositories.

Keep plugin code and tests here. The external integration project is for read-only verification; use temporary synthetic repositories for mutations. Read that project's instructions before running commands there. Do not commit, revert, update, clean, or otherwise modify its working copies as part of plugin tests.

Implement incrementally, with meaningful parser/adapter tests and desktop plus compact-layout verification. Record completed milestones and remaining work in repository documentation. Do not present planned capabilities as implemented.
