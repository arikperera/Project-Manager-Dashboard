# Field-Level Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop one save from silently reverting a field on an unrelated item's stale local copy, by making `mergeArrayForSave` merge field-by-field instead of whole-item, and make `logSaveDiff` log field-level changes for every save reason instead of only `edit-save`.

**Architecture:** Two isolated function rewrites in `app-core.js` — `mergeArrayForSave` (the shared merge helper used by all four save functions) and `logSaveDiff` (the shared activity-log diff helper). Neither the four `save*` functions nor any other file needs to change; both already call these two functions with the same signatures.

**Tech Stack:** Vanilla JS, no build step, no test framework — verification is `node --check` plus manual browser testing.

**Spec:** `docs/superpowers/specs/2026-09-03-field-level-merge-design.md`

## Global Constraints

- Only `app-core.js` is touched. No changes to `app-render.js`, `app-modals.js`, `index.html`, `styles.css`, or `proxy-worker.js`.
- Field comparison is generic (iterate over the union of an item's own keys), not a fixed list — anything added to the schema later is automatically covered.
- `statusText`/`pmNotes` are compared through `normalizeHtmlForCompare` (already defined at `app-core.js:754`), not raw string equality, in both the merge and the logging — otherwise browser HTML re-serialization noise makes them look "changed" on every save.
- Same-field, same-item conflicts: whichever save's merge completes last simply wins for that field — no special-case code, no smarter resolution.
- `logSaveDiff`'s field-level diffing must run for every save reason, not just `edit-save`. Fields not in `EDIT_TRACKED_FIELDS` still get logged, using their raw field name as the label. `statusUpdatedAt`, `jira`, and `id` are excluded from generic field logging (bookkeeping/key fields, not meaningful to show as a "change").

---

### Task 1: Field-level merge in mergeArrayForSave

**Files:**
- Modify: `app-core.js:893-911` (replace the doc comment and body of `mergeArrayForSave`; add a new small helper immediately before it)

**Interfaces:**
- Consumes: `normalizeHtmlForCompare(html)` (already defined at `app-core.js:754`, unchanged).
- Produces: `mergeArrayForSave(baseline, fresh, local, deleteIds, getKey)` — same name, same parameters, same return type (an array) as before. All four call sites (`saveProjects`, `saveTasks`, `saveClosedProjects`, `saveBackups`) already call it with this exact signature and need no changes.

- [ ] **Step 1: Add an isHtmlField helper**

At `app-core.js:893`, immediately BEFORE the line `// Merges this tab's in-memory array against the current KV truth. ...` (the doc comment directly above `function mergeArrayForSave`), insert:

```js
// statusText/pmNotes are rich HTML that gets re-read from an editor's innerHTML on every
// save regardless of whether the user touched that specific field — the browser's
// serialization isn't guaranteed byte-identical to what was originally stored (whitespace,
// attribute order), so these two fields need HTML-normalized comparison everywhere they're
// diffed, not raw string equality. See normalizeHtmlForCompare above.
function isHtmlField(field) {
  return field === 'statusText' || field === 'pmNotes';
}

```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Replace mergeArrayForSave's doc comment and body**

The current doc comment and function (`app-core.js:893-911`, after Step 1's insertion these lines will have shifted down by 9 — find them by their exact text, not the line numbers) are:

```js
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

Replace it with:

```js
// Merges this tab's in-memory array against the current KV truth, field by field — not
// whole-item. `baseline` is this tab's last confirmed snapshot; `fresh` is a KV read taken
// moments ago at save time; `local` is the tab's current in-memory array. For an item this
// tab never touched at all (identical to its own baseline), fresh's version is left exactly
// as is. For an item this tab DID change something about, only the specific fields that
// differ from this tab's OWN baseline get overlaid onto fresh's version — every other field
// keeps whatever fresh already has. This is what stops a stale local copy of an unrelated
// field (e.g. an AT Link someone else just added) from being silently carried backward just
// because this tab happened to save something else about that same item. New items (no
// baseline counterpart) use the tab's full version, same as before. Tombstoned items are
// excluded either way. `getKey` is the same key function every store already uses
// (getItemDeleteKey). See docs/superpowers/specs/2026-09-03-field-level-merge-design.md.
function mergeArrayForSave(baseline, fresh, local, deleteIds, getKey) {
  const baselineMap = new Map((baseline || []).map(item => [getKey(item), item]));
  const result = new Map(fresh.map(item => [getKey(item), item]));

  for (const item of local) {
    const key = getKey(item);
    if (!key || deleteIds.has(key)) continue;
    const baselineItem = baselineMap.get(key);
    if (!baselineItem) {
      // New to this tab (no baseline counterpart) — use the full local version, as before.
      result.set(key, item);
      continue;
    }
    if (JSON.stringify(baselineItem) === JSON.stringify(item)) {
      // This tab never touched this item — leave fresh's version exactly as it is.
      continue;
    }
    const freshItem = result.get(key);
    if (!freshItem) {
      // In this tab's baseline but gone from fresh — deleted by another session since this
      // tab's baseline. Respect that; don't resurrect it just because this tab's stale copy
      // still has it.
      continue;
    }
    // This tab changed something about this item. Merge field by field: start from fresh's
    // version, then overlay only the fields where local differs from THIS TAB'S OWN
    // baseline — not the whole item.
    const merged = { ...freshItem };
    const fieldNames = new Set([...Object.keys(baselineItem), ...Object.keys(item)]);
    for (const field of fieldNames) {
      const beforeVal = isHtmlField(field) ? normalizeHtmlForCompare(baselineItem[field]) : baselineItem[field];
      const localVal = isHtmlField(field) ? normalizeHtmlForCompare(item[field]) : item[field];
      if (beforeVal !== localVal) merged[field] = item[field];
    }
    result.set(key, merged);
  }

  for (const key of deleteIds) result.delete(key);

  return [...result.values()];
}
```

- [ ] **Step 4: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add app-core.js
git commit -m "feat: merge concurrent saves field-by-field instead of whole-item"
```

---

### Task 2: Generic field-level logging in logSaveDiff

**Files:**
- Modify: `app-core.js:760-813` (replace the doc comment and body of `logSaveDiff`; add a new constant immediately before it)

**Interfaces:**
- Consumes: `EDIT_TRACKED_FIELDS` (already defined at `app-core.js:738`, unchanged — still used as a label lookup, just no longer the exclusive list of fields that get logged), `normalizeHtmlForCompare` (unchanged), `getItemDeleteKey`, `logActivity` (unchanged).
- Produces: `logSaveDiff(storeKey, storeLabel, afterArray, reason)` — same name, same parameters, same behavior for callers (all four `save*` functions already call it identically and need no changes). The only observable difference is that `edited` is now populated for every reason, not just `edit-save`.

- [ ] **Step 1: Add the field exclusion set**

At `app-core.js:760`, immediately BEFORE the line `// Compares the KV state right before a save against what's about to be written, and logs` (the doc comment directly above `async function logSaveDiff`), insert:

```js
// Fields excluded from generic field-level change logging: statusUpdatedAt is bookkeeping,
// not a meaningful change to show; jira/id are each item's own key and can't meaningfully
// "change" for an existing logged item; statusText/pmNotes are handled separately below
// (shown as "(updated)", not a raw value diff — logging the full HTML would be unreadable).
const LOG_EXCLUDED_FIELDS = new Set(['statusUpdatedAt', 'jira', 'id', 'statusText', 'pmNotes']);

```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Replace logSaveDiff's doc comment and body**

The current doc comment and function (`app-core.js:760-813`, after Step 1's insertion these lines will have shifted down by 6 — find them by their exact text, not the line numbers) are:

```js
// Compares the KV state right before a save against what's about to be written, and logs
// added/removed items, plus (for manual edits only) which fields changed on items that were
// neither added nor removed — otherwise a pure field edit like a PM reassignment produces no
// diff in the added/removed sets and silently logs nothing at all.
async function logSaveDiff(storeKey, storeLabel, afterArray, reason) {
  try {
    const cached = _lastKnownKvState[storeKey];
    const beforeArray = (cached && Date.now() - cached.ts < _KV_CACHE_MAX_AGE_MS) ? cached.value : await kvGet(storeKey);
    if (!Array.isArray(beforeArray)) return;
    const beforeKeys = new Set(beforeArray.map(getItemDeleteKey).filter(Boolean));
    const afterKeys = new Set(afterArray.map(getItemDeleteKey).filter(Boolean));
    const added = afterArray.filter(item => { const k = getItemDeleteKey(item); return k && !beforeKeys.has(k); });
    const removed = beforeArray.filter(item => { const k = getItemDeleteKey(item); return k && !afterKeys.has(k); });

    let edited = [];
    if (reason === 'edit-save') {
      const beforeByKey = new Map(beforeArray.map(item => [getItemDeleteKey(item), item]));
      edited = afterArray.map(after => {
        const key = getItemDeleteKey(after);
        const before = key ? beforeByKey.get(key) : null;
        if (!before) return null;
        const changes = [];
        for (const [field, label] of Object.entries(EDIT_TRACKED_FIELDS)) {
          const beforeVal = before[field] ?? '';
          const afterVal = after[field] ?? '';
          if (beforeVal !== afterVal) changes.push({ field: label, from: beforeVal || '(empty)', to: afterVal || '(empty)' });
        }
        // Compare through the same HTML round-trip on both sides — statusText/pmNotes get
        // re-read from the editor's innerHTML on every save regardless of whether the user
        // touched that specific field, and the browser's serialization isn't guaranteed to
        // come back byte-identical to what was originally stored (whitespace, attribute
        // order, etc.), which was falsely flagging untouched fields as "updated".
        if (normalizeHtmlForCompare(before.statusText) !== normalizeHtmlForCompare(after.statusText)) {
          changes.push({ field: 'Project Status', from: '', to: '(updated)', content: after.statusText || '' });
        }
        if (normalizeHtmlForCompare(before.pmNotes) !== normalizeHtmlForCompare(after.pmNotes)) {
          changes.push({ field: 'PM Personal Notes', from: '', to: '(updated)', content: after.pmNotes || '' });
        }
        if (!changes.length) return null;
        return { customer: after.customer, name: after.name || after.parentProjectName || after.label, jira: after.jira, changes };
      }).filter(Boolean);
    }

    if (!added.length && !removed.length && !edited.length) return;
    await logActivity({
      store: storeLabel,
      reason: reason || 'unknown',
      beforeCount: beforeArray.length,
      afterCount: afterArray.length,
      added: added.map(item => ({ customer: item.customer, name: item.name || item.parentProjectName || item.label, jira: item.jira })),
      removed: removed.map(item => ({ customer: item.customer, name: item.name || item.parentProjectName || item.label, jira: item.jira })),
      edited,
    });
  } catch {}
}
```

Replace it with:

```js
// Compares the KV state right before a save against what's about to be written, and logs
// added/removed items, plus which fields changed on items that were neither added nor
// removed — for EVERY save reason, not just manual edits, so a background sync silently
// reverting a field (via a stale whole-array snapshot) leaves a visible trace instead of
// none. Field comparison is generic (every own field on the item), not a fixed list, so
// anything added to the schema later is automatically covered.
async function logSaveDiff(storeKey, storeLabel, afterArray, reason) {
  try {
    const cached = _lastKnownKvState[storeKey];
    const beforeArray = (cached && Date.now() - cached.ts < _KV_CACHE_MAX_AGE_MS) ? cached.value : await kvGet(storeKey);
    if (!Array.isArray(beforeArray)) return;
    const beforeKeys = new Set(beforeArray.map(getItemDeleteKey).filter(Boolean));
    const afterKeys = new Set(afterArray.map(getItemDeleteKey).filter(Boolean));
    const added = afterArray.filter(item => { const k = getItemDeleteKey(item); return k && !beforeKeys.has(k); });
    const removed = beforeArray.filter(item => { const k = getItemDeleteKey(item); return k && !afterKeys.has(k); });

    const beforeByKey = new Map(beforeArray.map(item => [getItemDeleteKey(item), item]));
    const edited = afterArray.map(after => {
      const key = getItemDeleteKey(after);
      const before = key ? beforeByKey.get(key) : null;
      if (!before) return null;
      const changes = [];
      const fieldNames = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const field of fieldNames) {
        if (LOG_EXCLUDED_FIELDS.has(field)) continue;
        const beforeVal = before[field] ?? '';
        const afterVal = after[field] ?? '';
        if (beforeVal !== afterVal) {
          const label = EDIT_TRACKED_FIELDS[field] || field;
          changes.push({ field: label, from: beforeVal || '(empty)', to: afterVal || '(empty)' });
        }
      }
      // statusText/pmNotes are shown as "(updated)", not a raw value diff — the full HTML
      // would be unreadable in the log. Compared through the same HTML round-trip on both
      // sides — see isHtmlField's comment above mergeArrayForSave for why raw string
      // equality falsely flags untouched fields as "updated".
      if (normalizeHtmlForCompare(before.statusText) !== normalizeHtmlForCompare(after.statusText)) {
        changes.push({ field: 'Project Status', from: '', to: '(updated)', content: after.statusText || '' });
      }
      if (normalizeHtmlForCompare(before.pmNotes) !== normalizeHtmlForCompare(after.pmNotes)) {
        changes.push({ field: 'PM Personal Notes', from: '', to: '(updated)', content: after.pmNotes || '' });
      }
      if (!changes.length) return null;
      return { customer: after.customer, name: after.name || after.parentProjectName || after.label, jira: after.jira, changes };
    }).filter(Boolean);

    if (!added.length && !removed.length && !edited.length) return;
    await logActivity({
      store: storeLabel,
      reason: reason || 'unknown',
      beforeCount: beforeArray.length,
      afterCount: afterArray.length,
      added: added.map(item => ({ customer: item.customer, name: item.name || item.parentProjectName || item.label, jira: item.jira })),
      removed: removed.map(item => ({ customer: item.customer, name: item.name || item.parentProjectName || item.label, jira: item.jira })),
      edited,
    });
  } catch {}
}
```

- [ ] **Step 4: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add app-core.js
git commit -m "feat: log field-level changes for every save reason, not just edit-save"
```

---

### Task 3: Version bump, changelog, and deploy

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
    'Fix: a save could silently revert a field on an unrelated project if that project\'s local copy in the saving tab was stale — e.g. a background Jira sync noticing a change on one project could carry along an old, empty value for a completely different project\'s AT Link, wiping out a colleague\'s real edit with no trace. Saves now merge field-by-field instead of whole-item, so only what a tab actually changed can ever overwrite what\'s already there. The Activity Log also now shows field-level changes for every kind of save, not just manual edits, so this class of issue is visible if it ever happens again.',
  ]
},
```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add app-core.js
git commit -m "chore: bump version for field-level merge fix"
```

- [ ] **Step 4: Deploy**

Follow this project's established deploy process: copy `index.html`, `app-core.js`, `app-render.js`, `app-modals.js`, `styles.css`, `favicon.png`, `favicon1.png`, `activity-log.html`, `activity-log.js` into a clean temp staging directory, then `deploy_from_directory` targeting the `project-manager-dashboard` app. `proxy-worker.js` is untouched by this fix and does not need redeploying.

- [ ] **Step 5: Confirm the version number shown in the running app**

Open the deployed app, confirm the footer/about version label shows the new version number bumped in Step 1.

---

### Task 4: Manual verification

This task has no code changes — it is a checklist to run, live, after Task 3's deploy. No subagent can execute this (it requires two real browser sessions to reproduce the actual mechanism); it's the controller/human's task.

- [ ] **Step 1: The realistic scenario — unrelated stale copy can no longer clobber a real change**

In Tab A, load the dashboard (captures its baseline). In Tab B, add or change an untracked-by-name field (e.g. AT Link) on Project X, and save. Back in Tab A (which never touched Project X, so its local copy of it is now stale), edit and save a *completely different* Project Y. Confirm afterward that Project X's field survives — check by reloading Tab A or checking Tab B's own view.

- [ ] **Step 2: Activity Log now shows field-level detail for non-edit-save reasons**

Trigger a save with a reason other than `edit-save` that changes a field — e.g. click "Refresh Dashboard" shortly after a Jira-side field change lands (progress%, health, etc. via `jira-progress-sync`, or a description change via `jira-status-sync`). Confirm the resulting Activity Log entry shows which field changed (not just a bare count with no detail).

- [ ] **Step 3: Single-tab sanity pass**

With one tab, edit a project via the Edit modal, changing both an already-tracked field (e.g. Health) and an untracked one (e.g. AT Link) in the same save. Confirm both show up correctly in the Activity Log, and confirm the save behaves exactly as before — no regression to ordinary single-tab editing.

- [ ] **Step 4: Closed Projects / Backups sanity pass**

Close a project (Backup & Delete) and restore it. Create a backup and delete it. Confirm both flows still work exactly as before — the field-level merge change applies to `saveClosedProjects`/`saveBackups` too (via the same shared `mergeArrayForSave`), so worth a quick confirmation there's no regression even though these stores are less exposed to the concurrent-edit scenario in practice.
