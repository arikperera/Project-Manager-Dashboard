# PM Personal Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "PM Personal Notes" rich-text block to the Edit Project modal (projects only) that persists on the project object forever but never touches Jira or the Export Report.

**Architecture:** Clone the existing "Project Status" block's HTML structure (toolbar + editor, its own `data-role` attributes) into a second, fully independent instance wired via the already-proven `setupRichEditorToolbar(editorEl, scopeEl, options)` reusable function — the same pattern used twice already today (Project Status, Comments composer) with zero cross-talk between instances. The new field (`pmNotes`) rides on the existing project object, so every persistence path (save/backup/close/restore) picks it up automatically via existing deep-clone logic — no new plumbing there.

**Tech Stack:** Vanilla JS/HTML/CSS, no build step, no test framework. Spec: `docs/superpowers/specs/2026-08-11-pm-personal-notes-design.md`.

## Global Constraints

- **Projects only** — the block must not appear (and must not be read from) when `itemType === 'task'`.
- **No @mention autocomplete** — do not call `setupMentionAutocomplete` for this editor.
- **Never write to Jira** — no `write*ToJira` function may reference `pmNotes`.
- **Never appear in the Export Report** — `generateHTMLReport()` in app-modals.js must not be touched.
- **No test framework exists in this repo.** Verification is `node --check <file>.js` (syntax) before every deploy, plus a manual browser walkthrough — this is the established convention used throughout today's other fixes in this same codebase. Do not attempt to introduce pytest/jest/etc.
- Every JS change must pass `node --check` before being considered complete.

---

### Task 1: Clone the HTML block

**Files:**
- Modify: `index.html:236` (insert new block immediately after the existing Project Status block, which currently ends at `index.html:284` with `</div>` closing `editStatusEditorBlock`)

**Interfaces:**
- Produces: DOM elements with ids `pmNotesLabel`, `pmNotesEditorBlock`, `pmNotesEditor`, and `data-role` attributes `colorSwatch`/`colorPicker`/`fontSize`/`insertLink`/`linkPopup`/`linkUrl`/`linkText`/`linkCancel`/`linkInsert` **scoped inside `pmNotesEditorBlock`** — Task 3 depends on these exact ids/attributes existing.

- [ ] **Step 1: Insert the cloned block**

Immediately after line 284 (`</div>` that closes `id="editStatusEditorBlock"`) and before line 285 (`<div class="modal-actions">`), insert:

```html
          <label id="pmNotesLabel">PM Personal Notes</label>
          <div class="rich-editor-block" id="pmNotesEditorBlock">
          <div class="editor-toolbar">
            <button type="button" class="ghost-btn small-btn" data-rich-command="bold" title="Bold"><b>B</b></button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="italic" title="Italic"><i>I</i></button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="underline" title="Underline"><u>U</u></button>
            <span class="toolbar-sep"></span>
            <button type="button" class="ghost-btn small-btn" data-rich-command="insertUnorderedList" title="Bullet list">• List</button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="insertOrderedList" title="Numbered list">1. List</button>
            <span class="toolbar-sep"></span>
            <button type="button" class="ghost-btn small-btn" data-rich-command="outdent" title="Decrease indent">⇤</button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="indent" title="Increase indent">⇥</button>
            <span class="toolbar-sep"></span>
            <span class="toolbar-color-wrap">
              <span class="toolbar-color-a">A</span>
              <label class="toolbar-color-btn ghost-btn small-btn" title="Text color">
                <span data-role="colorSwatch" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:#eff6ff;border:1px solid rgba(255,255,255,0.25);"></span>
                <input type="color" data-role="colorPicker" value="#eff6ff" style="width:0;height:0;opacity:0;position:absolute;">
              </label>
            </span>
            <span class="toolbar-sep"></span>
            <select data-role="fontSize" title="Font size" style="width:58px;padding:4px 6px;border:1px solid var(--line);border-radius:10px;background:rgba(15,23,42,0.95);color:var(--text);font-family:inherit;font-size:0.88rem;cursor:pointer;">
              <option value="8" selected>8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
              <option value="12">12</option>
              <option value="14">14</option>
              <option value="16">16</option>
              <option value="18">18</option>
              <option value="20">20</option>
              <option value="24">24</option>
              <option value="28">28</option>
              <option value="36">36</option>
              <option value="48">48</option>
              <option value="72">72</option>
            </select>
            <button type="button" data-role="insertLink" class="ghost-btn small-btn" title="Insert link">🔗</button>
          </div>
          <div data-role="linkPopup" style="display:none;margin-top:6px;background:#0f172a;border:1px solid #223249;border-radius:10px;padding:10px 12px;gap:8px;flex-direction:column;">
            <input data-role="linkUrl" type="url" placeholder="https://..." style="width:100%;border:1px solid #334155;background:#0b1220;color:#eff6ff;border-radius:8px;padding:7px 10px;font-size:0.9rem;" />
            <input data-role="linkText" type="text" placeholder="Display text (optional)" style="width:100%;border:1px solid #334155;background:#0b1220;color:#eff6ff;border-radius:8px;padding:7px 10px;font-size:0.9rem;" />
            <div style="display:flex;gap:8px;justify-content:flex-end;">
              <button type="button" data-role="linkCancel" class="ghost-btn small-btn">Cancel</button>
              <button type="button" data-role="linkInsert" class="primary-btn small-btn">Insert</button>
            </div>
          </div>
          <div id="pmNotesEditor" class="rich-editor" contenteditable="true" spellcheck="true" lang="en"></div>
          </div>
```

Do not give this `<label>` an id-less bare tag like Project Status's — it must be `id="pmNotesLabel"` specifically, because Task 3 needs to toggle it (Project Status has no such toggle since it's shown for both projects and tasks; PM Notes is projects-only, so it needs one).

- [ ] **Step 2: Verify no id collisions**

Run: `grep -c "id=\"pmNotesLabel\"" index.html` and `grep -c "id=\"pmNotesEditorBlock\"" index.html` and `grep -c "id=\"pmNotesEditor\"" index.html`
Expected: each prints `1`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add PM Personal Notes block markup to Edit Project modal"
```

---

### Task 2: Wire the DOM references and toolbar in the JS layer

**Files:**
- Modify: `app-core.js:1094` (insert new const declarations next to the existing `pmStatusLabel` one)
- Modify: `app-render.js:1710` (insert the new `setupRichEditorToolbar` call right after the existing `editStatusToolbar` one)

**Interfaces:**
- Consumes: `setupRichEditorToolbar(editorEl, scopeEl, options)` — already defined in app-core.js (used identically for `editStatusEditor` and `commentComposerEditor` elsewhere in this file; no changes to that function itself).
- Produces: `pmNotesEditor` (DOM element, app-core.js global const), `pmNotesLabel` (DOM element, app-core.js global const), `pmNotesToolbar` (return value of `setupRichEditorToolbar`, app-render.js global const) — Task 3 depends on all three names exactly.

- [ ] **Step 1: Add DOM references in app-core.js**

At `app-core.js:1094`, immediately after the line `const pmStatusLabel = document.getElementById('pmStatusLabel');`, insert:

```js
const pmNotesLabel = document.getElementById('pmNotesLabel');
const pmNotesEditor = document.getElementById('pmNotesEditor');
```

- [ ] **Step 2: Run node --check**

Run: `node --check app-core.js`
Expected: no output (success).

- [ ] **Step 3: Wire the toolbar in app-render.js**

At `app-render.js:1710`, immediately after the line `setupMentionAutocomplete(editStatusEditor);`, insert:

```js
const pmNotesToolbar = setupRichEditorToolbar(
  pmNotesEditor,
  document.getElementById('pmNotesEditorBlock'),
  { placeholderHtml: '<span style="font-style:italic;opacity:0.5;">No notes yet</span>' }
);
```

Do **not** add a `setupMentionAutocomplete(pmNotesEditor);` call — this field never has mentions (per spec, Global Constraints).

- [ ] **Step 4: Run node --check**

Run: `node --check app-render.js`
Expected: no output (success).

- [ ] **Step 5: Commit**

```bash
git add app-core.js app-render.js
git commit -m "feat: wire PM Personal Notes editor toolbar"
```

---

### Task 3: Populate, reset, show/hide, and save `pmNotes`

**Files:**
- Modify: `app-render.js:540-546` (inside `openEditProjectModal`, right after the existing `editStatusEditor` population block)
- Modify: `app-render.js:559-561` (inside `closeEditProjectModal`, right after the existing `editStatusEditor`/`editStatusToolbar` reset lines)
- Modify: `app-render.js:1343` (inside the edit-form submit handler, right after the existing `selectedProject.statusText = ...` line, and strictly before line 1345's `if (itemType === 'task') { ... } else { await saveProjects(...); }` call)

**Interfaces:**
- Consumes: `pmNotesEditor`, `pmNotesLabel`, `pmNotesToolbar.linkPopup` (all from Task 2).
- Produces: `selectedProject.pmNotes` (string, HTML) — set on the in-memory project object before `saveProjects('edit-save')` is called on the same line that already exists at `app-render.js:1345`. No other task reads this field in this plan; the persistence paths (saveProjects, saveBackups, Backup&Delete→closedProjects) already forward the whole object with no changes needed, per spec.

- [ ] **Step 1: Populate on open (project-only) and toggle visibility**

At `app-render.js:546` (immediately after the existing `else { editStatusEditor.innerHTML = ...; editStatusEditor.setAttribute(...); }` block that ends the Project Status population, and before line 547's `editProjectForm.dataset.itemType = itemType;`), insert:

```js
  pmNotesLabel.style.display = itemType === 'task' ? 'none' : '';
  document.getElementById('pmNotesEditorBlock').style.display = itemType === 'task' ? 'none' : '';
  if (itemType !== 'task') {
    if (item.pmNotes) {
      pmNotesEditor.innerHTML = item.pmNotes;
      pmNotesEditor.removeAttribute('data-placeholder-active');
    } else {
      pmNotesEditor.innerHTML = '<span style="font-style:italic;opacity:0.5;">No notes yet</span>';
      pmNotesEditor.setAttribute('data-placeholder-active', '1');
    }
  }
```

- [ ] **Step 2: Reset on close**

At `app-render.js:561` (immediately after the existing line `editStatusToolbar.linkPopup.style.display = 'none';` and before `editPmStatus.value = '';`), insert:

```js
  pmNotesEditor.innerHTML = '';
  pmNotesEditor.removeAttribute('data-placeholder-active');
  pmNotesToolbar.linkPopup.style.display = 'none';
```

- [ ] **Step 3: Read back into the project object on save (project-only, never touches Jira)**

At `app-render.js:1343` (immediately after the existing line `selectedProject.statusUpdatedAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();` and before the blank line + `if (itemType === 'task') { await saveTasks('edit-save'); } else { await saveProjects('edit-save'); }`), insert:

```js
  if (itemType !== 'task') {
    const rawNotes = pmNotesEditor.getAttribute('data-placeholder-active') ? '' : pmNotesEditor.innerHTML.trim();
    selectedProject.pmNotes = isEmptyStatus(rawNotes) ? '' : rawNotes;
  }
```

This reuses the existing `isEmptyStatus()` helper already used for `statusText` a few lines above — same "strip empty tags down to nothing" logic, no new helper needed.

Confirm this new block sits **above** the `if (itemType !== 'task') { const issueKey = ...; writeStatusToJira(...); ... }` block that follows (that block is unchanged — it must never reference `pmNotes`).

- [ ] **Step 4: Run node --check**

Run: `node --check app-render.js`
Expected: no output (success).

- [ ] **Step 5: Manual verification pass**

Open the app in a browser (or the deployed staging URL) and walk through, in order:

1. Edit a project → confirm "PM Personal Notes" appears below Project Status, empty/placeholder state shows "No notes yet" in italics.
2. Type formatted text: bold a word, color another, insert a bullet list, insert a link. Confirm Project Status's own toolbar still works independently (click its Bold button, confirm it does NOT bold text in PM Notes, and vice versa) — this checks the two `setupRichEditorToolbar` instances don't cross-talk.
3. Save. Reopen the same project's Edit modal — confirm the formatted notes are exactly as left.
4. Edit a **task** (not a project) → confirm "PM Personal Notes" and its editor block are both absent (not just empty — not present in the layout at all).
5. Open browser DevTools → Network tab. Save a project with notes changed. Confirm no new request fires to any `jira/issue/*` endpoint beyond whatever Project Status itself already triggers (i.e., saving notes alone, with Project Status unchanged, should trigger `writeStatusToJira` at most once for the unchanged status text — not twice, not a new endpoint for notes).
6. From the row's "Delete" button, use Backup & Delete on a project with notes set. Open Closed Projects → find it → confirm the notes are visible/intact there.
7. Restore it back to active from Closed Projects → reopen Edit → confirm notes are still there.
8. Create a manual Backup of a project with notes set (Settings → Create Backup, or however this app's backup trigger is currently exposed) → open the Backups viewer → confirm the backed-up snapshot includes the notes.
9. Run Export Report → search the generated report's HTML (e.g. browser "View Source" or Ctrl+F for a snippet of the notes text you typed) → confirm it does not appear anywhere.

- [ ] **Step 6: Commit**

```bash
git add app-render.js
git commit -m "feat: populate, save, and scope PM Personal Notes to projects only"
```

---

### Task 4: Version bump, changelog, and deploy

**Files:**
- Modify: `app-core.js` (the `APP_VERSION` constant and `CHANGELOG` array — same location touched by every version bump this session, e.g. where `1.16.3`/`1.16.4` entries were added)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed by other tasks — this is the final, deploy-facing task.

- [ ] **Step 1: Bump the version and add a changelog entry**

Increment `APP_VERSION` by one patch version from whatever it currently is, and add a new entry at the top of `CHANGELOG` describing the feature in the same style as existing entries, e.g.:

```js
{
  version: '<next>',
  date: '<today's date, YYYY-MM-DD>',
  features: [
    'New "PM Personal Notes" block in Edit Project (projects only) — same rich-text formatting as Project Status, but purely internal: never synced to Jira, never included in the Export Report, and persists through Backup & Delete / Closed Projects / Restore just like every other project field.',
  ]
},
```

- [ ] **Step 2: Run node --check on every touched file**

Run: `node --check index.html` — N/A, skip (not a JS file). Run instead:
Run: `node --check app-core.js && node --check app-render.js && node --check app-modals.js`
Expected: no output (success) for all three.

- [ ] **Step 3: Commit**

```bash
git add app-core.js
git commit -m "chore: bump version for PM Personal Notes feature"
```

- [ ] **Step 4: Deploy**

Follow this project's established deploy process (see the K-Vibe deploy memory / this session's precedent): copy `index.html`, `app-core.js`, `app-render.js`, `app-modals.js`, `styles.css`, `favicon.png`, `favicon1.png` into a clean temp staging directory, then `deploy_from_directory` targeting the `project-manager-dashboard` app. `proxy-worker.js` is untouched by this feature and does not need redeploying.

- [ ] **Step 5: Confirm the version number shown in the running app**

Open the deployed app, confirm the footer/about version label shows the new version number bumped in Step 1 — this is the same check used earlier today to rule out stale-browser-cache confusion.

---

## Self-Review Notes

- **Spec coverage:** Projects-only scope → Task 3 Step 1/3 guards. No @mention → Task 2 Step 3 explicitly omits it. Never writes to Jira → Task 3 Step 3 confirmed positioned above the Jira-write block, untouched. Excluded from Export Report → no task touches app-modals.js's `generateHTMLReport()`. Persists through Backup/Closed/Restore → no task needed, called out explicitly as "no new plumbing" per spec; verified instead via Task 3 Step 5's manual walkthrough (steps 6-8).
- **Type/name consistency checked:** `pmNotesEditor`, `pmNotesLabel`, `pmNotesEditorBlock`, `pmNotesToolbar` used identically across Tasks 1-3 — no renaming drift.
- **No placeholders:** every step above contains literal code to insert, not a description of what to do.
