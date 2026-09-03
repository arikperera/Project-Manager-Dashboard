# Filter Persistence, Region Field & Region Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PM filter reset on edit-save, add a Region field synced from Jira, and add region filtering to both the dashboard and the HTML report.

**Architecture:** Three sequential tasks in a single file (`app.js` + `index.html`). Task 1 is a one-line fix. Task 2 adds schema, Jira sync, and modal UI. Task 3 wires up the filter in the dashboard and the report. Each task is independently testable and committable.

**Tech Stack:** Vanilla JS, HTML, no build step. Open `index.html` directly in a browser to test.

## Global Constraints

- Region valid values (fixed list, exact strings): `APAC`, `EMEA`, `North America`, `LatAm`, `Internal`, `ROW`
- Jira field name for region: `Region` (resolved in `applyFieldNames()`)
- Dashboard filter dropdown id: `regionFilter`
- Report region select id: `rRegionFilter`
- `project.region` stores region as a plain string (no quotes around ROW)
- Display value for `ROW` in dropdowns: `"ROW"` (with quotes)
- No changes to Jira writeback, backup/restore, or print layout
- All tasks modify `app.js` and/or `index.html` only

---

### Task 1: Fix PM filter persistence on edit-save

**Files:**
- Modify: `app.js` — `renderSelect()` function (~line 1440)

**Interfaces:**
- Produces: nothing new — just stops `pmFilter` losing its selected value on every `renderAll()`

- [ ] **Step 1: Locate `renderSelect()` in `app.js` (~line 1440). Find the line that rebuilds `pmFilter.innerHTML`:**

```js
const uniqueManagers = [...new Set(projects.map((project) => project.manager).filter(Boolean))];
pmFilter.innerHTML = ['<option value="All">All PMs</option>', ...uniqueManagers.map((manager) => `<option value="${manager}">${manager}</option>`)].join('');
```

- [ ] **Step 2: Add save/restore around `pmFilter.innerHTML` rebuild. Replace those two lines with:**

```js
const uniqueManagers = [...new Set(projects.map((project) => project.manager).filter(Boolean))];
const currentPm = pmFilter.value;
pmFilter.innerHTML = ['<option value="All">All PMs</option>', ...uniqueManagers.map((manager) => `<option value="${manager}">${manager}</option>`)].join('');
pmFilter.value = currentPm;
```

- [ ] **Step 3: Verify in browser.**
  1. Open `index.html`
  2. Select a PM from the PM filter dropdown — table narrows to that PM's projects
  3. Click Edit on any project, change any field, click Save
  4. Confirm the PM filter still shows the same PM selected and the table is still filtered

- [ ] **Step 4: Commit**

```
git add app.js
git commit -m "fix: preserve PM filter selection across renderAll calls"
```

---

### Task 2: Add Region field — schema, migration, Jira sync, modals

**Files:**
- Modify: `app.js` — `migrateProjects()`, `applyFieldNames()`, `syncProjectProgressFromJira()`, `buildProjectFromEnrichment()`, `openEditProjectModal()`, `editProjectForm` submit handler, `modalProjectForm` submit handler
- Modify: `index.html` — edit modal form, add project modal form

**Interfaces:**
- Produces: `project.region` — string, one of the 6 valid values or `''`
- Produces: `cachedRegionFieldId` — module-level `let` variable, resolved in `applyFieldNames()`

- [ ] **Step 1: Add `cachedRegionFieldId` module-level variable. In `app.js`, find the block of `let cached...FieldId` declarations (~line 123). Add after `let cachedNrrFieldId = null;`:**

```js
let cachedRegionFieldId = null;
```

- [ ] **Step 2: Register `Region` field in `applyFieldNames()` (~line 668). After the `if (name === 'NRR(USD)')` line, add:**

```js
if (name === 'Region') cachedRegionFieldId = id;
```

- [ ] **Step 3: Add `region` to `migrateProjects()` (~line 310). After `if (p.statusUpdatedAt === undefined)` line, add:**

```js
if (p.region === undefined) { p.region = ''; changed = true; }
```

- [ ] **Step 4: Add region to Jira sync. In `syncProjectProgressFromJira()` (~line 760), find:**

```js
const fieldIds = ['progress', cachedProgressPctFieldId, cachedEstHoursFieldId, cachedRemEffortFieldId, cachedActEffortFieldId].filter(Boolean);
```

Replace with:

```js
const fieldIds = ['progress', cachedProgressPctFieldId, cachedEstHoursFieldId, cachedRemEffortFieldId, cachedActEffortFieldId, cachedRegionFieldId].filter(Boolean);
```

Then find the block that writes synced values back to `project` (~line 799):

```js
if (percent !== null) project.progress = percent;
if (estimatedHours !== null) project.estimatedHours = estimatedHours;
if (remainingHours !== null) project.remainingHours = remainingHours;
if (actualHours !== null) project.actualHours = actualHours;
```

Add after the last line:

```js
if (cachedRegionFieldId) {
  const rawRegion = f[cachedRegionFieldId];
  const regionVal = typeof rawRegion === 'object' && rawRegion !== null ? (rawRegion.value || '') : (rawRegion || '');
  if (regionVal) project.region = regionVal;
}
```

Also update the condition that guards the whole write block (~line 798). Currently:
```js
if (percent !== null || estimatedHours !== null || remainingHours !== null || actualHours !== null) {
```
Replace with:
```js
if (percent !== null || estimatedHours !== null || remainingHours !== null || actualHours !== null || cachedRegionFieldId) {
```

- [ ] **Step 5: Add `region` to `buildProjectFromEnrichment()` (~line 1056). In the returned object, after `riskReason: issue.riskReason || '',` add:**

```js
region: issue.region || '',
```

Also add region extraction in the extra fields fetch in `pollForNewProjects()` (~line 1098). Find:

```js
const extraFieldIds = [cachedAccountNameFieldId, cachedMrrFieldId, cachedNrrFieldId, cachedEstHoursFieldId, cachedVMForecastFieldId].filter(Boolean);
```

Replace with:

```js
const extraFieldIds = [cachedAccountNameFieldId, cachedMrrFieldId, cachedNrrFieldId, cachedEstHoursFieldId, cachedVMForecastFieldId, cachedRegionFieldId].filter(Boolean);
```

And after `if (cachedVMForecastFieldId) issue.dueDate = f[cachedVMForecastFieldId] || '';` add:

```js
if (cachedRegionFieldId) {
  const rawR = f[cachedRegionFieldId];
  issue.region = typeof rawR === 'object' && rawR !== null ? (rawR.value || '') : (rawR || '');
}
```

- [ ] **Step 6: Add Region dropdown to the edit modal in `index.html`. Find the `<label id="riskReasonLabel">` block (~line 149) and add the Region label immediately before it:**

```html
<label>
  Region
  <select id="editRegion">
    <option value="">— select —</option>
    <option value="APAC">APAC</option>
    <option value="EMEA">EMEA</option>
    <option value="North America">North America</option>
    <option value="LatAm">LatAm</option>
    <option value="Internal">Internal</option>
    <option value="ROW">"ROW"</option>
  </select>
</label>
```

- [ ] **Step 7: Add Region dropdown to the Add Project modal in `index.html`. Find the `<label>` for MRR value (~line 287) and add the Region label immediately before the `<div class="modal-actions">` block (~line 290):**

```html
<label>
  Region
  <select id="modalProjectRegion">
    <option value="">— select —</option>
    <option value="APAC">APAC</option>
    <option value="EMEA">EMEA</option>
    <option value="North America">North America</option>
    <option value="LatAm">LatAm</option>
    <option value="Internal">Internal</option>
    <option value="ROW">"ROW"</option>
  </select>
</label>
```

- [ ] **Step 8: Wire up `editRegion` in `app.js`. Add the const reference near the other edit modal element refs (~line 358):**

```js
const editRegion = document.getElementById('editRegion');
```

In `openEditProjectModal()` (~line 1481), after `editRiskReason.value = ...` add:

```js
editRegion.value = project.region || '';
```

In `closeEditProjectModal()` (~line 1516), after `editRiskReason.value = '';` add:

```js
editRegion.value = '';
```

In `editProjectForm` submit handler (~line 1826), after `selectedProject.riskReason = riskOptionLabel;` add:

```js
selectedProject.region = editRegion.value;
```

- [ ] **Step 9: Wire up `modalProjectRegion` in Add Project submit handler (~line 1856). In `modalProjectForm.addEventListener('submit', ...)`, inside the `projects.unshift({...})` object, after `riskReason: '',` add:**

```js
region: document.getElementById('modalProjectRegion').value,
```

- [ ] **Step 10: Verify in browser.**
  1. On page load, check that existing projects get region populated from Jira sync (open DevTools console, no errors)
  2. Open Edit on a project — Region dropdown is present, shows current value
  3. Change region and save — re-open edit modal, region shows updated value
  4. Add a new project — Region dropdown is present in the modal

- [ ] **Step 11: Commit**

```
git add app.js index.html
git commit -m "feat: add Region field — schema, Jira sync, edit and add modals"
```

---

### Task 3: Add region filter — dashboard and report

**Files:**
- Modify: `index.html` — dashboard filter row
- Modify: `app.js` — `getFilteredProjects()`, `renderSelect()`, filter event listener, `renderTable()` row `data-region`, `generateHTMLReport()` — report region select, stats IIFE, section arrays, `applyFilters()`, all `<tr>` rows

**Interfaces:**
- Consumes: `project.region` from Task 2
- Consumes: `cachedRegionFieldId` from Task 2
- Produces: `regionFilter` — dashboard select element
- Produces: `rRegionFilter` — report select element

#### Dashboard region filter

- [ ] **Step 1: Add region filter `<select>` to `index.html` dashboard filter row. Find `<select id="duemonthFilter">` (~line 99) and add immediately after its closing `</select>`:**

```html
<select id="regionFilter">
  <option value="">All Regions</option>
  <option value="APAC">APAC</option>
  <option value="EMEA">EMEA</option>
  <option value="North America">North America</option>
  <option value="LatAm">LatAm</option>
  <option value="Internal">Internal</option>
  <option value="ROW">"ROW"</option>
</select>
```

- [ ] **Step 2: Add `regionFilter` const ref in `app.js` near the other filter refs (~line 410):**

```js
const regionFilter = document.getElementById('regionFilter');
```

- [ ] **Step 3: Add region to `getFilteredProjects()` (~line 1311). After `const selectedDueMonth = duemonthFilter.value;` add:**

```js
const selectedRegion = regionFilter.value;
```

In the `return projects.filter(...)` callback, add region match condition and include it in the return:

After `const matchesDueMonth = ...` add:
```js
const matchesRegion = !selectedRegion || project.region === selectedRegion;
```

Change `return matchesPm && matchesHealth && matchesDueMonth && matchesSearch && matchesProgress;` to:
```js
return matchesPm && matchesHealth && matchesDueMonth && matchesSearch && matchesProgress && matchesRegion;
```

- [ ] **Step 4: Persist region filter in `renderSelect()` (same save/restore pattern as PM filter from Task 1). After the `pmFilter.value = currentPm;` line added in Task 1, add:**

```js
const currentRegion = regionFilter.value;
// (no innerHTML rebuild needed — regionFilter is static HTML)
regionFilter.value = currentRegion;
```

Note: `regionFilter` is static HTML so no rebuild is needed, but the save/restore ensures correctness if `renderSelect` ever changes.

- [ ] **Step 5: Wire event listener. After `duemonthFilter.addEventListener('change', renderTable);` (~line 2180) add:**

```js
regionFilter.addEventListener('change', renderTable);
```

#### Report region filter

- [ ] **Step 6: Add region selector to report header in `generateHTMLReport()` (~line 2397). Find:**

```js
<p style="color:#94a3b8;margin:4px 0 24px">Generated: ${dateLabel}</p>
```

Replace with:

```js
<div style="display:flex;align-items:center;gap:16px;margin:4px 0 24px">
  <p style="color:#94a3b8;margin:0">Generated: ${dateLabel}</p>
  <select id="rRegionFilter" onchange="applyRegionFilter()" style="background:#0b1220;color:#eff6ff;border:1px solid #223249;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:0.9rem">
    <option value="">All Regions</option>
    <option value="APAC">APAC</option>
    <option value="EMEA">EMEA</option>
    <option value="North America">North America</option>
    <option value="LatAm">LatAm</option>
    <option value="Internal">Internal</option>
    <option value="ROW">"ROW"</option>
  </select>
</div>
```

- [ ] **Step 7: Add `data-region` attribute to all report `<tr>` rows. There are three places:**

**a) `atRiskRows` (~line 2249):** Change `<tr>` to `<tr data-region="${esc(p.region||'')}">` in `atRisk.map(p => ...)`.

**b) `healthRows`** (find `healthAtRisk.map(p =>` nearby): same — add `data-region="${esc(p.region||'')}"` to each `<tr>`.

**c) `newRows`** (find `newProjects.map(p =>` nearby): same.

**d) `allProjectsRows` (~line 2304):** Find `<tr data-pm=...` and add `data-region="${esc(p.region||'')}"` to it.

- [ ] **Step 8: Add per-region stat counts as `data-*` attributes on the stat boxes. The stats section is an IIFE (~line 2399). After the existing aggregations at the top of the IIFE, add:**

```js
const REGIONS = ['APAC','EMEA','North America','LatAm','Internal','ROW'];
const regionStats = {};
REGIONS.forEach(r => {
  const rp = projects.filter(p => p.region === r);
  const rAtRisk = rp.filter(p => Number(p.progress) >= 100);
  const rNew = backups.length >= 1 ? rp.filter(p => !backupNames.has(p.name)) : [];
  regionStats[r] = {
    total: rp.length,
    totalNrr: rp.reduce((s,p) => s + (Number(p.nrrUsd)||0), 0),
    totalMrr: rp.reduce((s,p) => s + (Number(p.mrrUsd)||0), 0),
    hGreen: rp.filter(p => (p.health||'Green')==='Green').length,
    hYellow: rp.filter(p => p.health==='Yellow').length,
    hRed: rp.filter(p => p.health==='Red').length,
    atRisk: rAtRisk.length,
    newCount: rNew.length,
    newNrr: rNew.reduce((s,p) => s + (Number(p.nrrUsd)||0), 0),
    newMrr: rNew.reduce((s,p) => s + (Number(p.mrrUsd)||0), 0),
  };
});
const regionDataAttr = `data-region-stats='${JSON.stringify(regionStats)}'`;
```

Add `${regionDataAttr}` to the outermost `<div class="stats">` element:
```js
return `<div class="stats" id="rptStats" ${regionDataAttr}>
```

- [ ] **Step 9: Add `applyRegionFilter()` function to the report's embedded `<script>` block. Find the `<script>` block near the end of the report HTML template (~line 2520). Add this function inside it:**

```js
function applyRegionFilter() {
  const region = document.getElementById('rRegionFilter').value;
  // Filter all table rows with data-region
  document.querySelectorAll('tr[data-region]').forEach(row => {
    row.style.display = (!region || row.dataset.region === region) ? '' : 'none';
  });
  // Update stat boxes
  const statsDiv = document.getElementById('rptStats');
  if (!statsDiv) return;
  let stats;
  try { stats = JSON.parse(statsDiv.dataset.regionStats); } catch { return; }
  const s = region ? stats[region] : null;
  const el = id => document.getElementById(id);
  if (s) {
    if (el('rptTotal')) el('rptTotal').textContent = s.total;
    if (el('rptMrr')) el('rptMrr').textContent = formatCurrencyRpt(s.totalMrr);
    if (el('rptNrr')) el('rptNrr').textContent = formatCurrencyRpt(s.totalNrr);
    if (el('rptHGreen')) el('rptHGreen').textContent = s.hGreen;
    if (el('rptHYellow')) el('rptHYellow').textContent = s.hYellow;
    if (el('rptHRed')) el('rptHRed').textContent = s.hRed;
    if (el('rptAtRisk')) el('rptAtRisk').textContent = s.atRisk;
    if (el('rptNewCount')) el('rptNewCount').textContent = s.newCount;
    if (el('rptNewMrr')) el('rptNewMrr').textContent = formatCurrencyRpt(s.newMrr);
    if (el('rptNewNrr')) el('rptNewNrr').textContent = formatCurrencyRpt(s.newNrr);
  } else {
    // restore original values from data attributes
    ['rptTotal','rptMrr','rptNrr','rptHGreen','rptHYellow','rptHRed','rptAtRisk','rptNewCount','rptNewMrr','rptNewNrr'].forEach(id => {
      const e = el(id);
      if (e && e.dataset.orig !== undefined) e.textContent = e.dataset.orig;
    });
  }
}
function formatCurrencyRpt(v) {
  if (!v) return '$0';
  if (v >= 1000000) return '$' + (v/1000000).toFixed(1) + 'M';
  if (v >= 1000) return '$' + (v/1000).toFixed(1) + 'K';
  return '$' + Math.round(v);
}
```

- [ ] **Step 10: Add `id` and `data-orig` attributes to the stat box value elements so `applyRegionFilter()` can find and restore them. In the stats IIFE, update the stat box HTML. Each stat value element (the `<h3>` or `<div>` with the number) needs an `id` and `data-orig` matching its current value.**

Find each stat box and add ids:

- `<h3>${projects.length}</h3>` → `<h3 id="rptTotal" data-orig="${projects.length}">${projects.length}</h3>`
- Total MRR div: add `id="rptMrr" data-orig="${formatCurrency(totalMrr)}"` to the MRR `<div>`
- Total NRR div: add `id="rptNrr" data-orig="${formatCurrency(totalNrr)}"` to the NRR `<div>`
- `🟢 ${hGreen} Green`: wrap count in `<span id="rptHGreen" data-orig="${hGreen}">${hGreen}</span>`
- `🟡 ${hYellow} Yellow`: wrap count in `<span id="rptHYellow" data-orig="${hYellow}">${hYellow}</span>`
- `🔴 ${hRed} Red`: wrap count in `<span id="rptHRed" data-orig="${hRed}">${hRed}</span>`
- Over Budget `<h3>`: `<h3 id="rptAtRisk" data-orig="${atRisk.length}">${atRisk.length}</h3>`
- Newly Added `<h3>`: `<h3 id="rptNewCount" data-orig="${newProjects.length}">${newProjects.length}</h3>`
- Added MRR: `id="rptNewMrr" data-orig="..."` on the MRR `<div>`
- Added NRR: `id="rptNewNrr" data-orig="..."` on the NRR `<div>`

- [ ] **Step 11: Verify in browser.**
  1. Open `index.html`, select a region in the dashboard filter — only that region's projects show
  2. Edit a project and save — region filter persists
  3. Click Export to generate the HTML report
  4. Open the downloaded report — region selector appears in the header
  5. Select EMEA — Over Budget, Project Health, Newly Added, and All Projects tables filter to EMEA only; stat boxes update to EMEA totals
  6. Select "All Regions" — everything restores to full counts

- [ ] **Step 12: Commit**

```
git add app.js index.html
git commit -m "feat: add region filter to dashboard and report"
```
