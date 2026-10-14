import path from "node:path";
import { open, realpath } from "node:fs/promises";
import type { ChangedPath, DiffMode, DiffOutput, GetHistoryOutput, GetRevisionOutput, GetStatusOutput, HistoryEntry, RepositoryDescriptor, StatusEntry, StatusKind } from "../shared/source-control.js";
import { contains, fileTarget, gitScope, svnTarget } from "./paths.js";
import { CommandError, run } from "./process.js";
import { childText, descendants, parseXml, type XmlNode } from "./xml.js";

const now = () => new Date().toISOString();
const DIFF_BYTES = 256 * 1024;
const git = (repo: RepositoryDescriptor, args: string[], signal: AbortSignal, maxBytes?: number) => run("git", ["--literal-pathspecs", ...args], { cwd: repo.rootPath, signal, maxBytes });
const svn = (repo: RepositoryDescriptor, args: string[], signal: AbortSignal, maxBytes?: number) => run("svn", [args[0]!, "--non-interactive", ...args.slice(1)], { cwd: repo.rootPath, signal, maxBytes });

function baseEntry(repo: RepositoryDescriptor, relativePath: string): StatusEntry {
  const absolutePath = path.resolve(repo.rootPath, relativePath);
  return { absolutePath, relativePath, displayPath: path.relative(repo.scopePath, absolutePath) || ".", originalPath: null,
    originalDisplayPath: null, status: "unknown", staged: false, unstaged: false, untracked: false,
    conflicted: false, ignored: false, propertyStatus: "none", remoteStatus: null, revision: null };
}
const gitKinds: Record<string, StatusKind> = { M: "modified", A: "added", D: "deleted", R: "renamed", C: "copied", U: "conflicted", T: "modified" };

/** Porcelain v2 is NUL terminated; only fixed metadata fields are split on spaces. */
export function parseGitStatus(raw: string, repo: RepositoryDescriptor): Omit<GetStatusOutput, "refreshedAt"> {
  const result: Omit<GetStatusOutput, "refreshedAt"> = { repositoryId: repo.id, branch: null, upstream: null, ahead: null, behind: null, entries: [], truncated: false };
  const tokens = raw.split("\0");
  for (let index = 0; index < tokens.length; index++) {
    const record = tokens[index]!;
    if (!record) continue;
    if (record.startsWith("# branch.head ")) { result.branch = record.slice(14); continue; }
    if (record.startsWith("# branch.upstream ")) { result.upstream = record.slice(18); continue; }
    if (record.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(record);
      if (match) { result.ahead = Number(match[1]); result.behind = Number(match[2]); }
      continue;
    }
    if (record.startsWith("#")) continue;
    const type = record[0];
    let relative: string;
    let xy = "..";
    if (type === "?" || type === "!") relative = record.slice(2);
    else if (type === "1" || type === "2" || type === "u") {
      const fields = type === "1" ? 8 : type === "2" ? 9 : 10;
      let offset = 0;
      for (let field = 0; field < fields; field++) {
        const space = record.indexOf(" ", offset);
        if (space < 0) throw new Error("Malformed Git status");
        offset = space + 1;
      }
      relative = record.slice(offset);
      xy = record.slice(2, 4);
    } else throw new Error("Unsupported Git status record");
    const entry = baseEntry(repo, relative);
    entry.staged = type !== "?" && type !== "!" && xy[0] !== ".";
    entry.unstaged = type !== "?" && type !== "!" && xy[1] !== ".";
    entry.untracked = type === "?";
    entry.ignored = type === "!";
    entry.conflicted = type === "u";
    entry.status = entry.conflicted ? "conflicted" : entry.untracked ? "untracked" : entry.ignored ? "ignored" : gitKinds[xy[0]!] ?? gitKinds[xy[1]!] ?? "modified";
    if (type === "2") {
      entry.originalPath = tokens[++index] ?? null;
      if (entry.originalPath === null) throw new Error("Missing Git rename source");
      entry.originalDisplayPath = path.relative(repo.scopePath, path.resolve(repo.rootPath, entry.originalPath));
    }
    // Renames crossing scope boundaries can carry an outside destination.
    if (contains(repo.scopePath, entry.absolutePath) || entry.originalPath && contains(repo.scopePath, path.resolve(repo.rootPath, entry.originalPath))) result.entries.push(entry);
  }
  return result;
}

const svnKinds: Record<string, StatusKind> = { normal: "normal", modified: "modified", added: "added", deleted: "deleted", missing: "missing", conflicted: "conflicted", unversioned: "unversioned", ignored: "ignored", replaced: "replaced", external: "external", obstructed: "obstructed", incomplete: "incomplete" };
export function parseSvnStatus(raw: string, repo: RepositoryDescriptor): StatusEntry[] {
  return descendants(parseXml(raw), "entry").flatMap((node) => {
    const wc = node.children.find((child) => child.name === "wc-status");
    if (!wc || !node.attrs.path) return [];
    const entry = baseEntry(repo, path.relative(repo.rootPath, path.resolve(repo.rootPath, node.attrs.path)));
    if (!contains(repo.scopePath, entry.absolutePath)) return [];
    const props = wc.attrs.props ?? "none";
    entry.propertyStatus = props === "modified" || props === "conflicted" || props === "normal" ? props : "none";
    entry.conflicted = wc.attrs.item === "conflicted" || props === "conflicted" || wc.attrs["tree-conflicted"] === "true";
    entry.status = entry.conflicted ? "conflicted" : wc.attrs.item === "normal" && props === "modified" ? "property-modified" : svnKinds[wc.attrs.item ?? ""] ?? "unknown";
    entry.untracked = entry.status === "unversioned";
    entry.ignored = entry.status === "ignored";
    entry.unstaged = !entry.untracked && !entry.ignored && entry.status !== "normal";
    entry.revision = wc.attrs.revision ?? null;
    return entry.status === "normal" ? [] : [entry];
  });
}

export async function status(repo: RepositoryDescriptor, signal: AbortSignal): Promise<GetStatusOutput> {
  if (repo.kind === "git") {
    const raw = await git(repo, ["status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all", "--", gitScope(repo)], signal);
    return { ...parseGitStatus(raw, repo), refreshedAt: now() };
  }
  const raw = await svn(repo, ["status", "--xml", "--ignore-externals", "--", svnTarget(repo.scopePath)], signal);
  return { repositoryId: repo.id, branch: null, upstream: null, ahead: null, behind: null, entries: parseSvnStatus(raw, repo), refreshedAt: now(), truncated: false };
}

function diffResult(target: string, mode: DiffMode, content: string): DiffOutput {
  const binary = content.includes("\0") || /(?:Binary files .* differ|Cannot display: file marked as a binary type|GIT binary patch)/.test(content);
  return { path: target, mode, kind: binary ? "binary" : content ? "text" : "empty", content: binary ? null : content,
    message: binary ? "Binary content cannot be displayed as text" : null, truncated: false, generatedAt: now() };
}
async function boundedDiff(target: string, mode: DiffMode, work: () => Promise<string>): Promise<DiffOutput> {
  try { return diffResult(target, mode, await work()); }
  catch (error) {
    if (error instanceof CommandError && error.reason === "large") return { path: target, mode, kind: "large", content: null, message: "Diff exceeds 256 KiB; inspect with your VCS client", truncated: true, generatedAt: now() };
    throw error;
  }
}

export async function diff(repo: RepositoryDescriptor, value: string, mode: DiffMode, signal: AbortSignal): Promise<DiffOutput> {
  const target = fileTarget(repo, value);
  if (mode === "untracked") {
    const entries = (await status(repo, signal)).entries;
    if (!entries.some((entry) => entry.absolutePath === target && entry.untracked)) throw new Error("File is no longer untracked; refresh status");
    // Realpath containment protects preview from symlinks leading outside the scope.
    const resolved = await realpath(target);
    if (!contains(repo.scopePath, resolved)) throw new Error("Symlink preview is outside the inspection scope");
    const handle = await open(resolved, "r");
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) return { ...diffResult(value, mode, ""), kind: "unavailable", message: "Only regular files can be previewed" };
      if (stat.size > DIFF_BYTES) return { ...diffResult(value, mode, ""), kind: "large", truncated: true, message: "File exceeds 256 KiB" };
      const buffer = Buffer.alloc(DIFF_BYTES + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (signal.aborted) throw new CommandError("Request cancelled", "cancelled");
      if (bytesRead > DIFF_BYTES) return { ...diffResult(value, mode, ""), kind: "large", truncated: true, message: "File exceeds 256 KiB" };
      return { ...diffResult(value, mode, buffer.subarray(0, bytesRead).toString("utf8")), message: "Untracked file preview (not a VCS diff)" };
    } finally { await handle.close(); }
  }
  if (repo.kind === "svn") {
    if (mode === "index") throw new Error("SVN has no staging index");
    // SVN local diff takes literal paths; unlike log/info, an empty peg suffix
    // would become part of the filename. Absolute argv paths also protect '-'.
    return boundedDiff(value, mode, () => svn(repo, ["diff", "--internal-diff", "--", target], signal, DIFF_BYTES));
  }
  const args = ["diff", "--no-ext-diff", "--no-textconv", "--no-color", ...(mode === "index" ? ["--cached"] : []), "--", path.relative(repo.rootPath, target)];
  // Include the old path for a rename, without splitting either filename.
  const entry = (await status(repo, signal)).entries.find((item) => item.absolutePath === target);
  if (entry?.originalPath && contains(repo.scopePath, path.resolve(repo.rootPath, entry.originalPath))) args.push(entry.originalPath);
  return boundedDiff(value, mode, () => git(repo, args, signal, DIFF_BYTES));
}

const LOG_FORMAT = "%H%x00%P%x00%an%x00%aI%x00%s%x00%B%x00%D";
export function parseGitHistory(raw: string): HistoryEntry[] {
  if (!raw) return [];
  const fields = raw.split("\0");
  const entries: HistoryEntry[] = [];
  for (let offset = 0; offset < fields.length; offset += 7) {
    const [id, parents, author, date, title, message, refs] = fields.slice(offset, offset + 7);
    if (!id || !/^[a-f0-9]{40,64}$/.test(id) || refs === undefined) throw new Error("Malformed Git log");
    entries.push({ id, kind: "git-commit", title: title ?? "", author: author ?? null, date: date ?? null, message: message ?? null,
      parents: parents ? parents.split(" ") : [], refs: refs ? refs.split(", ") : [] });
  }
  return entries;
}
function svnEntry(node: XmlNode): HistoryEntry {
  const message = childText(node, "msg");
  return { id: node.attrs.revision!, kind: "svn-revision", title: message?.split("\n")[0] ?? "", author: childText(node, "author"), date: childText(node, "date"), message, parents: [], refs: [] };
}
export function parseSvnHistory(raw: string): HistoryEntry[] {
  return descendants(parseXml(raw), "logentry").map(svnEntry);
}
function cursorRead(value: string): { anchor: string; offset: number; scope: string } {
  try {
    const data: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!data || typeof data !== "object") throw new Error();
    const item = data as Record<string, unknown>;
    if (typeof item.anchor !== "string" || typeof item.scope !== "string" || !Number.isSafeInteger(item.offset) || (item.offset as number) < 0) throw new Error();
    return item as { anchor: string; offset: number; scope: string };
  } catch { throw new Error("Invalid history cursor; refresh history"); }
}
const cursorWrite = (data: { anchor: string; offset: number; scope: string }) => Buffer.from(JSON.stringify(data)).toString("base64url");

export async function history(repo: RepositoryDescriptor, limit: number, cursor: string | undefined, signal: AbortSignal): Promise<GetHistoryOutput> {
  // Cursor stores scope identity as a hash, keeping opaque cursors bounded for long paths.
  const scope = (await import("node:crypto")).createHash("sha256").update(repo.id).digest("hex");
  let page = cursor ? cursorRead(cursor) : undefined;
  if (page && page.scope !== scope) throw new Error("History cursor belongs to another repository/scope");
  let entries: HistoryEntry[];
  let nextCursor: string | null = null;
  if (repo.kind === "git") {
    if (!page) {
      const head = await git(repo, ["rev-parse", "--verify", "--quiet", "HEAD"], signal).catch(async (error: unknown) => {
        if (error instanceof CommandError && error.reason === "failed") {
          // A symbolic HEAD pointing at a missing branch is an unborn repository.
          await git(repo, ["symbolic-ref", "-q", "HEAD"], signal);
          return "";
        }
        throw error;
      });
      if (!head) return { repositoryId: repo.id, entries: [], nextCursor: null, hasMore: false, generatedAt: now() };
      page = { anchor: head.trim(), offset: 0, scope };
    }
    if (!/^[a-f0-9]{40,64}$/.test(page.anchor)) throw new Error("Invalid Git history anchor");
    entries = parseGitHistory(await git(repo, ["log", "--topo-order", "-z", `--format=format:${LOG_FORMAT}`, `--skip=${page.offset}`, `--max-count=${limit + 1}`, page.anchor, "--", gitScope(repo)], signal));
    if (entries.length > limit) nextCursor = cursorWrite({ ...page, offset: page.offset + limit });
  } else {
    // Anchor initial page at scoped repository HEAD, then use decreasing revisions.
    if (!page) {
      const info = parseXml(await svn(repo, ["info", "--xml", "-r", "HEAD", "--", svnTarget(repo.scopePath)], signal));
      const anchor = descendants(info, "entry")[0]?.attrs.revision;
      if (!anchor) throw new Error("Cannot resolve SVN history anchor");
      page = { anchor, offset: 0, scope };
    }
    if (!/^\d+$/.test(page.anchor)) throw new Error("Invalid SVN history anchor");
    entries = parseSvnHistory(await svn(repo, ["log", "--xml", "--limit", String(limit + 1), "-r", `${page.anchor}:0`, "--", svnTarget(repo.scopePath)], signal));
    if (entries.length > limit) nextCursor = cursorWrite({ anchor: String(Number(entries[limit - 1]!.id) - 1), offset: 0, scope });
  }
  return { repositoryId: repo.id, entries: entries.slice(0, limit), nextCursor, hasMore: nextCursor !== null, generatedAt: now() };
}

export function parseGitChangedPaths(raw: string): ChangedPath[] {
  const tokens = raw.split("\0");
  const paths: ChangedPath[] = [];
  for (let index = 0; index < tokens.length;) {
    const action = tokens[index++];
    if (!action) continue;
    const first = tokens[index++];
    const rename = /^[RC]/.test(action);
    const target = rename ? tokens[index++] : first;
    if (target === undefined) throw new Error("Malformed Git changed paths");
    paths.push({ path: target, displayPath: target, action, copyFrom: rename ? first ?? null : null, copyFromRevision: null, kind: "file" });
  }
  return paths;
}
export function scopedSvnPaths(node: XmlNode, relativeUrl: string): ChangedPath[] {
  if (!relativeUrl.startsWith("^/")) throw new Error("Cannot resolve SVN repository-relative scope");
  const scope = decodeURIComponent(relativeUrl.slice(1)).replace(/\/$/, "") || "/";
  return descendants(node, "path").filter((item) => scope === "/" || item.text === scope || item.text.startsWith(`${scope}/`)).map((item) => ({
    path: item.text, displayPath: item.text, action: item.attrs.action ?? "?", copyFrom: item.attrs["copyfrom-path"] ?? null,
    copyFromRevision: item.attrs["copyfrom-rev"] ?? null, kind: item.attrs.kind ?? null,
  }));
}
export async function revision(repo: RepositoryDescriptor, value: string, signal: AbortSignal): Promise<GetRevisionOutput> {
  let entry: HistoryEntry;
  let changedPaths: ChangedPath[];
  let revisionDiff: DiffOutput;
  if (repo.kind === "git") {
    if (!/^[a-f0-9]{40,64}$/.test(value)) throw new Error("Use a full Git commit OID from history");
    const raw = await git(repo, ["show", "-s", "-z", `--format=format:${LOG_FORMAT}`, value], signal);
    entry = parseGitHistory(raw)[0]!;
    // First-parent comparison is explicit for merges; root commits use --root.
    const compare = ["diff-tree", "--root", "--no-commit-id", "-r", "-M", "--no-ext-diff", "--no-textconv", ...(entry.parents[0] ? [entry.parents[0], value] : [value])];
    changedPaths = parseGitChangedPaths(await git(repo, [...compare, "--name-status", "-z", "--", gitScope(repo)], signal));
    revisionDiff = await boundedDiff(value, "worktree", () => git(repo, [...compare, "-p", "--no-color", "--", gitScope(repo)], signal, DIFF_BYTES));
    if (entry.parents.length > 1) revisionDiff.message = "Merge commit compared with its first parent";
  } else {
    if (!/^\d+$/.test(value)) throw new Error("Use a numeric SVN revision from history");
    const raw = await svn(repo, ["log", "--xml", "--verbose", "--limit", "1", "-r", value, "--", svnTarget(repo.scopePath)], signal);
    const node = descendants(parseXml(raw), "logentry")[0];
    if (!node) throw new Error("Revision does not affect this scope");
    entry = svnEntry(node);
    const info = parseXml(await svn(repo, ["info", "--xml", "--", svnTarget(repo.scopePath)], signal));
    const scopeEntry = descendants(info, "entry")[0];
    const relativeUrl = scopeEntry && childText(scopeEntry, "relative-url");
    if (!relativeUrl) throw new Error("Cannot resolve SVN repository-relative scope");
    changedPaths = scopedSvnPaths(node, relativeUrl);
    revisionDiff = await boundedDiff(value, "worktree", () => svn(repo, ["diff", "--internal-diff", "-c", value, "--", svnTarget(repo.scopePath)], signal, DIFF_BYTES));
  }
  return { repositoryId: repo.id, revision: value, entry, changedPaths, diff: revisionDiff, generatedAt: now() };
}
