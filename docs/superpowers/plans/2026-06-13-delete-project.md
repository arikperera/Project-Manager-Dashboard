# Delete Project Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Delete button to each project row that opens a confirmation modal with options to delete immediately or merge the project into the latest backup before deleting.

**Architecture:** A `#deleteProjectModal` is added to the HTML and wired via `openDeleteProjectModal(projectIndex)` / `closeDeleteProjectModal()` in app.js. The modal stores the target project index in a module-level variable. Two action handlers implement the delete and backup-then-delete flows. The Delete button is added to the `renderTable()` row template alongside the existing Edit button.

**Tech Stack:** Vanilla JS, HTML, CSS — no build tools, no dependencies.

---

### Task 1: Add delete project modal HTML to index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add modal markup before `<script src="app.js">`**

Find `<script src="app.js"></script>` and insert immediately before it:

```html
    <div id="deleteProjectModal" class="modal hidden" aria-hidden="true">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Delete project</p>
            <h3 id="deleteProjectModalTitle">Project name</h3>
          </div>
        </div>
        <p class="muted" style="margin-bottom:16px;">This action cannot be undone. Would you like to back up this project to the latest backup record first?</p>
        <div class="modal-actions">
          <button type="button" id="cancelDeleteProjectBtn" class="ghost-btn">Cancel</button>
          <button type="button" id="deleteProjectBtn" class="ghost-btn">Delete</button>
          <button type="button" id="backupAndDeleteProjectBtn" class="primary-btn">Backup &amp; Delete</button>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Verify modal is in DOM**

Refresh `http://localhost:8080`. In DevTools Console run:
```js
document.getElementById('deleteProjectModal')
```
Expected: returns the element (not null).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add delete project confirmation modal HTML"
```

---

### Task 2: Add DOM refs, open/close functions, and action handlers to app.js

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add DOM refs after the existing `saveSettingsBtn` line**

Find `const saveSettingsBtn = document.getElementById('saveSettingsBtn');` and add immediately after it:

```js
const deleteProjectModal = document.getElementById('deleteProjectModal');
const deleteProjectModalTitle = document.getElementById('deleteProjectModalTitle');
const cancelDeleteProjectBtn = document.getElementById('cancelDeleteProjectBtn');
const deleteProjectBtn = document.getElementById('deleteProjectBtn');
const backupAndDeleteProjectBtn = document.getElementById('backupAndDeleteProjectBtn');
```

- [ ] **Step 2: Add module-level variable and open/close functions**

Find `function openUsersModal()` and add immediately before it:

```js
let deleteProjectIndex = -1;

function openDeleteProjectModal(projectIndex) {
  const project = projects[projectIndex];
  if (!project) return;
  deleteProjectIndex = projectIndex;
  deleteProjectModalTitle.textContent = project.name;
  deleteProjectModal.classList.remove('hidden');
  deleteProjectModal.setAttribute('aria-hidden', 'false');
}

function closeDeleteProjectModal() {
  deleteProjectModal.classList.add('hidden');
  deleteProjectModal.setAttribute('aria-hidden', 'true');
  deleteProjectIndex = -1;
}
```

- [ ] **Step 3: Add event listeners before `renderAll()` at the bottom of app.js**

Find `renderAll();` at the very bottom and add immediately before it:

```js
cancelDeleteProjectBtn.addEventListener('click', closeDeleteProjectModal);
deleteProjectModal.addEventListener('click', (e) => { if (e.target === deleteProjectModal) closeDeleteProjectModal(); });

deleteProjectBtn.addEventListener('click', () => {
  if (deleteProjectIndex < 0) return;
  projects.splice(deleteProjectIndex, 1);
  saveProjects();
  renderAll();
  closeDeleteProjectModal();
});

backupAndDeleteProjectBtn.addEventListener('click', () => {
  if (deleteProjectIndex < 0) return;
  if (!backups.length) {
    alert('No backup exists yet. Please create a backup first before deleting.');
    return;
  }
  const project = projects[deleteProjectIndex];
  const latestBackup = backups[0];
  const existingIndex = latestBackup.projects.findIndex(p => p.name === project.name);
  if (existingIndex >= 0) {
    latestBackup.projects[existingIndex] = JSON.parse(JSON.stringify(project));
  } else {
    latestBackup.projects.push(JSON.parse(JSON.stringify(project)));
  }
  saveBackups();
  projects.splice(deleteProjectIndex, 1);
  saveProjects();
  renderAll();
  closeDeleteProjectModal();
});
```

- [ ] **Step 4: Verify no syntax errors**

Refresh `http://localhost:8080`. DevTools Console — no errors.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add delete project modal logic and handlers"
```

---

### Task 3: Add Delete button to renderTable() row template

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Update the Actions cell in the row template**

Find this line in the `renderTable()` function:

```js
            <td><button type="button" class="secondary-btn small-btn" data-edit-project="${projects.indexOf(project)}">Edit</button></td>
```

Replace with:

```js
            <td style="white-space:nowrap;">
              <button type="button" class="secondary-btn small-btn" data-edit-project="${projects.indexOf(project)}">Edit</button>
              <button type="button" class="ghost-btn small-btn" style="margin-top:4px;display:block;" data-delete-project="${projects.indexOf(project)}">Delete</button>
            </td>
```

- [ ] **Step 2: Add click delegation for the Delete button in portfolioGroups listener**

Find the existing `portfolioGroups.addEventListener('click', ...)` block:

```js
portfolioGroups.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-project]');
  if (!editButton) return;
  openEditProjectModal(Number(editButton.dataset.editProject));
});
```

Replace with:

```js
portfolioGroups.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-project]');
  if (editButton) {
    openEditProjectModal(Number(editButton.dataset.editProject));
    return;
  }
  const deleteButton = event.target.closest('[data-delete-project]');
  if (deleteButton) {
    openDeleteProjectModal(Number(deleteButton.dataset.deleteProject));
  }
});
```

- [ ] **Step 3: Verify Delete button appears and opens the modal**

Refresh `http://localhost:8080`. Each project row should have an Edit and Delete button. Clicking Delete should open the confirmation modal with the correct project name.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add Delete button to project rows"
```

---

### Task 4: Push to GitHub

- [ ] **Step 1: Verify clean state**

```bash
git status
```
Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Push**

```bash
git push
```
Expected: `master -> master`
