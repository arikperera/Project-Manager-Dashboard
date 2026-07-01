# Tasks & IE Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IE user role, a tasks store, an "Add new" button with project/task choice, and task rendering in the main dashboard grouped by task owner.

**Architecture:** Tasks live in a separate `tasks` array (KV key `project-dashboard-tasks-v1`) with the same schema as projects but `type: 'task'` and `owner` instead of `manager`. `renderTable()` merges tasks into the grouped-by-owner view. The "Add new project" button becomes "Add new" and opens a choice modal. A new task form collects customer, project (filtered by customer), task owner, and region; Jira is auto-filled from the parent project.

**Tech Stack:** Vanilla JS, HTML, CSS. KV storage via `kvPut`/`kvGet`. No new dependencies.

## Global Constraints

- Storage key for tasks: `'project-dashboard-tasks-v1'`
- Task `owner` field maps to `manager` for grouping and filter purposes
- `type: 'task'` distinguishes tasks from projects in merged arrays
- IE is a fourth role (alongside PM, CSM, Sales); stored in `user.roles[]` array
- Region options: `APAC`, `EMEA`, `North America`, `LatAm`, `Internal`, `ROW`
- `saveData()` pattern: `kvPut` then `localStorage.setItem` cache (same as `saveProjects`, `saveUsers`)
- Project root: `c:\Users\arik.perera\OneDrive - Kaltura\Documents\Claude\New Self version of Project tracker`

---

### Task 1: Add IE role + tasks store

**Files:**
- Modify: `app.js` — after `CUSTOMERS_KEY` block; after `initData()`; after `migrateProjects()`
- Modify: `index.html` — add IE checkbox to add/edit user forms

**Interfaces:**
- Produces: `TASKS_KEY`, `let tasks`, `saveTasks()`, `getUsersByRole('IE')` works via existing `getUserRoles()` function

- [ ] **Step 1: Add tasks store constants and functions in app.js**

Find the line `const BACKUPS_KEY = 'project-dashboard-backups-v1';` and insert immediately before it:

```js
const TASKS_KEY = 'project-dashboard-tasks-v1';
let tasks = JSON.parse(localStorage.getItem('project-dashboard-tasks-v1') || '[]');

async function saveTasks() {
  const ok = await kvPut(TASKS_KEY, tasks);
  if (ok) try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
  else showToast('Save failed — please try again.', 'error');
}
```

- [ ] **Step 2: Load tasks in initData() offline branch**

Find this block in `initData()`:
```js
    backups = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');
    return;
```
Replace with:
```js
    backups = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');
    tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    return;
```

- [ ] **Step 3: Load tasks in initData() KV branch**

Find:
```js
  const [kvProjects, kvUsers, kvSettings, kvCustomers, kvBackups] = await Promise.all([
    kvGet(STORAGE_KEY),
    kvGet(USERS_KEY),
    kvGet(SETTINGS_KEY),
    kvGet(CUSTOMERS_KEY),
    kvGet(BACKUPS_KEY),
  ]);
```
Replace with:
```js
  const [kvProjects, kvUsers, kvSettings, kvCustomers, kvBackups, kvTasks] = await Promise.all([
    kvGet(STORAGE_KEY),
    kvGet(USERS_KEY),
    kvGet(SETTINGS_KEY),
    kvGet(CUSTOMERS_KEY),
    kvGet(BACKUPS_KEY),
    kvGet(TASKS_KEY),
  ]);
```

And find:
```js
  [projects, users, settings, customers, backups] = await Promise.all([
    hydrateKey(kvProjects, STORAGE_KEY, defaultProjects),
    hydrateKey(kvUsers, USERS_KEY, []),
    hydrateKey(kvSettings, SETTINGS_KEY, {}),
    hydrateKey(kvCustomers, CUSTOMERS_KEY, []),
    hydrateKey(kvBackups, BACKUPS_KEY, []),
  ]);
```
Replace with:
```js
  [projects, users, settings, customers, backups, tasks] = await Promise.all([
    hydrateKey(kvProjects, STORAGE_KEY, defaultProjects),
    hydrateKey(kvUsers, USERS_KEY, []),
    hydrateKey(kvSettings, SETTINGS_KEY, {}),
    hydrateKey(kvCustomers, CUSTOMERS_KEY, []),
    hydrateKey(kvBackups, BACKUPS_KEY, []),
    hydrateKey(kvTasks, TASKS_KEY, []),
  ]);
```

And find the localStorage cache block and add tasks:
```js
  try { localStorage.setItem(TASKS_KEY,   JSON.stringify(tasks));    } catch {}
```
(Add after the `BACKUPS_KEY` line.)

- [ ] **Step 4: Add IE checkbox to add user form in index.html**

Find in the add user form:
```html
              <label style="display:flex;align-items:center;gap:4px;color:#dbeafe;font-size:0.9rem;"><input type="checkbox" id="newUserRoleSales" value="Sales"> Sales</label>
```
Add immediately after:
```html
              <label style="display:flex;align-items:center;gap:4px;color:#dbeafe;font-size:0.9rem;"><input type="checkbox" id="newUserRoleIE" value="IE"> IE</label>
```

- [ ] **Step 5: Update resetAddUserForm() in app.js to clear IE checkbox**

Find:
```js
  document.getElementById('newUserRoleSales').checked = false;
```
Add immediately after:
```js
  document.getElementById('newUserRoleIE').checked = false;
```

- [ ] **Step 6: Verify page loads without errors**

Refresh `http://localhost:8080`. DevTools Console — no errors. `tasks` global exists: run `console.log(tasks)` → `[]`.

- [ ] **Step 7: Commit**

```bash
git add app.js index.html
git commit -m "feat: add IE role and tasks store (TASKS_KEY, saveTasks, initData wiring)"
```

---

### Task 2: "Add new" button + choice modal + task form HTML

**Files:**
- Modify: `index.html` — rename button, add choice modal, add task form modal

**Interfaces:**
- Produces: `#addNewBtn`, `#addNewChoiceModal`, `#addNewChoiceProjectBtn`, `#addNewChoiceTaskBtn`, `#taskModal`, `#taskModalForm`, `#taskCustomer`, `#taskProject`, `#taskJira`, `#taskOwner`, `#taskRegion`

- [ ] **Step 1: Rename "Add new project" button**

Find:
```html
            <button id="addProjectBtn" class="secondary-btn">Add new project</button>
```
Replace with:
```html
            <button id="addNewBtn" class="secondary-btn">Add new</button>
```

- [ ] **Step 2: Add choice modal before `<script src="app.js">`**

Find the last modal before `<script src="app.js"></script>` and insert before the script tag:

```html
    <div id="addNewChoiceModal" class="modal hidden" aria-hidden="true">
      <div class="modal-card" style="max-width:400px;">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Add new</p>
            <h3>What would you like to add?</h3>
          </div>
        </div>
        <p class="muted" style="margin-bottom:16px;">Choose whether to add a full project or a task linked to an existing project.</p>
        <div class="modal-actions">
          <button type="button" id="addNewChoiceProjectBtn" class="secondary-btn">New Project</button>
          <button type="button" id="addNewChoiceTaskBtn" class="primary-btn">New Task</button>
        </div>
      </div>
    </div>

    <div id="taskModal" class="modal hidden" aria-hidden="true">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <p class="eyebrow">New task</p>
            <h3>Add a task</h3>
          </div>
          <button id="closeTaskModalBtn" class="ghost-btn" type="button" aria-label="Close">×</button>
        </div>
        <form id="taskModalForm" class="status-form modal-form">
          <label>
            Customer name
            <div class="autocomplete-wrap">
              <input id="taskCustomer" type="text" placeholder="Select customer" autocomplete="off" required />
              <ul class="autocomplete-list hidden"></ul>
            </div>
          </label>
          <label>
            Project name
            <select id="taskProject" required>
              <option value="">— select customer first —</option>
            </select>
          </label>
          <label>
            Jira URL
            <input id="taskJira" type="text" readonly placeholder="Auto-filled from project" style="opacity:0.6;" />
          </label>
          <label>
            Task owner
            <div class="autocomplete-wrap">
              <input id="taskOwner" type="text" placeholder="Select or type owner" autocomplete="off" required />
              <ul class="autocomplete-list hidden"></ul>
            </div>
          </label>
          <label>
            Region
            <select id="taskRegion">
              <option value="">— select —</option>
              <option value="APAC">APAC</option>
              <option value="EMEA">EMEA</option>
              <option value="North America">North America</option>
              <option value="LatAm">LatAm</option>
              <option value="Internal">Internal</option>
              <option value="ROW">ROW</option>
            </select>
          </label>
          <div class="modal-actions">
            <button type="button" id="cancelTaskModalBtn" class="ghost-btn">Cancel</button>
            <button type="submit" class="primary-btn">Save task</button>
          </div>
        </form>
      </div>
    </div>
```

- [ ] **Step 3: Verify modals exist in DOM**

Refresh `http://localhost:8080`. In Console:
```js
document.getElementById('addNewChoiceModal') // not null
document.getElementById('taskModal')          // not null
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: Add new button, choice modal, and task form HTML"
```

---

### Task 3: Wire choice modal + task form logic in app.js

**Files:**
- Modify: `app.js` — add DOM refs, modal open/close, task form save, customer→project filtering, autocomplete

**Interfaces:**
- Consumes: `tasks`, `saveTasks()`, `projects`, `customers`, `getCustomerNames()`, `getUsersByRole()`, `setupAutocomplete()`, `renderAll()`
- Produces: `openTaskModal()`, `closeTaskModal()`

- [ ] **Step 1: Add DOM refs**

Find `const addProjectBtn = document.getElementById('addProjectBtn');` and replace with:

```js
const addProjectBtn = document.getElementById('addProjectBtn') || document.getElementById('addNewBtn');
const addNewBtn = document.getElementById('addNewBtn');
const addNewChoiceModal = document.getElementById('addNewChoiceModal');
const addNewChoiceProjectBtn = document.getElementById('addNewChoiceProjectBtn');
const addNewChoiceTaskBtn = document.getElementById('addNewChoiceTaskBtn');
const taskModal = document.getElementById('taskModal');
const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
const cancelTaskModalBtn = document.getElementById('cancelTaskModalBtn');
const taskModalForm = document.getElementById('taskModalForm');
```

- [ ] **Step 2: Add open/close functions**

Add these functions near `openModal` / `closeModal`:

```js
function openAddNewChoice() {
  addNewChoiceModal.classList.remove('hidden');
  addNewChoiceModal.setAttribute('aria-hidden', 'false');
}

function closeAddNewChoice() {
  addNewChoiceModal.classList.add('hidden');
  addNewChoiceModal.setAttribute('aria-hidden', 'true');
}

function openTaskModal() {
  document.getElementById('taskCustomer').value = '';
  document.getElementById('taskProject').innerHTML = '<option value="">— select customer first —</option>';
  document.getElementById('taskJira').value = '';
  document.getElementById('taskOwner').value = '';
  document.getElementById('taskRegion').value = '';
  taskModal.classList.remove('hidden');
  taskModal.setAttribute('aria-hidden', 'false');
}

function closeTaskModal() {
  taskModal.classList.add('hidden');
  taskModal.setAttribute('aria-hidden', 'true');
}
```

- [ ] **Step 3: Add customer→project filter logic**

Add this function near `initAutocompletes`:

```js
function initTaskFormAutocompletes() {
  const custInput = document.getElementById('taskCustomer');
  const projSelect = document.getElementById('taskProject');
  const jiraInput = document.getElementById('taskJira');

  setupAutocomplete(custInput, () => getCustomerNames(), null, null);

  custInput.addEventListener('input', () => {
    const custName = custInput.value.trim();
    const matchingProjects = projects.filter(p => p.customer === custName);
    projSelect.innerHTML = matchingProjects.length
      ? '<option value="">— select project —</option>' + matchingProjects.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="">— no projects for this customer —</option>';
    jiraInput.value = '';
  });

  projSelect.addEventListener('change', () => {
    const projName = projSelect.value;
    const proj = projects.find(p => p.name === projName && p.customer === custInput.value.trim());
    jiraInput.value = proj ? (proj.jira || '') : '';
  });

  setupAutocomplete(document.getElementById('taskOwner'), () => users.map(u => getUserDisplayName(u)).sort(), null, null);
}
```

- [ ] **Step 4: Add event listeners**

Find `addProjectBtn.addEventListener('click', openModal);` and replace with:

```js
if (addNewBtn) {
  addNewBtn.addEventListener('click', openAddNewChoice);
} else if (addProjectBtn) {
  addProjectBtn.addEventListener('click', openModal);
}
addNewChoiceModal.addEventListener('click', (e) => { if (e.target === addNewChoiceModal) closeAddNewChoice(); });
addNewChoiceProjectBtn.addEventListener('click', () => { closeAddNewChoice(); openModal(); });
addNewChoiceTaskBtn.addEventListener('click', () => { closeAddNewChoice(); openTaskModal(); });
closeTaskModalBtn.addEventListener('click', closeTaskModal);
cancelTaskModalBtn.addEventListener('click', closeTaskModal);
taskModal.addEventListener('click', (e) => { if (e.target === taskModal) closeTaskModal(); });
```

- [ ] **Step 5: Add task form submit handler**

Add before `renderAll()` at the bottom:

```js
taskModalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const custName = document.getElementById('taskCustomer').value.trim();
  const projName = document.getElementById('taskProject').value.trim();
  const jira = document.getElementById('taskJira').value.trim();
  const owner = document.getElementById('taskOwner').value.trim();
  const region = document.getElementById('taskRegion').value;
  if (!custName || !projName || !owner) return;
  tasks.push({
    id: `task_${Date.now()}`,
    type: 'task',
    customer: custName,
    parentProjectName: projName,
    jira,
    owner,
    region,
    health: 'Green',
    riskReason: '',
    pmStatus: '',
    statusText: '',
    comments: '',
    progress: 0,
    nrr: null,
    nrrUsd: null,
    mrrUsd: null,
    startDate: '',
    dueDate: '',
    status: 'On Track',
    atLink: '',
    estimatedHours: null,
    remainingHours: null,
    actualHours: null,
  });
  await saveTasks();
  renderAll();
  closeTaskModal();
});
```

- [ ] **Step 6: Call initTaskFormAutocompletes at startup**

Find `initAutocompletes();` at the bottom and add after it:
```js
initTaskFormAutocompletes();
```

- [ ] **Step 7: Verify Add new → New Task → save works**

Refresh `http://localhost:8080`. Click "Add new" → "New Task" → fill in customer, project, owner → Save. Check DevTools Console: `console.log(tasks)` should show the new task.

- [ ] **Step 8: Commit**

```bash
git add app.js
git commit -m "feat: wire Add new choice modal and task form save logic"
```

---

### Task 4: Merge tasks into renderTable() and filters

**Files:**
- Modify: `app.js` — `getFilteredProjects()`, `renderTable()`, `renderSelect()`

**Interfaces:**
- Consumes: `tasks` (global), `task.owner` as grouping key

- [ ] **Step 1: Update getFilteredProjects() to return merged items**

Find `function getFilteredProjects() {` and replace the entire function with:

```js
function getFilteredProjects() {
  const term = searchInput.value.toLowerCase().trim();
  const selectedPm = pmFilter.value;
  const selectedHealth = healthFilter.value;
  const selectedProgress = progressFilter.value;
  const selectedDueMonth = duemonthFilter.value;
  const selectedRegion = regionFilter.value;

  function matchItem(item) {
    const owner = item.manager || item.owner || '';
    const matchesPm = selectedPm === 'All' || owner === selectedPm;
    const matchesHealth = selectedHealth === 'All' || item.health === selectedHealth;
    const matchesDueMonth = !selectedDueMonth || (item.dueDate || '').startsWith(selectedDueMonth);
    const matchesSearch = !term || `${item.name || ''} ${owner} ${item.customer || ''} ${item.jira || ''}`.toLowerCase().includes(term);
    let matchesProgress = true;
    if (selectedProgress === '0-39') matchesProgress = item.progress < 40;
    if (selectedProgress === '40-69') matchesProgress = item.progress >= 40 && item.progress < 70;
    if (selectedProgress === '70-100') matchesProgress = item.progress >= 70;
    const matchesRegion = !selectedRegion || item.region === selectedRegion;
    return matchesPm && matchesHealth && matchesDueMonth && matchesSearch && matchesProgress && matchesRegion;
  }

  const filteredProjects = projects.filter(matchItem);
  const filteredTasks = tasks.filter(matchItem);
  return [...filteredProjects, ...filteredTasks];
}
```

- [ ] **Step 2: Update renderTable() to group by manager OR owner**

Find in `renderTable()`:
```js
  const grouped = filteredProjects.reduce((acc, project) => {
    const key = project.manager || 'Unassigned';
```
Replace with:
```js
  const grouped = filteredProjects.reduce((acc, project) => {
    const key = project.manager || project.owner || 'Unassigned';
```

- [ ] **Step 3: Update renderSelect() PM filter to include task owners**

Find in `renderSelect()`:
```js
  const uniqueManagers = [...new Set(projects.map((project) => project.manager).filter(Boolean))];
```
Replace with:
```js
  const uniqueManagers = [...new Set([
    ...projects.map(p => p.manager).filter(Boolean),
    ...tasks.map(t => t.owner).filter(Boolean),
  ])].sort();
```

- [ ] **Step 4: Verify tasks appear in dashboard**

Refresh `http://localhost:8080`. If you added a task in Task 3, it should appear grouped under the task owner's name. The PM filter dropdown should include task owners.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: merge tasks into dashboard grouped by owner, update filters"
```

---

### Task 5: Edit modal support for tasks + delete/backup-delete

**Files:**
- Modify: `app.js` — `openEditProjectModal()`, `editProjectForm submit`, `deleteProjectBtn`, `backupAndDeleteProjectBtn`

**Interfaces:**
- Consumes: `tasks` global, `task.type === 'task'`

- [ ] **Step 1: Update openEditProjectModal to handle tasks**

Find `function openEditProjectModal(projectIndex) {` and note it currently does `const project = projects[projectIndex];`.

The Edit button currently passes `projects.indexOf(project)`. We need to support tasks too. Replace the function signature and lookup:

```js
function openEditProjectModal(itemType, itemIndex) {
  const item = itemType === 'task' ? tasks[itemIndex] : projects[itemIndex];
  if (!item) return;

  editCustomerName.value = item.customer || '';
  editCustomerName.readOnly = itemType === 'task';
  editProjectName.value = item.name || item.parentProjectName || '';
  editProjectName.readOnly = itemType === 'task';
  editHealth.value = item.health || 'Green';
  editRiskReason.value = item.riskReason || '';
  riskReasonLabel.style.display = (item.health === 'Yellow' || item.health === 'Red') ? '' : 'none';
  if (editPmStatus) editPmStatus.value = item.pmStatus || '';
  if (pmStatusLabel) pmStatusLabel.style.display = (item.health === 'Yellow' || item.health === 'Red') ? '' : 'none';
  if (editRegion) editRegion.value = item.region || '';
  if (editProjectManager) editProjectManager.value = itemType === 'task' ? (item.owner || '') : (item.manager || '');
  editStatusEditor.innerHTML = item.statusText || '';
  editProjectForm.dataset.itemType = itemType;
  editProjectForm.dataset.itemIndex = String(itemIndex);

  editProjectModal.classList.remove('hidden');
  editProjectModal.setAttribute('aria-hidden', 'false');
}
```

- [ ] **Step 2: Update editProjectForm submit to save tasks**

Find `editProjectForm.addEventListener('submit', async (event) => {` and update the body to handle both types:

Find:
```js
  const selectedIndex = Number(editProjectForm.dataset.projectIndex ?? -1);
  const selectedProject = projects[selectedIndex];
  if (!selectedProject) return;
```
Replace with:
```js
  const itemType = editProjectForm.dataset.itemType || 'project';
  const selectedIndex = Number(editProjectForm.dataset.itemIndex ?? editProjectForm.dataset.projectIndex ?? -1);
  const selectedProject = itemType === 'task' ? tasks[selectedIndex] : projects[selectedIndex];
  if (!selectedProject) return;
```

And find where `selectedProject.manager` is set and add task owner handling:
After `selectedProject.health = editHealth.value;` add:
```js
  if (itemType === 'task') {
    selectedProject.owner = editProjectManager ? editProjectManager.value.trim() || selectedProject.owner : selectedProject.owner;
  }
```

And after saving, use correct save function:
Find `saveProjects();` in the submit handler and replace with:
```js
  if (itemType === 'task') { await saveTasks(); } else { await saveProjects(); }
```

- [ ] **Step 3: Update portfolioGroups click delegation for tasks**

Find:
```js
  const deleteButton = event.target.closest('[data-delete-project]');
  if (deleteButton) {
    openDeleteProjectModal(Number(deleteButton.dataset.deleteProject));
  }
```
Replace with:
```js
  const deleteButton = event.target.closest('[data-delete-project]');
  if (deleteButton) {
    openDeleteProjectModal(
      deleteButton.dataset.itemType || 'project',
      Number(deleteButton.dataset.deleteProject)
    );
  }
```

And find `const editButton = event.target.closest('[data-edit-project]');`:
```js
  const editButton = event.target.closest('[data-edit-project]');
  if (editButton) {
    openEditProjectModal(
      editButton.dataset.itemType || 'project',
      Number(editButton.dataset.editProject)
    );
    return;
  }
```

- [ ] **Step 4: Update openDeleteProjectModal and delete handlers**

Find `function openDeleteProjectModal(projectIndex) {` and replace with:
```js
function openDeleteProjectModal(itemType, itemIndex) {
  const item = itemType === 'task' ? tasks[itemIndex] : projects[itemIndex];
  if (!item) return;
  deleteProjectIndex = itemIndex;
  deleteProjectModal.dataset.itemType = itemType;
  deleteProjectModalTitle.textContent = item.name || item.parentProjectName || 'Task';
  deleteProjectModal.classList.remove('hidden');
  deleteProjectModal.setAttribute('aria-hidden', 'false');
}
```

Find `deleteProjectBtn.addEventListener('click', () => {` and update:
```js
deleteProjectBtn.addEventListener('click', async () => {
  if (deleteProjectIndex < 0) return;
  const itemType = deleteProjectModal.dataset.itemType || 'project';
  if (itemType === 'task') {
    tasks.splice(deleteProjectIndex, 1);
    await saveTasks();
  } else {
    projects.splice(deleteProjectIndex, 1);
    await saveProjects();
  }
  renderAll();
  closeDeleteProjectModal();
});
```

Find `backupAndDeleteProjectBtn.addEventListener('click', async () => {` and update:
```js
backupAndDeleteProjectBtn.addEventListener('click', async () => {
  if (deleteProjectIndex < 0) return;
  if (!backups.length) { alert('No backup exists yet. Please create a backup first before deleting.'); return; }
  const itemType = deleteProjectModal.dataset.itemType || 'project';
  const item = itemType === 'task' ? tasks[deleteProjectIndex] : projects[deleteProjectIndex];
  const latestBackup = backups[0];
  const existingIndex = latestBackup.projects.findIndex(p => p.name === (item.name || item.parentProjectName));
  if (existingIndex >= 0) {
    latestBackup.projects[existingIndex] = JSON.parse(JSON.stringify(item));
  } else {
    latestBackup.projects.push(JSON.parse(JSON.stringify(item)));
  }
  await saveBackups();
  if (itemType === 'task') {
    tasks.splice(deleteProjectIndex, 1);
    await saveTasks();
  } else {
    projects.splice(deleteProjectIndex, 1);
    await saveProjects();
  }
  renderAll();
  closeDeleteProjectModal();
});
```

- [ ] **Step 5: Update renderTable row to pass itemType in data attributes**

In `renderTable()`, find where the Edit and Delete buttons are rendered:
```js
              <button type="button" class="secondary-btn small-btn" data-edit-project="${projects.indexOf(project)}">Edit</button>
              <button type="button" class="ghost-btn small-btn" style="margin-top:4px;display:block;" data-delete-project="${projects.indexOf(project)}">Delete</button>
```
Replace with:
```js
              <button type="button" class="secondary-btn small-btn" data-edit-project="${project.type === 'task' ? tasks.indexOf(project) : projects.indexOf(project)}" data-item-type="${project.type || 'project'}">Edit</button>
              <button type="button" class="ghost-btn small-btn" style="margin-top:4px;display:block;" data-delete-project="${project.type === 'task' ? tasks.indexOf(project) : projects.indexOf(project)}" data-item-type="${project.type || 'project'}">Delete</button>
```

- [ ] **Step 6: Verify edit and delete work for tasks**

Add a task via "Add new → New Task". Click its Edit button — modal should open with customer/project read-only. Click Delete — should show the delete confirmation modal with the task's project name.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: edit modal and delete/backup-delete support for tasks"
```

---

### Task 6: Push to GitHub

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
