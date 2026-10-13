import { useRpc, useSettings, useWorkspace, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { sourceControlSettings } from "../shared/settings.js";
import { cancelRequestRpc, getDiffRpc, getHistoryRpc, getRevisionRpc, getStatusRpc, listRepositoriesRpc,
  sourceControlSettingsSchema, type DiffMode, type DiffOutput, type RepositoryDescriptor, type StatusEntry } from "../shared/source-control.js";
import { RequestLifetime } from "./request.js";

const Appearance = createContext<PluginWorkspacePanelProps | null>(null);
function useAppearance() { return useContext(Appearance)!; }
function Label({ children, muted = false, mono = false }: { children: ReactNode; muted?: boolean; mono?: boolean }) {
  const { theme, layout } = useAppearance();
  return <Text selectable style={{ color: muted ? theme.colors.foregroundMuted : theme.colors.foreground, fontSize: layout.compact ? 12 : 13, ...(mono ? { fontFamily: "monospace" } : {}) }}>{children}</Text>;
}
function Button({ title, onPress, selected = false, disabled = false }: { title: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  const { theme } = useAppearance();
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled, selected }} disabled={disabled} onPress={onPress}
    style={{ padding: 8, borderRadius: 5, borderWidth: 1, borderColor: selected ? theme.colors.accent : theme.colors.border, opacity: disabled ? 0.5 : 1 }}>
    <Label>{title}</Label>
  </Pressable>;
}
function Row({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{children}</View>;
}

type Load<T> = { identity: string; phase: "loading" } | { identity: string; phase: "ready"; value: T } | { identity: string; phase: "error"; error: string };
function useLoad<T>(identity: string, work: (key: string) => Promise<T>): Load<T> {
  const cancel = useRpc(cancelRequestRpc);
  const workRef = useRef(work);
  workRef.current = work;
  const [state, setState] = useState<Load<T>>({ identity, phase: "loading" });
  useEffect(() => {
    const lifetime = new RequestLifetime((requestKey) => cancel({ requestKey }));
    setState({ identity, phase: "loading" });
    void lifetime.run(workRef.current,
      (value) => setState({ identity, phase: "ready", value }),
      (error) => setState({ identity, phase: "error", error: error.message }));
    return () => lifetime.dispose();
  }, [identity, cancel]);
  // Hide previous data immediately, before effect cleanup runs.
  return state.identity === identity ? state : { identity, phase: "loading" };
}
function Pending({ load }: { load: Load<unknown> }) {
  return load.phase === "error" ? <Label>{load.error} · Retry with Refresh.</Label> : load.phase === "loading" ? <Label muted>Loading from daemon…</Label> : null;
}
function DiffView({ value }: { value: DiffOutput }) {
  const { theme } = useAppearance();
  return <View style={{ gap: 6 }}>
    <Label>{value.path} · {value.mode} · {value.kind}</Label>
    {value.message && <Label muted>{value.message}</Label>}
    {value.kind === "empty" && <Label muted>No diff for this target.</Label>}
    {value.content !== null && <ScrollView horizontal style={{ maxHeight: 400, backgroundColor: theme.colors.surface1 }}>
      <ScrollView style={{ maxHeight: 400, padding: 8 }}><Label mono>{value.content}</Label></ScrollView>
    </ScrollView>}
  </View>;
}
function FileDiff({ repo, target }: { repo: RepositoryDescriptor; target: { path: string; mode: DiffMode } }) {
  const getDiff = useRpc(getDiffRpc);
  const load = useLoad(JSON.stringify([repo.id, target]), (requestKey) => getDiff({ repository: repo, ...target, requestKey }));
  return <><Pending load={load} />{load.phase === "ready" && <DiffView value={load.value} />}</>;
}
function StatusGroup({ title, entries, mode, onSelect }: { title: string; entries: StatusEntry[]; mode: DiffMode; onSelect: (path: string, mode: DiffMode) => void }) {
  const [page, setPage] = useState(0);
  const visible = entries.slice(page * 200, (page + 1) * 200);
  return <View style={{ gap: 6 }}>
    <Label>{title} ({entries.length})</Label>
    {visible.map((entry) => <Button key={entry.relativePath} title={`${entry.displayPath}${entry.originalDisplayPath ? ` ← ${entry.originalDisplayPath}` : ""} · ${entry.status}${entry.propertyStatus === "modified" ? " · properties modified" : ""}`}
      onPress={() => onSelect(entry.relativePath, mode)} />)}
    {entries.length > 200 && <Row>
      <Button title="Previous files" disabled={page === 0} onPress={() => setPage(page - 1)} />
      <Button title="Next files" disabled={(page + 1) * 200 >= entries.length} onPress={() => setPage(page + 1)} />
    </Row>}
  </View>;
}
function WorkingChanges({ repo }: { repo: RepositoryDescriptor }) {
  const getStatus = useRpc(getStatusRpc);
  const load = useLoad(repo.id, (requestKey) => getStatus({ repository: repo, requestKey }));
  const [target, setTarget] = useState<{ path: string; mode: DiffMode } | null>(null);
  const select = (path: string, mode: DiffMode) => setTarget({ path, mode });
  return <View style={{ gap: 10 }}>
    <Pending load={load} />
    {load.phase === "ready" && <>
      <Label>{load.value.entries.length} changed paths{load.value.branch ? ` · ${load.value.branch}` : ""}</Label>
      {load.value.upstream && <Label muted>Upstream {load.value.upstream} · ahead {load.value.ahead ?? "?"} / behind {load.value.behind ?? "?"}</Label>}
      <Label muted>Refreshed {new Date(load.value.refreshedAt).toLocaleTimeString()} · manual refresh</Label>
      {load.value.entries.length === 0 && <Label>No working-copy changes in this scope.</Label>}
      {repo.kind === "git" ? <>
        <StatusGroup title="Staged" entries={load.value.entries.filter((entry) => entry.staged)} mode="index" onSelect={select} />
        <StatusGroup title="Unstaged" entries={load.value.entries.filter((entry) => entry.unstaged)} mode="worktree" onSelect={select} />
      </> : <StatusGroup title="Working copy (text and properties)" entries={load.value.entries.filter((entry) => !entry.untracked)} mode="worktree" onSelect={select} />}
      <StatusGroup title={repo.kind === "git" ? "Untracked" : "Unversioned"} entries={load.value.entries.filter((entry) => entry.untracked)} mode="untracked" onSelect={select} />
    </>}
    {target && <><Button title="Close file diff" onPress={() => setTarget(null)} /><FileDiff repo={repo} target={target} /></>}
  </View>;
}
function RevisionDetail({ repo, id }: { repo: RepositoryDescriptor; id: string }) {
  const getRevision = useRpc(getRevisionRpc);
  const load = useLoad(JSON.stringify([repo.id, id]), (requestKey) => getRevision({ repository: repo, revision: id, requestKey }));
  const [page, setPage] = useState(0);
  return <View style={{ gap: 6 }}><Pending load={load} />
    {load.phase === "ready" && <>
      <Label>{load.value.entry.id} · {load.value.entry.author} · {load.value.entry.date}</Label>
      <Label>{load.value.entry.message}</Label>
      {load.value.entry.parents.length > 0 && <Label muted>Parents: {load.value.entry.parents.join(", ")}</Label>}
      <Label>{load.value.changedPaths.length} changed paths in scope</Label>
      {load.value.changedPaths.slice(page * 200, (page + 1) * 200).map((item, index) => <Label key={index}>{item.action} {item.displayPath}{item.copyFrom ? ` ← ${item.copyFrom}${item.copyFromRevision ? `@${item.copyFromRevision}` : ""}` : ""}</Label>)}
      {load.value.changedPaths.length > 200 && <Row>
        <Button title="Previous revision paths" disabled={page === 0} onPress={() => setPage(page - 1)} />
        <Button title="Next revision paths" disabled={(page + 1) * 200 >= load.value.changedPaths.length} onPress={() => setPage(page + 1)} />
      </Row>}
      <DiffView value={load.value.diff} />
    </>}
  </View>;
}
function History({ repo }: { repo: RepositoryDescriptor }) {
  const getHistory = useRpc(getHistoryRpc);
  const [cursor, setCursor] = useState<string | undefined>();
  const [id, setId] = useState<string | null>(null);
  const load = useLoad(JSON.stringify([repo.id, cursor]), (requestKey) => getHistory({ repository: repo, cursor, limit: 25, requestKey }));
  return <View style={{ gap: 8 }}>
    <Label>{repo.kind === "svn" ? "Revision history" : "Commit history"} · inspection scope</Label>
    <Pending load={load} />
    {load.phase === "ready" && <>
      {load.value.entries.length === 0 && <Label>No history in this scope.</Label>}
      {load.value.entries.map((entry) => <Button key={entry.id} selected={id === entry.id} title={`${repo.kind === "git" ? entry.id.slice(0, 10) : `r${entry.id}`} · ${entry.title || "(no message)"} · ${entry.author ?? "unknown"} · ${entry.date?.slice(0, 10) ?? ""}`} onPress={() => setId(entry.id)} />)}
      {load.value.nextCursor && <Button title="Next 25 older entries" onPress={() => { setId(null); setCursor(load.value.nextCursor!); }} />}
      {!load.value.hasMore && <Label muted>End of history.</Label>}
      <Label muted>Refresh restarts history from current HEAD.</Label>
    </>}
    {id && <><Button title="Close revision detail" onPress={() => setId(null)} /><RevisionDetail key={id} repo={repo} id={id} /></>}
  </View>;
}
function SelectedRepository({ repo }: { repo: RepositoryDescriptor }) {
  const [tab, setTab] = useState<"changes" | "history">("changes");
  return <View style={{ gap: 10 }}>
    <Label>{repo.kind.toUpperCase()} · {repo.label}</Label>
    <Label muted>Root: {repo.rootPath}</Label>
    <Label muted>Scope: {repo.scopePath}</Label>
    <Row><Button title="Changes" selected={tab === "changes"} onPress={() => setTab("changes")} /><Button title="History" selected={tab === "history"} onPress={() => setTab("history")} /></Row>
    {tab === "changes" ? <WorkingChanges repo={repo} /> : <History repo={repo} />}
  </View>;
}

function PanelContent({ workspaceId }: { workspaceId: string }) {
  const { host, theme, layout } = useAppearance();
  const directory = useWorkspace(workspaceId, (workspace) => workspace.directory);
  const settings = useSettings(sourceControlSettings);
  const list = useRpc(listRepositoriesRpc);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ text: string; revision: string } | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const identity = JSON.stringify([host.id, workspaceId, directory, settings.status === "ready" ? settings.values : settings.status, refresh]);
  const load = useLoad(identity, async (requestKey) => {
    if (!directory) throw new Error("Workspace directory is unavailable; check the selected host connection");
    if (settings.status !== "ready") throw new Error("Source Control settings are not ready");
    return list({ workspacePath: directory, configured: settings.values.repositories, discovery: settings.values.discovery, requestKey });
  });
  const repo = load.phase === "ready" ? load.value.repositories.find((item) => item.id === selected) ?? load.value.repositories[0] : undefined;
  const saveDraft = async () => {
    if (!draft) return;
    try {
      const values = sourceControlSettingsSchema.parse(JSON.parse(draft.text));
      if (await settings.save(values, draft.revision)) { setDraft(null); setDraftError(null); }
    } catch (error) { setDraftError((error as Error).message); }
  };
  return <ScrollView style={{ flex: 1, backgroundColor: theme.colors.surface0 }} contentContainerStyle={{ padding: layout.compact ? 10 : 16, gap: 12 }}>
    <Label>Source Control · {host.label} · read-only</Label>
    <Row>
      <Button title="Refresh" onPress={() => setRefresh((value) => value + 1)} />
      <Button title="Configure repositories" disabled={settings.status !== "ready"} onPress={() => {
        if (settings.status === "ready") { setDraft({ text: JSON.stringify(settings.values, null, 2), revision: settings.revision }); setDraftError(null); }
      }} />
    </Row>
    {settings.status !== "ready" && <>
      <Label>{settings.status === "loading" ? "Loading host settings…" : settings.error}</Label>
      <Row><Button title="Reload settings" onPress={() => { void settings.reload(); }} />
        {settings.status === "invalid" && <Button title="Reset invalid settings to defaults" onPress={() => { void settings.reset(); }} />}</Row>
    </>}
    {draft && <View style={{ gap: 8 }}>
      <Label>Daemon settings JSON. Paths must be absolute on this host. Optional workspacePath restricts each configured repository to one workspace; scopePath explicitly selects a subtree or the whole root.</Label>
      <TextInput accessibilityLabel="Repository configuration JSON" multiline value={draft.text} onChangeText={(text) => setDraft({ ...draft, text })}
        style={{ color: theme.colors.foreground, backgroundColor: theme.colors.surface1, borderColor: theme.colors.border, borderWidth: 1, padding: 8, minHeight: 180, fontFamily: "monospace" }} />
      {(draftError || settings.saveError) && <Label>{draftError || settings.saveError}</Label>}
      <Row><Button title="Save configuration" disabled={settings.saving} onPress={() => { void saveDraft(); }} />
        <Button title="Discard draft" onPress={() => { setDraft(null); setDraftError(null); }} /></Row>
      <Label muted>On a revision conflict, discard and reopen the draft to load the latest settings.</Label>
    </View>}
    <Pending load={load} />
    {load.phase === "ready" && <>
      {load.value.discoveryTruncated && <Label muted>Discovery reached its depth, entry or time limit. Configure omitted repositories explicitly.</Label>}
      {load.value.warnings.map((warning, index) => <Label key={index}>{warning.source}: {warning.message}</Label>)}
      {load.value.repositories.length === 0 && <Label>No repositories found. Configure an absolute repository path or adjust discovery limits.</Label>}
      <View style={{ gap: 6 }}>{load.value.repositories.map((item) => <Button key={item.id} title={`${item.kind.toUpperCase()} · ${item.label} · ${item.scopePath}`} selected={repo?.id === item.id} onPress={() => setSelected(item.id)} />)}</View>
      {repo && <SelectedRepository key={`${identity}:${repo.id}`} repo={repo} />}
    </>}
  </ScrollView>;
}
export function SourceControlPanel(props: PluginWorkspacePanelProps) {
  return <Appearance.Provider value={props}><PanelContent key={`${props.host.id}:${props.workspaceId}`} workspaceId={props.workspaceId} /></Appearance.Provider>;
}
