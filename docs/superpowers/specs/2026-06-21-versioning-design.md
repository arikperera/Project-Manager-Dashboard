# Versioning, Schema Migration & What's New — Design Spec

**Date:** 2026-06-21

## Goals

1. Add `APP_VERSION` constant and `CHANGELOG` array to `app.js`
2. Display version number below the "Project status at a glance" title with a `?` button
3. `?` opens a "What's New" modal listing all changelog entries newest-first
4. Schema migration runs on load, filling missing fields with safe defaults
5. Create a `release` branch and enable GitHub Pages on it

## Section 1 — Version constant & changelog data

At the top of `app.js` (after existing constants), add:

```js
const APP_VERSION = '1.0.0';
const CHANGELOG = [
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
```

Each future release prepends a new entry to the array. The modal always shows all versions, newest-first (array order).

## Section 2 — Version display in header

In `index.html`, below `<h2>Project status at a glance</h2>`, add:

```html
<div class="app-version-row">
  <span id="appVersionLabel"></span>
  <button id="whatsNewBtn" class="whats-new-btn" title="What's new">?</button>
</div>
```

On page load, JS sets: `document.getElementById('appVersionLabel').textContent = 'v' + APP_VERSION;`

CSS for `.app-version-row`:
```css
.app-version-row { display:flex; align-items:center; gap:6px; margin-top:2px; }
```

CSS for `.whats-new-btn`:
```css
.whats-new-btn { background:none; border:1px solid var(--line); border-radius:50%; width:18px; height:18px; font-size:0.75rem; color:var(--text); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; opacity:0.7; }
.whats-new-btn:hover { opacity:1; border-color:#38bdf8; color:#38bdf8; }
```

`#appVersionLabel` style: `font-size:0.78rem; color:#64748b; font-weight:400;`

## Section 3 — What's New modal

In `index.html`, add a new modal (same pattern as existing modals):

```html
<div id="whatsNewModal" class="modal-overlay hidden" aria-hidden="true">
  <div class="modal-card" style="max-width:480px;">
    <div class="modal-header">
      <h3>What's New</h3>
      <button id="closeWhatsNewBtn" class="ghost-btn">✕</button>
    </div>
    <div id="whatsNewBody" style="max-height:420px;overflow-y:auto;padding:4px 0;"></div>
  </div>
</div>
```

`#whatsNewBody` is populated by JS from `CHANGELOG` on open:

```js
function renderWhatsNew() {
  const body = document.getElementById('whatsNewBody');
  body.innerHTML = CHANGELOG.map(entry => `
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
        <span style="font-weight:700;color:#7dd3fc;">v${entry.version}</span>
        <span style="font-size:0.8rem;color:#64748b;">${entry.date}</span>
      </div>
      <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:0.9rem;line-height:1.7;">
        ${entry.features.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}
```

Open: `document.getElementById('whatsNewBtn').addEventListener('click', () => { renderWhatsNew(); whatsNewModal.classList.remove('hidden'); whatsNewModal.setAttribute('aria-hidden','false'); });`

Close: `closeWhatsNewBtn` click + Escape key + overlay click (same pattern as other modals).

## Section 4 — Schema migration

After loading projects from localStorage, call `migrateProjects()`:

```js
function migrateProjects() {
  let changed = false;
  for (const p of projects) {
    if (p.pmStatus === undefined) { p.pmStatus = ''; changed = true; }
    if (p.atLink === undefined) { p.atLink = ''; changed = true; }
    if (p.estimatedHours === undefined) { p.estimatedHours = null; changed = true; }
    if (p.remainingHours === undefined) { p.remainingHours = null; changed = true; }
    if (p.actualHours === undefined) { p.actualHours = null; changed = true; }
  }
  if (changed) saveProjects();
}
```

No version tracking in localStorage — field-existence checks are idempotent and safe to run every load. Add new fields here with each release.

## Section 5 — Release branch & GitHub Pages

**One-time setup (done during implementation):**
1. Create `release` branch from current master: `git checkout -b release && git push -u origin release`
2. Enable GitHub Pages in repo settings: Source = `release` branch, `/ (root)`
3. PMs access: `https://arikperera.github.io/Project-Manager-Dashboard`

**Per-release workflow:**
1. You say "ready to release"
2. Claude reads git log since last release tag, drafts "What's New" entries
3. You review/edit the entries
4. Claude bumps `APP_VERSION`, prepends entry to `CHANGELOG`, commits to master
5. Claude merges master → release, pushes both, creates a git tag `vX.Y.Z`

## Release versioning scheme

- `1.0.0` — initial release
- `1.x.0` — new features
- `1.x.x` — bug fixes only

## Out of Scope

- Authentication / access control for PMs
- Server-side data storage (localStorage remains the data layer)
- Automatic changelog generation without human review
