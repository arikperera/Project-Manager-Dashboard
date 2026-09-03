# Due Month Filter & Summary Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "All Statuses" filter with a dynamic 3-month due-date filter, and replace the "Completion rate" summary card with a "Due this month" card that shows a hover popup listing affected projects.

**Architecture:** All changes are in `index.html` (HTML structure) and `app.js` (filter logic, rendering, event wiring). No new files. The due-month filter options are generated at render time from `new Date()`. The "Due this month" card mirrors the existing At Risk popup pattern exactly.

**Tech Stack:** Vanilla JS, HTML, CSS — no build step, open `index.html` directly in browser to test.

---

## Files

- Modify: `index.html` — lines 51–55 (stat card), lines 84–90 (status filter)
- Modify: `app.js` — line 191 (constant), lines 512/517/525 (filter logic), lines 635–644 (renderSummary), lines 629–632 (renderSelect), lines 1181 (event listener), plus new popup wiring after existing at-risk popup block (~line 1612)

---

### Task 1: Replace the status filter HTML with the due-month filter

**Files:**
- Modify: `index.html` lines 84–90

- [ ] **Step 1: Replace the `<select id="statusFilter">` element**

In `index.html`, find and replace:

```html
              <select id="statusFilter">
                <option value="All">All statuses</option>
                <option value="On Track">On Track</option>
                <option value="At Risk">At Risk</option>
                <option value="Delayed">Delayed</option>
                <option value="Completed">Completed</option>
              </select>
```

With:

```html
              <select id="duemonthFilter">
                <option value="">All months</option>
              </select>
```

The options beyond "All months" will be populated dynamically by JS in Task 3.

- [ ] **Step 2: Verify in browser**

Open `index.html` in a browser. The rightmost filter in the projects panel should now read "All months" with no other options. Nothing else should change visually.

---

### Task 2: Replace the Completion Rate stat card HTML with Due This Month

**Files:**
- Modify: `index.html` lines 51–55

- [ ] **Step 1: Replace the purple stat card**

In `index.html`, find and replace:

```html
          <article class="stat-card accent-purple">
            <p>Completion rate</p>
            <h3 id="completionRate">0%</h3>
            <span>Average progress</span>
          </article>
```

With:

```html
          <article class="stat-card accent-purple" id="dueThisMonthCard" style="position:relative;cursor:default;">
            <p>Due this month</p>
            <h3 id="dueThisMonthCount">0</h3>
            <span id="dueThisMonthTrigger" style="color:#a78bfa;cursor:pointer;">View projects</span>
            <div id="dueThisMonthPopup" class="atrisk-popup hidden"></div>
          </article>
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. The 4th summary card should now read "Due this month" with "0" and a "View projects" link. No CSS changes needed — `.atrisk-popup` already exists in `styles.css`.

---

### Task 3: Update `app.js` constants and event listeners

**Files:**
- Modify: `app.js` line 191, line 1181

- [ ] **Step 1: Replace `statusFilter` constant with `duemonthFilter`**

In `app.js`, find:

```js
const statusFilter = document.getElementById('statusFilter');
```

Replace with:

```js
const duemonthFilter = document.getElementById('duemonthFilter');
```

- [ ] **Step 2: Replace `statusFilter` event listener**

In `app.js`, find:

```js
statusFilter.addEventListener('change', renderTable);
```

Replace with:

```js
duemonthFilter.addEventListener('change', renderTable);
```

- [ ] **Step 3: Verify no JS errors**

Open `index.html` in browser, open DevTools console. There should be no errors about `statusFilter` being null.

---

### Task 4: Update `getFilteredProjects()` to filter by due month

**Files:**
- Modify: `app.js` lines 507–527

- [ ] **Step 1: Replace status filter logic with due-month filter logic**

In `app.js`, find the entire `getFilteredProjects` function:

```js
function getFilteredProjects() {
  const term = searchInput.value.toLowerCase().trim();
  const selectedPm = pmFilter.value;
  const selectedHealth = healthFilter.value;
  const selectedProgress = progressFilter.value;
  const selectedStatus = statusFilter.value;

  return projects.filter((project) => {
    const matchesPm = selectedPm === 'All' || project.manager === selectedPm;
    const matchesHealth = selectedHealth === 'All' || project.health === selectedHealth;
    const matchesStatus = selectedStatus === 'All' || project.status === selectedStatus;
    const matchesSearch = !term || `${project.name} ${project.manager || ''} ${project.jira || ''}`.toLowerCase().includes(term);

    let matchesProgress = true;
    if (selectedProgress === '0-39') matchesProgress = project.progress < 40;
    if (selectedProgress === '40-69') matchesProgress = project.progress >= 40 && project.progress < 70;
    if (selectedProgress === '70-100') matchesProgress = project.progress >= 70;

    return matchesPm && matchesHealth && matchesStatus && matchesSearch && matchesProgress;
  });
}
```

Replace with:

```js
function getFilteredProjects() {
  const term = searchInput.value.toLowerCase().trim();
  const selectedPm = pmFilter.value;
  const selectedHealth = healthFilter.value;
  const selectedProgress = progressFilter.value;
  const selectedDueMonth = duemonthFilter.value;

  return projects.filter((project) => {
    const matchesPm = selectedPm === 'All' || project.manager === selectedPm;
    const matchesHealth = selectedHealth === 'All' || project.health === selectedHealth;
    const matchesDueMonth = !selectedDueMonth || (project.dueDate || '').startsWith(selectedDueMonth);
    const matchesSearch = !term || `${project.name} ${project.manager || ''} ${project.jira || ''}`.toLowerCase().includes(term);

    let matchesProgress = true;
    if (selectedProgress === '0-39') matchesProgress = project.progress < 40;
    if (selectedProgress === '40-69') matchesProgress = project.progress >= 40 && project.progress < 70;
    if (selectedProgress === '70-100') matchesProgress = project.progress >= 70;

    return matchesPm && matchesHealth && matchesDueMonth && matchesSearch && matchesProgress;
  });
}
```

- [ ] **Step 2: Verify filter works**

Open `index.html`. The "All months" dropdown still shows all projects. You can't test month options yet — that comes in Task 5.

---

### Task 5: Populate due-month filter options dynamically in `renderSelect()`

**Files:**
- Modify: `app.js` lines 622–633

- [ ] **Step 1: Add dynamic month option generation to `renderSelect()`**

In `app.js`, find:

```js
function renderSelect() {
  if (projectSelect) {
    projectSelect.innerHTML = projects
      .map((project, index) => `<option value="${index}">${project.name}</option>`)
      .join('');
  }

  const uniqueManagers = [...new Set(projects.map((project) => project.manager).filter(Boolean))];

  pmFilter.innerHTML = ['<option value="All">All PMs</option>', ...uniqueManagers.map((manager) => `<option value="${manager}">${manager}</option>`)].join('');

}
```

Replace with:

```js
function renderSelect() {
  if (projectSelect) {
    projectSelect.innerHTML = projects
      .map((project, index) => `<option value="${index}">${project.name}</option>`)
      .join('');
  }

  const uniqueManagers = [...new Set(projects.map((project) => project.manager).filter(Boolean))];
  pmFilter.innerHTML = ['<option value="All">All PMs</option>', ...uniqueManagers.map((manager) => `<option value="${manager}">${manager}</option>`)].join('');

  const now = new Date();
  const monthOptions = [['', 'All months']];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push([value, label]);
  }
  const currentDueMonth = duemonthFilter.value;
  duemonthFilter.innerHTML = monthOptions.map(([v, l]) => `<option value="${v}"${v === currentDueMonth ? ' selected' : ''}>${l}</option>`).join('');
}
```

- [ ] **Step 2: Verify options appear**

Open `index.html`. The due-month dropdown should now show: "All months", "June 2026", "July 2026", "August 2026". Selecting "June 2026" should filter projects to only those with a `dueDate` starting with `2026-06`.

---

### Task 6: Update `renderSummary()` for the Due This Month card

**Files:**
- Modify: `app.js` lines 635–645

- [ ] **Step 1: Replace `renderSummary()` body**

In `app.js`, find:

```js
function renderSummary() {
  const total = projects.length;
  const onTrack = projects.filter((project) => project.status === 'On Track').length;
  const atRisk = projects.filter((project) => project.health === 'Yellow' || project.health === 'Red').length;
  const completionRate = Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / total);

  document.getElementById('totalProjects').textContent = total;
  document.getElementById('onTrackCount').textContent = onTrack;
  document.getElementById('atRiskCount').textContent = atRisk;
  document.getElementById('completionRate').textContent = `${completionRate}%`;
}
```

Replace with:

```js
function renderSummary() {
  const total = projects.length;
  const onTrack = projects.filter((project) => project.status === 'On Track').length;
  const atRisk = projects.filter((project) => project.health === 'Yellow' || project.health === 'Red').length;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dueThisMonth = projects.filter((project) => (project.dueDate || '').startsWith(currentMonth));

  document.getElementById('totalProjects').textContent = total;
  document.getElementById('onTrackCount').textContent = onTrack;
  document.getElementById('atRiskCount').textContent = atRisk;
  document.getElementById('dueThisMonthCount').textContent = dueThisMonth.length;
}
```

- [ ] **Step 2: Verify count updates**

Open `index.html`. The "Due this month" card should show the correct count of projects with a due date in the current month (June 2026). If no projects are due this month, it shows 0.

---

### Task 7: Wire up the Due This Month hover popup

**Files:**
- Modify: `app.js` — add after the existing at-risk popup block (~line 1653)

- [ ] **Step 1: Add popup constants and show/hide functions**

In `app.js`, find the end of the at-risk popup block:

```js
atRiskPopup.addEventListener('click', (e) => {
  const link = e.target.closest('[data-scroll-project]');
  if (!link) return;
  e.preventDefault();
```

Read down to find the closing `});` of that block, then add the following **after** the entire at-risk popup block (after its closing `});`):

```js
const dueThisMonthTrigger = document.getElementById('dueThisMonthTrigger');
const dueThisMonthPopup = document.getElementById('dueThisMonthPopup');

let dueThisMonthHideTimer = null;

function showDueThisMonthPopup() {
  clearTimeout(dueThisMonthHideTimer);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const due = projects.filter((p) => (p.dueDate || '').startsWith(currentMonth));
  if (!due.length) {
    dueThisMonthPopup.innerHTML = '<span style="color:#94a3b8">No projects due this month</span>';
  } else {
    dueThisMonthPopup.innerHTML = due.map((p, i) =>
      `<span>${i + 1}. ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name)} <span style="color:#94a3b8">(${escapeHtml(p.dueDate || '')})</span></span>`
    ).join('');
  }
  dueThisMonthPopup.classList.remove('hidden');
}

function hideDueThisMonthPopup() {
  dueThisMonthHideTimer = setTimeout(() => dueThisMonthPopup.classList.add('hidden'), 150);
}

dueThisMonthTrigger.addEventListener('mouseenter', showDueThisMonthPopup);
dueThisMonthTrigger.addEventListener('mouseleave', hideDueThisMonthPopup);
dueThisMonthPopup.addEventListener('mouseenter', () => clearTimeout(dueThisMonthHideTimer));
dueThisMonthPopup.addEventListener('mouseleave', hideDueThisMonthPopup);
```

- [ ] **Step 2: Verify popup behavior**

Open `index.html`. Hover over "View projects" on the "Due this month" card. A popup should appear listing projects due this month (customer — name + due date), or a "No projects due this month" message if none. Moving the mouse off should dismiss it after ~150ms.

---

### Task 8: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add index.html app.js
git commit -m "feat: replace status filter with due-month filter, add due-this-month summary card"
```

- [ ] **Step 2: Final smoke test**

Open `index.html`, verify:
1. Due-month filter shows June/July/August 2026 and filters projects correctly
2. "Due this month" card shows correct count and hover popup lists projects with due dates
3. "At Risk" card and all other filters still work normally
4. No JS errors in DevTools console
