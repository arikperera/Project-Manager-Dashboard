# Field-Level Merge and Generic Change Logging — Design

## Context

Yesterday's concurrent-save merge fix (`mergeArrayForSave`, spec `2026-08-31-concurrent-save-merge-design.md`) stopped a stale tab's save from wholesale-overwriting the shared projects/tasks/closedProjects/backups arrays — but it merges at the *whole-item* level: if a tab's local copy of an item differs from that tab's own baseline at all, the tab's entire version of that item wins, including every field the tab never touched.

Confirmed real incident: a PM added an "AT Link" (Airtable URL) to project PSVAMB-147054 via the Edit modal. The value was correctly saved and logged. Sometime later, it reverted to empty, with zero trace in the Activity Log.

**The actual mechanism does not require two people editing the same project** — that scenario is close to zero probability in this team's real workflow (each project has one PM; multiple people rarely touch the same one). The real trigger: every browser tab holds the *entire* shared list of ~105+ projects, not just the fields or projects that tab's user cares about. If Tab A's stale, whole-item copy of Project X (missing a field someone else just added) ends up carried through as part of Tab A saving something *completely unrelated* — its own edit to Project Y, or a background Jira sync noticing a change on Project Z — Project X's real, recent change gets silently clobbered as a side effect. No two people need to touch the same project; it just needs many people saving many different things in a short window, which is exactly what happens on the team's weekly "update day" (Thursdays) — the day this was actually noticed.

A second, compounding gap: `logSaveDiff`'s field-level change detail is only computed when `reason === 'edit-save'`. Every other save reason (`jira-progress-sync`, `jira-status-sync`, `reconnect-sync`) skips it entirely — so if a background sync is what reverted the field, there is no way to ever see it happen, even in principle.

## Approach

Two changes, both confined to `app-core.js`:

1. **Field-level merging** — `mergeArrayForSave` compares fields individually instead of whole items. For an item present in baseline, fresh, and local: start from `fresh`'s version, then overlay only the specific fields where `local` differs from *its own* baseline. Fields neither side touched keep whatever `fresh` has. New items and tombstoned deletions behave exactly as before — only the "item exists in all three, something about it differs" case changes.
2. **Generic field-level logging** — remove `logSaveDiff`'s `reason === 'edit-save'` gate so field-level diffing runs for every save reason. If this class of bug ever resurfaces, there will be a visible log entry showing exactly which field changed and under which reason, instead of silence.

Both changes apply uniformly to all four stores (projects, tasks, closedProjects, backups) via the same shared functions — no reason to special-case projects/tasks only, and it costs nothing extra.

## Field-level merge algorithm

For each item present in `local`:
- **No baseline counterpart** (this tab added it): use `local`'s full version, as today.
- **In baseline, but missing from `fresh`** (properly deleted by another session since this tab's baseline): stays absent — never resurrected just because this tab's stale copy still has it. (This is distinct from the tombstone check, which covers *this* tab's own deliberate deletions; this covers a *different* session's deletion that this tab's baseline simply hasn't caught up to yet.)
- **Present in all three:** build the merged result starting from `fresh`'s object. For every field on the item (comparing the union of baseline's and local's own keys — generic, not a fixed list, so anything added later is automatically covered), if `local`'s value for that field differs from *baseline's* value for that field, the merged result uses `local`'s value for that one field. Every other field keeps whatever `fresh` already had.

One necessary refinement: `statusText` and `pmNotes` (rich HTML) are compared through the same HTML-normalization already used by the existing logging code (`normalizeHtmlForCompare`), not raw string equality — otherwise browser re-serialization noise would make them look "changed" on every single save regardless of whether the user touched them, and that false positive would make them spuriously win over a genuinely newer value from someone else.

**Same-field, same-project edge case:** if the *same* field of the *same* item is genuinely touched by two different saves close together, whichever save's merge completes last wins for that one field — no special handling needed, no smarter conflict resolution. Confirmed acceptable: this case is rarer than the "different project" case this fix targets, and not worth extra complexity.

Traced against the AT Link incident: whichever save carried a stale copy of PSVAMB-147054 would, for the `atLink` field specifically, find its own local value identical to its own baseline (since that save never touched AT Link) — so it would leave `fresh`'s value (the real AT Link) untouched. This class of bug becomes structurally impossible once merging is per-field.

## Logging changes

`logSaveDiff`'s field-diff computation currently only runs `if (reason === 'edit-save')`. That gate is removed — the same field-diffing logic runs for every save, regardless of reason.

To keep this generic without becoming noisy:
- Fields not already in `EDIT_TRACKED_FIELDS`' label map still get logged, using the raw internal field name (e.g. `atLink`) rather than a friendly label — new fields are covered automatically, just with a less polished label until someone adds a nicer one.
- A small denylist excludes purely internal bookkeeping fields that would just be noise (`statusUpdatedAt`, and the item's own key field).

## Files touched

Only `app-core.js`: `mergeArrayForSave` and `logSaveDiff`. No changes to the four `save*` functions themselves (they already call both with the same signatures — the behavior change is entirely internal to these two functions). No HTML, no CSS, no other JS file, no proxy-worker.js changes.

## Verification

No automated test framework exists in this app. Verification is manual:
1. **The realistic scenario**: Tab A loads (baseline captured). Tab B adds an AT Link (or any field) to Project X, saves. Tab A — which never touched Project X and holds a stale copy of it — saves an edit to a *completely different* Project Y. Confirm Project X's AT Link survives Tab A's save.
2. Confirm the Activity Log now shows field-level detail for a save with a non-`edit-save` reason (e.g. trigger `jira-progress-sync`/`jira-status-sync` via Refresh Dashboard after a Jira-side field change) — should show which field changed, not just a bare count with no detail.
3. Single-tab sanity pass: normal edit-save still works exactly as before, for both already-tracked fields (health, region, etc.) and untracked ones.
4. Confirm closed-projects/backups still behave correctly (no regression from the algorithm change, even though they're less exposed to this scenario in practice).
