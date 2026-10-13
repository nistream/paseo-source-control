import path from "node:path";
import { realpath } from "node:fs/promises";
import type { RepositoryDescriptor, VcsKind } from "../shared/source-control.js";

export function contains(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
export async function canonical(value: string): Promise<string> {
  if (!path.isAbsolute(value)) throw new Error("Use an absolute daemon path");
  return realpath(value);
}
export function descriptor(kind: VcsKind, root: string, scope: string, label?: string): RepositoryDescriptor {
  return { id: JSON.stringify([kind, root, scope]), kind, rootPath: root, scopePath: scope,
    label: label ?? path.basename(root), capabilities: { staged: kind === "git", untracked: true, history: true, diff: true } };
}
export function fileTarget(repo: RepositoryDescriptor, value: string): string {
  const target = path.resolve(repo.rootPath, value);
  if (!contains(repo.scopePath, target) || !contains(repo.rootPath, target)) throw new Error("Path is outside the selected inspection scope");
  return target;
}
export const gitScope = (repo: RepositoryDescriptor): string => path.relative(repo.rootPath, repo.scopePath).split(path.sep).join("/") || ".";
// Always append an empty peg revision, including targets which already contain '@'.
export const svnTarget = (value: string): string => `${value}@`;
