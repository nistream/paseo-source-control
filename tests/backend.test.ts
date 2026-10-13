import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CommandError, Requests, run } from "../server/process.js";
import { descriptor } from "../server/paths.js";
import { discover, validateRepository } from "../server/discovery.js";
import { diff, history, parseGitStatus, parseSvnStatus, revision, scopedSvnPaths, status } from "../server/adapters.js";
import { descendants, parseXml } from "../server/xml.js";
import { getHistoryInputSchema, getRevisionOutputSchema, getStatusOutputSchema } from "../shared/source-control.js";

const signal = () => new AbortController().signal;
const temporary: string[] = [];
async function temp() {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "source-control-test-")));
  temporary.push(directory);
  return directory;
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });
const command = (cwd: string, exe: string, args: string[]) => run(exe, args, { cwd, timeoutMs: 10000 }).catch((error: Error) => { throw new Error(`${args[0]}: ${error.message}`); });
async function gitRepo() {
  const root = await temp();
  await command(root, "git", ["init", "-b", "main"]);
  await command(root, "git", ["config", "user.name", "Synthetic Tester"]);
  await command(root, "git", ["config", "user.email", "test@example.invalid"]);
  return { root, repo: descriptor("git", root, root) };
}
async function commit(root: string, message: string) {
  await command(root, "git", ["add", "--all"]);
  await command(root, "git", ["commit", "-m", message]);
}
async function svnRepo() {
  const base = await temp();
  const store = path.join(base, "store");
  await command(base, "svnadmin", ["create", store]);
  const root = path.join(base, "wc");
  await command(base, "svn", ["checkout", "--non-interactive", pathToFileURL(store).href, root]);
  return { base, root, repo: descriptor("svn", root, root) };
}
const svnAdd = (root: string, file: string) => command(root, "svn", ["add", "--", `${file}@`]);
const svnCommit = (root: string, message: string) => command(root, "svn", ["commit", "--non-interactive", "-m", message]);

describe("subprocess limits and request lifetime", () => {
  it("enforces actual timeout, combined output cap, missing executable and literal argv", async () => {
    const cwd = await temp();
    await expect(run(process.execPath, ["-e", "setTimeout(()=>{}, 10000)"], { cwd, timeoutMs: 80 })).rejects.toMatchObject({ reason: "timeout" });
    await expect(run(process.execPath, ["-e", "process.stdout.write('x'.repeat(4000)); process.stderr.write('y'.repeat(4000))"], { cwd, maxBytes: 6000 })).rejects.toMatchObject({ reason: "large" });
    await expect(run("source-control-no-such-executable", [], { cwd })).rejects.toMatchObject({ reason: "missing" });
    expect(await run(process.execPath, ["-e", "process.stdout.write(process.argv[1])", "--", "-$() @ 文 space"], { cwd })).toBe("-$() @ 文 space");
  });
  it("cancels an active process, remembers pre-start cancellation and disposes requests", async () => {
    const cwd = await temp();
    const requests = new Requests();
    const pending = requests.execute("panel-one", (abortSignal) => run(process.execPath, ["-e", "setTimeout(()=>{},10000)"], { cwd, signal: abortSignal }));
    const check = expect(pending).rejects.toMatchObject({ reason: "cancelled" });
    expect(requests.cancel("panel-one")).toBe(true);
    await check;
    requests.cancel("early");
    await expect(requests.execute("early", async () => "bad")).rejects.toBeInstanceOf(CommandError);
    const second = requests.execute("second", (abortSignal) => run(process.execPath, ["-e", "setTimeout(()=>{},10000)"], { cwd, signal: abortSignal }));
    const checkSecond = expect(second).rejects.toMatchObject({ reason: "cancelled" });
    requests.dispose();
    await checkSecond;
  });
});

describe("Git adapter and discovery", () => {
  it("handles unborn HEAD, literal Unicode/space/dash paths, both staging states, binary and large previews", async () => {
    const { root, repo } = await gitRepo();
    expect((await history(repo, 25, undefined, signal())).entries).toEqual([]);
    const name = "-文 @ space.txt";
    await writeFile(path.join(root, name), "base\n");
    await commit(root, "initial");
    await writeFile(path.join(root, name), "staged\n");
    await command(root, "git", ["add", "--", name]);
    await writeFile(path.join(root, name), "unstaged\n");
    await writeFile(path.join(root, "binary"), Buffer.from([0, 1, 255]));
    await writeFile(path.join(root, "big"), "x".repeat(300000));
    const before = await readFile(path.join(root, ".git", "index"));
    const result = getStatusOutputSchema.parse(await status(repo, signal()));
    expect(result.entries.find((entry) => entry.relativePath === name)).toMatchObject({ staged: true, unstaged: true });
    expect((await diff(repo, name, "index", signal())).content).toContain("+staged");
    expect((await diff(repo, name, "worktree", signal())).content).toContain("+unstaged");
    expect((await diff(repo, "binary", "untracked", signal())).kind).toBe("binary");
    expect((await diff(repo, "big", "untracked", signal())).kind).toBe("large");
    expect(await readFile(path.join(root, ".git", "index"))).toEqual(before);
    await expect(diff(repo, "../escape", "worktree", signal())).rejects.toThrow("outside");
  });
  it("preserves NUL rename paths, deletion, and conflict records", () => {
    const repo = descriptor("git", "/synthetic", "/synthetic");
    const raw = "2 RM N... 100644 100644 100644 abc def R100 new 文\nname\0old @ name\0" +
      "1 .D N... 100644 100644 000000 abc abc gone\0" +
      "u UU N... 100644 100644 100644 100644 abc abc abc conflict\0";
    const entries = parseGitStatus(raw, repo).entries;
    expect(entries[0]).toMatchObject({ relativePath: "new 文\nname", originalPath: "old @ name", staged: true, unstaged: true });
    expect(entries[1]?.status).toBe("deleted");
    expect(entries[2]?.conflicted).toBe(true);
  });
  it("scopes ancestor status and discovers nested, worktree, multiple roots while skipping symlinks", async () => {
    const { root } = await gitRepo();
    const scope = path.join(root, "scope");
    await mkdir(scope);
    await writeFile(path.join(root, "sibling.txt"), "outside");
    await writeFile(path.join(scope, "inside.txt"), "inside");
    await commit(root, "initial");
    await writeFile(path.join(root, "sibling.txt"), "outside changed");
    await writeFile(path.join(scope, "inside.txt"), "inside changed");
    const nested = path.join(scope, "nested");
    await mkdir(nested);
    await command(nested, "git", ["init"]);
    const worktree = path.join(scope, "worktree");
    await command(root, "git", ["worktree", "add", "-b", "other", worktree]);
    const outside = await temp();
    await command(outside, "git", ["init"]);
    await symlink(outside, path.join(scope, "alias"));
    const found = await discover({ workspacePath: scope, configured: [], discovery: { maxDepth: 2, maxEntries: 100 } }, signal());
    expect(found.repositories.map((repo) => repo.rootPath).sort()).toEqual([root, nested, worktree].sort());
    const parent = found.repositories.find((repo) => repo.rootPath === root)!;
    expect(parent.scopePath).toBe(scope);
    expect((await status(parent, signal())).entries.some((entry) => entry.relativePath === "sibling.txt")).toBe(false);
    await expect(validateRepository({ ...parent, scopePath: outside }, signal())).rejects.toThrow("inside");
    const bounded = await discover({ workspacePath: scope, configured: [], discovery: { maxDepth: 0, maxEntries: 1 } }, signal());
    expect(bounded.discoveryTruncated).toBe(true);
  });
  it("anchors pagination across a merge DAG and later HEAD changes; details include literal rename paths", async () => {
    const { root, repo } = await gitRepo();
    await writeFile(path.join(root, "base"), "base");
    await commit(root, "base");
    await command(root, "git", ["checkout", "-b", "side"]);
    await writeFile(path.join(root, "side"), "side");
    await commit(root, "side");
    await command(root, "git", ["checkout", "main"]);
    await writeFile(path.join(root, "main"), "main");
    await commit(root, "main");
    await command(root, "git", ["merge", "--no-ff", "side", "-m", "merge"]);
    const expected = (await command(root, "git", ["log", "--topo-order", "--format=%H", "HEAD", "--", "."])).trim().split("\n");
    let page = await history(repo, 1, undefined, signal());
    const ids = page.entries.map((entry) => entry.id);
    await writeFile(path.join(root, "later"), "later");
    await commit(root, "later HEAD");
    while (page.nextCursor) { page = await history(repo, 1, page.nextCursor, signal()); ids.push(...page.entries.map((entry) => entry.id)); }
    expect(ids).toEqual(expected);
    const details = getRevisionOutputSchema.parse(await revision(repo, ids[0]!, signal()));
    expect(details.entry.parents).toHaveLength(2);
    expect(details.diff.message).toContain("first parent");
    await command(root, "git", ["mv", "--", "base", "-new @ 文"]);
    await commit(root, "rename");
    const renameId = (await history(repo, 1, undefined, signal())).entries[0]!.id;
    expect((await revision(repo, renameId, signal())).changedPaths).toContainEqual(expect.objectContaining({ path: "-new @ 文", copyFrom: "base" }));
    const cursor = Buffer.from(JSON.stringify({ anchor: "a".repeat(64), scope: "b".repeat(64), offset: 999999 })).toString("base64url");
    expect(getHistoryInputSchema.safeParse({ repository: repo, cursor }).success).toBe(true);
  });
});

describe("SVN adapter", () => {
  it("parses property, missing, tree conflict and XML entities; rejects external entity declarations", () => {
    const repo = descriptor("svn", "/synthetic", "/synthetic");
    const raw = '<status><target><entry path="-a &amp; 文@"><wc-status item="normal" props="modified" revision="5"/></entry><entry path="gone"><wc-status item="missing" props="none"/></entry><entry path="conflict"><wc-status item="normal" props="none" tree-conflicted="true"/></entry></target></status>';
    expect(parseSvnStatus(raw, repo).map((entry) => [entry.relativePath, entry.status])).toEqual([["-a & 文@", "property-modified"], ["gone", "missing"], ["conflict", "conflicted"]]);
    expect(() => parseXml('<!DOCTYPE foo SYSTEM "file:///fake"><foo/>')).toThrow("Unsupported");
    const node = descendants(parseXml('<log><logentry revision="8"><paths><path action="A" copyfrom-path="/old" copyfrom-rev="7">/scope 文/file</path><path action="M">/scope 文-extra/sibling</path><path action="D">/sibling</path></paths></logentry></log>'), "logentry")[0]!;
    expect(scopedSvnPaths(node, "^/scope%20%E6%96%87")).toEqual([expect.objectContaining({ path: "/scope 文/file", copyFrom: "/old", copyFromRevision: "7" })]);
  });
  it("scopes ancestor status, diffs and revision paths, handles peg names and property-only changes, paginates", async () => {
    const { root } = await svnRepo();
    const scope = path.join(root, "scope 文");
    await mkdir(scope);
    await writeFile(path.join(scope, "-file @.txt"), "base\n");
    await writeFile(path.join(root, "sibling"), "sibling\n");
    await svnAdd(root, scope);
    await svnAdd(root, "sibling");
    await svnCommit(root, "initial");
    // Advance the scope's operative revision before querying its history.
    await command(root, "svn", ["update", "--non-interactive"]);
    await writeFile(path.join(scope, "-file @.txt"), "changed\n");
    await writeFile(path.join(root, "sibling"), "sibling changed\n");
    await svnCommit(root, "both scopes");
    await command(root, "svn", ["update", "--non-interactive"]);
    await command(root, "svn", ["propset", "synthetic", "value", "--", `${path.join(scope, "-file @.txt")}@`]);
    await writeFile(path.join(scope, "untracked@"), "untracked");
    const repo = descriptor("svn", root, scope);
    const state = await status(repo, signal());
    expect(state.entries).toContainEqual(expect.objectContaining({ status: "property-modified", propertyStatus: "modified" }));
    expect((await diff(repo, "scope 文/-file @.txt", "worktree", signal())).content).toContain("Property changes");
    expect((await diff(repo, "scope 文/untracked@", "untracked", signal())).content).toBe("untracked");
    const first = await history(repo, 1, undefined, signal());
    expect(first.entries[0]?.id).toBe("2");
    expect((await history(repo, 1, first.nextCursor!, signal())).entries[0]?.id).toBe("1");
    const details = getRevisionOutputSchema.parse(await revision(repo, "2", signal()));
    expect(details.changedPaths.map((item) => item.path)).toEqual(["/scope 文/-file @.txt"]);
    expect(details.diff.content).toContain("+changed");
    expect(details.diff.content).not.toContain("sibling changed");
    await unlink(path.join(scope, "-file @.txt"));
    expect((await status(repo, signal())).entries).toContainEqual(expect.objectContaining({ status: "missing" }));
    await command(scope, "git", ["init"]);
    const found = await discover({ workspacePath: scope, configured: [], discovery: { maxDepth: 1, maxEntries: 100 } }, signal());
    expect(found.repositories.map((item) => item.kind).sort()).toEqual(["git", "svn"]);
    expect(found.repositories.find((item) => item.kind === "svn")?.rootPath).toBe(root);
  }, 30000);
});
