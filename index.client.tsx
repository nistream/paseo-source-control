import type { PluginClientContext } from "@getpaseo/plugin/client";
import { SourceControlPanel } from "./client/panel.js";

export default function contribute(client: PluginClientContext) {
  const removePanel = client.addWorkspacePanel({ id: "source-control", title: "Source Control", icon: "GitBranch", context: "workspace", locations: ["workspace", "explorer"], Component: SourceControlPanel });
  const removeCommand = client.addCommandCenterItem({ id: "open-source-control", title: "Open Source Control", icon: "GitBranch", context: "workspace",
    onSelect({ openPanel }) { openPanel("source-control", { location: "explorer" }); } });
  return () => { removeCommand(); removePanel(); };
}
