# Concurrent-Save Merge Fix — Design

## Context

`saveProjects`, `saveTasks`, `saveClosedProjects`, and `saveBackups` in app-core.js each take whatever array is currently sitting in that browser tab's memory and write it wholesale over the corresponding KV blob. There is no check for what the *current* KV state actually contains — only a tombstone strip for deliberately-deleted items. If a tab has been open a while without refreshing, its in-memory array is stale, and any save from that tab silently overwrites anything added or edited by other sessions in the meantime, since the whole array is replaced, not merged.

Confirmed real incidents:
- **2026-08-20:** Gaurav Sharma clicked "Backup & delete" on exactly one project (Federation, PSVAMB-143953). The Activity Log recorded `107 → 86` and listed ~20 unrelated projects as "removed" — projects nobody touched. Several PMs subsequently found most of their assigned projects missing (one went from 17 down to 3) and had to be manually re-added.
- **2026-08-23:** Arik Perera made one PM reassignment (Lund University, Hadar Blonskey → Greg Cohen). The log recorded `110 → 106` with a dozen+ unrelated projects both added and removed in the same entry.

Root cause: both tabs' in-memory arrays were stale relative to the real KV state at save time (missing projects added by others, still containing projects deleted by others), and the whole-array overwrite baked that staleness into the shared data permanently.

This is a different, more fundamental bug than the tombstone-race (fixed 2026-08-09) and KV-edge-caching (fixed 2026-08-11) issues — those protected against a deleted item resurfacing, or a read being briefly stale for logging purposes. Neither protects against a stale tab's *whole-array save* silently dropping *additions* made by anyone else since that tab last synced.

## Approach

Client-side 3-way merge on every save, using a per-store baseline snapshot to detect what the current tab actually changed, layered onto a genuinely fresh read of KV at save time. No server-side changes.

Rejected alternatives:
- **Explicit per-call-site operations** (each save call states its intent — "I added X", "I deleted Y" — instead of diffing against a baseline) would be more precise but requires touching every one of the ~15 distinct call sites across app-render.js/app-modals.js, a much larger and riskier surface than touching just the four save functions.
- **Server-side optimistic locking** (version numbers, rejected writes, client retry loop) is the "textbook" distributed-systems answer but adds proxy-worker.js changes and retry-loop UX for a scale of concurrent use (a handful of PMs, occasional overlap) that doesn't need it.

## Baseline tracking

Two tracking mechanisms exist side by side, kept deliberately separate so this fix cannot reintroduce the Aug 9-11 logging bug:

- `_lastKnownKvState` (existing, 90-second cap) — **unchanged**, still used only by `logSaveDiff`'s before/after comparison for the Activity Log.
- **New:** `_saveBaseline`, a plain object keyed by storeKey (`STORAGE_KEY`, `TASKS_KEY`, `CLOSED_PROJECTS_KEY`, `BACKUPS_KEY`), holding a deep-clone snapshot of that store's array. No expiry — lives for the session. Captured/updated at every point where that array is assigned a genuinely fresh value from KV:
  - Initial page load's fetch of each store.
  - `refreshProjectsAndTasksFromKv()` (covers projects + tasks).
  - The periodic poll cycle, and the "Refresh Dashboard" button.
  - The existing inline "refresh right before mutating" reads already present in the Restore-from-Closed, Restore-from-Backup, and Backup&Delete handlers (e.g. `const freshClosed = await kvGet(CLOSED_PROJECTS_KEY); if (Array.isArray(freshClosed)) closedProjects = freshClosed;`).
  - Immediately after every successful `kvPut` inside the four save functions themselves, set to the just-written (merged) result — so the *next* save's diff is computed against the most recently confirmed truth, not the pre-save state.

## Merge algorithm

On every save, for that store:
1. `deleteIds = await getCombinedDeleteIds(storeKey)` — existing tombstone mechanism, unchanged.
2. `fresh = await kvGet(storeKey)` — a genuine network read at save time, not served from any cache (correctness matters more than the extra round-trip here).
3. `baseline = _saveBaseline[storeKey]` (may be absent — see Fallbacks).
4. Build the result starting as a copy of `fresh`, keyed by `getItemDeleteKey`.
5. For every item in the tab's local in-memory array: if it's tombstoned, skip it entirely. Otherwise, compare it to its baseline counterpart (by key). If it's new (no baseline counterpart) or its serialized value differs from baseline, this tab's version wins — write it into the result, replacing whatever `fresh` had for that key (or adding it, if new). If it's unchanged from baseline, leave the result exactly as `fresh` already has it — the tab didn't touch this item, so it shouldn't override anything anyone else did to it.
6. Remove anything in `deleteIds` from the result as a final safety net.
7. The result becomes the array that gets `kvPut`.

Traced against both real incidents (see Context) — both are fully prevented: in Gaurav's case, every project his stale tab never knew about survives because it comes from `fresh`, never touched by his diff (his only actual change vs. his baseline is Federation being gone). In Arik's case, projects added or removed by others after his baseline stay exactly as `fresh` has them; only his one genuine edit (Lund University's PM field) gets layered on top.

## Known, accepted limitation

Two different people editing *different fields of the same project* at nearly the same moment can still have one overwrite the other for that one item — this is a whole-item merge, not a field-level one. This fix targets and fully solves the confirmed bug (different projects clobbered across sessions); true same-item concurrent editing by two people at once remains a rare, unaddressed edge case, no worse than today's behavior.

## Fallbacks

- No baseline yet for this store this session (e.g., first save before any refresh happened), or the fresh KV read fails (network error): fall back to exactly today's behavior — strip tombstoned items from the local array, write it as-is. Not an improvement in that rare case, but not a regression either, and saves aren't blocked entirely on a transient failure.

## Files touched

`app-core.js` — the four save functions and the new shared merge helper/baseline map. Also `app-render.js` and `app-modals.js`: several of the "fresh read at refresh time" locations that update the baseline live there (`refreshProjectsAndTasksFromKv`, the Restore-from-Backup handler, the Refresh Closed Projects button, the Backup & Delete handler), and Closed Projects' new tombstone support has to be added at the exact point an item is removed (Restore to Active), which is also in `app-render.js`. No HTML, no CSS, no proxy-worker.js changes.

## Verification

No automated test framework exists in this app. Verification is manual:
1. Two-tab scenario: Tab A adds a project and saves; Tab B (opened earlier, stale relative to Tab A's addition) edits an unrelated project and saves. Confirm both the addition and the unrelated edit survive.
2. Two-tab scenario: Tab A deletes a project; Tab B (stale) edits an unrelated project. Confirm the deletion sticks (not resurrected by Tab B's save) and the unrelated edit lands, with nothing else dropped.
3. Single-tab sanity pass across all four stores (one add/edit/delete cycle each) to confirm no regression to ordinary usage.
4. Confirm the Activity Log's added/removed/edited listings now reflect only genuine intentional changes — no more mass phantom entries.

Scenarios 1-2 need a real second browser tab/session to reproduce properly; the definitive confirmation is you reproducing them live, not simulated verification alone.
