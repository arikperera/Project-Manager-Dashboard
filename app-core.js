const PROXY_BASE = 'https://pm-proxy.demo.qa.kaltura.ai';
const KV_SECRET = 'HPZTjoBph4Cz9AMGwiSsYcJf086bdgRX';
const PM_IDENTITY_BASE = 'https://pm-identity.demo.qa.kaltura.ai';

// Real logged-in user, read from the K-Vibe gate session cookie via pm-identity (a private
// K-Vibe app, unlike the public pm-proxy — the cookie only reaches apps that are
// password-gated). Cached per page load since it doesn't change mid-session.
let _cachedCurrentUserEmail;
async function getCurrentUserEmail() {
  if (_cachedCurrentUserEmail !== undefined) return _cachedCurrentUserEmail;
  try {
    const res = await fetch(`${PM_IDENTITY_BASE}/me`, { credentials: 'include' });
    const data = res.ok ? await res.json() : { email: null };
    _cachedCurrentUserEmail = data.email || null;
  } catch {
    _cachedCurrentUserEmail = null;
  }
  return _cachedCurrentUserEmail;
}
function emailToDisplayName(email) {
  if (!email) return '';
  const local = email.split('@')[0];
  return local.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
async function getCurrentUserName() {
  return emailToDisplayName(await getCurrentUserEmail());
}
const APP_VERSION = '1.17.2';
const CHANGELOG = [
  {
    version: '1.17.2',
    date: '2026-08-31',
    features: [
      'Fix: a stale browser tab saving any change (even a single unrelated edit or delete) could silently wipe out projects, tasks, closed-project entries, or backups added or edited by other people in the meantime — confirmed real incidents where dozens of projects vanished from PMs\' lists after someone else made one small edit elsewhere. Every save now merges against the current shared state instead of overwriting it wholesale, so only what you actually changed is what gets applied — nothing you never touched can be dropped by your save.',
    ]
  },
  {
    version: '1.17.1',
    date: '2026-08-14',
    features: [
      'Fix: the Activity Log could show "Project Status" (or "PM Personal Notes") as updated even when you only edited the other field — saving always re-reads both editors\' HTML, and the browser doesn\'t always serialize it back byte-identical to what was stored, which looked like a change that never happened. Now compares both fields through the same round-trip before deciding.',
    ]
  },
  {
    version: '1.17.0',
    date: '2026-08-14',
    features: [
      'Activity Log now opens as its own standalone page in a new tab, instead of a window over the dashboard — keep both open side by side.',
      'Project Status / PM Personal Notes edit entries in the Activity Log are now clickable ("(updated)") — opens a popover showing the actual text that was saved, without needing to reopen the project.',
    ]
  },
  {
    version: '1.16.8',
    date: '2026-08-12',
    features: [
      'The hourglass on Save/Post/Delete buttons now actually spins while the action runs, instead of a static icon — shown as its own animated element next to the label text.',
    ]
  },
  {
    version: '1.16.7',
    date: '2026-08-12',
    features: [
      'Save/Post/Delete buttons now show an hourglass ("⏳ Saving...", "⏳ Posting...") while the action is in progress, so a save that takes a moment doesn\'t look unresponsive — added to Edit Project\'s "Save changes", Comments\' "Save Comment", and the delete-comment button.',
    ]
  },
  {
    version: '1.16.6',
    date: '2026-08-12',
    features: [
      'Editing PM Personal Notes now shows up in the Activity Log (as "PM Personal Notes: (updated)", same style as Project Status) — temporary while we confirm the feature is working well for everyone; may go back to untracked once that\'s settled.',
    ]
  },
  {
    version: '1.16.5',
    date: '2026-08-12',
    features: [
      'New "PM Personal Notes" block in Edit Project (projects only) — same rich-text formatting as Project Status, but purely internal: never synced to Jira, never included in the Export Report, and persists through Backup & Delete / Closed Projects / Restore just like every other project field.',
    ]
  },
  {
    version: '1.16.4',
    date: '2026-08-11',
    features: [
      'Fix: the v1.16.3 fix for phantom "removed" log entries had no expiration — a browser tab left open for a long time (background tabs get throttled, and the periodic refresh skips itself while a modal is open) could keep comparing against a days-old local snapshot, misreporting long-gone items as newly removed every time that tab saved anything. The local snapshot is now only trusted for 90 seconds; older than that, it falls back to a fresh read.',
    ]
  },
  {
    version: '1.16.3',
    date: '2026-08-09',
    features: [
      'Fix: the Activity Log could occasionally re-report an already-deleted item as "removed" a second time on a later, unrelated save. Cause: the log\'s before/after comparison re-fetched from KV each time, which is only eventually consistent across regions and could return a slightly stale snapshot. Now compares against this browser\'s own last-confirmed state instead of a fresh (and sometimes stale) read.',
    ]
  },
  {
    version: '1.16.2',
    date: '2026-08-09',
    features: [
      'Removed the automatic "Dashboard (Name): Updated via PM Dashboard" Jira comment that used to post on every project edit — now that the Comments window exists for real commentary, that generic noise comment is gone. Saving an edit still syncs the actual field values (status, health, due date, etc.) to Jira as before, just without the extra comment.',
    ]
  },
  {
    version: '1.16.1',
    date: '2026-08-09',
    features: [
      'Activity Log now also tracks field-level edits (PM reassignment, health, CSM/Sales, region, risk reason, AT link, due date, name/customer, and whether Project Status changed) — previously it only tracked items being added or removed, so a pure edit like reassigning a PM left no trace at all.',
    ]
  },
  {
    version: '1.16.0',
    date: '2026-08-09',
    features: [
      'Fix: a deleted project could resurrect itself with zero trace in the Activity Log, if another (often stale) browser tab saved anything around the same time. Root cause: delete-tombstones lived in one shared list requiring read-modify-write on every add/remove — under concurrent writes, a stale tab\'s save could push the deleted item straight back and even erase the tombstone that was just created for it. Tombstones are now individual KV entries (same fix already applied to the Activity Log earlier), so add/remove are independent atomic operations with nothing to race. All 29 existing tombstones were migrated over; none lost protection.',
      'Removed a redundant "clear tombstones for anything present in this save" step that ran after every single save — it was meant as a safety net for restoring an item, but every restore/import/add flow already clears the specific tombstone it needs to, and the blanket version was the actual mechanism a stale save could exploit to erase someone else\'s tombstone.',
    ]
  },
  {
    version: '1.15.3',
    date: '2026-08-09',
    features: [
      'Comment attribution ("Dashboard (Name):") now sits on its own line, with the comment text starting on the next line instead of running on immediately after it.',
    ]
  },
  {
    version: '1.15.2',
    date: '2026-08-09',
    features: [
      'Fix: bold/links/color could silently lose their formatting when they were the very first thing typed in Project Status or a comment (before the browser wraps subsequent lines in their own block) — formatting inside lists or later lines was unaffected. Now applies correctly everywhere.',
    ]
  },
  {
    version: '1.15.1',
    date: '2026-08-09',
    features: [
      'Replaced the browser\'s native password/confirm popups (export report, create backup, delete comment) with dialogs styled to match the rest of the dashboard.',
      'Delete-comment button now uses a clearer red trash-can icon instead of an emoji.',
    ]
  },
  {
    version: '1.15.0',
    date: '2026-08-08',
    features: [
      'New "Comments" button on every project/task row (between Edit and Delete) opens a window to write and view Jira comments without leaving the dashboard — same rich-text toolbar as Project Status, existing comments shown newest-first, posted comments prefixed "Dashboard (Real Name): ...".',
      'Type @ in the comment composer or Project Status editor to search Jira users and insert a real mention — the mentioned person gets a genuine Jira notification.',
      'Edit/Delete buttons relabeled to "Edit Project"/"Delete Project" (or "Edit Task"/"Delete Task") for clarity now that there\'s a third button.',
      'Each existing comment in the Comments window now has a trash button to delete it from Jira (with a confirmation prompt first, since it can\'t be undone).',
    ]
  },
  {
    version: '1.14.1',
    date: '2026-08-08',
    features: [
      'Fix: Import/Add Project could silently fail to persist if the project\'s Jira key was still tombstoned from an earlier deletion — the save step would strip it right back out. Both flows now clear any lingering tombstone before saving.',
      'pollForNewProjects (auto-add) now also checks shared KV tombstones, not just this browser\'s own pending deletes, so it won\'t auto-resurrect something deleted from another session.',
      'Jira comment attribution format changed to "Dashboard (Real Name): Updated via PM Dashboard".',
    ]
  },
  {
    version: '1.14.0',
    date: '2026-08-08',
    features: [
      'Real user identity: reads the K-Vibe gate session cookie via a new private helper app (pm-identity) to know who\'s actually logged in.',
      'Activity Log now shows a "By" column with the real person who took each action.',
      'Jira comments posted from the dashboard are now prefixed with the real logged-in user, e.g. "Arik Perera (Dashboard - Real User): Updated via PM Dashboard" — the Jira account posting it is still the shared service account, but the comment text now says who really made the change.',
    ]
  },
  {
    version: '1.13.5',
    date: '2026-08-07',
    features: [
      'Activity Log now also tracks Closed Projects and Backups (previously untracked) — so if entries disappear from either again, there\'ll be a record of when and via what action.',
    ]
  },
  {
    version: '1.13.4',
    date: '2026-08-07',
    features: [
      'Critical fix: v1.13.3 broke the entire dashboard (blank page, zero projects). Cause: the last fix used a nested template literal inside the Export report\'s inline script — but that whole script lives inside app-modals.js\'s own outer template literal, so the extra backticks broke out of it and corrupted every line after. Replaced with plain string concatenation. Verified with node --check before deploying this time.',
    ]
  },
  {
    version: '1.13.3',
    date: '2026-08-07',
    features: [
      'Fix: Export report\'s "All Projects" header counted projects + tasks combined, while "Total Projects" up top counts projects only — the two numbers looked contradictory. "All Projects" now shows a clear breakdown, e.g. "106 projects · 13 tasks".',
    ]
  },
  {
    version: '1.13.2',
    date: '2026-08-07',
    features: [
      'Fix: the new section-header counts in Export report (Over Budget, Project Health, Newly Added, All Projects) were static and didn\'t update with the Region filter, unlike the top stat cards. They now update together.',
    ]
  },
  {
    version: '1.13.1',
    date: '2026-08-07',
    features: [
      'Export report: fixed "Newly Added Projects" header color (was a stray blue, now matches every other section), and every section header now shows its count in parentheses — e.g. "Over Budget Projects (15)"',
    ]
  },
  {
    version: '1.13.0',
    date: '2026-08-07',
    features: [
      'Create backup / Export and Backup now snapshots current tasks too, not just projects and users — grouped under each task\'s owner, same as everywhere else.',
      'Backups viewer and Restore checklist updated to match — a "Restore tasks" option now appears alongside Restore projects/users.',
    ]
  },
  {
    version: '1.12.7',
    date: '2026-08-06',
    features: [
      'Fix: the Backups viewer grouped tasks under "Unassigned" and showed "undefined" for their project name — it only knew about project fields (.manager/.name), not task fields (.owner/.parentProjectName). Now shows tasks under their real owner with the correct project name.',
      'Cleaned up duplicate backup entries left over from earlier resurrection bugs (same task pushed into the July 22 backup multiple times before the type-aware matching fix).',
    ]
  },
  {
    version: '1.12.6',
    date: '2026-08-06',
    features: [
      'Fix: Backup & Delete on a task matched against the latest backup by name, which falls back to the task\'s parent project name — silently overwriting that project\'s backup snapshot with the task\'s data. Matching is now type-aware (task id / project jira), so tasks and projects can never collide in a backup.',
    ]
  },
  {
    version: '1.12.5',
    date: '2026-08-06',
    features: [
      'Fix: closedProjects (Closed Projects archive) could be silently wiped by a long-lived tab with a stale local copy doing a Backup & Delete or Restore — it\'s only refreshed from KV at page load, so a tab open for hours would overwrite the whole archive with its outdated snapshot on the next mutation. Both write paths now refresh from KV immediately before mutating.',
      'Recovered 7 of Hadar Blonskey\'s Aug 5th closures that were wiped by this bug, using full project snapshots preserved in the July 22 backup.',
    ]
  },
  {
    version: '1.12.4',
    date: '2026-08-06',
    features: [
      'Critical fix: tasks have both a jira field (parent project) and their own id, but every tombstone/pending-delete check used the jira field as the match key — while task tombstones are recorded by task id. The two never matched, so task tombstones have silently done nothing since they were introduced. getItemDeleteKey now uses id for tasks.',
      'Backups now get the same delete protection as projects/tasks: deleting a backup records a tombstone, and saveBackups strips tombstoned entries before writing — closes the same resurrection class for the Backups tab.',
    ]
  },
  {
    version: '1.12.3',
    date: '2026-08-06',
    features: [
      'Fix: the periodic background poll could resurrect an already-deleted project/task if a long-lived browser tab still held a stale local copy whose tombstone had since cleared. The poll no longer auto-pushes "local-only" items back to KV — it still shows them locally, but persistence now only happens through the actual save action or the dedicated reconnect-sync flow, both of which are tombstone-protected.',
    ]
  },
  {
    version: '1.12.2',
    date: '2026-08-06',
    features: [
      'Export report and Create backup now require a password before proceeding',
    ]
  },
  {
    version: '1.12.1',
    date: '2026-08-06',
    features: [
      'Fix: Import from Jira could silently skip a project if this browser tab\'s in-memory list was stale (still showing it as "already imported" from before it was deleted). The import modal now refreshes from KV every time it opens.',
    ]
  },
  {
    version: '1.12.0',
    date: '2026-08-06',
    features: [
      'Activity Log rearchitected: each entry now writes to its own KV key (via new pm-proxy /activity-log routes) instead of a shared JSON array, so concurrent writes from different browsers can no longer silently overwrite each other\'s entries. Old entries auto-expire after 7 days via KV TTL.',
    ]
  },
  {
    version: '1.11.6',
    date: '2026-08-06',
    features: [
      'Fix: a reassigned project (PM changed in Jira) could revert back to the old PM a few minutes later — a stale browser tab\'s periodic Jira sync would write its whole outdated projects list back to KV, clobbering the reassignment. Both sync loops now refresh from KV before applying any field updates.',
    ]
  },
  {
    version: '1.11.5',
    date: '2026-08-06',
    features: [
      'Fix: Activity Log table was inheriting the main dashboard\'s fixed 1500px-min-width table styling, ignoring all column-width tweaks. Now uses its own compact table style — columns size to content, Added/Removed merged into one column.',
    ]
  },
  {
    version: '1.11.4',
    date: '2026-08-06',
    features: [
      'Activity Log: tighter column widths, human-readable reason labels (e.g. "Jira field sync" instead of "jira-progress-sync"), and de-duplication of near-simultaneous entries for the same add/remove (fixes a project appearing to be logged twice right after import)',
    ]
  },
  {
    version: '1.11.3',
    date: '2026-08-06',
    features: [
      'Activity Log: narrower When/Store/Reason/Count columns to give Added/Removed more room; Jira IDs in those columns are now clickable links',
    ]
  },
  {
    version: '1.11.2',
    date: '2026-08-06',
    features: [
      'Fix: Restore (from Closed Projects or from a full Backup) immediately undid itself — saveProjects\' tombstone-strip check removed the restored item right back out since its old delete tombstone was never cleared. Both restore paths now clear the relevant tombstone(s) first.',
    ]
  },
  {
    version: '1.11.1',
    date: '2026-08-06',
    features: [
      'Closed Projects: the Closed date is highlighted in amber for 3 days after closure, to flag recent activity at a glance',
      'Backups: recently created backups (within 3 days) are highlighted in the sidebar the same way',
    ]
  },
  {
    version: '1.11.0',
    date: '2026-08-06',
    features: [
      'Added Activity Log (Settings > Diagnostics) — records every add/remove to projects and tasks with a reason tag (manual delete, backup & delete, Jira sync, auto-add, restore, etc.), filterable by last 24h/48h/7 days',
    ]
  },
  {
    version: '1.10.5',
    date: '2026-08-05',
    features: [
      'Added "Project added month" filter to the dashboard (between Progress and Due month) — shows projects with a Start Date in the current, previous, or 2-months-prior month',
    ]
  },
  {
    version: '1.10.4',
    date: '2026-08-05',
    features: [
      'Fix: a stale browser session touched by a Jira sync (progress/status) could push a deleted project or task straight back to KV via saveProjects/saveTasks, bypassing all tombstone checks. Both save functions now always strip tombstoned items before writing.',
    ]
  },
  {
    version: '1.10.3',
    date: '2026-08-05',
    features: [
      'Fix: "Projects" count badge on the dashboard was counting projects + tasks combined. Now counts projects only, matching the top nav total.',
    ]
  },
  {
    version: '1.10.2',
    date: '2026-08-05',
    features: [
      'Tasks now inherit Customer/Account URL and Opportunity URL from their linked project, so those columns are hyperlinked same as projects',
      'Tasks: Manager Notes now shows "PM - <name>" for the PM of the linked project/Jira, set at creation time',
      'Backfilled both fixes for all 13 existing tasks',
    ]
  },
  {
    version: '1.10.1',
    date: '2026-08-05',
    features: [
      'Added a live count badge next to "Projects" on the dashboard and "Closed Projects" in the archive — both update dynamically as filters are applied',
    ]
  },
  {
    version: '1.10.0',
    date: '2026-08-05',
    features: [
      'Closed Projects: added search, PM filter, Region filter, Closed Month filter, Closed Quarter filter (e.g. Q326), and matching Refresh/Reset buttons',
    ]
  },
  {
    version: '1.9.6',
    date: '2026-08-05',
    features: [
      'Fix: reconnecting after a dropped connection pushed a stale local copy of projects/tasks straight to KV with no tombstone check, which could resurrect something another session had already deleted. The reconnect sync now strips tombstoned items first.',
    ]
  },
  {
    version: '1.9.5',
    date: '2026-08-03',
    features: [
      'Delete project dialog wording updated: Backup & Delete is now reversible via Closed Projects > Restore, so the message no longer claims all deletion is permanent',
    ]
  },
  {
    version: '1.9.4',
    date: '2026-08-03',
    features: [
      'Fix: search matched the full Jira URL, so short terms like "tp" (a substring of "http") falsely matched nearly every project. Search now matches only the numeric Jira ID (e.g. 146770), not the project key prefix or URL.',
    ]
  },
  {
    version: '1.9.3',
    date: '2026-08-03',
    features: [
      'Closed date now pulled from Jira resolution date (when the issue was marked Done/Canceled) instead of the local delete timestamp',
      'Closed Projects: Customer and Opportunity columns are now hyperlinked, same as the main dashboard',
      'Backfilled Closed date corrections for all 13 historical closures using real Jira resolution dates',
    ]
  },
  {
    version: '1.9.2',
    date: '2026-08-03',
    features: [
      'Fix: Closed date in Closed Projects showed a raw timestamp instead of a simple dd/mm/yy date like the End date column',
    ]
  },
  {
    version: '1.9.1',
    date: '2026-08-03',
    features: [
      'Closed projects: within each PM group, sorted by most recently closed first',
      'Backfilled Closed projects archive with 9 historical closures from June/July',
    ]
  },
  {
    version: '1.9.0',
    date: '2026-08-03',
    features: [
      'New "Closed projects" archive — permanent record of every project sent through Backup & Delete, grouped by PM',
      'Closed projects can be restored back into active projects from the archive',
    ]
  },
  {
    version: '1.8.2',
    date: '2026-08-03',
    features: [
      'Progress filter: added "Above 100%" option to quickly view over-budget projects',
    ]
  },
  {
    version: '1.8.1',
    date: '2026-08-03',
    features: [
      'Fix: "Refresh Dashboard" button bypassed tombstone/pending-delete protection — now uses the same protected merge as the background poll and page reload',
    ]
  },
  {
    version: '1.8.0',
    date: '2026-08-03',
    features: [
      'Fix: deleted projects/tasks resurrecting when another browser/session still had them locally',
      'Shared delete tombstones now stored in KV so deletions are visible across all open sessions',
      'pollForNewProjects now respects pending deletes',
    ]
  },
  {
    version: '1.7.0',
    date: '2026-07-31',
    features: [
      'app.js split into app-core.js, app-render.js, app-modals.js for faster deployment',
      'Filter persistence — filters saved across page refreshes',
      'URL filter params — ?pm=Name filters dashboard on load',
      'Refresh and Reset filter buttons',
      'KV poll merges local-only projects instead of overwriting',
      'Import: 1.5s wait after save before reload to ensure KV write completes',
      'Jira sync: always pull status from Jira when local statusText is empty',
    ]
  },
  {
    version: '1.6.0',
    date: '2026-07-02',
    features: [
      'Tasks — new "Add new" button lets users choose between a full project or a task linked to an existing project',
      'Tasks — task form: customer autocomplete, project filtered by customer, Jira auto-filled, region auto-filled read-only, task owner with add-new-user suggestion',
      'Tasks — appear in the dashboard grouped by task owner, with NRR and Project Budget showing "-"',
      'Tasks — edit modal: customer/project read-only, all other fields editable; task owner list shows all users regardless of role',
      'Tasks — Complete/Delete works the same as projects including Backup & Delete',
      'Tasks — no Jira writes; data stored in KV only',
      'Tasks — included in HTML report under owner\'s group; not counted in Total Projects',
      'IE role — new user role for Integration Engineers, available in add/edit user forms',
      'Risk Reason — new option: "Project actual work does not match estimation"',
      'Region sync — changing Region in dashboard now writes back to Jira',
      'Data safety — localStorage written before KV on every save; KV empty array no longer overwrites local data',
    ]
  },
  {
    version: '1.5.0',
    date: '2026-06-28',
    features: [
      'Region field — projects now have a Region (APAC, EMEA, North America, LatAm, Internal, ROW) synced from Jira and editable in both Add and Edit modals',
      'Region filter — dashboard filter row now includes a Region dropdown; filters live like other filters and persists across edits',
      'Report: region selector in report header scopes all stat boxes (Total Projects, MRR/NRR, Project Health, Over Budget, Newly Added, Added MRR/NRR) and all tables',
      'Report: All Projects PM filter now hides PM group headers when all their projects are filtered out',
      'Report: Newly Added and Added MRR/NRR stat boxes now show the backup date they compare against ("since dd/mm/yy")',
      'Report: Project Budget column now shows actual vs planned hours on the same line as the percentage (e.g. 690% · 0 / 10h)',
      'Dashboard: PM filter no longer resets when saving an edit',
    ]
  },
  {
    version: '1.4.0',
    date: '2026-06-25',
    features: [
      'Dashboard: "On track" replaced with "Project health" showing Green/Yellow/Red counts',
      'Dashboard: "Project At risk" renamed to "Over Budget Projects" (counts projects ≥100% budget)',
      'Report: 6 stat boxes — Total Projects, Total MRR/NRR, Project Health, Over Budget, Newly Added, Added MRR/NRR',
      'Report: new "Project Health" section listing Yellow/Red projects with PM status',
      'Report: "Over Budget" section shows Project Budget widget and Risk Reason',
      'Report: PM column added to All Projects table, aligned with Newly Added Projects table',
      'Report: links styled in correct color, Manager Notes displayed on separate lines',
    ]
  },
  {
    version: '1.3.1',
    date: '2026-06-25',
    features: [
      'Project Health imported from Jira — Risk Rate (Green/Yellow/Red) now imported on project import',
      'Project At risk (budget) — correctly counts projects at 100%+ budget consumption',
      'PM name fix — full display name imported from Jira instead of short name',
      'Due-month email — PM column added as first column, sorted by PM name',
      'No blank flash on reload — dashboard renders instantly from local cache while KV loads',
      'Data safety — guard prevents default sample data from overwriting real KV data',
    ]
  },
  {
    version: '1.3.0',
    date: '2026-06-24',
    features: [
      'Shared storage — all data stored in Cloudflare KV and shared across all users in real-time',
      'Import: Risk Reason (Budget) now imported from Jira on project import',
      'Edit modal: CSM and Sales names are now editable fields',
      'No flash on reload — dashboard shows data instantly while KV syncs in background',
      'Offline mode — falls back to local data with banner when worker is unreachable',
    ]
  },
  {
    version: '1.2.1',
    date: '2026-06-24',
    features: [
      'Import fix — Customer name, NRR(h), End date, NRR(USD) and MRR(USD) now correctly populated from Jira on import',
      'Currency format — values now show with $ prefix (e.g. $14.8K instead of 14.8K)',
      'Customer list — Edit/Delete buttons stay on same line for long customer names',
    ]
  },
  {
    version: '1.2.0',
    date: '2026-06-23',
    features: [
      'Shared proxy — all Jira API calls route through a shared cloud worker; no local proxy needed',
      'Auto-create users and customers on import — PM and customer are added automatically if they don\'t exist',
      'No import limit — project import returns up to 200 projects per PM',
      'Project Budget tooltip — projects with zero actual hours now show "No hours reported yet"',
    ]
  },
  {
    version: '1.1.0',
    date: '2026-06-23',
    features: [
      'Import from Jira — bulk import initiatives by PM name with live autocomplete; auto-fills customer, NRR hours, MRR/NRR, due date from Jira',
      'Project Status ↔ Jira sync — bidirectional sync with Jira Initiative Description on page load and save; supports bullet lists, numbered lists, nested indentation, and task lists (☐/☑)',
      'Reassign PM — edit modal now has a PM selector to move a project between PMs',
      'Project Health → Jira Risk Rate — changing health updates the Jira Risk Rate field automatically',
      'Larger status cell — Project Status column shows ~10 lines before scrolling',
      'Editor improvements — content no longer lost when clicking toolbar buttons',
    ]
  },
  {
    version: '1.0.0',
    date: '2026-06-21',
    features: [
      'Initial release',
      'PM Status field for Yellow/Red health projects',
      'Project Health hover tooltip in all views',
      'Color picker in project status editor',
      'Due date and Risk Rate sync to Jira',
      'Project Budget column with blink warning',
    ]
  }
];

const STORAGE_KEY = 'project-dashboard-projects-v1';

const USERS_KEY = 'project-dashboard-users-v1';
let users = JSON.parse(localStorage.getItem('project-dashboard-users-v1') || '[]');

async function saveUsers() {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
  const ok = await kvPut(USERS_KEY, users);
  if (!ok) _wasOffline = true;
}

const SETTINGS_KEY = 'project-dashboard-settings-v1';
let settings = JSON.parse(localStorage.getItem('project-dashboard-settings-v1') || '{}');

async function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  await kvPut(SETTINGS_KEY, settings);
}

const CUSTOMERS_KEY = 'project-dashboard-customers-v1';
let customers = JSON.parse(localStorage.getItem('project-dashboard-customers-v1') || '[]');

async function saveCustomers() {
  try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {}
  const ok = await kvPut(CUSTOMERS_KEY, customers);
  if (!ok) _wasOffline = true;
}

function getCustomerNames() {
  return customers.map(c => c.name);
}

let cachedRiskReasonFieldId = null;
let cachedProgressPctFieldId = null;
let cachedEstHoursFieldId = null;
let cachedRemEffortFieldId = null;
let cachedActEffortFieldId = null;
let cachedRiskRateFieldId = null;
let cachedRiskRateOptions = null;
let cachedAccountNameFieldId = null;
let cachedAccountOwnerFieldId = null;
let cachedOppUrlFieldId = null;
let cachedAccountUrlFieldId = null;
let cachedAccountCsmFieldId = null;
let cachedMrrFieldId = null;
let cachedNrrFieldId = null;
let cachedRegionFieldId = null;

const TASKS_KEY = 'project-dashboard-tasks-v1';
let tasks = JSON.parse(localStorage.getItem('project-dashboard-tasks-v1') || '[]');

const PENDING_DELETES_KEY = 'project-dashboard-pending-deletes-v1';

function getPendingDeletes() {
  return JSON.parse(localStorage.getItem(PENDING_DELETES_KEY) || '[]');
}

function addPendingDelete(id, storeKey) {
  const pending = getPendingDeletes();
  if (!pending.find(d => d.id === id && d.storeKey === storeKey)) {
    pending.push({ id, storeKey });
    try { localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending)); } catch {}
  }
}

function removePendingDelete(id, storeKey) {
  const pending = getPendingDeletes().filter(d => !(d.id === id && d.storeKey === storeKey));
  try { localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending)); } catch {}
}

function getItemDeleteKey(item) {
  // Tasks have BOTH a jira field (their parent project's issue) and their own id — must use
  // id, or every tombstone/pending-delete check silently never matches (tombstones for tasks
  // are recorded by task.id, not by the parent project's jira URL).
  if (item.type === 'task') return item.id || '';
  // Projects have no id field, so jira is the natural key. Fall back to id for anything else.
  return item.jira || item.id || '';
}

// Shared cross-session delete tombstones — protects against another browser/session
// pushing a deleted item back because it still has it locally. Each tombstone is its own
// KV key server-side (see proxy-worker.js POST/DELETE/GET /tombstone(s)), not a single
// shared JSON array — a shared array requires read-modify-write on every add/remove, and
// two concurrent writes (e.g. one session deleting an item while another session's stale
// tab saves its own unrelated edit) can race: the stale save's tombstone-check can read
// before the delete's write lands, push the "deleted" item straight back into KV, and then
// clear the very tombstone that was just created — a real incident (Nomura/PSVAMB-145761,
// 2026-08-09) that this per-key redesign closes, since each add/remove is now an
// independent atomic KV operation with no shared list to race on.
async function addKvTombstone(id, storeKey) {
  if (!id) return;
  try {
    await fetch(`${PROXY_BASE}/tombstone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-KV-Secret': KV_SECRET },
      body: JSON.stringify({ id, storeKey, ts: Date.now() }),
    });
  } catch {}
}

// Must be called before re-adding a previously-deleted item (restore from Closed
// Projects/backup, Import, Add Project) — otherwise saveProjects/saveTasks strip it right
// back out again since it still matches the tombstone that was recorded when it was deleted.
async function removeKvTombstone(id, storeKey) {
  if (!id) return;
  try {
    await fetch(`${PROXY_BASE}/tombstone`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-KV-Secret': KV_SECRET },
      body: JSON.stringify({ id, storeKey }),
    });
  } catch {}
}

async function getKvTombstonesForStore(storeKey) {
  try {
    const res = await fetch(`${PROXY_BASE}/tombstones?storeKey=${encodeURIComponent(storeKey)}`, {
      headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Combined delete-id set for a store: this browser's pending deletes + the shared KV tombstones
async function getCombinedDeleteIds(storeKey) {
  const ids = new Set(getPendingDeletes().filter(d => d.storeKey === storeKey).map(d => d.id));
  const remote = await getKvTombstonesForStore(storeKey);
  remote.forEach(t => ids.add(t.id));
  return ids;
}

// Shared activity log — records every add/remove to projects or tasks, with a reason
// tag, so cross-session disappear/reappear mysteries can be traced. Each entry writes to
// its own KV key server-side (see proxy-worker.js POST /activity-log) instead of a single
// shared JSON array, so concurrent writers from different browsers never clobber each
// other's entries. Cloudflare KV's native TTL prunes entries after 7 days automatically.
async function logActivity(entry) {
  try {
    const user = await getCurrentUserName();
    await fetch(`${PROXY_BASE}/activity-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-KV-Secret': KV_SECRET },
      body: JSON.stringify({ ts: Date.now(), user, ...entry }),
    });
  } catch {}
}

// Fields worth calling out by name when a manual edit changes them. Deliberately excludes
// anything the automatic Jira syncs touch (progress, hours, dueDate mirrored from Jira,
// etc.) — those fire constantly and would flood the log, which is why field-diffing below
// only runs for reason === 'edit-save' in the first place, not as a belt-and-suspenders here.
const EDIT_TRACKED_FIELDS = {
  customer: 'Customer',
  name: 'Name',
  manager: 'PM',
  health: 'Health',
  pmStatus: 'PM Status',
  region: 'Region',
  riskReason: 'Risk Reason',
  atLink: 'AT Link',
  csm: 'CSM',
  sales: 'Sales',
  dueDate: 'End Date',
};

// Round-trips an HTML string through a detached element so two strings that differ only
// by browser HTML serialization quirks (not actual content) compare equal.
function normalizeHtmlForCompare(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return div.innerHTML;
}

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

const BACKUPS_KEY = 'project-dashboard-backups-v1';
let backups = JSON.parse(localStorage.getItem('project-dashboard-backups-v1') || '[]');

const CLOSED_PROJECTS_KEY = 'project-dashboard-closed-projects-v1';
let closedProjects = JSON.parse(localStorage.getItem('project-dashboard-closed-projects-v1') || '[]');

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

// This browser's own last-confirmed view of each KV key, timestamped — updated on every
// successful read AND write. logSaveDiff prefers this over a fresh network read for its
// "before" snapshot ONLY while it's recent (see _KV_CACHE_MAX_AGE_MS below), since
// Cloudflare KV is only eventually consistent across regions: a fresh GET moments after a
// write can still return the pre-write value, which made logSaveDiff occasionally report
// already-deleted items as "removed" a second time in an unrelated later save.
//
// The cache must expire, though — a tab left open for hours/days (background tabs get their
// timers throttled/suspended by the browser, and the periodic refresh in app-render.js
// deliberately skips itself while a modal is open) can otherwise sit on a snapshot from long
// before several real deletes happened, making EVERY later save from that tab misreport all
// of them as "removed" again. Past _KV_CACHE_MAX_AGE_MS, a fresh network read is more likely
// to be right than a very old local snapshot, so fall back to it.
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

const _lastKnownKvState = {};
const _KV_CACHE_MAX_AGE_MS = 90 * 1000;

async function kvGet(key) {
  try {
    const res = await fetch(`${PROXY_BASE}/kv/${encodeURIComponent(key)}`, {
      headers: { 'X-KV-Secret': KV_SECRET },
    });
    if (!res.ok) return null;
    const value = await res.json();
    if (Array.isArray(value)) _lastKnownKvState[key] = { value: JSON.parse(JSON.stringify(value)), ts: Date.now() };
    return value;
  } catch {
    return null;
  }
}

async function kvPut(key, value) {
  try {
    const res = await fetch(`${PROXY_BASE}/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-KV-Secret': KV_SECRET },
      body: JSON.stringify(value),
    });
    if (res.ok && Array.isArray(value)) _lastKnownKvState[key] = { value: JSON.parse(JSON.stringify(value)), ts: Date.now() };
    return res.ok;
  } catch {
    return false;
  }
}

// One retry after a transient failure, shared by every save* function — projects/tasks and
// closedProjects/backups all need it equally: a dropped write to closedProjects during a
// project delete, for instance, would leave an item removed from active projects but never
// actually landed in Closed Projects, with no other trace of it anywhere.
async function kvPutWithRetry(key, value) {
  let ok = await kvPut(key, value);
  if (!ok) {
    await new Promise(r => setTimeout(r, 800));
    ok = await kvPut(key, value);
  }
  return ok;
}

async function initData() {
  // Check if worker is reachable before touching KV
  let workerHealthy = false;
  try {
    const healthRes = await fetch(`${PROXY_BASE}/health`, {
      headers: { 'X-KV-Secret': KV_SECRET },
    });
    workerHealthy = healthRes.ok;
  } catch {
    workerHealthy = false;
  }

  if (!workerHealthy) {
    showOfflineBanner();
    projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;
    users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
    backups = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');
    tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    closedProjects = JSON.parse(localStorage.getItem(CLOSED_PROJECTS_KEY) || '[]');
    return;
  }

  const [kvProjects, kvUsers, kvSettings, kvCustomers, kvBackups, kvTasks, kvClosedProjects] = await Promise.all([
    kvGet(STORAGE_KEY),
    kvGet(USERS_KEY),
    kvGet(SETTINGS_KEY),
    kvGet(CUSTOMERS_KEY),
    kvGet(BACKUPS_KEY),
    kvGet(TASKS_KEY),
    kvGet(CLOSED_PROJECTS_KEY),
  ]);

  async function hydrateKey(kvValue, lsKey, fallback) {
    if (kvValue !== null) {
      let value = Array.isArray(kvValue) ? kvValue : kvValue;

      if (Array.isArray(kvValue)) {
        // Step 1: apply offline deletes on top of KV (this browser's pending deletes + shared KV tombstones)
        const beforeDeletes = value.length;
        const deleteIds = await getCombinedDeleteIds(lsKey);
        value = deleteIds.size ? value.filter(item => !deleteIds.has(getItemDeleteKey(item))) : value;
        const hadDeletes = value.length < beforeDeletes;

        // Step 2: merge offline adds — items in localStorage not present in KV (by id)
        const lsValue = JSON.parse(localStorage.getItem(lsKey) || 'null');
        if (Array.isArray(lsValue) && lsValue.length > 0) {
          const kvIds = new Set(value.map(item => item.id).filter(Boolean));
          const offlineAdds = lsValue.filter(item => item.id && !kvIds.has(item.id) && !deleteIds.has(item.id));
          if (offlineAdds.length > 0) {
            value = [...value, ...offlineAdds];
          }
        }

        const needsSync = hadDeletes || value.length > kvValue.length;
        if (needsSync) {
          kvPut(lsKey, value).then(() => {
            getPendingDeletes().filter(d => d.storeKey === lsKey)
              .forEach(d => removePendingDelete(d.id, lsKey));
          }).catch(() => {});
        } else {
          // No offline changes — clear any stale pending deletes for this key
          getPendingDeletes().filter(d => d.storeKey === lsKey)
            .forEach(d => removePendingDelete(d.id, lsKey));
        }
      }

      try { localStorage.setItem(lsKey, JSON.stringify(value)); } catch {}
      return value;
    }
    // KV unreachable — fall back to localStorage
    const lsValue = JSON.parse(localStorage.getItem(lsKey) || 'null');
    return lsValue !== null ? lsValue : fallback;
  }

  [projects, users, settings, customers, backups, tasks, closedProjects] = await Promise.all([
    hydrateKey(kvProjects, STORAGE_KEY, defaultProjects),
    hydrateKey(kvUsers, USERS_KEY, []),
    hydrateKey(kvSettings, SETTINGS_KEY, {}),
    hydrateKey(kvCustomers, CUSTOMERS_KEY, []),
    hydrateKey(kvBackups, BACKUPS_KEY, []),
    hydrateKey(kvTasks, TASKS_KEY, []),
    hydrateKey(kvClosedProjects, CLOSED_PROJECTS_KEY, []),
  ]);
  // Always keep backups sorted newest first
  backups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  _saveBaseline[STORAGE_KEY] = JSON.parse(JSON.stringify(projects));
  _saveBaseline[TASKS_KEY] = JSON.parse(JSON.stringify(tasks));
  _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(closedProjects));
  _saveBaseline[BACKUPS_KEY] = JSON.parse(JSON.stringify(backups));

  // Cache KV data to localStorage so next load renders instantly
  try { localStorage.setItem(STORAGE_KEY,   JSON.stringify(projects));  } catch {}
  try { localStorage.setItem(USERS_KEY,     JSON.stringify(users));     } catch {}
  try { localStorage.setItem(SETTINGS_KEY,  JSON.stringify(settings));  } catch {}
  try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {}
  try { localStorage.setItem(BACKUPS_KEY,   JSON.stringify(backups));   } catch {}
  try { localStorage.setItem(TASKS_KEY,    JSON.stringify(tasks));     } catch {}
  try { localStorage.setItem(CLOSED_PROJECTS_KEY, JSON.stringify(closedProjects)); } catch {}
}

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

function formatBackupLabel(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `Backup ${dd}/${mm}/${yy} ${hh}:${min}`;
}

function createBackup(btn) {
  const ts = Date.now();
  const backup = {
    id: `bk_${ts}`,
    label: formatBackupLabel(ts),
    timestamp: ts,
    projects: JSON.parse(JSON.stringify(projects)),
    users: JSON.parse(JSON.stringify(users)),
    tasks: JSON.parse(JSON.stringify(tasks)),
  };
  backups.unshift(backup);
  backups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  saveBackups('create-backup');

  const dd = String(new Date(ts).getDate()).padStart(2, '0');
  const mm = String(new Date(ts).getMonth() + 1).padStart(2, '0');
  const yy = String(new Date(ts).getFullYear()).slice(2);
  const hh = String(new Date(ts).getHours()).padStart(2, '0');
  const min = String(new Date(ts).getMinutes()).padStart(2, '0');
  const filename = `dashboard-backup-${dd}-${mm}-${yy}-${hh}-${min}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.textContent = original; }, 2000);
  }
}

function getUserAvatarHtml(displayName, size = 22) {
  const user = users.find(u => getUserDisplayName(u) === displayName);
  if (user?.avatarUrl) {
    return `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(displayName)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.15);" onerror="this.style.display='none'">`;
  }
  // Initials fallback
  const initials = displayName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:#334155;color:#94a3b8;font-size:${Math.round(size*0.45)}px;font-weight:600;margin-right:6px;vertical-align:middle;flex-shrink:0;">${escapeHtml(initials)}</span>`;
}

function getUserDisplayName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function getUserRoles(user) {
  if (Array.isArray(user.roles)) return user.roles;
  if (user.role) return [user.role];
  return [];
}

function getUsersByRole(role) {
  return users.filter(u => getUserRoles(u).includes(role)).map(getUserDisplayName);
}

const STATUS_PLACEHOLDER = '<span style="font-style:italic;opacity:0.5;">No Status Entered</span>';
function isEmptyStatus(html) {
  if (!html) return true;
  const t = html.replace(/<[^>]+>/g, '').trim();
  return !t || /no status yet|no status entered/i.test(t);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function propagateUserRename(oldName, newName) {
  if (oldName === newName) return;
  projects.forEach(project => {
    if (project.manager === oldName) project.manager = newName;
    if (project.csm === oldName) project.csm = newName;
    if (project.sales === oldName) project.sales = newName;
    if (project.comments) {
      project.comments = project.comments.split(oldName).join(newName);
    }
  });
}

const defaultProjects = [
  { customer: 'Client Customer', name: 'Client Portal', manager: 'Ava', jira: 'https://jira.example.com/CP', nrr: 120, startDate: '2026-05-05', dueDate: '2026-06-30', status: 'On Track', statusText: 'Backend APIs are stable and user testing is in progress.', health: 'Green', progress: 78, comments: 'NRR: 120h, MRR: 8k, CSM: John, Sales: Sara' },
  { customer: 'Mobile Customer', name: 'Mobile Launch', manager: 'Noah', jira: 'https://jira.example.com/ML', nrr: 85, startDate: '2026-04-20', dueDate: '2026-06-18', status: 'At Risk', statusText: 'Vendor dependency delayed design approvals.', health: 'Yellow', progress: 54, comments: 'NRR: 85h, MRR: 6k, CSM: Maya, Sales: Leo' },
  { customer: 'Data Customer', name: 'Data Sync Upgrade', manager: 'Mia', jira: 'https://jira.example.com/DS', nrr: 140, startDate: '2026-05-12', dueDate: '2026-07-05', status: 'Delayed', statusText: 'Data mapping needs a second review cycle.', health: 'Red', progress: 38, comments: 'NRR: 140h, MRR: 10k, CSM: Emma, Sales: Omar' },
  { customer: 'Reporting Customer', name: 'Reporting Hub', manager: 'Liam', jira: 'https://jira.example.com/RH', nrr: 60, startDate: '2026-03-10', dueDate: '2026-06-10', status: 'Completed', statusText: 'All stakeholders have approved the final dashboard.', health: 'Green', progress: 100, comments: 'NRR: 60h, MRR: 4k, CSM: Alex, Sales: Nina' },
];

async function migrateProjects() {
  let changed = false;
  for (const p of projects) {
    if (p.pmStatus === undefined) { p.pmStatus = ''; changed = true; }
    if (p.atLink === undefined) { p.atLink = ''; changed = true; }
    if (p.estimatedHours === undefined) { p.estimatedHours = null; changed = true; }
    if (p.remainingHours === undefined) { p.remainingHours = null; changed = true; }
    if (p.actualHours === undefined) { p.actualHours = null; changed = true; }
    if (p.statusUpdatedAt === undefined) { p.statusUpdatedAt = ''; changed = true; }
    if (p.region === undefined) { p.region = ''; changed = true; }
    if (p.accountUrl === undefined) { p.accountUrl = ''; changed = true; }
    if (p.nrrUsd === undefined || p.nrrUsd === null) {
      // Try to backfill from comments: "NRR: $14.8K, MRR: $0K, ..."
      const nrrMatch = (p.comments || '').match(/NRR:\s*\$?([\d.]+)K?/i);
      p.nrrUsd = nrrMatch ? parseFloat(nrrMatch[1]) * (nrrMatch[0].includes('K') ? 1000 : 1) : null;
      changed = true;
    }
    if (p.mrrUsd === undefined || p.mrrUsd === null) {
      const mrrMatch = (p.comments || '').match(/MRR:\s*\$?([\d.]+)K?/i);
      p.mrrUsd = mrrMatch ? parseFloat(mrrMatch[1]) * (mrrMatch[0].includes('K') ? 1000 : 1) : null;
      changed = true;
    }
  }
  // Never save if projects is still the default sample data — would overwrite real KV data
  if (changed && projects !== defaultProjects) await saveProjects('migrate-projects');
}

// Pre-populate from localStorage for instant render while KV loads in background
let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;

const statusClasses = {
  'On Track': 'status-ontrack',
  'At Risk': 'status-risk',
  'Delayed': 'status-delayed',
  'Completed': 'status-completed',
};

const portfolioGroups = document.getElementById('portfolioGroups');
const projectSelect = document.getElementById('projectSelect');
const editProjectModal = document.getElementById('editProjectModal');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');
const editProjectForm = document.getElementById('editProjectForm');
const editCustomerName = document.getElementById('editCustomerName');
const editProjectName = document.getElementById('editProjectName');
const editProjectManager = document.getElementById('editProjectManager');
const editStatusEditor = document.getElementById('editStatusEditor');
const editHealth = document.getElementById('editHealth');
const editPmStatus = document.getElementById('editPmStatus');
const pmStatusLabel = document.getElementById('pmStatusLabel');
const pmNotesLabel = document.getElementById('pmNotesLabel');
const pmNotesEditor = document.getElementById('pmNotesEditor');
const saveEditModalBtn = document.getElementById('saveEditModalBtn');
const editRiskReason = document.getElementById('editRiskReason');
const editRegion = document.getElementById('editRegion');
const riskReasonLabel = document.getElementById('riskReasonLabel');
const riskList = document.getElementById('riskList');
const commentsModal = document.getElementById('commentsModal');
const closeCommentsModalBtn = document.getElementById('closeCommentsModalBtn');
const cancelCommentsModalBtn = document.getElementById('cancelCommentsModalBtn');
const saveCommentBtn = document.getElementById('saveCommentBtn');
const commentsModalTitle = document.getElementById('commentsModalTitle');
const commentComposerEditor = document.getElementById('commentComposerEditor');
const commentsList = document.getElementById('commentsList');
const appDialogModal = document.getElementById('appDialogModal');
const appDialogEyebrow = document.getElementById('appDialogEyebrow');
const appDialogTitle = document.getElementById('appDialogTitle');
const appDialogMessage = document.getElementById('appDialogMessage');
const appDialogInput = document.getElementById('appDialogInput');
const appDialogError = document.getElementById('appDialogError');
const appDialogCancelBtn = document.getElementById('appDialogCancelBtn');
const appDialogConfirmBtn = document.getElementById('appDialogConfirmBtn');
const closeAppDialogBtn = document.getElementById('closeAppDialogBtn');
const exportBtn = document.getElementById('exportBtn');
const manageUsersBtn = document.getElementById('manageUsersBtn');
const usersModal = document.getElementById('usersModal');
const closeUsersModalBtn = document.getElementById('closeUsersModalBtn');
const usersModalBody = document.getElementById('usersModalBody');
const addUserBtn = document.getElementById('addUserBtn');
const addUserForm = document.getElementById('addUserForm');
const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
const saveAddUserBtn = document.getElementById('saveAddUserBtn');
const addCustomerModal = document.getElementById('addCustomerModal');
const closeAddCustomerModalBtn = document.getElementById('closeAddCustomerModalBtn');
const cancelAddCustomerBtn = document.getElementById('cancelAddCustomerBtn');
const saveAddCustomerBtn = document.getElementById('saveAddCustomerBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const openActivityLogBtn = document.getElementById('openActivityLogBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const deleteProjectModal = document.getElementById('deleteProjectModal');
const deleteProjectModalTitle = document.getElementById('deleteProjectModalTitle');
const cancelDeleteProjectBtn = document.getElementById('cancelDeleteProjectBtn');
const deleteProjectBtn = document.getElementById('deleteProjectBtn');
const backupAndDeleteProjectBtn = document.getElementById('backupAndDeleteProjectBtn');
const manageCustomersBtn = document.getElementById('manageCustomersBtn');
const customersModal = document.getElementById('customersModal');
const closeCustomersModalBtn = document.getElementById('closeCustomersModalBtn');
const customersModalBody = document.getElementById('customersModalBody');
const addCustomerListBtn = document.getElementById('addCustomerListBtn');
const addCustomerListForm = document.getElementById('addCustomerListForm');
const cancelCustomerListBtn = document.getElementById('cancelCustomerListBtn');
const saveCustomerListBtn = document.getElementById('saveCustomerListBtn');
const createBackupBtn = document.getElementById('createBackupBtn');
const backupsPanelBtn = document.getElementById('backupsPanelBtn');
const backupsModal = document.getElementById('backupsModal');
const closeBackupsModalBtn = document.getElementById('closeBackupsModalBtn');
const backupMain = document.getElementById('backupMain');
const backupSidebar = document.getElementById('backupSidebar');
const closedProjectsBtn = document.getElementById('closedProjectsBtn');
const closedProjectsModal = document.getElementById('closedProjectsModal');
const closeClosedProjectsModalBtn = document.getElementById('closeClosedProjectsModalBtn');
const closedSearchInput = document.getElementById('closedSearchInput');
const closedPmFilter = document.getElementById('closedPmFilter');
const closedRegionFilter = document.getElementById('closedRegionFilter');
const closedMonthFilter = document.getElementById('closedMonthFilter');
const closedQuarterFilter = document.getElementById('closedQuarterFilter');
const refreshClosedProjectsBtn = document.getElementById('refreshClosedProjectsBtn');
const resetClosedFiltersBtn = document.getElementById('resetClosedFiltersBtn');
const addProjectBtn = document.getElementById('addProjectBtn') || document.getElementById('addNewBtn');
const addNewBtn = document.getElementById('addNewBtn');
const addNewChoiceModal = document.getElementById('addNewChoiceModal');
const addNewChoiceProjectBtn = document.getElementById('addNewChoiceProjectBtn');
const addNewChoiceTaskBtn = document.getElementById('addNewChoiceTaskBtn');
const taskModal = document.getElementById('taskModal');
const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
const cancelTaskModalBtn = document.getElementById('cancelTaskModalBtn');
const taskModalForm = document.getElementById('taskModalForm');
const projectModal = document.getElementById('projectModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const closeSaveBtn = document.getElementById('closeSaveBtn');
const modalProjectForm = document.getElementById('modalProjectForm');
const searchInput = document.getElementById('searchInput');
const pmFilter = document.getElementById('pmFilter');
const pmList = null;
const csmList = null;
const salesList = null;
const healthFilter = document.getElementById('healthFilter');
const progressFilter = document.getElementById('progressFilter');
const duemonthFilter = document.getElementById('duemonthFilter');
const addedMonthFilter = document.getElementById('addedMonthFilter');
const regionFilter = document.getElementById('regionFilter');
const importFromJiraBtn = document.getElementById('importFromJiraBtn');
const importModal = document.getElementById('importModal');
const closeImportModalBtn = document.getElementById('closeImportModalBtn');
const importPmSearch = document.getElementById('importPmSearch');
const importPmResults = document.getElementById('importPmResults');
const importPmStatus = document.getElementById('importPmStatus');
const importStep1 = document.getElementById('importStep1');
const importStep2 = document.getElementById('importStep2');
const importStep2Header = document.getElementById('importStep2Header');
const importSelectAll = document.getElementById('importSelectAll');
const importCount = document.getElementById('importCount');
const importProjectList = document.getElementById('importProjectList');
const importBackBtn = document.getElementById('importBackBtn');
const importConfirmBtn = document.getElementById('importConfirmBtn');
const importProgress = document.getElementById('importProgress');

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

function setupRichEditorToolbar(editorEl, scopeEl, options = {}) {
  const placeholderHtml = options.placeholderHtml || '';
  const colorPicker = scopeEl.querySelector('[data-role="colorPicker"]');
  const colorSwatch = scopeEl.querySelector('[data-role="colorSwatch"]');
  const fontSize = scopeEl.querySelector('[data-role="fontSize"]');
  const insertLinkBtn = scopeEl.querySelector('[data-role="insertLink"]');
  const linkPopup = scopeEl.querySelector('[data-role="linkPopup"]');
  const linkUrl = scopeEl.querySelector('[data-role="linkUrl"]');
  const linkText = scopeEl.querySelector('[data-role="linkText"]');
  const linkCancel = scopeEl.querySelector('[data-role="linkCancel"]');
  const linkInsert = scopeEl.querySelector('[data-role="linkInsert"]');
  const blurGuardEl = scopeEl.closest('.modal') || scopeEl;

  let savedLinkSelection = null;

  scopeEl.addEventListener('click', (event) => {
    const toolbarButton = event.target.closest('[data-rich-command]');
    if (toolbarButton) {
      event.preventDefault();
      document.execCommand(toolbarButton.dataset.richCommand, false, null);
      editorEl.focus();
      return;
    }
    const colorLabel = event.target.closest('.toolbar-color-btn');
    if (colorLabel) {
      editorEl.focus();
    }
  });

  colorPicker.addEventListener('change', (event) => {
    const color = event.target.value;
    colorSwatch.style.background = color;
    document.execCommand('foreColor', false, color);
    editorEl.focus();
  });

  fontSize.addEventListener('change', (e) => {
    const size = e.target.value;
    if (!size) return;
    editorEl.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    if (!sel.isCollapsed) {
      // Text selected — wrap it in a span with the chosen size
      const range = sel.getRangeAt(0);
      try {
        const frag = range.extractContents();
        const span = document.createElement('span');
        span.style.fontSize = size + 'pt';
        span.appendChild(frag);
        range.insertNode(span);
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
      } catch {}
    } else {
      // No selection — insert a zero-width space span so future typing uses this size
      const range = sel.getRangeAt(0);
      const span = document.createElement('span');
      span.style.fontSize = size + 'pt';
      span.innerHTML = '​'; // zero-width space as anchor
      range.insertNode(span);
      // Place cursor inside the span after the zero-width space
      const newRange = document.createRange();
      newRange.setStart(span.firstChild, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }
  });

  insertLinkBtn.addEventListener('click', () => {
    savedLinkSelection = window.getSelection()?.getRangeAt(0)?.cloneRange() || null;
    const selectedText = window.getSelection()?.toString() || '';
    linkText.value = selectedText;
    linkUrl.value = '';
    linkPopup.style.display = linkPopup.style.display === 'flex' ? 'none' : 'flex';
    if (linkPopup.style.display === 'flex') linkUrl.focus();
  });

  linkCancel.addEventListener('click', () => {
    linkPopup.style.display = 'none';
    editorEl.focus();
  });

  linkInsert.addEventListener('click', () => {
    const url = linkUrl.value.trim();
    const text = linkText.value.trim() || url;
    if (!url) return;
    editorEl.focus();
    if (savedLinkSelection) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedLinkSelection);
    }
    document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>`);
    linkPopup.style.display = 'none';
    savedLinkSelection = null;
  });

  editorEl.addEventListener('focus', () => {
    if (editorEl.getAttribute('data-placeholder-active')) {
      editorEl.innerHTML = '';
      editorEl.removeAttribute('data-placeholder-active');
    }
  });

  if (placeholderHtml) {
    editorEl.addEventListener('blur', (e) => {
      // Don't trigger placeholder if focus moved to another element inside the same modal
      if (e.relatedTarget && blurGuardEl.contains(e.relatedTarget)) return;
      if (!editorEl.textContent.trim() && !editorEl.querySelector('img, br, li, div')) {
        editorEl.innerHTML = placeholderHtml;
        editorEl.setAttribute('data-placeholder-active', '1');
      }
    });
  }

  return { linkPopup };
}

// --- @mention autocomplete, shared by every rich editor instance ---
let _mentionDropdownEl = null;
let _mentionState = { editorEl: null, node: null, atOffset: -1, endOffset: -1, items: [], activeIndex: -1 };
let _mentionSearchTimer = null;
let _mentionInserting = false;

function getMentionDropdown() {
  if (!_mentionDropdownEl) {
    _mentionDropdownEl = document.createElement('ul');
    _mentionDropdownEl.id = 'mentionDropdown';
    _mentionDropdownEl.className = 'mention-dropdown hidden';
    document.body.appendChild(_mentionDropdownEl);
    _mentionDropdownEl.addEventListener('mousedown', (e) => {
      const li = e.target.closest('li[data-account-id]');
      if (!li) return;
      e.preventDefault();
      insertMention(li.dataset.accountId, li.dataset.displayName);
    });
  }
  return _mentionDropdownEl;
}

function hideMentionDropdown() {
  const dd = getMentionDropdown();
  dd.classList.add('hidden');
  _mentionState.editorEl = null;
  _mentionState.node = null;
  _mentionState.items = [];
  _mentionState.activeIndex = -1;
}

function setMentionActive(index) {
  const dd = getMentionDropdown();
  _mentionState.activeIndex = index;
  [...dd.children].forEach((li, i) => li.classList.toggle('active', i === index));
}

function moveMentionActive(delta) {
  if (!_mentionState.items.length) return;
  const next = (_mentionState.activeIndex + delta + _mentionState.items.length) % _mentionState.items.length;
  setMentionActive(next);
}

function renderMentionDropdown(items) {
  const dd = getMentionDropdown();
  _mentionState.items = items;
  if (!items.length) {
    dd.innerHTML = '<li class="mention-dropdown-empty">No users found</li>';
  } else {
    dd.innerHTML = items.map(u => `
      <li data-account-id="${escapeHtml(u.accountId)}" data-display-name="${escapeHtml(u.displayName)}">
        <span class="mention-dropdown-name">${escapeHtml(u.displayName)}</span>
        <span class="mention-dropdown-email">${escapeHtml(u.emailAddress || '')}</span>
      </li>`).join('');
  }
  dd.classList.remove('hidden');
  setMentionActive(items.length ? 0 : -1);
}

function positionMentionDropdown() {
  const dd = getMentionDropdown();
  const sel = window.getSelection();
  let rect = null;
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    rect = range.getClientRects()[0] || range.getBoundingClientRect();
  }
  if (!rect || (!rect.width && !rect.height && !rect.top && !rect.left)) {
    rect = _mentionState.editorEl ? _mentionState.editorEl.getBoundingClientRect() : { bottom: 0, left: 0 };
  }
  dd.style.top = `${rect.bottom + 4}px`;
  dd.style.left = `${rect.left}px`;
}

function insertMention(accountId, displayName) {
  const { node, atOffset, endOffset, editorEl } = _mentionState;
  if (!node || !node.parentNode || !editorEl) { hideMentionDropdown(); return; }
  _mentionInserting = true;
  const range = document.createRange();
  try {
    range.setStart(node, atOffset);
    range.setEnd(node, endOffset);
  } catch {
    hideMentionDropdown();
    _mentionInserting = false;
    return;
  }
  range.deleteContents();

  const frag = document.createDocumentFragment();
  if (accountId) {
    const mentionSpan = document.createElement('span');
    mentionSpan.className = 'mention';
    mentionSpan.contentEditable = 'false';
    mentionSpan.dataset.accountId = accountId;
    mentionSpan.textContent = '@' + (displayName || '');
    frag.appendChild(mentionSpan);
  } else {
    frag.appendChild(document.createTextNode('@' + (displayName || '')));
  }
  const spaceNode = document.createTextNode(' ');
  frag.appendChild(spaceNode);
  range.insertNode(frag);

  const sel = window.getSelection();
  const newRange = document.createRange();
  newRange.setStartAfter(spaceNode);
  newRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(newRange);

  hideMentionDropdown();
  editorEl.focus();
  setTimeout(() => { _mentionInserting = false; }, 0);
}

function setupMentionAutocomplete(editorEl) {
  editorEl.addEventListener('input', () => {
    if (_mentionInserting) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) { hideMentionDropdown(); return; }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) { hideMentionDropdown(); return; }
    const textBefore = node.textContent.slice(0, range.startOffset);
    const match = /(?:^|\s)@([\w.-]{1,30})$/.exec(textBefore);
    if (!match) { hideMentionDropdown(); return; }
    const query = match[1];
    _mentionState.editorEl = editorEl;
    _mentionState.node = node;
    _mentionState.atOffset = range.startOffset - query.length - 1;
    _mentionState.endOffset = range.startOffset;

    clearTimeout(_mentionSearchTimer);
    _mentionSearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`${PROXY_BASE}/jira/user/search?query=${encodeURIComponent(query)}`, {
          headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
        });
        if (!res.ok) { hideMentionDropdown(); return; }
        const jiraUsers = await res.json();
        renderMentionDropdown(Array.isArray(jiraUsers) ? jiraUsers.slice(0, 8) : []);
        positionMentionDropdown();
      } catch { hideMentionDropdown(); }
    }, 300);
  });

  editorEl.addEventListener('keydown', (e) => {
    const dd = getMentionDropdown();
    if (dd.classList.contains('hidden') || _mentionState.editorEl !== editorEl) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveMentionActive(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveMentionActive(-1); }
    else if (e.key === 'Enter') {
      if (_mentionState.activeIndex >= 0 && _mentionState.items[_mentionState.activeIndex]) {
        e.preventDefault();
        const item = _mentionState.items[_mentionState.activeIndex];
        insertMention(item.accountId, item.displayName);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideMentionDropdown();
    }
  });

  editorEl.addEventListener('blur', () => {
    setTimeout(() => { if (_mentionState.editorEl === editorEl) hideMentionDropdown(); }, 0);
  });
}

// --- Dashboard-styled replacement for native confirm()/prompt() dialogs ---
let _appDialogState = null;

function finishAppDialog(result) {
  if (!_appDialogState) return;
  const resolve = _appDialogState.resolve;
  _appDialogState = null;
  appDialogModal.classList.add('hidden');
  appDialogModal.setAttribute('aria-hidden', 'true');
  appDialogInput.value = '';
  appDialogError.classList.add('hidden');
  resolve(result);
}

function setupAppDialog() {
  function onConfirm() {
    if (!_appDialogState) return;
    if (_appDialogState.validate) {
      const value = appDialogInput.value;
      const errorMsg = _appDialogState.validate(value);
      if (errorMsg) {
        appDialogError.textContent = errorMsg;
        appDialogError.classList.remove('hidden');
        appDialogInput.value = '';
        appDialogInput.focus();
        return;
      }
      finishAppDialog(value);
    } else {
      finishAppDialog(true);
    }
  }
  function onCancel() {
    if (!_appDialogState) return;
    finishAppDialog(_appDialogState.isPassword ? null : false);
  }
  appDialogConfirmBtn.addEventListener('click', onConfirm);
  appDialogCancelBtn.addEventListener('click', onCancel);
  closeAppDialogBtn.addEventListener('click', onCancel);
  appDialogModal.addEventListener('click', (e) => { if (e.target === appDialogModal) onCancel(); });
  appDialogInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
  });
}

function openAppDialog({ eyebrow, title, message, isPassword = false, danger = false, confirmLabel = 'OK', validate = null }) {
  appDialogEyebrow.textContent = eyebrow || (isPassword ? 'Password required' : 'Confirm');
  appDialogTitle.textContent = title || (isPassword ? 'Enter password' : 'Are you sure?');
  appDialogMessage.textContent = message || '';
  appDialogMessage.style.display = message ? '' : 'none';
  appDialogInput.style.display = isPassword ? '' : 'none';
  appDialogInput.value = '';
  appDialogError.classList.add('hidden');
  appDialogConfirmBtn.textContent = confirmLabel;
  appDialogConfirmBtn.classList.toggle('danger-btn', danger);
  appDialogConfirmBtn.classList.toggle('primary-btn', !danger);
  appDialogModal.classList.remove('hidden');
  appDialogModal.setAttribute('aria-hidden', 'false');
  if (isPassword) setTimeout(() => appDialogInput.focus(), 30);
  return new Promise((resolve) => {
    _appDialogState = { resolve, isPassword, validate };
  });
}

function showAppConfirm(message, opts = {}) {
  return openAppDialog({
    message,
    isPassword: false,
    danger: opts.danger || false,
    title: opts.title,
    eyebrow: opts.eyebrow,
    confirmLabel: opts.confirmLabel || 'OK',
  });
}

setupAppDialog();

let addUserReturnContext = null;

function setupAutocomplete(input, getOptions, role, addCallback, addLabel) {
  const list = input.closest('.autocomplete-wrap').querySelector('.autocomplete-list');
  let activeIndex = -1;

  function buildList(matches, typedTerm) {
    const items = matches.map(item => `<li>${escapeHtml(item)}</li>`);
    const exactMatch = matches.some(m => m.toLowerCase() === typedTerm.toLowerCase());
    if (typedTerm && !exactMatch) {
      if (role) {
        items.push(`<li class="autocomplete-add" data-add-name="${escapeHtml(typedTerm)}" data-add-role="${escapeHtml(role)}">➕ Add "${escapeHtml(typedTerm)}" as new ${escapeHtml(role)}</li>`);
      } else if (addCallback) {
        items.push(`<li class="autocomplete-add" data-add-name="${escapeHtml(typedTerm)}">➕ Add "${escapeHtml(typedTerm)}" as new ${escapeHtml(addLabel || 'customer')}</li>`);
      }
    }
    list.innerHTML = items.join('');
    activeIndex = -1;
    list.classList.toggle('hidden', items.length === 0);
  }

  function hideList() {
    list.classList.add('hidden');
    activeIndex = -1;
  }

  function setActive(index) {
    const items = list.querySelectorAll('li');
    items.forEach(li => li.classList.remove('active'));
    if (index >= 0 && index < items.length) {
      items[index].classList.add('active');
      items[index].scrollIntoView({ block: 'nearest' });
    }
    activeIndex = index;
  }

  input.addEventListener('focus', () => {
    const term = input.value.trim();
    const opts = getOptions();
    const matches = term ? opts.filter(o => o.toLowerCase().includes(term.toLowerCase())) : opts;
    buildList(matches, term);
  });

  input.addEventListener('input', () => {
    const term = input.value.trim();
    const opts = getOptions();
    const matches = term ? opts.filter(o => o.toLowerCase().includes(term.toLowerCase())) : opts;
    buildList(matches, term);
  });

  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('li');
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const active = items[activeIndex];
      if (active.classList.contains('autocomplete-add')) {
        if (active.dataset.addRole) {
          triggerAddUserFromAutocomplete(active.dataset.addName, active.dataset.addRole, input);
        } else if (addCallback) {
          addCallback(active.dataset.addName, input);
        }
      } else {
        input.value = active.textContent;
        input.dispatchEvent(new Event('change'));
      }
      hideList();
    }
    else if (e.key === 'Escape') { hideList(); }
  });

  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    if (li.classList.contains('autocomplete-add')) {
      if (li.dataset.addRole) {
        triggerAddUserFromAutocomplete(li.dataset.addName, li.dataset.addRole, input);
      } else if (addCallback) {
        addCallback(li.dataset.addName, input);
      }
    } else {
      input.value = li.textContent;
      input.dispatchEvent(new Event('change'));
    }
    hideList();
  });

  document.addEventListener('click', (e) => {
    if (!input.closest('.autocomplete-wrap').contains(e.target)) hideList();
  });
}

let addCustomerReturnContext = null;

function triggerAddCustomerFromAutocomplete(name, returnInput, sourceModal) {
  document.getElementById('newCustomerName').value = name;
  document.getElementById('newCustomerSfLink').value = '';
  const src = sourceModal || projectModal;
  addCustomerReturnContext = { inputEl: returnInput, sourceModal: src };
  src.classList.add('hidden');
  src.setAttribute('aria-hidden', 'true');
  addCustomerModal.classList.remove('hidden');
  addCustomerModal.setAttribute('aria-hidden', 'false');
}

function closeAddCustomerModal() {
  addCustomerModal.classList.add('hidden');
  addCustomerModal.setAttribute('aria-hidden', 'true');
  document.getElementById('newCustomerName').value = '';
  document.getElementById('newCustomerSfLink').value = '';
}

function triggerAddUserFromAutocomplete(name, role, returnInput) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  document.getElementById('newUserFirstName').value = firstName;
  document.getElementById('newUserLastName').value = lastName;
  if (role) document.getElementById(`newUserRole${role}`).checked = true;
  addUserForm.style.display = 'grid';
  addUserBtn.style.display = 'none';

  addUserReturnContext = { inputEl: returnInput, fullName: name };

  projectModal.classList.add('hidden');
  projectModal.setAttribute('aria-hidden', 'true');
  usersModal.classList.remove('hidden');
  usersModal.setAttribute('aria-hidden', 'false');
}

function initAutocompletes() {
  setupAutocomplete(document.getElementById('modalProjectPm'), () => getUsersByRole('PM'), 'PM');
  setupAutocomplete(document.getElementById('modalProjectCsm'), () => getUsersByRole('CSM'), 'CSM');
  setupAutocomplete(document.getElementById('modalProjectSales'), () => getUsersByRole('Sales'), 'Sales');
  setupAutocomplete(document.getElementById('modalProjectCustomer'), () => getCustomerNames(), null, triggerAddCustomerFromAutocomplete);
  setupAutocomplete(document.getElementById('editCustomerName'), () => getCustomerNames(), null,
    (name, input) => triggerAddCustomerFromAutocomplete(name, input, editProjectModal));
}

function initTaskFormAutocompletes() {
  const custInput = document.getElementById('taskCustomer');
  const projSelect = document.getElementById('taskProject');
  const jiraInput = document.getElementById('taskJira');

  function updateProjectList() {
    const custName = custInput.value.trim();
    const activeStatuses = ['On Track', 'At Risk', 'Delayed', 'Open', 'In Progress'];
    const matchingProjects = projects
      .filter(p => p.customer === custName && activeStatuses.includes(p.status))
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    projSelect.innerHTML = matchingProjects.length
      ? '<option value="">— select project —</option>' + matchingProjects.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="">— no active projects for this customer —</option>';
    jiraInput.value = '';
    document.getElementById('taskRegion').value = '';
  }

  setupAutocomplete(custInput, () => [...getCustomerNames()].sort((a, b) => a.localeCompare(b)), null, null);

  custInput.addEventListener('input', updateProjectList);
  custInput.addEventListener('change', updateProjectList);

  projSelect.addEventListener('change', () => {
    const projName = projSelect.value;
    const proj = projects.find(p => p.name === projName && p.customer === custInput.value.trim());
    jiraInput.value = proj ? (proj.jira || '') : '';
    document.getElementById('taskRegion').value = proj ? (proj.region || '') : '';
  });

  setupAutocomplete(document.getElementById('taskOwner'), () => users.map(u => getUserDisplayName(u)).sort(), null,
    (name, input) => {
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      document.getElementById('newUserFirstName').value = firstName;
      document.getElementById('newUserLastName').value = lastName;
      addUserForm.style.display = 'grid';
      addUserBtn.style.display = 'none';
      addUserReturnContext = { inputEl: input, fullName: name, sourceModal: taskModal };
      taskModal.classList.add('hidden');
      taskModal.setAttribute('aria-hidden', 'true');
      usersModal.classList.remove('hidden');
      usersModal.setAttribute('aria-hidden', 'false');
    },
    'user'
  );
}

function getJiraLabel(jira) {
  if (!jira) return '-';

  const browseMatch = jira.match(/\/browse\/([A-Za-z0-9-]+)/i);
  if (browseMatch) return browseMatch[1];

  const pathParts = jira.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  return lastPart && lastPart !== 'browse' ? lastPart : jira;
}

function getJiraIssueKey(jira) {
  if (!jira) return '';

  const browseMatch = jira.match(/\/browse\/([A-Za-z0-9-]+)/i);
  if (browseMatch) return browseMatch[1];

  const pathMatch = jira.match(/\/([A-Z]+-[0-9]+)(?:\/|$)/);
  return pathMatch ? pathMatch[1] : '';
}

async function getJiraResolutionDate(issueKey) {
  if (!issueKey) return null;
  try {
    const res = await fetch(`${PROXY_BASE}/jira/issue/${issueKey}?fields=resolutiondate`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.fields?.resolutiondate || null;
  } catch {
    return null;
  }
}

function validSfUrl(url) {
  if (!url || typeof url !== 'string') return '';
  // Reject URLs with N/A, null, undefined, or non-SF-looking IDs
  if (/\/N\/A\//i.test(url) || /\/null\//i.test(url) || /\/undefined\//i.test(url)) return '';
  // Must look like a real Salesforce URL
  if (!url.startsWith('http')) return '';
  return url;
}

function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '$0K';
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return String(val);
  const k = num / 1000;
  const rounded = Math.round(k * 10) / 10;
  return `$${rounded}K`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y.slice(2)}`;
}

function formatDateDMY(dateStr) {
  return formatDate(dateStr);
}

function setupDateInput(input) {
  input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 6) val = val.slice(0, 6);
    if (val.length >= 5) val = val.slice(0,2) + '/' + val.slice(2,4) + '/' + val.slice(4);
    else if (val.length >= 3) val = val.slice(0,2) + '/' + val.slice(2);
    e.target.value = val;
  });
}

function parseDateInput(val) {
  if (!val) return '';
  const parts = val.trim().split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const fullYear = y.length === 2 ? `20${y}` : y;
    return `${fullYear}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return val;
}

function normalizeProgress(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Math.round(numericValue));
}

function getProgressTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-neutral';
  if (numericValue < 50) return 'progress-green';
  if (numericValue <= 75) return 'progress-yellow';
  if (numericValue <= 90) return 'progress-orange';
  return 'progress-red';
}

function getProgressFillTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-fill-neutral';
  if (numericValue < 50) return 'progress-fill-green';
  if (numericValue <= 75) return 'progress-fill-yellow';
  if (numericValue <= 90) return 'progress-fill-orange';
  return 'progress-fill-red';
}

function buildHoursLabel(actualHours, estimatedHours, nrr) {
  const actual = Math.round(actualHours ?? 0);
  const est = (estimatedHours != null && estimatedHours !== '') ? Number(estimatedHours) : null;
  const planned = est != null ? Math.round(est) : ((nrr != null && nrr !== '') ? Math.round(Number(nrr)) : null);
  if (planned != null) return `${actual} / ${planned}h`;
  return `${actual}h actual`;
}

function applyFieldNames(names) {
  for (const [id, name] of Object.entries(names)) {
    if (name === 'Risk Reason') cachedRiskReasonFieldId = id;
    if (name === 'VM Forecast Commit Date') cachedVMForecastFieldId = id;
    if (name === 'Project Progress Percentage') cachedProgressPctFieldId = id;
    if (name === 'Estimated PS Hours') cachedEstHoursFieldId = id;
    if (name === 'Remaining Effort') cachedRemEffortFieldId = id;
    if (name === 'Actual Effort(H)') cachedActEffortFieldId = id;
    if (name === 'Risk Rate') cachedRiskRateFieldId = id;
    if (name === 'Account Name') cachedAccountNameFieldId = id;
    if (name === 'Account Owner') cachedAccountOwnerFieldId = id;
    if (name === 'Opportunity URL') cachedOppUrlFieldId = id;
    if (name === 'Account URL') cachedAccountUrlFieldId = id;
    if (name === 'Account Customer Success Manager') cachedAccountCsmFieldId = id;
    if (name === 'MRR (USD)') cachedMrrFieldId = id;
    if (name === 'NRR(USD)') cachedNrrFieldId = id;
    if (name === 'Region') cachedRegionFieldId = id;
  }
}

async function resolveJiraFieldIds() {
  const useProxy = true;
  const opts = useProxy
    ? { headers: { Accept: 'application/json' } }
    : { credentials: 'include', headers: { Accept: 'application/json' } };

  // First try /jira/field (lightweight)
  try {
    const url = useProxy
      ? 'https://pm-proxy.demo.qa.kaltura.ai/jira/field'
      : 'https://kaltura.atlassian.net/rest/api/3/field';
    const res = await fetch(url, opts);
    if (res.ok) {
      const fields = await res.json();
      const namesMap = {};
      for (const f of fields) namesMap[f.id] = f.name;
      applyFieldNames(namesMap);
    }
  } catch {}

  // If critical fields are still missing, fetch from a real issue's names map
  if (!cachedAccountNameFieldId || !cachedVMForecastFieldId || !cachedEstHoursFieldId || !cachedRiskRateFieldId) {
    const firstKey = projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean)[0];
    if (firstKey) {
      try {
        const url = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${firstKey}?fields=*all&expand=names`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${firstKey}?fields=*all&expand=names`;
        const res = await fetch(url, opts);
        if (res.ok) {
          const data = await res.json();
          if (data.names) applyFieldNames(data.names);
        }
      } catch {}
    }
  }

  if (cachedRiskRateFieldId && !cachedRiskRateOptions) {
    await resolveRiskRateOptions(cachedRiskRateFieldId);
  }
}

async function resolveRiskRateOptions(fieldId) {
  const issueKey = projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean)[0];
  if (!issueKey) return;
  const useProxy = true;
  const url = useProxy
    ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${issueKey}/editmeta`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}/editmeta`;
  const opts = useProxy
    ? { headers: { Accept: 'application/json' } }
    : { credentials: 'include', headers: { Accept: 'application/json' } };
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return;
    const data = await res.json();
    const field = data.fields?.[fieldId];
    if (!field?.allowedValues) return;
    cachedRiskRateOptions = {};
    for (const opt of field.allowedValues) {
      cachedRiskRateOptions[opt.value] = opt.id;
    }
  } catch {}
}

async function syncProjectProgressFromJira() {
  // Pull the latest KV state first — otherwise a stale in-memory copy of `projects`
  // (e.g. a browser tab that's been open since before someone else's edit) would get
  // written back wholesale by saveProjects() below, clobbering that other change.
  await refreshProjectsAndTasksFromKv().catch(() => {});

  const issueKeys = projects
    .map((project) => getJiraIssueKey(project.jira))
    .filter(Boolean);

  if (!issueKeys.length) return;

  const useProxy = true;

  await resolveJiraFieldIds();

  // Build fields param from cached IDs — only request what we need
  const fieldIds = ['progress', 'assignee', cachedProgressPctFieldId, cachedEstHoursFieldId, cachedRemEffortFieldId, cachedActEffortFieldId, cachedRegionFieldId, cachedRiskRateFieldId, cachedVMForecastFieldId, cachedAccountOwnerFieldId, cachedAccountCsmFieldId, cachedOppUrlFieldId, cachedAccountUrlFieldId].filter(Boolean);
  const fieldsParam = fieldIds.join(',');

  const uniqueKeys = [...new Set(issueKeys)];
  const BATCH_SIZE = 10;
  let changed = false;

  for (let i = 0; i < uniqueKeys.length; i += BATCH_SIZE) {
    const batch = uniqueKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (key) => {
      try {
        const url = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${key}?fields=${fieldsParam}`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${key}?fields=${fieldsParam}`;
        const fetchOpts = useProxy
          ? { headers: { Accept: 'application/json' } }
          : { credentials: 'include', headers: { Accept: 'application/json' } };
        const response = await fetch(url, fetchOpts);
        if (!response.ok) return;

        const data = await response.json();
        const f = data.fields || {};

        let percent = null;
        if (cachedProgressPctFieldId) {
          const raw = f[cachedProgressPctFieldId];
          const extracted = (raw !== null && typeof raw === 'object') ? (raw.value ?? raw.percent ?? null) : raw;
          percent = normalizeProgress(extracted);
        }
        if (percent === null) percent = normalizeProgress(f.progress?.percent ?? f.progress);

        const readHours = (fieldId) => {
          if (!fieldId) return null;
          const raw = f[fieldId];
          const v = (raw !== null && typeof raw === 'object') ? (raw.value ?? null) : raw;
          return (v !== null && Number.isFinite(Number(v))) ? Math.round(Number(v)) : null;
        };
        const estimatedHours = readHours(cachedEstHoursFieldId);
        const remainingHours = readHours(cachedRemEffortFieldId);
        const actualHours = readHours(cachedActEffortFieldId);
        const healthVal = cachedRiskRateFieldId ? (f[cachedRiskRateFieldId]?.value || null) : null;

        const rawOwner = cachedAccountOwnerFieldId ? f[cachedAccountOwnerFieldId] : null;
        const accountOwnerName = rawOwner ? (typeof rawOwner === 'string' ? rawOwner : (rawOwner.displayName || rawOwner.name || '')) : null;

        const rawCsm = cachedAccountCsmFieldId ? f[cachedAccountCsmFieldId] : null;
        const accountCsmName = rawCsm ? (typeof rawCsm === 'string' ? rawCsm : (rawCsm.displayName || rawCsm.name || '')) : null;

        const oppUrl = cachedOppUrlFieldId ? (validSfUrl(f[cachedOppUrlFieldId]) || null) : null;
        const accountUrl = cachedAccountUrlFieldId ? (validSfUrl(f[cachedAccountUrlFieldId]) || null) : null;

        projects.forEach((project) => {
          if (getJiraIssueKey(project.jira) !== key) return;
          if (percent !== null) { project.progress = percent; changed = true; }
          if (estimatedHours !== null) { project.estimatedHours = estimatedHours; changed = true; }
          if (remainingHours !== null) { project.remainingHours = remainingHours; changed = true; }
          if (actualHours !== null) { project.actualHours = actualHours; changed = true; }
          if (healthVal) { project.health = healthVal; changed = true; }
          if (cachedVMForecastFieldId && f[cachedVMForecastFieldId]) { project.dueDate = f[cachedVMForecastFieldId]; changed = true; }
          if (f.assignee?.displayName) { project.manager = f.assignee.displayName; changed = true; }
          if (cachedRegionFieldId) {
            const rawRegion = f[cachedRegionFieldId];
            const regionVal = typeof rawRegion === 'object' && rawRegion !== null ? (rawRegion.value || '') : (rawRegion || '');
            if (regionVal && !project.region) { project.region = regionVal; changed = true; }
          }
          if (accountOwnerName) {
            project.sales = accountOwnerName;
            project.comments = (project.comments || '').replace(/Sales:\s*[^,\n]*/i, `Sales: ${accountOwnerName}`);
            changed = true;
          }
          if (accountCsmName) {
            project.csm = accountCsmName;
            project.comments = (project.comments || '').replace(/CSM:\s*[^,\n]*/i, `CSM: ${accountCsmName}`);
            changed = true;
          }
          if (oppUrl) { project.oppLink = oppUrl; changed = true; }
          if (accountUrl) { project.accountUrl = accountUrl; changed = true; }
        });
      } catch (error) {
        console.warn(`Jira sync failed for ${key}`, error);
      }
    }));
    if (changed) { saveProjects('jira-progress-sync'); renderAll(); changed = false; }
  }
}

async function syncStatusFromJira() {
  // Same reasoning as syncProjectProgressFromJira — refresh before mutating so we don't
  // write back a stale copy that clobbers someone else's concurrent change.
  await refreshProjectsAndTasksFromKv().catch(() => {});

  const useProxy = true;
  const BATCH_SIZE = 10;
  let changed = false;

  const projectsWithKeys = projects
    .map(p => ({ project: p, issueKey: getJiraIssueKey(p.jira) }))
    .filter(({ issueKey }) => !!issueKey);

  for (let i = 0; i < projectsWithKeys.length; i += BATCH_SIZE) {
    const batch = projectsWithKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async ({ project, issueKey }) => {
      try {
        const url = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${issueKey}?fields=description,updated`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}?fields=description,updated`;
        const opts = useProxy
          ? { headers: { Accept: 'application/json' } }
          : { credentials: 'include', headers: { Accept: 'application/json' } };
        const res = await fetch(url, opts);
        if (!res.ok) return;
        const data = await res.json();
        const jiraUpdated = data.fields?.updated || '';
        const localUpdated = project.statusUpdatedAt || '';
        const jiraTime = jiraUpdated ? new Date(jiraUpdated).getTime() : 0;
        const localTime = localUpdated ? new Date(localUpdated).getTime() : 0;

        const recentlySaved = localTime && (Date.now() - localTime) < 10 * 60 * 1000;
        const localIsEmpty = !project.statusText || isEmptyStatus(project.statusText);
        if (localIsEmpty || (!recentlySaved && (!localTime || jiraTime > localTime))) {
          // Jira is newer and local wasn't recently edited — pull from Jira
          const adf = data.fields?.description;
          const html = adf ? adfToHtml(adf) : '';
          if (html !== project.statusText) {
            project.statusText = html;
            project.statusUpdatedAt = jiraUpdated;
            changed = true;
          }
        }
        // Note: push-on-load disabled — Jira's issue-level `updated` tracks all field changes,
        // not just description, so it cannot reliably determine if dashboard status is newer.
        // Dashboard→Jira sync happens only on explicit edit-modal save.
      } catch {}
    }));
  }

  if (changed) {
    saveProjects('jira-status-sync');
    renderAll();
  }
}

function adfToHtml(adf) {
  if (!adf || !adf.content) return '';
  return adf.content.map(node => adfBlockToHtml(node)).join('');
}

function adfBlockToHtml(node) {
  if (!node) return '';
  if (node.type === 'paragraph') {
    const inner = (node.content || []).map(adfInlineToHtml).join('');
    return `<div>${inner || '<br>'}</div>`;
  }
  if (node.type === 'bulletList') {
    const items = (node.content || []).map(item => {
      const children = (item.content || []).map(adfBlockToHtml).join('');
      return `<li>${children}</li>`;
    }).join('');
    return `<ul>${items}</ul>`;
  }
  if (node.type === 'orderedList') {
    const items = (node.content || []).map((item, idx) => {
      const children = (item.content || []).map(adfBlockToHtml).join('');
      return `<li>${children}</li>`;
    }).join('');
    return `<ol>${items}</ol>`;
  }
  if (node.type === 'heading') {
    const level = node.attrs?.level || 1;
    const inner = (node.content || []).map(adfInlineToHtml).join('');
    return `<h${level}>${inner}</h${level}>`;
  }
  if (node.type === 'taskList') {
    return (node.content || []).map(item => {
      const box = item.attrs?.state === 'DONE' ? '☑' : '☐';
      const text = (item.content || []).map(adfInlineToHtml).join('');
      return `<div>${box} ${text}</div>`;
    }).join('');
  }
  if (node.type === 'hardBreak') return '<br>';
  // fallback: render content if present
  return (node.content || []).map(adfBlockToHtml).join('');
}

function adfInlineToHtml(node) {
  if (!node) return '';
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'inlineCard') {
    const url = node.attrs?.url || '';
    if (/^https?:/i.test(url)) return `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
    return '';
  }
  if (node.type === 'mention') {
    const id = node.attrs?.id || '';
    let text = node.attrs?.text || '';
    if (text && !text.startsWith('@')) text = '@' + text;
    return `<span class="mention" contenteditable="false" data-account-id="${escapeHtml(id)}">${escapeHtml(text)}</span>`;
  }
  if (node.type !== 'text') return '';
  let text = escapeHtml(node.text || '');
  if (!text) return '';
  const marks = node.marks || [];
  for (const mark of marks) {
    if (mark.type === 'strong') text = `<strong>${text}</strong>`;
    else if (mark.type === 'em') text = `<em>${text}</em>`;
    else if (mark.type === 'underline') text = `<u>${text}</u>`;
    else if (mark.type === 'textColor') {
      const color = mark.attrs?.color || '';
      if (/^#[0-9a-fA-F]{3,8}$|^rgb\(/.test(color)) text = `<span style="color:${escapeHtml(color)}">${text}</span>`;
    }
    else if (mark.type === 'link') {
      const href = mark.attrs?.href || '';
      if (/^https?:|^mailto:/i.test(href)) text = `<a href="${escapeHtml(href)}">${text}</a>`;
    }
  }
  return text;
}

function htmlToAdf(html) {
  if (!html || !html.trim()) return { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  const div = document.createElement('div');
  div.innerHTML = html;
  const content = htmlNodesToAdf(div.childNodes);
  return { version: 1, type: 'doc', content: content.length ? content : [{ type: 'paragraph', content: [] }] };
}

function isAdfBlockNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return /^(ul|ol|li|h[1-6]|div|p|br)$/.test(node.tagName.toLowerCase());
}

function htmlNodesToAdf(nodes) {
  const result = [];
  const nodeList = [...nodes];
  let i = 0;
  while (i < nodeList.length) {
    const node = nodeList[i];
    // A run of bare text/inline-formatted nodes with no wrapping <div>/<p> — happens for
    // the first line typed in a contenteditable before the browser wraps subsequent lines
    // in <div>s. Merge the whole run into ONE paragraph (via inlineNodeToAdf, which knows
    // how to apply marks for a node passed directly rather than only to its children).
    if (node.nodeType === Node.TEXT_NODE || !isAdfBlockNode(node)) {
      const runContent = [];
      while (i < nodeList.length && (nodeList[i].nodeType === Node.TEXT_NODE || !isAdfBlockNode(nodeList[i]))) {
        runContent.push(...inlineNodeToAdf(nodeList[i]));
        i++;
      }
      if (runContent.length) result.push({ type: 'paragraph', content: runContent });
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        const listType = tag === 'ul' ? 'bulletList' : 'orderedList';
        const items = [];
        for (const child of node.children) {
          const childTag = child.tagName.toLowerCase();
          if (childTag === 'ul' || childTag === 'ol') {
            // Bare nested list (browser indent quirk) — attach to last listItem
            const nestedType = childTag === 'ul' ? 'bulletList' : 'orderedList';
            const nestedItems = [...child.children].map(li => {
              const parsed = htmlNodesToAdf(li.childNodes);
              const content = parsed.length
                ? parsed.map(n => (n.type === 'paragraph' || n.type === 'bulletList' || n.type === 'orderedList') ? n : { type: 'paragraph', content: [n] })
                : [{ type: 'paragraph', content: [] }];
              return { type: 'listItem', content };
            }).filter(i => i.content.length > 0);
            if (nestedItems.length) {
              const nested = { type: nestedType, content: nestedItems };
              if (items.length > 0) {
                items[items.length - 1].content.push(nested);
              } else {
                items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [] }, nested] });
              }
            }
          } else if (childTag === 'li') {
            const parsed = htmlNodesToAdf(child.childNodes);
            const content = parsed.length
              ? parsed.map(n => (n.type === 'paragraph' || n.type === 'bulletList' || n.type === 'orderedList') ? n : { type: 'paragraph', content: [n] })
              : [{ type: 'paragraph', content: [] }];
            items.push({ type: 'listItem', content });
          }
        }
        if (items.length) result.push({ type: listType, content: items });
      } else if (tag === 'li') {
        const inner = htmlNodesToAdf(node.childNodes);
        result.push({ type: 'listItem', content: inner.length ? inner : [{ type: 'paragraph', content: [] }] });
      } else if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1]);
        const content = htmlInlineToAdf(node);
        result.push({ type: 'heading', attrs: { level }, content });
      } else if (tag === 'div' || tag === 'p') {
        // If div contains block-level children (ul/ol/div/p), recurse as blocks
        const hasBlockChildren = [...node.childNodes].some(c =>
          c.nodeType === Node.ELEMENT_NODE && /^(ul|ol|div|p|h[1-6]|br)$/.test(c.tagName.toLowerCase())
        );
        if (hasBlockChildren) {
          result.push(...htmlNodesToAdf(node.childNodes));
        } else {
          const content = htmlInlineToAdf(node);
          result.push({ type: 'paragraph', content });
        }
      } else if (tag === 'br') {
        result.push({ type: 'paragraph', content: [] });
      }
      i++;
      continue;
    }
    i++;
  }
  return result;
}

// Converts a SINGLE DOM node (text node, or an inline-formatted element like <b>/<a>/<span>)
// into ADF inline node(s), applying that node's own mark if it has one. Used both when
// iterating a block container's children (htmlInlineToAdf) and when an inline-formatted
// element appears bare at the top level with no wrapping <div> — e.g. the first line typed
// in a contenteditable, before the browser wraps subsequent lines. Passing such a node
// straight to htmlInlineToAdf would only look at ITS children and never apply the mark for
// the node itself, silently dropping bold/links/color on that first line.
function inlineNodeToAdf(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    return text ? [{ type: 'text', text }] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return [{ type: 'hardBreak' }];
  if (tag === 'span' && node.classList.contains('mention') && node.dataset.accountId) {
    return [{ type: 'mention', attrs: { id: node.dataset.accountId, text: node.textContent || '' } }];
  }
  const inner = htmlInlineToAdf(node);
  if (tag === 'strong' || tag === 'b') {
    inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'strong' }]; } });
  } else if (tag === 'em' || tag === 'i') {
    inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'em' }]; } });
  } else if (tag === 'u') {
    inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'underline' }]; } });
  } else if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'link', attrs: { href } }]; } });
  } else if (tag === 'span') {
    const color = node.style?.color || '';
    if (color) {
      inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'textColor', attrs: { color } }]; } });
    }
  } else if (tag === 'font') {
    const color = node.getAttribute('color') || '';
    if (color) {
      inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'textColor', attrs: { color } }]; } });
    }
  }
  return inner;
}

function htmlInlineToAdf(el) {
  const result = [];
  for (const node of el.childNodes) {
    result.push(...inlineNodeToAdf(node));
  }
  return result.filter(n => n.type !== 'text' || n.text);
}

function getExistingJiraKeys() {
  return new Set(projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean));
}

async function ensureUserExists(displayName, jiraAccountId, role) {
  if (!displayName) return;
  const existing = users.find(u => getUserDisplayName(u) === displayName);
  if (existing) {
    // Add role if missing
    const roles = getUserRoles(existing);
    if (!roles.includes(role)) {
      existing.roles = [...roles, role];
      await saveUsers();
    }
    return;
  }
  const parts = displayName.trim().split(/\s+/);
  const firstName = parts[0] || displayName;
  const lastName = parts.slice(1).join(' ') || '';
  users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, roles: [role], jiraAccountId: jiraAccountId || null });
  await saveUsers();
}

function buildProjectFromEnrichment(issue, sfData) {
  const pmMapping = settings.pmMapping || {};
  const manager = pmMapping[issue.assigneeEmail] || issue.assigneeDisplayName || 'Unassigned';
  const startDate = issue.created ? issue.created.slice(0, 10) : '';
  const nrr = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.nrr ?? '') : (issue.nrrUsd ?? '');
  const mrr = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.mrr ?? '') : (issue.mrrUsd ?? '');
  const csmName = sfData && !sfData.sfSkipped && !sfData.sfError
    ? (sfData.csmName ?? '')
    : (issue.accountCsmName || '');
  const salesName = sfData && !sfData.sfSkipped && !sfData.sfError
    ? (sfData.salesName ?? '')
    : (issue.accountOwnerName || '');
  const sfOk = sfData && !sfData.sfSkipped && !sfData.sfError;
  return {
    customer:    sfOk ? (sfData.customer || '') : (issue.accountName || ''),
    name:        sfOk ? (sfData.name || issue.summary) : issue.summary,
    manager,
    jira:        issue.jiraUrl,
    nrr:         sfOk ? (sfData.nrrHours ?? '') : (issue.estimatedHours ?? ''),
    nrrUsd:      nrr !== '' ? Number(nrr) || null : null,
    mrrUsd:      mrr !== '' ? Number(mrr) || null : null,
    comments:    `NRR: ${formatCurrency(nrr || '0')}, MRR: ${formatCurrency(mrr || '0')}, CSM: ${csmName || '-'}, Sales: ${salesName || '-'}`,
    startDate,
    dueDate:     issue.dueDate || '',
    health:      issue.healthFromJira || 'Green',
    status:      'On Track',
    progress:    0,
    statusText:  '',
    oppLink:     sfOk ? (sfData.oppUrl || '') : (issue.oppUrl || ''),
    accountUrl:  sfOk ? (sfData.accountUrl || '') : (issue.accountUrl || ''),
    atLink:      '',
    riskReason:  issue.riskReason || '',
    region:      issue.region || '',
    csm:         csmName,
    sales:       salesName,
  };
}

async function pollForNewProjects() {
  if (!settings.jiraEmail || !settings.jiraToken) return;
  let newIssues;
  try {
    const resp = await fetch('https://pm-proxy.demo.qa.kaltura.ai/jira/new-assignments', {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return;
    newIssues = await resp.json();
  } catch {
    return;
  }
  const existing = getExistingJiraKeys();
  // Combined (local + shared KV) delete set — auto-add is a background process, so it
  // should respect a deletion made by ANY session, not just this browser's own.
  const deleteJiraUrls = await getCombinedDeleteIds(STORAGE_KEY);
  const toAdd = newIssues.filter(issue => !existing.has(issue.key) && !deleteJiraUrls.has(`https://kaltura.atlassian.net/browse/${issue.key}`));
  if (!toAdd.length) return;

  const addedKeys = [];
  for (const issue of toAdd) {
    // Enrich issue with extra Jira fields (account name, hours, MRR/NRR, due date)
    const extraFieldIds = [cachedAccountNameFieldId, cachedMrrFieldId, cachedNrrFieldId, cachedEstHoursFieldId, cachedVMForecastFieldId, cachedRegionFieldId, cachedAccountOwnerFieldId, cachedOppUrlFieldId, cachedAccountUrlFieldId, cachedAccountCsmFieldId].filter(Boolean);
    if (extraFieldIds.length) {
      try {
        const useProxy = true;
        const fieldsParam = extraFieldIds.join(',');
        const extraUrl = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${issue.key}?fields=${fieldsParam}`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${issue.key}?fields=${fieldsParam}`;
        const extraResp = await fetch(extraUrl, useProxy ? { headers: { Accept: 'application/json' } } : { credentials: 'include', headers: { Accept: 'application/json' } });
        if (extraResp.ok) {
          const extraData = await extraResp.json();
          const f = extraData.fields || {};
          if (cachedAccountNameFieldId) issue.accountName = f[cachedAccountNameFieldId] || '';
          if (cachedMrrFieldId) issue.mrrUsd = f[cachedMrrFieldId] ?? '';
          if (cachedNrrFieldId) issue.nrrUsd = f[cachedNrrFieldId] ?? '';
          if (cachedEstHoursFieldId) issue.estimatedHours = f[cachedEstHoursFieldId] ?? '';
          if (cachedVMForecastFieldId) issue.dueDate = f[cachedVMForecastFieldId] || '';
          if (cachedRegionFieldId) {
            const rawR = f[cachedRegionFieldId];
            issue.region = typeof rawR === 'object' && rawR !== null ? (rawR.value || '') : (rawR || '');
          }
          if (cachedAccountOwnerFieldId) {
            const rawOwner = f[cachedAccountOwnerFieldId];
            issue.accountOwnerName = typeof rawOwner === 'string' ? rawOwner : (rawOwner?.displayName || rawOwner?.name || '');
            issue.accountOwnerAccountId = rawOwner?.accountId || '';
          }
          if (cachedOppUrlFieldId) issue.oppUrl = validSfUrl(f[cachedOppUrlFieldId]) || '';
          if (cachedAccountUrlFieldId) issue.accountUrl = validSfUrl(f[cachedAccountUrlFieldId]) || '';
          if (cachedAccountCsmFieldId) {
            const rawCsm = f[cachedAccountCsmFieldId];
            issue.accountCsmName = typeof rawCsm === 'string' ? rawCsm : (rawCsm?.displayName || rawCsm?.name || '');
          }
        }
      } catch {}
    }

    let sfData = { sfSkipped: true };
    try {
      const sfResp = await fetch(`https://pm-proxy.demo.qa.kaltura.ai/sf/enrich?jiraKey=${encodeURIComponent(issue.key)}`, {
        headers: { Accept: 'application/json' },
      });
      if (sfResp.ok) sfData = await sfResp.json();
    } catch {
      // sfData stays sfSkipped
    }
    const project = buildProjectFromEnrichment(issue, sfData);
    projects.push(project);
    if (issue.accountOwnerName) {
      await ensureUserExists(issue.accountOwnerName, issue.accountOwnerAccountId, 'Sales');
    }
    if (issue.accountCsmName) {
      await ensureUserExists(issue.accountCsmName, '', 'CSM');
    }
    addedKeys.push({ key: issue.key, sfUnavailable: !!(sfData.sfSkipped || sfData.sfError) });
  }
  saveProjects('auto-add-new-project');
  renderAll();
  showNewProjectsBanner(addedKeys);
}

let _wasOffline = false;
