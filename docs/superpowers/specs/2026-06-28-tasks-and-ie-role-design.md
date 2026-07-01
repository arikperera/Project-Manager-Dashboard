# Tasks & IE Role — Design Spec
Date: 2026-06-28

## Overview

Add support for IM/IE team members (Integration Engineers) to track their tasks in the same dashboard as PM projects. Tasks are child work items linked to existing projects. A new IE user role is added. The "Add new project" button becomes "Add new" with a choice between project and task.

## New User Role: IE

Add `IE` as a fourth role alongside `PM`, `CSM`, `Sales`. IE users appear in:
- User management modal (add/edit form checkboxes)
- Autocomplete for task owner field in Add task form
- User panel list

## Data Model

New `tasks` array stored in localStorage under `project-dashboard-tasks-v1`.

Each task object:
```js
{
  id: 'task_<timestamp>',
  type: 'task',
  customer: 'Acme Corp',
  parentProjectName: 'CRM Migration',
  jira: '',                    // inherited from parent project at creation time (read-only)
  owner: 'Dana Cohen',         // task owner from users store (any role)
  region: 'EMEA',
  health: 'Green',
  riskReason: '',
  statusText: '',
  comments: '',
  progress: 0,
  nrr: null,
  startDate: '',
  dueDate: '',
  status: 'On Track',
}
```

`saveTasks()` persists to localStorage. Customer↔Project correlation is derived live from `projects.filter(p => p.customer === selectedCustomer).map(p => p.name)` — no separate store needed.

## "Add new" Button and Choice Modal

- Rename "Add new project" button to **"Add new"**
- Clicking opens a small choice modal:
  - Header: "What would you like to add?"
  - **"New Project"** (secondary-btn) — opens existing Add project form unchanged
  - **"New Task"** (primary-btn) — opens new Add task form

## Add Task Form

Fields:
1. **Customer name** — autocomplete from customers store (same mechanism as Add project); selecting a customer filters the Project name dropdown
2. **Project name** — dropdown showing only projects where `project.customer === selectedCustomer`; selecting a project auto-fills the Jira URL
3. **Jira URL** — read-only, auto-filled from selected project's `jira` field
4. **Task owner** — autocomplete from users store (all roles)
5. **Region** — same dropdown as projects (APAC, EMEA, North America, LatAm, Internal, ROW)

On save: push to `tasks` array, call `saveTasks()`, call `renderAll()`, close modal.

## Dashboard Rendering

`renderTable()` merges `tasks` into the same grouped view as `projects`:
- Grouping key: `task.owner` (same as `project.manager`)
- Tasks render as table rows with the same columns as projects
- Fields not applicable to tasks show as `-` or empty:
  - NRR → `-`
  - Start / End → `-`
  - Progress → `0%` (empty bar)
  - Manager Notes → empty
- Jira cell shows inherited parent project Jira URL
- Health, Project Status, Region work identically to projects

All existing filters (PM/owner, Health, Progress, Region) apply to tasks the same way — no filter changes needed.

## Edit Task

Edit modal reused with one change: when `item.type === 'task'`, Customer name and Project name fields are **read-only**. All other fields editable: Health, Risk Reason, Project Status, Task Owner.

## Complete/Delete

Same modal as projects: Cancel | Delete | Backup & Delete. Backup & Delete merges the task into `backups[0]` before removal (same upsert logic by name).

## Affected Files

- `index.html` — rename "Add new project" button; add choice modal; add task form modal; add IE option to role checkboxes in user add/edit forms
- `app.js` — add `TASKS_KEY`, `tasks`, `saveTasks()`; add IE to role lists; update `renderTable()` to merge tasks; add task form open/save logic; update edit modal to detect task type; update delete handlers to work on tasks
- `styles.css` — no new styles needed (reuses existing patterns)
