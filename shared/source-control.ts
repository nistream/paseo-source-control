import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const vcsKindSchema = z.enum(["git", "svn"]);
export type VcsKind = z.infer<typeof vcsKindSchema>;

export const repositoryCapabilitiesSchema = z.object({
  staged: z.boolean(),
  untracked: z.boolean(),
  history: z.boolean(),
  diff: z.boolean(),
});

export const repositoryDescriptorSchema = z.object({
  id: z.string().min(1),
  kind: vcsKindSchema,
  label: z.string().min(1),
  rootPath: z.string().min(1),
  scopePath: z.string().min(1),
  capabilities: repositoryCapabilitiesSchema,
});
export type RepositoryDescriptor = z.infer<typeof repositoryDescriptorSchema>;

export const configuredRepositorySchema = z.object({
  kind: vcsKindSchema,
  rootPath: z.string().min(1),
  scopePath: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  workspacePath: z.string().min(1).optional(),
});
export type ConfiguredRepository = z.infer<typeof configuredRepositorySchema>;

export const discoveryOptionsSchema = z.object({
  maxDepth: z.number().int().min(0).max(5).default(3),
  maxEntries: z.number().int().min(1).max(5000).default(1200),
});
export type DiscoveryOptions = z.infer<typeof discoveryOptionsSchema>;

export const sourceControlSettingsSchema = z.object({
  repositories: z.array(configuredRepositorySchema).max(100).default([]),
  discovery: discoveryOptionsSchema.default({ maxDepth: 3, maxEntries: 1200 }),
});
export type SourceControlSettings = z.infer<typeof sourceControlSettingsSchema>;

const requestKeySchema = z.string().min(1).max(200).optional();

export const listRepositoriesInputSchema = z.object({
  workspacePath: z.string().min(1),
  configured: z.array(configuredRepositorySchema).max(100).default([]),
  discovery: discoveryOptionsSchema.default({ maxDepth: 3, maxEntries: 1200 }),
  requestKey: requestKeySchema,
});
export type ListRepositoriesInput = z.infer<typeof listRepositoriesInputSchema>;

export const discoveryWarningSchema = z.object({
  source: z.string(),
  message: z.string(),
});
export type DiscoveryWarning = z.infer<typeof discoveryWarningSchema>;

export const listRepositoriesOutputSchema = z.object({
  repositories: z.array(repositoryDescriptorSchema),
  warnings: z.array(discoveryWarningSchema),
  discoveryTruncated: z.boolean(),
  generatedAt: z.string(),
});
export type ListRepositoriesOutput = z.infer<typeof listRepositoriesOutputSchema>;

export const statusKindSchema = z.enum([
  "normal",
  "modified",
  "added",
  "deleted",
  "renamed",
  "copied",
  "untracked",
  "unversioned",
  "ignored",
  "missing",
  "conflicted",
  "property-modified",
  "replaced",
  "external",
  "obstructed",
  "incomplete",
  "unknown",
]);
export type StatusKind = z.infer<typeof statusKindSchema>;

export const propertyStatusSchema = z.enum(["none", "normal", "modified", "conflicted"]);
export const remoteStatusSchema = z.enum([
  "none",
  "normal",
  "modified",
  "added",
  "deleted",
  "replaced",
  "merged",
  "conflicted",
  "obstructed",
  "incomplete",
]);

export const statusEntrySchema = z.object({
  absolutePath: z.string().min(1),
  relativePath: z.string(),
  displayPath: z.string(),
  originalPath: z.string().nullable(),
  originalDisplayPath: z.string().nullable(),
  status: statusKindSchema,
  staged: z.boolean(),
  unstaged: z.boolean(),
  untracked: z.boolean(),
  conflicted: z.boolean(),
  ignored: z.boolean(),
  propertyStatus: propertyStatusSchema,
  remoteStatus: remoteStatusSchema.nullable(),
  revision: z.string().nullable(),
});
export type StatusEntry = z.infer<typeof statusEntrySchema>;

export const getStatusInputSchema = z.object({
  repository: repositoryDescriptorSchema,
  requestKey: requestKeySchema,
});
export type GetStatusInput = z.infer<typeof getStatusInputSchema>;

export const getStatusOutputSchema = z.object({
  repositoryId: z.string().min(1),
  branch: z.string().nullable(),
  upstream: z.string().nullable(),
  ahead: z.number().int().nullable(),
  behind: z.number().int().nullable(),
  entries: z.array(statusEntrySchema),
  refreshedAt: z.string(),
  truncated: z.boolean(),
});
export type GetStatusOutput = z.infer<typeof getStatusOutputSchema>;

export const diffModeSchema = z.enum(["worktree", "index", "untracked"]);
export type DiffMode = z.infer<typeof diffModeSchema>;

export const diffKindSchema = z.enum(["text", "binary", "large", "empty", "unavailable"]);
export type DiffKind = z.infer<typeof diffKindSchema>;

export const diffOutputSchema = z.object({
  path: z.string(),
  mode: diffModeSchema,
  kind: diffKindSchema,
  content: z.string().nullable(),
  message: z.string().nullable(),
  truncated: z.boolean(),
  generatedAt: z.string(),
});
export type DiffOutput = z.infer<typeof diffOutputSchema>;

export const getDiffInputSchema = z.object({
  repository: repositoryDescriptorSchema,
  path: z.string().min(1),
  mode: diffModeSchema.default("worktree"),
  requestKey: requestKeySchema,
});
export type GetDiffInput = z.infer<typeof getDiffInputSchema>;

export const historyEntrySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["git-commit", "svn-revision"]),
  title: z.string(),
  author: z.string().nullable(),
  date: z.string().nullable(),
  message: z.string().nullable(),
  parents: z.array(z.string()),
  refs: z.array(z.string()),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const getHistoryInputSchema = z.object({
  repository: repositoryDescriptorSchema,
  cursor: z.string().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  requestKey: requestKeySchema,
});
export type GetHistoryInput = z.infer<typeof getHistoryInputSchema>;

export const getHistoryOutputSchema = z.object({
  repositoryId: z.string().min(1),
  entries: z.array(historyEntrySchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  generatedAt: z.string(),
});
export type GetHistoryOutput = z.infer<typeof getHistoryOutputSchema>;

export const changedPathSchema = z.object({
  path: z.string(),
  displayPath: z.string(),
  action: z.string(),
  copyFrom: z.string().nullable(),
  copyFromRevision: z.string().nullable(),
  kind: z.string().nullable(),
});
export type ChangedPath = z.infer<typeof changedPathSchema>;

export const getRevisionInputSchema = z.object({
  repository: repositoryDescriptorSchema,
  revision: z.string().min(1),
  requestKey: requestKeySchema,
});
export type GetRevisionInput = z.infer<typeof getRevisionInputSchema>;

export const getRevisionOutputSchema = z.object({
  repositoryId: z.string().min(1),
  revision: z.string().min(1),
  entry: historyEntrySchema,
  changedPaths: z.array(changedPathSchema),
  diff: diffOutputSchema,
  generatedAt: z.string(),
});
export type GetRevisionOutput = z.infer<typeof getRevisionOutputSchema>;

export const cancelRequestInputSchema = z.object({
  requestKey: z.string().min(1).max(200),
});
export type CancelRequestInput = z.infer<typeof cancelRequestInputSchema>;

export const cancelRequestOutputSchema = z.object({
  cancelled: z.boolean(),
});
export type CancelRequestOutput = z.infer<typeof cancelRequestOutputSchema>;

export const listRepositoriesRpc = defineRpc({
  name: "source-control.list-repositories",
  input: listRepositoriesInputSchema,
  output: listRepositoriesOutputSchema,
});

export const getStatusRpc = defineRpc({
  name: "source-control.get-status",
  input: getStatusInputSchema,
  output: getStatusOutputSchema,
});

export const getDiffRpc = defineRpc({
  name: "source-control.get-diff",
  input: getDiffInputSchema,
  output: diffOutputSchema,
});

export const getHistoryRpc = defineRpc({
  name: "source-control.get-history",
  input: getHistoryInputSchema,
  output: getHistoryOutputSchema,
});

export const getRevisionRpc = defineRpc({
  name: "source-control.get-revision",
  input: getRevisionInputSchema,
  output: getRevisionOutputSchema,
});

export const cancelRequestRpc = defineRpc({
  name: "source-control.cancel-request",
  input: cancelRequestInputSchema,
  output: cancelRequestOutputSchema,
});
