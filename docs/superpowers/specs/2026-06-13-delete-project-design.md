# Delete Project — Design Spec
Date: 2026-06-13

## Overview

Add a Delete button to each project row. Clicking it opens a confirmation modal with two options: delete immediately, or merge the project into the most recent backup before deleting.

## UI Changes

### Delete button in table
A "Delete" button (`ghost-btn small-btn`) added below the existing "Edit" button in the Actions column of each project row.

### Confirmation modal (`#deleteProjectModal`)
Small modal (reuses existing `modal-card` pattern) containing:
- Header: eyebrow "Delete project", h3 shows the project name
- Three buttons:
  - **Cancel** (ghost-btn) — closes modal, no action
  - **Delete** (ghost-btn) — deletes immediately
  - **Backup & Delete** (primary-btn) — merges into latest backup then deletes

## Delete flow
1. Remove project from `projects` array
2. `saveProjects()`
3. `renderAll()`
4. Close modal

## Backup & Delete flow
1. Check `backups.length === 0` → show `alert("No backup exists yet. Please create a backup first before deleting.")` → stop, do not delete, keep modal open
2. Find `backups[0]` (most recent entry)
3. Check if `backups[0].projects` already contains a project with the same `name`:
   - Yes → replace that entry with the current project object
   - No → append the current project object to `backups[0].projects`
4. `saveBackups()`
5. Remove project from `projects`, `saveProjects()`, `renderAll()`, close modal

## Affected Files
- `index.html` — add `#deleteProjectModal` markup before `<script src="app.js">`
- `app.js` — add DOM refs, `openDeleteProjectModal(projectIndex)`, `closeDeleteProjectModal()`, Delete and Backup & Delete handlers, add Delete button to `renderTable()` row template
