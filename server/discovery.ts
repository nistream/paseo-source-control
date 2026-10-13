import path from "node:path";
import { opendir, lstat } from "node:fs/promises";
import type { ListRepositoriesInput, ListRepositoriesOutput, RepositoryDescriptor, VcsKind } from "../shared/source-control.js";
import { canonical, contains, descriptor, svnTarget } from "./paths.js";
import { CommandError, run } from "./process.js";
import { childText, descendants, parseXml } from "./xml.js";

export async function detect(kind: VcsKind, directory: string, signal: AbortSignal): Promise<string> {
  if (kind === "git") return canonical((await run("git", ["rev-parse", "--show-toplevel"], { cwd: directory, signal })).trimEnd());
  const xml = parseXml(await run("svn", ["info", "--xml", "--non-interactive", "--", svnTarget(directory)], { cwd: directory, signal }));
  const wc = descendants(xml, "wc-info")[0];
  const root = wc && childText(wc, "wcroot-abspath");
  if (!root) throw new Error("Not an SVN working copy");
  return canonical(root);
}

export async function validateRepository(repo: RepositoryDescriptor, signal: AbortSignal): Promise<RepositoryDescriptor> {
  const root = await canonical(repo.rootPath);
  const scope = await canonical(repo.scopePath);
  if (!contains(root, scope)) throw new Error("Inspection scope must be inside the repository root");
  if (await detect(repo.kind, scope, signal) !== root) throw new Error("Repository changed; refresh discovery");
  return descriptor(repo.kind, root, scope, repo.label);
}

const skipped = new Set([".git", ".svn", "node_modules", "Library", "Temp", "Logs", "obj", "bin", "dist", "build", ".cache"]);
export async function discover(input: ListRepositoriesInput, signal: AbortSignal): Promise<ListRepositoriesOutput> {
  const workspace = await canonical(input.workspacePath);
  const repositories = new Map<string, RepositoryDescriptor>();
  const warnings: ListRepositoriesOutput["warnings"] = [];
  let discoveryTruncated = false;
  const add = async (kind: VcsKind, directory: string, scope?: string, label?: string, explicit = false) => {
    try {
      const root = await detect(kind, directory, signal);
      const target = scope ? await canonical(scope) : contains(root, workspace) ? workspace : root;
      if (!contains(root, target) || await detect(kind, target, signal) !== root) throw new Error("Scope is outside this repository");
      const repo = descriptor(kind, root, target, label);
      if (explicit || !repositories.has(repo.id)) repositories.set(repo.id, repo);
    } catch (error) {
      if (signal.aborted) throw error;
      if (explicit || error instanceof CommandError && error.reason !== "failed") warnings.push({ source: kind, message: (error as Error).message });
    }
  };
  for (const config of input.configured) {
    if (config.workspacePath && path.resolve(config.workspacePath) !== workspace) continue;
    try { await add(config.kind, await canonical(config.rootPath), config.scopePath, config.label, true); }
    catch (error) { if (signal.aborted) throw error; warnings.push({ source: config.kind, message: (error as Error).message }); }
  }
  // CLI root resolution sees ancestor metadata without scanning sibling directories.
  await add("git", workspace);
  await add("svn", workspace);
  let visited = 0;
  const started = Date.now();
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (signal.aborted) throw new CommandError("Request cancelled", "cancelled");
    if (Date.now() - started > 15000) { discoveryTruncated = true; return; }
    const markers = await Promise.all([".git", ".svn"].map(async (name) => {
      try { return !(await lstat(path.join(directory, name))).isSymbolicLink(); } catch { return false; }
    }));
    if (markers[0]) await add("git", directory);
    if (markers[1]) await add("svn", directory);
    let handle;
    try { handle = await opendir(directory); }
    catch { warnings.push({ source: "discovery", message: "A directory could not be read" }); return; }
    for await (const entry of handle) {
      if (++visited > input.discovery.maxEntries || Date.now() - started > 15000) { discoveryTruncated = true; break; }
      if (!entry.isDirectory() || entry.isSymbolicLink() || skipped.has(entry.name)) continue;
      if (depth < input.discovery.maxDepth) await walk(path.join(directory, entry.name), depth + 1);
      else discoveryTruncated = true;
      if (visited > input.discovery.maxEntries) break;
    }
  };
  await walk(workspace, 0);
  return { repositories: [...repositories.values()], warnings: warnings.slice(0, 100), discoveryTruncated, generatedAt: new Date().toISOString() };
}
