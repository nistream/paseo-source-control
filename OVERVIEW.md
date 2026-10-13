# Source Control

Inspect Git and SVN working copies from Paseo's Explorer or a workspace tab. Select ancestor, nested or overlapping repositories while keeping your workspace and agent in their current directory. The panel shows staged and unstaged Git changes, SVN text/property/conflict status, file diffs, paginated history and scoped revision details.

Paseo 0.11.2 or later is required on the client and daemon. Git and/or SVN must be available on the selected daemon's PATH. Automatic discovery is bounded; Configure repositories accepts absolute daemon paths, optional inspection scopes and workspace-specific entries. Shared host settings use revision conflict checks; selections and refresh snapshots belong to each panel.

The plugin reads files and executes read-only VCS commands on that host. SVN history can contact its configured server using existing authentication noninteractively. Refresh updates the snapshot manually. Binary or oversized content is identified rather than rendered; commands have timeout and output limits. History is a list with details; graph visualization and mutation actions are future work. macOS adapter tests and Paseo browser checks cover desktop and compact web layouts in light and dark themes. Native mobile clients and other host operating systems still require validation.
