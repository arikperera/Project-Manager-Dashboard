# Concurrent-Save Merge Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop a stale browser tab's save from silently overwriting projects/tasks/closed-projects/backups added or edited by other sessions since that tab last synced.

**Architecture:** A shared 3-way merge helper (`mergeArrayForSave`) compares a per-store baseline snapshot (what this tab last confirmed was in KV) against a genuinely fresh KV read taken at save time, layering in only the items the tab itself actually added or edited. All four save functions (`saveProjects`, `saveTasks`, `saveClosedProjects`, `saveBackups`) route through it. One deliberate exception: "Restore from Backup" bypasses the merge entirely (an explicit `skipMerge` option), since restoring a backup means "reset to exactly this snapshot," not "merge it in."

**Tech Stack:** Vanilla JS, no build step, no test framework — verification is `node --check` plus manual browser testing.

**Spec:** `docs/superpowers/specs/2026-08-31-concurrent-save-merge-design.md`

## Global Constraints

- Only `app-core.js`, `app-render.js`, and `app-modals.js` are touched. No changes to `index.html`, `styles.css`, or `proxy-worker.js`.
- The existing `_lastKnownKvState` cache (90-second cap, used only by `logSaveDiff`) must NOT be touched or reused for this purpose — the new `_saveBaseline` map is separate and has no expiry.
- `mergeArrayForSave`'s `fresh` read must always be a genuine network call (`kvGet`), never served from any cache — correctness at write time matters more than the extra round-trip.
- Tombstoned items (per `getCombinedDeleteIds`) are excluded from every merge result, no exceptions.
- "Restore from Backup" (both the projects and tasks writes it triggers) is the one call site that bypasses the merge via `{ skipMerge: true }` — confirmed explicitly with the user; every other save call site uses the merge.
- Same-item-edited-by-two-tabs-at-once is explicitly out of scope (whole-item merge, not field-level) — confirmed with the user, not a defect to fix here.

---

### Task 1: Merge helper, baseline tracking, and initial baseline capture

**Files:**
- Modify: `app-core.js:832` (insert new tracking map + helper function immediately before the existing `_lastKnownKvState` block)
- Modify: `app-core.js:962` (insert initial baseline capture right after the init-hydration `Promise.all` and the backups sort)

**Interfaces:**
- Produces: `_saveBaseline` (plain object, keyed by storeKey, values are deep-cloned arrays), `mergeArrayForSave(baseline, fresh, local, deleteIds, getKey)` (function, returns a merged array) — every later task in this plan consumes both, by these exact names.
- Consumes: nothing new (uses existing `getItemDeleteKey`, already defined at `app-core.js:625`).

- [ ] **Step 1: Add the baseline map and merge helper**

At `app-core.js:832`, immediately BEFORE the existing line `const _lastKnownKvState = {};`, insert:

```js
// Per-store baseline snapshots (deep clones) — what this browser tab last confirmed was
// actually in KV. Captured at page load, on poll/refresh, and after every successful save
// (see below). Deliberately separate from _lastKnownKvState below: that cache has a
// 90-second cap and exists only for logSaveDiff's before/after comparison. This one has no
// expiry, because detecting what a tab actually changed requires comparing against what it
// knew when its editing session started — which can be minutes or hours before a save, not
// seconds. See docs/superpowers/specs/2026-08-31-concurrent-save-merge-design.md.
const _saveBaseline = {};

// Merges this tab's in-memory array against the current KV truth. `baseline` is this tab's
// last confirmed snapshot; `fresh` is a KV read taken moments ago at save time; `local` is
// the tab's current in-memory array. Anything in `local` that matches its `baseline`
// counterpart exactly is left as `fresh` already has it (untouched by this tab — any
// addition/edit made by another session since baseline stays intact). Anything new or
// changed relative to baseline uses the tab's own version. Tombstoned items are excluded
// either way. `getKey` is the same key function every store already uses (getItemDeleteKey).
function mergeArrayForSave(baseline, fresh, local, deleteIds, getKey) {
  const baselineMap = new Map((baseline || []).map(item => [getKey(item), item]));
  const result = new Map(fresh.map(item => [getKey(item), item]));

  for (const item of local) {
    const key = getKey(item);
    if (!key || deleteIds.has(key)) continue;
    const baselineItem = baselineMap.get(key);
    const isNewOrChanged = !baselineItem || JSON.stringify(baselineItem) !== JSON.stringify(item);
    if (isNewOrChanged) result.set(key, item);
  }

  for (const key of deleteIds) result.delete(key);

  return [...result.values()];
}

```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Capture the initial baseline at page load**

At `app-core.js:962`, the line immediately after the init-hydration assignment is:
```js
  backups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
```
Immediately AFTER that line, insert:

```js
  _saveBaseline[STORAGE_KEY] = JSON.parse(JSON.stringify(projects));
  _saveBaseline[TASKS_KEY] = JSON.parse(JSON.stringify(tasks));
  _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(closedProjects));
  _saveBaseline[BACKUPS_KEY] = JSON.parse(JSON.stringify(backups));
```

This must be the array as `hydrateKey` returned it (already tombstone-filtered and offline-add-merged) — exactly what `projects`/`tasks`/`closedProjects`/`backups` already equal at this point, so no different value needs to be threaded through; just read the four module-level variables directly.

- [ ] **Step 4: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add app-core.js
git commit -m "feat: add 3-way merge helper and baseline tracking for concurrent saves"
```

---

### Task 2: Rewire saveProjects

**Files:**
- Modify: `app-core.js:1252-1270` (replace the entire body of `saveProjects`)
- Modify: `app-render.js:38-61` (inside `refreshProjectsAndTasksFromKv`, capture baseline for projects)
- Modify: `app-render.js:933` (Restore-from-Backup call site — add the merge bypass)

**Interfaces:**
- Consumes: `_saveBaseline`, `mergeArrayForSave` (Task 1).
- Produces: `saveProjects(reason, options = {})` — the new optional second parameter; `options.skipMerge` (boolean) is consumed by Task 6's equivalent call for tasks, but for THIS task, only the projects call site (`app-render.js:933`) needs updating to pass it.

- [ ] **Step 1: Replace saveProjects**

The current function at `app-core.js:1252-1270` is:

```js
async function saveProjects(reason) {
  // Strip anything tombstoned (by this browser or any other session) before persisting —
  // guards every caller (delete handlers, Jira sync loops, etc.) against writing back a
  // stale in-memory copy that still contains an item someone else already deleted.
  const deleteIds = await getCombinedDeleteIds(STORAGE_KEY);
  if (deleteIds.size) {
    const cleaned = projects.filter(p => !deleteIds.has(getItemDeleteKey(p)));
    if (cleaned.length !== projects.length) projects = cleaned;
  }
  await logSaveDiff(STORAGE_KEY, 'projects', projects, reason);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
  const ok = await kvPutWithRetry(STORAGE_KEY, projects);
  if (ok) {
    getPendingDeletes().filter(d => d.storeKey === STORAGE_KEY)
      .forEach(d => removePendingDelete(d.id, STORAGE_KEY));
  } else {
    _wasOffline = true;
  }
}
```

Replace it with:

```js
async function saveProjects(reason, options = {}) {
  // Strip anything tombstoned (by this browser or any other session) before persisting —
  // guards every caller against writing back a stale in-memory copy that still contains an
  // item someone else already deleted.
  const deleteIds = await getCombinedDeleteIds(STORAGE_KEY);
  // Merge against a fresh KV read so this tab's save can't silently drop projects added or
  // edited by other sessions since this tab's baseline (see 2026-08-31 design doc). Bypassed
  // for Restore from Backup (options.skipMerge), which is a deliberate full replacement, and
  // falls back to the old tombstone-strip-only behavior if the fresh read fails.
  const fresh = options.skipMerge ? null : await kvGet(STORAGE_KEY);
  if (Array.isArray(fresh)) {
    projects = mergeArrayForSave(_saveBaseline[STORAGE_KEY], fresh, projects, deleteIds, getItemDeleteKey);
  } else if (deleteIds.size) {
    const cleaned = projects.filter(p => !deleteIds.has(getItemDeleteKey(p)));
    if (cleaned.length !== projects.length) projects = cleaned;
  }
  await logSaveDiff(STORAGE_KEY, 'projects', projects, reason);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
  const ok = await kvPutWithRetry(STORAGE_KEY, projects);
  if (ok) {
    getPendingDeletes().filter(d => d.storeKey === STORAGE_KEY)
      .forEach(d => removePendingDelete(d.id, STORAGE_KEY));
    _saveBaseline[STORAGE_KEY] = JSON.parse(JSON.stringify(projects));
  } else {
    _wasOffline = true;
  }
}
```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Capture baseline in refreshProjectsAndTasksFromKv**

At `app-render.js`, inside `refreshProjectsAndTasksFromKv`, the current line 46 is:
```js
    const kvFiltered = freshProjects.filter(p => !pendingDelIds.has(getItemDeleteKey(p)));
```
Immediately AFTER that line, insert:

```js
    _saveBaseline[STORAGE_KEY] = JSON.parse(JSON.stringify(kvFiltered));
```

Capture `kvFiltered` specifically (the KV-derived, tombstone-filtered portion), NOT the later `merged` variable — `merged` also includes local-only display items this function deliberately never writes back to KV, and those must not be treated as part of the confirmed baseline.

- [ ] **Step 4: Run node --check**

Run: `node --check app-render.js`
Expected: no output (success).

- [ ] **Step 5: Bypass the merge for Restore from Backup**

At `app-render.js:933`, the current line is:
```js
      await saveProjects('restore-from-backup');
```
Replace it with:
```js
      await saveProjects('restore-from-backup', { skipMerge: true });
```

- [ ] **Step 6: Run node --check**

Run: `node --check app-render.js`
Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add app-core.js app-render.js
git commit -m "feat: merge concurrent changes into saveProjects, bypass for backup restore"
```

---

### Task 3: Rewire saveTasks

**Files:**
- Modify: `app-core.js:788-804` (replace the entire body of `saveTasks`)
- Modify: `app-render.js:63-75` (inside `refreshProjectsAndTasksFromKv`, capture baseline for tasks)
- Modify: `app-render.js:943` (Restore-from-Backup call site — add the merge bypass)

**Interfaces:**
- Consumes: `_saveBaseline`, `mergeArrayForSave` (Task 1).
- Produces: `saveTasks(reason, options = {})` — same shape as Task 2's `saveProjects`.

- [ ] **Step 1: Replace saveTasks**

The current function at `app-core.js:788-804` is:

```js
async function saveTasks(reason) {
  const deleteIds = await getCombinedDeleteIds(TASKS_KEY);
  if (deleteIds.size) {
    const cleaned = tasks.filter(t => !deleteIds.has(getItemDeleteKey(t)));
    if (cleaned.length !== tasks.length) tasks = cleaned;
  }
  await logSaveDiff(TASKS_KEY, 'tasks', tasks, reason);
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
  const ok = await kvPutWithRetry(TASKS_KEY, tasks);
  if (ok) {
    // Clear any pending deletes for tasks since KV is now up to date
    getPendingDeletes().filter(d => d.storeKey === TASKS_KEY)
      .forEach(d => removePendingDelete(d.id, TASKS_KEY));
  } else {
    _wasOffline = true;
  }
}
```

Replace it with:

```js
async function saveTasks(reason, options = {}) {
  const deleteIds = await getCombinedDeleteIds(TASKS_KEY);
  // See saveProjects for the reasoning — merge against fresh KV unless this is a deliberate
  // full replacement (Restore from Backup).
  const fresh = options.skipMerge ? null : await kvGet(TASKS_KEY);
  if (Array.isArray(fresh)) {
    tasks = mergeArrayForSave(_saveBaseline[TASKS_KEY], fresh, tasks, deleteIds, getItemDeleteKey);
  } else if (deleteIds.size) {
    const cleaned = tasks.filter(t => !deleteIds.has(getItemDeleteKey(t)));
    if (cleaned.length !== tasks.length) tasks = cleaned;
  }
  await logSaveDiff(TASKS_KEY, 'tasks', tasks, reason);
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
  const ok = await kvPutWithRetry(TASKS_KEY, tasks);
  if (ok) {
    // Clear any pending deletes for tasks since KV is now up to date
    getPendingDeletes().filter(d => d.storeKey === TASKS_KEY)
      .forEach(d => removePendingDelete(d.id, TASKS_KEY));
    _saveBaseline[TASKS_KEY] = JSON.parse(JSON.stringify(tasks));
  } else {
    _wasOffline = true;
  }
}
```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Capture baseline in refreshProjectsAndTasksFromKv**

At `app-render.js`, inside `refreshProjectsAndTasksFromKv`, the current line 66 is:
```js
    const kvFilteredTasks = freshTasks.filter(t => !pendingDelTaskIds.has(getItemDeleteKey(t)));
```
Immediately AFTER that line, insert:

```js
    _saveBaseline[TASKS_KEY] = JSON.parse(JSON.stringify(kvFilteredTasks));
```

- [ ] **Step 4: Run node --check**

Run: `node --check app-render.js`
Expected: no output (success).

- [ ] **Step 5: Bypass the merge for Restore from Backup**

At `app-render.js:943`, the current line is:
```js
      await saveTasks('restore-from-backup');
```
Replace it with:
```js
      await saveTasks('restore-from-backup', { skipMerge: true });
```

- [ ] **Step 6: Run node --check**

Run: `node --check app-render.js`
Expected: no output (success).

- [ ] **Step 7: Commit**

```bash
git add app-core.js app-render.js
git commit -m "feat: merge concurrent changes into saveTasks, bypass for backup restore"
```

---

### Task 4: Rewire saveClosedProjects (adds tombstone support)

**Files:**
- Modify: `app-core.js:812-817` (replace the entire body of `saveClosedProjects`)
- Modify: `app-render.js:1076-1077` (restore-closed-project-btn handler — capture baseline, and tombstone the removal)
- Modify: `app-modals.js:861-863` (Refresh Closed Projects button — capture baseline)
- Modify: `app-modals.js:1135-1136` (Backup & Delete handler — capture baseline)

**Interfaces:**
- Consumes: `_saveBaseline`, `mergeArrayForSave` (Task 1); `addKvTombstone` (already defined elsewhere in app-core.js, used identically to how `saveProjects`'s callers already use it for `STORAGE_KEY`/`TASKS_KEY`).
- Produces: `saveClosedProjects(reason)` now strips tombstoned items — a behavior it never had before. No other task depends on this directly, but this is a **prerequisite correctness fix**: without it, removing an item from Closed Projects (Restore to Active) has no way to tell the new merge "this was deliberately removed," and the item would incorrectly reappear after the merge. See Step 5 below.

- [ ] **Step 1: Replace saveClosedProjects**

The current function at `app-core.js:812-817` is:

```js
async function saveClosedProjects(reason) {
  await logSaveDiff(CLOSED_PROJECTS_KEY, 'closedProjects', closedProjects, reason);
  try { localStorage.setItem(CLOSED_PROJECTS_KEY, JSON.stringify(closedProjects)); } catch {}
  const ok = await kvPutWithRetry(CLOSED_PROJECTS_KEY, closedProjects);
  if (!ok) _wasOffline = true;
}
```

Replace it with:

```js
async function saveClosedProjects(reason) {
  // Closed Projects never had tombstone protection before — everything else (projects,
  // tasks, backups) already did. Without this, removing an entry (Restore to Active) has no
  // way to tell the merge below "this was deliberately removed", and it would silently
  // reappear the next time this store is saved from a tab that still has it locally.
  const deleteIds = await getCombinedDeleteIds(CLOSED_PROJECTS_KEY);
  const fresh = await kvGet(CLOSED_PROJECTS_KEY);
  if (Array.isArray(fresh)) {
    closedProjects = mergeArrayForSave(_saveBaseline[CLOSED_PROJECTS_KEY], fresh, closedProjects, deleteIds, getItemDeleteKey);
  } else if (deleteIds.size) {
    const cleaned = closedProjects.filter(p => !deleteIds.has(getItemDeleteKey(p)));
    if (cleaned.length !== closedProjects.length) closedProjects = cleaned;
  }
  await logSaveDiff(CLOSED_PROJECTS_KEY, 'closedProjects', closedProjects, reason);
  try { localStorage.setItem(CLOSED_PROJECTS_KEY, JSON.stringify(closedProjects)); } catch {}
  const ok = await kvPutWithRetry(CLOSED_PROJECTS_KEY, closedProjects);
  if (ok) {
    _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(closedProjects));
  } else {
    _wasOffline = true;
  }
}
```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Capture baseline and tombstone the removal in restore-closed-project-btn**

At `app-render.js:1072-1089`, the current handler is:

```js
  el.querySelectorAll('.restore-closed-project-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jira = btn.dataset.jira;
      // Refresh from KV right before mutating — same reasoning as backupAndDeleteProjectBtn.
      const freshClosed = await kvGet(CLOSED_PROJECTS_KEY);
      if (Array.isArray(freshClosed)) closedProjects = freshClosed;
      const idx = closedProjects.findIndex(p => (p.jira || '') === jira);
      if (idx < 0) return;
      const [restored] = closedProjects.splice(idx, 1);
      delete restored.closedAt;
      removePendingDelete(jira, STORAGE_KEY);
      await removeKvTombstone(jira, STORAGE_KEY);
      projects.push(restored);
      await saveClosedProjects('restore-to-active');
      await saveProjects('restore-from-closed');
      renderClosedProjectsPanel();
      renderAll();
      showToast(`${restored.name} restored to active projects.`, 'success');
```

Replace the `if (Array.isArray(freshClosed)) closedProjects = freshClosed;` line with:

```js
      if (Array.isArray(freshClosed)) {
        closedProjects = freshClosed;
        _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(freshClosed));
      }
```

And add a new line immediately after `const [restored] = closedProjects.splice(idx, 1);`:

```js
      if (jira) await addKvTombstone(jira, CLOSED_PROJECTS_KEY);
```

- [ ] **Step 4: Run node --check**

Run: `node --check app-render.js`
Expected: no output (success).

- [ ] **Step 5: Capture baseline in the Refresh Closed Projects button**

At `app-modals.js:856-871`, the current handler is:

```js
refreshClosedProjectsBtn.addEventListener('click', async () => {
  const orig = refreshClosedProjectsBtn.textContent;
  refreshClosedProjectsBtn.textContent = '↻ Syncing...';
  refreshClosedProjectsBtn.disabled = true;
  try {
    const fresh = await kvGet(CLOSED_PROJECTS_KEY);
    if (fresh) {
      closedProjects = fresh;
      try { localStorage.setItem(CLOSED_PROJECTS_KEY, JSON.stringify(closedProjects)); } catch {}
    }
    renderClosedProjectsPanel();
  } finally {
    refreshClosedProjectsBtn.textContent = orig;
    refreshClosedProjectsBtn.disabled = false;
  }
});
```

Replace the `if (fresh) { ... }` block with:

```js
    if (fresh) {
      closedProjects = fresh;
      _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(fresh));
      try { localStorage.setItem(CLOSED_PROJECTS_KEY, JSON.stringify(closedProjects)); } catch {}
    }
```

- [ ] **Step 6: Capture baseline in the Backup & Delete handler**

At `app-modals.js:1132-1136`, the current lines are:

```js
    // Refresh from KV right before mutating — a long-lived tab's in-memory copy can be
    // stale (missing closures added by other sessions since page load), and saving it
    // wholesale would silently wipe those out.
    const freshClosed = await kvGet(CLOSED_PROJECTS_KEY);
    if (Array.isArray(freshClosed)) closedProjects = freshClosed;
```

Replace the `if (Array.isArray(freshClosed)) closedProjects = freshClosed;` line with:

```js
    if (Array.isArray(freshClosed)) {
      closedProjects = freshClosed;
      _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(freshClosed));
    }
```

- [ ] **Step 7: Run node --check**

Run: `node --check app-modals.js`
Expected: no output (success).

- [ ] **Step 8: Commit**

```bash
git add app-core.js app-render.js app-modals.js
git commit -m "feat: merge concurrent changes into saveClosedProjects, add tombstone support"
```

---

### Task 5: Rewire saveBackups

**Files:**
- Modify: `app-core.js:974-986` (replace the entire body of `saveBackups`)

**Interfaces:**
- Consumes: `_saveBaseline`, `mergeArrayForSave` (Task 1).
- Produces: nothing consumed by later tasks — `saveBackups` takes no `options` parameter since nothing in this app currently needs to bypass its merge (no "restore a backup of backups" flow exists).

- [ ] **Step 1: Replace saveBackups**

The current function at `app-core.js:974-986` is (confirm the exact end of the function by reading the file — it ends with the closing brace after the `if (!ok) { ... }` block):

```js
async function saveBackups(reason) {
  const deleteIds = await getCombinedDeleteIds(BACKUPS_KEY);
  if (deleteIds.size) {
    const cleaned = backups.filter(b => !deleteIds.has(getItemDeleteKey(b)));
    if (cleaned.length !== backups.length) backups = cleaned;
  }
  await logSaveDiff(BACKUPS_KEY, 'backups', backups, reason);
  try { localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups)); } catch {}
  const ok = await kvPutWithRetry(BACKUPS_KEY, backups);
  if (!ok) {
    _wasOffline = true;
  }
}
```

Replace it with:

```js
async function saveBackups(reason) {
  const deleteIds = await getCombinedDeleteIds(BACKUPS_KEY);
  const fresh = await kvGet(BACKUPS_KEY);
  if (Array.isArray(fresh)) {
    backups = mergeArrayForSave(_saveBaseline[BACKUPS_KEY], fresh, backups, deleteIds, getItemDeleteKey);
  } else if (deleteIds.size) {
    const cleaned = backups.filter(b => !deleteIds.has(getItemDeleteKey(b)));
    if (cleaned.length !== backups.length) backups = cleaned;
  }
  await logSaveDiff(BACKUPS_KEY, 'backups', backups, reason);
  try { localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups)); } catch {}
  const ok = await kvPutWithRetry(BACKUPS_KEY, backups);
  if (ok) {
    _saveBaseline[BACKUPS_KEY] = JSON.parse(JSON.stringify(backups));
  } else {
    _wasOffline = true;
  }
}
```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add app-core.js
git commit -m "feat: merge concurrent changes into saveBackups"
```

---

### Task 6: Version bump, changelog, and deploy

**Files:**
- Modify: `app-core.js` (the `APP_VERSION` constant and `CHANGELOG` array — same location touched by every version bump this session)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by other tasks — final, deploy-facing task.

- [ ] **Step 1: Bump the version and add a changelog entry**

Increment `APP_VERSION` by one patch version from whatever it currently is, and add a new entry at the TOP of `CHANGELOG` (newest-first, matching every existing entry):

```js
{
  version: '<next>',
  date: '<today's date, YYYY-MM-DD>',
  features: [
    'Fix: a stale browser tab saving any change (even a single unrelated edit or delete) could silently wipe out projects, tasks, closed-project entries, or backups added or edited by other people in the meantime — confirmed real incidents where dozens of projects vanished from PMs\' lists after someone else made one small edit elsewhere. Every save now merges against the current shared state instead of overwriting it wholesale, so only what you actually changed is what gets applied — nothing you never touched can be dropped by your save.',
  ]
},
```

- [ ] **Step 2: Run node --check on every touched file**

Run: `node --check app-core.js && node --check app-render.js && node --check app-modals.js`
Expected: no output (success) for all three.

- [ ] **Step 3: Commit**

```bash
git add app-core.js
git commit -m "chore: bump version for concurrent-save merge fix"
```

- [ ] **Step 4: Deploy**

Follow this project's established deploy process (K-Vibe deploy memory / this session's precedent): copy `index.html`, `app-core.js`, `app-render.js`, `app-modals.js`, `styles.css`, `favicon.png`, `favicon1.png`, `activity-log.html`, `activity-log.js` into a clean temp staging directory, then `deploy_from_directory` targeting the `project-manager-dashboard` app. `proxy-worker.js` is untouched by this fix and does not need redeploying.

- [ ] **Step 5: Confirm the version number shown in the running app**

Open the deployed app, confirm the footer/about version label shows the new version number bumped in Step 1.

---

### Task 7: Manual verification

This task has no code changes — it is a checklist to run, live, after Task 6's deploy. No subagent can execute this (it requires two real browser sessions); it's the controller/human's task.

- [ ] **Step 1: Cross-session addition survives an unrelated save**

In Tab A, load the dashboard (this captures Tab A's baseline). In Tab B, import or add a brand-new test project and let it save. Back in Tab A (which never refreshed, so its baseline predates Tab B's addition), edit an unrelated project's field (e.g. change its region) and save. Confirm: after Tab A's save, the project Tab B added is STILL present (check via a fresh reload, or Tab B's own view).

- [ ] **Step 2: Cross-session deletion survives an unrelated save**

In Tab A, load the dashboard. In Tab B, delete a test project (Backup & Delete or Manual delete). Back in Tab A (stale, still shows the deleted project in memory), edit a different, unrelated project and save. Confirm: after Tab A's save, the deleted project stays deleted (does not reappear), and Tab A's unrelated edit is present.

- [ ] **Step 3: Restore from Backup still fully replaces**

Create a backup, then add a new test project after the backup was taken. Restore that backup. Confirm the newly-added test project (not in the backup) is now gone — Restore from Backup still means "reset to exactly this snapshot," per the explicit design decision to bypass the merge for this one action.

- [ ] **Step 4: Closed Projects — restore to active, then repeat the cross-session check**

Close a test project (moves it to Closed Projects), then Restore it to Active from the Closed Projects panel. Confirm it's back in active projects and gone from Closed Projects. Then, in Tab A (stale, still shows it in Closed Projects), save an unrelated edit — confirm the restored item does NOT reappear in Closed Projects (this specifically tests the new tombstone support added in Task 4).

- [ ] **Step 5: Single-tab sanity pass**

With just one tab/session, do one ordinary add, edit, and delete cycle for each of: projects, tasks, backups. Confirm everything behaves exactly as before — no regression to normal, non-concurrent usage.

- [ ] **Step 6: Activity Log reflects only real changes**

After Steps 1-2 above, check the Activity Log. Confirm neither of those two saves produced a log entry listing unrelated projects as added/removed — only the genuine, intentional change in each case.
