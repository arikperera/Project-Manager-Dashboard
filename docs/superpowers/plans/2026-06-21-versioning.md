# Versioning, Schema Migration & What's New — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add version display, a "What's New" modal, schema migration, and a release branch with GitHub Pages.

**Architecture:** Three in-app tasks (constants + migration, UI + modal, GitHub setup) each independently testable. No new files — all changes to `app.js`, `index.html`, `styles.css`, and git/GitHub configuration.

**Tech Stack:** Vanilla JS, HTML, CSS. Git. GitHub Pages.

## Global Constraints

- No build step — changes take effect by refreshing `index.html` in a browser.
- No frameworks, no npm. Pure vanilla JS/HTML/CSS.
- `APP_VERSION = '1.0.0'`, initial release date `2026-06-21`.
- `CHANGELOG` is an array newest-first; each entry has `{ version, date, features[] }`.
- Schema migration runs on every load — field-existence checks are idempotent.
- Release branch name: `release`. GitHub Pages source: `release` branch, `/ (root)`.

---

### Task 1: Version constant, changelog data, and schema migration

**Files:**
- Modify: `app.js:1` (top of file — add constants before `STORAGE_KEY`)
- Modify: `app.js:134` (after `let projects = ...` — call `migrateProjects()`)

**Interfaces:**
- Produces: `APP_VERSION` (string `'1.0.0'`), `CHANGELOG` (array), `migrateProjects()` (function) — used by Task 2

- [ ] **Step 1: Add APP_VERSION and CHANGELOG at top of app.js**

In [app.js](app.js), insert at the very top (before `const STORAGE_KEY`):

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

- [ ] **Step 2: Add migrateProjects function**

In [app.js](app.js), after `function saveProjects() { ... }` (around line 212), add:

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

- [ ] **Step 3: Call migrateProjects on load**

In [app.js](app.js), find the line:
```js
let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;
```

Add immediately after it:
```js
migrateProjects();
```

Wait — `migrateProjects` is defined later in the file. Move the call to after the function definition, or define `migrateProjects` before the `let projects` line. The correct approach: define `migrateProjects` **before** `let projects`, then call it immediately after `let projects`. Place the function definition right before `let projects`.

Final order:
```js
// ... (STORAGE_KEY, defaultProjects, etc.)
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

let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;
migrateProjects();
```

Note: `migrateProjects` references `projects` and `saveProjects`. `saveProjects` must be defined before `migrateProjects`. Check that `saveProjects` is defined before this block — it is (around line 210). `projects` is a `let` that is hoisted as `undefined` before assignment; since `migrateProjects` only runs after the `let projects = ...` line executes, this is safe.

- [ ] **Step 4: Verify in browser**

Open `index.html`. Open DevTools console. Run:
```js
console.log(APP_VERSION); // should print "1.0.0"
console.log(CHANGELOG.length); // should print 1
console.log(projects[0].pmStatus); // should print "" (not undefined)
```

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add APP_VERSION, CHANGELOG, and schema migration on load"
```

---

### Task 2: Version display in header and What's New modal

**Files:**
- Modify: `index.html:21-22` (add version row below h2)
- Modify: `index.html` (add whatsNewModal before closing `</div>` of app-shell)
- Modify: `app.js` (add DOM wiring, renderWhatsNew, modal open/close handlers)
- Modify: `styles.css` (add `.app-version-row`, `.whats-new-btn` styles)

**Interfaces:**
- Consumes: `APP_VERSION` (string), `CHANGELOG` (array) — from Task 1

- [ ] **Step 1: Add version row to index.html header**

In [index.html](index.html), find:
```html
            <h2>Project status at a glance</h2>
          </div>
```

Replace with:
```html
            <h2>Project status at a glance</h2>
            <div class="app-version-row">
              <span id="appVersionLabel"></span>
              <button id="whatsNewBtn" class="whats-new-btn" title="What's new">?</button>
            </div>
          </div>
```

- [ ] **Step 2: Add What's New modal to index.html**

In [index.html](index.html), find the last `</div>` before `</body>` (closing the app-shell). Insert before it:

```html
    <div id="whatsNewModal" class="modal-overlay hidden" aria-hidden="true">
      <div class="modal-card" style="max-width:480px;">
        <div class="modal-header">
          <h3>What's New</h3>
          <button id="closeWhatsNewBtn" class="ghost-btn" type="button" aria-label="Close">✕</button>
        </div>
        <div id="whatsNewBody" style="max-height:420px;overflow-y:auto;padding:4px 0;"></div>
      </div>
    </div>
```

- [ ] **Step 3: Add CSS for version row and button**

In [styles.css](styles.css), at the end of the file add:

```css
.app-version-row { display:flex; align-items:center; gap:6px; margin-top:2px; }
#appVersionLabel { font-size:0.78rem; color:#64748b; font-weight:400; }
.whats-new-btn { background:none; border:1px solid var(--line); border-radius:50%; width:18px; height:18px; font-size:0.75rem; color:var(--text); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:0; opacity:0.7; }
.whats-new-btn:hover { opacity:1; border-color:#38bdf8; color:#38bdf8; }
```

- [ ] **Step 4: Wire up version label and What's New modal in app.js**

In [app.js](app.js), find the block near the bottom where other modal event listeners are set up (around where `settingsBtn`, `closeSettingsBtn` are handled). Add after the existing modal handlers:

```js
// Version label
document.getElementById('appVersionLabel').textContent = 'v' + APP_VERSION;

// What's New modal
const whatsNewModal = document.getElementById('whatsNewModal');
const closeWhatsNewBtn = document.getElementById('closeWhatsNewBtn');

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

document.getElementById('whatsNewBtn').addEventListener('click', () => {
  renderWhatsNew();
  whatsNewModal.classList.remove('hidden');
  whatsNewModal.setAttribute('aria-hidden', 'false');
});

closeWhatsNewBtn.addEventListener('click', () => {
  whatsNewModal.classList.add('hidden');
  whatsNewModal.setAttribute('aria-hidden', 'true');
});

whatsNewModal.addEventListener('click', (e) => {
  if (e.target === whatsNewModal) {
    whatsNewModal.classList.add('hidden');
    whatsNewModal.setAttribute('aria-hidden', 'true');
  }
});
```

- [ ] **Step 5: Verify in browser**

1. Open `index.html`. Below "Project status at a glance" you should see `v1.0.0` and a small `?` button.
2. Click `?` — modal opens showing "v1.0.0 · 2026-06-21" and the 6 feature bullets.
3. Click `✕` or click outside the modal — it closes.
4. Press Escape — confirm it also closes (note: Escape may need a keydown handler if not already present — check if existing modals handle Escape globally; if so, it's already covered).

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: add version display and What's New modal"
```

---

### Task 3: Create release branch and enable GitHub Pages

**Files:**
- Git operations only — no source file changes

**Interfaces:**
- Produces: `release` branch on origin, GitHub Pages URL: `https://arikperera.github.io/Project-Manager-Dashboard`

- [ ] **Step 1: Create and push release branch**

```bash
git checkout -b release
git push -u origin release
git checkout master
```

Expected output from push: `Branch 'release' set up to track remote branch 'release' from 'origin'.`

- [ ] **Step 2: Enable GitHub Pages**

Go to: `https://github.com/arikperera/Project-Manager-Dashboard/settings/pages`

Under "Build and deployment":
- Source: `Deploy from a branch`
- Branch: `release`, folder: `/ (root)`
- Click Save

GitHub will show: "Your site is live at https://arikperera.github.io/Project-Manager-Dashboard"

(May take 1-2 minutes to deploy on first setup.)

- [ ] **Step 3: Verify GitHub Pages**

Open `https://arikperera.github.io/Project-Manager-Dashboard` in a browser. The dashboard should load correctly with `v1.0.0` showing below the title.

- [ ] **Step 4: Tag the release on master**

```bash
git tag v1.0.0
git push origin v1.0.0
```

Expected: `* [new tag] v1.0.0 -> v1.0.0`
