# Architecture

The plugin runs filesystem and VCS operations on the selected Paseo daemon. Shared Zod RPC contracts define repository descriptors, status, diff, history and revision responses. The daemon entry registers host settings and read-only RPC handlers. No workspace or agent directory is changed.

Repository identity includes VCS kind, canonical root and inspection scope. Discovery checks containing roots with Git/SVN commands, then traverses bounded nested directories, skipping metadata, common build/dependency trees and directory symlinks. Git metadata files are supported. Explicit configuration can select a broader scope; automatic ancestor detection defaults to the workspace subtree. Overlapping Git/SVN descriptors remain independent.

`server/process.ts` executes argv without a shell, closes stdin, disables Git optional locks and prompts, enforces 15-second command timeouts and a combined 2 MiB output budget, and terminates cancelled processes. Diff output is limited to 256 KiB. UTF-8 locales retain Unicode SVN filenames. `server/xml.ts` reads SVN XML without DTD or external entity support. Status uses Git porcelain v2 with NUL paths or scoped SVN XML, without remote status queries. Git staging and SVN properties remain distinct.

Every data RPC revalidates canonical root and scope. Untracked previews verify current status, resolve symlinks within scope, and read only bounded regular files. Git diffs disable external diff and text conversion. SVN local diffs use literal absolute paths, while info/log/historical diff commands use empty peg suffixes.

Git history cursors contain the initial full HEAD OID, offset and a hash of repository/scope identity. Every page uses the same topological ordering and literal scope pathspec, avoiding merge-DAG omissions. SVN history anchors to scoped HEAD and descends by numeric revision. Revision details compare Git merges with the first parent; SVN verbose paths are filtered using the scope's repository-relative URL, retaining copy ancestry for matching entries. History graphs are not implemented.

Random client request keys support explicit cancellation because Paseo 0.11.2 handler contexts do not supply AbortSignal. The server remembers recent pre-start cancellations and aborts active commands on shutdown. No backend data cache, watcher or polling exists.
