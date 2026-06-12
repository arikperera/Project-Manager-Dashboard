# Backup & Restore — Design Spec
Date: 2026-06-12

## Overview

Add a backup system that snapshots all projects and users to localStorage and downloads a JSON file. A backup panel lets the user browse past backups, preview their contents, and selectively restore projects and/or users. All backups are kept indefinitely.

## Data Model

New `backups` array stored in localStorage under `project-dashboard-backups-v1`.

Each entry:
```js
{
  id: "bk_1749999999000",          // "bk_" + Date.now()
  label: "Backup 12/06/26 14:35",  // auto-generated from date+time
  timestamp: 1749999999000,         // Date.now() at creation
  projects: [...],                  // deep copy of projects array
  users: [...]                      // deep copy of users array
}
```

- New backups prepended (newest first)
- No limit — all kept indefinitely
- `saveBackups()` persists the array to localStorage

## Topbar Buttons

Two new buttons added between "Manage users" and "Export report":

**"Create backup"** (secondary-btn):
- Deep-copies current `projects` and `users`
- Creates backup entry with `id`, `label`, `timestamp`
- Prepends to `backups` array, calls `saveBackups()`
- Downloads JSON file named `dashboard-backup-DD-MM-YY-HH-MM.json`
- Button text briefly changes to "✓ Saved" for 2 seconds, then reverts

**"Backups"** (secondary-btn):
- Opens the backup panel modal
- If no backups: shows empty state "No backups yet. Click Create backup to save your first snapshot."

## Backup Panel Modal

Full-viewport-width modal (wider than existing modals). Two-column layout:

### Right sidebar (~200px, scrollable)
- List of backup entries, newest first
- Each entry: date+time label
- Selected entry highlighted with blue border
- Clicking selects it and updates the main area

### Main area (remaining width)
- **Action bar** at top: selected backup label + "Restore" button + "Delete" button
- **Projects table**: same grouped-by-PM layout as main dashboard (read-only — no Edit button). Columns: Customer, Project, Jira, NRR, Start, End, Health, Progress, Project Status, Manager Notes
- **Users section** below the table: users grouped by role (PM / CSM / Sales), read-only

### Restore flow
1. Click Restore → inline confirmation appears below the action bar
2. Two checkboxes (both checked by default): ☑ Restore projects, ☑ Restore users
3. Confirm button → replaces live data with backup data for checked items
4. Calls `saveProjects()` and/or `saveUsers()` as appropriate
5. Calls `renderAll()`, closes panel

### Delete flow
1. Click Delete → backup removed from array, `saveBackups()` called
2. Sidebar re-renders, next newest backup auto-selected (or empty state if none left)

## Affected Files

- `index.html` — add "Create backup" and "Backups" buttons to topbar; add `#backupsModal` markup
- `app.js` — add backups store, `saveBackups()`, `createBackup()`, `renderBackupsPanel()`, restore/delete handlers
- `styles.css` — add `.backups-modal-card` (wide modal), `.backups-layout` (two-column), `.backup-sidebar`, `.backup-entry`, `.backup-entry.selected`, `.backup-main`
