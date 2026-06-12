# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated users store (PM, CSM, Sales) with a "Manage users" modal, rename propagation across projects, and role-filtered autocomplete dropdowns.

**Architecture:** A `users` array is stored in localStorage under `project-dashboard-users-v1`. Projects continue storing names as plain strings. When a user is renamed, all project records are scanned and updated. The autocomplete dropdowns pull from the users store filtered by role instead of scraping project data.

**Tech Stack:** Vanilla JS, HTML, CSS — no build tools, no dependencies.

---

### Task 1: Add users store and helper functions to app.js

**Files:**
- Modify: `app.js` (top of file, after `STORAGE_KEY` declaration)

- [ ] **Step 1: Add the users storage key and load/save functions**

Insert immediately after line 1 (`const STORAGE_KEY = ...`):

```js
const USERS_KEY = 'project-dashboard-users-v1';
let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

function saveUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getUserDisplayName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function getUsersByRole(role) {
  return users.filter(u => u.role === role).map(getUserDisplayName);
}

function propagateUserRename(oldName, newName) {
  if (oldName === newName) return;
  projects.forEach(project => {
    if (project.manager === oldName) project.manager = newName;
    if (project.csm === oldName) project.csm = newName;
    if (project.sales === oldName) project.sales = newName;
  });
}
```

- [ ] **Step 2: Verify the page still loads without errors**

Open `http://localhost:8080` in browser. Open DevTools Console (F12). No errors should appear.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: add users store and helper functions"
```

---

### Task 2: Add "Manage users" button to topbar in index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the button between "Add new project" and "Export report"**

Find this block in `index.html`:
```html
          <div class="topbar-actions">
            <button id="addProjectBtn" class="secondary-btn">Add new project</button>
            <button id="exportBtn" class="primary-btn">Export report</button>
          </div>
```

Replace with:
```html
          <div class="topbar-actions">
            <button id="addProjectBtn" class="secondary-btn">Add new project</button>
            <button id="manageUsersBtn" class="secondary-btn">Manage users</button>
            <button id="exportBtn" class="primary-btn">Export report</button>
          </div>
```

- [ ] **Step 2: Verify button appears in the browser**

Refresh `http://localhost:8080`. A "Manage users" button should appear between "Add new project" and "Export report".

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Manage users button to topbar"
```

---

### Task 3: Add the Manage Users modal HTML

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the modal markup before the closing `</body>` tag**

Find `<script src="app.js"></script>` near the bottom of `index.html`. Insert this block immediately before it:

```html
    <div id="usersModal" class="modal hidden" aria-hidden="true">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Team</p>
            <h3>Manage users</h3>
          </div>
          <button id="closeUsersModalBtn" class="ghost-btn" type="button" aria-label="Close">×</button>
        </div>
        <div id="usersModalBody">
          <!-- rendered by renderUsersModal() -->
        </div>
        <div style="margin-top:12px;">
          <button id="addUserBtn" class="secondary-btn small-btn" type="button">+ Add user</button>
        </div>
        <div id="addUserForm" class="status-form" style="display:none; margin-top:12px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
            <label>First name<input id="newUserFirstName" type="text" required placeholder="e.g. Janina" /></label>
            <label>Last name<input id="newUserLastName" type="text" required placeholder="e.g. Pomme" /></label>
          </div>
          <label>Role
            <select id="newUserRole">
              <option value="PM">PM</option>
              <option value="CSM">CSM</option>
              <option value="Sales">Sales</option>
            </select>
          </label>
          <div class="modal-actions">
            <button type="button" id="cancelAddUserBtn" class="ghost-btn">Cancel</button>
            <button type="button" id="saveAddUserBtn" class="primary-btn">Save</button>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Verify the modal HTML is in the DOM**

Refresh `http://localhost:8080`. In DevTools Console run:
```js
document.getElementById('usersModal')
```
Expected: returns the modal element (not null).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add Manage users modal HTML"
```

---

### Task 4: Implement the Manage Users modal logic in app.js

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add DOM references near the top of app.js**

Find the block of `const` DOM references (around line 19). Add these after the existing `const exportBtn` line:

```js
const manageUsersBtn = document.getElementById('manageUsersBtn');
const usersModal = document.getElementById('usersModal');
const closeUsersModalBtn = document.getElementById('closeUsersModalBtn');
const usersModalBody = document.getElementById('usersModalBody');
const addUserBtn = document.getElementById('addUserBtn');
const addUserForm = document.getElementById('addUserForm');
const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
const saveAddUserBtn = document.getElementById('saveAddUserBtn');
```

- [ ] **Step 2: Add renderUsersModal function**

Add this function after the `renderRiskList` function:

```js
function renderUsersModal() {
  const roles = ['PM', 'CSM', 'Sales'];
  const grouped = roles.map(role => ({
    role,
    members: users.filter(u => u.role === role),
  }));

  const hasUsers = users.length > 0;

  usersModalBody.innerHTML = hasUsers
    ? grouped.map(({ role, members }) => members.length === 0 ? '' : `
        <div style="margin-bottom:14px;">
          <p class="eyebrow" style="margin-bottom:6px;">${role}</p>
          ${members.map(u => `
            <div class="user-row" data-user-id="${u.id}">
              <span>${getUserDisplayName(u)}</span>
              <div>
                <button type="button" class="ghost-btn small-btn" data-edit-user="${u.id}">Edit</button>
                <button type="button" class="ghost-btn small-btn" data-delete-user="${u.id}">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')
    : '<p class="muted">No users added yet. Click Add user to get started.</p>';
}
```

- [ ] **Step 3: Add open/close modal functions**

Add these after `renderUsersModal`:

```js
function openUsersModal() {
  renderUsersModal();
  addUserForm.style.display = 'none';
  usersModal.classList.remove('hidden');
  usersModal.setAttribute('aria-hidden', 'false');
}

function closeUsersModal() {
  usersModal.classList.add('hidden');
  usersModal.setAttribute('aria-hidden', 'true');
  addUserForm.style.display = 'none';
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
}
```

- [ ] **Step 4: Add event listeners for open/close and add-user**

Add these before the final `renderAll()` call at the bottom of `app.js`:

```js
manageUsersBtn.addEventListener('click', openUsersModal);
closeUsersModalBtn.addEventListener('click', closeUsersModal);
usersModal.addEventListener('click', (e) => { if (e.target === usersModal) closeUsersModal(); });

addUserBtn.addEventListener('click', () => {
  addUserForm.style.display = 'grid';
  addUserBtn.style.display = 'none';
});

cancelAddUserBtn.addEventListener('click', () => {
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
});

saveAddUserBtn.addEventListener('click', () => {
  const firstName = document.getElementById('newUserFirstName').value.trim();
  const lastName = document.getElementById('newUserLastName').value.trim();
  const role = document.getElementById('newUserRole').value;
  if (!firstName || !lastName) return;

  users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, role });
  saveUsers();
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
  renderUsersModal();
});
```

- [ ] **Step 5: Verify add user works**

Refresh `http://localhost:8080`. Click "Manage users" → click "+ Add user" → fill in a name and role → click Save. The user should appear in the list. Refresh the page — user should still be there (persisted in localStorage).

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: implement Manage users modal open/close and add user"
```

---

### Task 5: Implement Edit and Delete user

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add CSS for user rows**

Add to `styles.css`:

```css
.user-row { display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border:1px solid var(--line); border-radius:10px; margin-bottom:6px; }
.user-row-edit { display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:8px 10px; border:1px solid rgba(56,189,248,0.3); border-radius:10px; margin-bottom:6px; }
```

- [ ] **Step 2: Add edit/delete event delegation to usersModalBody**

Add this after the `saveAddUserBtn` listener block:

```js
usersModalBody.addEventListener('click', (e) => {
  const editBtn = e.target.closest('[data-edit-user]');
  const deleteBtn = e.target.closest('[data-delete-user]');

  if (deleteBtn) {
    const userId = deleteBtn.dataset.deleteUser;
    users = users.filter(u => u.id !== userId);
    saveUsers();
    renderUsersModal();
    return;
  }

  if (editBtn) {
    const userId = editBtn.dataset.editUser;
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const row = editBtn.closest('.user-row');
    row.outerHTML = `
      <div class="user-row-edit" data-editing-id="${userId}">
        <label style="grid-column:1">First name<input type="text" class="edit-first" value="${user.firstName}" /></label>
        <label style="grid-column:2">Last name<input type="text" class="edit-last" value="${user.lastName}" /></label>
        <label style="grid-column:1">Role
          <select class="edit-role">
            <option value="PM"${user.role === 'PM' ? ' selected' : ''}>PM</option>
            <option value="CSM"${user.role === 'CSM' ? ' selected' : ''}>CSM</option>
            <option value="Sales"${user.role === 'Sales' ? ' selected' : ''}>Sales</option>
          </select>
        </label>
        <div class="modal-actions" style="grid-column:2; align-self:end;">
          <button type="button" class="ghost-btn small-btn cancel-edit-user">Cancel</button>
          <button type="button" class="primary-btn small-btn save-edit-user">Save</button>
        </div>
      </div>`;
    return;
  }

  const saveEditBtn = e.target.closest('.save-edit-user');
  const cancelEditBtn = e.target.closest('.cancel-edit-user');

  if (cancelEditBtn) {
    renderUsersModal();
    return;
  }

  if (saveEditBtn) {
    const editingRow = saveEditBtn.closest('[data-editing-id]');
    const userId = editingRow.dataset.editingId;
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const oldName = getUserDisplayName(user);
    user.firstName = editingRow.querySelector('.edit-first').value.trim() || user.firstName;
    user.lastName = editingRow.querySelector('.edit-last').value.trim() || user.lastName;
    user.role = editingRow.querySelector('.edit-role').value;
    const newName = getUserDisplayName(user);

    propagateUserRename(oldName, newName);
    saveUsers();
    saveProjects();
    renderAll();
    renderUsersModal();
  }
});
```

- [ ] **Step 3: Verify edit and delete work**

Refresh `http://localhost:8080`. Add a user, then:
- Click Edit → change the name → Save. Verify the name updates in the list and any projects with that PM/CSM/Sales also update.
- Click Delete. Verify the user is removed from the list.

- [ ] **Step 4: Commit**

```bash
git add app.js styles.css
git commit -m "feat: implement edit and delete user with rename propagation"
```

---

### Task 6: Update autocomplete dropdowns to use users store

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Update initAutocompletes to pull from users store by role**

Find and replace the `initAutocompletes` function:

```js
function initAutocompletes() {
  setupAutocomplete(document.getElementById('modalProjectPm'), () => getUsersByRole('PM'));
  setupAutocomplete(document.getElementById('modalProjectCsm'), () => getUsersByRole('CSM'));
  setupAutocomplete(document.getElementById('modalProjectSales'), () => getUsersByRole('Sales'));
}
```

- [ ] **Step 2: Verify autocomplete shows users store entries**

Refresh `http://localhost:8080`. Add a user with role PM (e.g. "Test Person"). Open "Add new project" → click the PM name field. "Test Person" should appear in the dropdown.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: wire autocomplete dropdowns to users store by role"
```

---

### Task 7: Push all changes to GitHub

**Files:** none

- [ ] **Step 1: Verify all changes are committed**

```bash
git status
```
Expected: `nothing to commit, working tree clean`

- [ ] **Step 2: Push to GitHub**

```bash
git push
```

Expected: `master -> master` confirmed in output.
