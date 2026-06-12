# User Management — Design Spec
Date: 2026-06-12

## Overview

Add a dedicated user store (PM, CSM, Sales) independent of projects, with a "Manage users" modal in the topbar. Users pre-registered here appear in autocomplete dropdowns when creating or editing projects. Renaming a user propagates across all existing projects automatically.

## Data Model

A new `users` array stored in localStorage under `project-dashboard-users-v1`.

Each user object:
```js
{ id: "u_<timestamp>_<index>", firstName: "Janina", lastName: "Pomme", role: "PM" }
```

- `id`: generated once at creation (`"u_" + Date.now() + "_" + index`), never changes
- `role`: one of `"PM"`, `"CSM"`, `"Sales"`
- Display name: `firstName + " " + lastName`

Projects continue to store names as plain strings (`manager`, `csm`, `sales` fields — no migration needed). Rename propagation works by scanning all projects at save time and replacing the old full name string with the new one.

## Manage Users Modal

### Trigger
New "Manage users" button in the topbar, placed between "Add new project" and "Export report".

### Modal layout
- Header: "Manage users"
- User list grouped by role: PM first, then CSM, then Sales
- Each row: `Full name — Role [Edit] [Delete]`
- "Add user" button below the list
- Empty state: "No users added yet. Click Add user to get started."

### Add user
Clicking "Add user" opens a small inline form at the bottom of the list:
- First name (text input, required)
- Last name (text input, required)
- Role (select: PM / CSM / Sales, required)
- Save / Cancel buttons

On Save: new user appended to store, list re-renders, form clears.

### Edit user
Clicking Edit on a row replaces that row with an inline editable form pre-filled with the user's current values. On Save:
1. Compute old full name and new full name
2. If name changed: scan all projects and replace `manager`, `csm`, `sales` fields where they match the old name
3. Update user record in store
4. Save both stores, re-render

### Delete user
Clicking Delete removes the user from the store. Projects that referenced the name keep it as a plain string (no data loss).

## Autocomplete Integration

The three autocomplete fields in the "Add project" modal are updated to pull from the users store filtered by role:

- PM name → users where `role === "PM"`
- CSM name → users where `role === "CSM"`
- Sales name → users where `role === "Sales"`

Typing a name not in the list remains allowed (free-text entry still works).

## Affected Files

- `index.html` — add "Manage users" button in topbar; add `#usersModal` markup
- `app.js` — add users store, `loadUsers`/`saveUsers`, modal open/close, add/edit/delete handlers, rename propagation, update `initAutocompletes` to read from users store
- `styles.css` — no new styles needed (reuses existing modal, form, button classes)
