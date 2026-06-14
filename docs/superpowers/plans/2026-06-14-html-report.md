# HTML Export Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSV export with a polished self-contained HTML report containing summary stats, at-risk projects, newly added projects, a live filter bar, and a collapsible full projects table.

**Architecture:** A single `generateHTMLReport()` function in `app.js` builds the entire HTML string from current `projects`, `backups`, and `customers` data, then downloads it as a `.html` file. All CSS and JS is inlined — no external dependencies. The existing `exportBtn` click handler is replaced.

**Tech Stack:** Vanilla JS, HTML template strings, Blob download — no libraries.

---

### Task 1: Replace CSV export handler with generateHTMLReport() in app.js

**Files:**
- Modify: `app.js` — replace `exportBtn` click handler (lines ~1170–1188)

- [ ] **Step 1: Add the `generateHTMLReport` function before the `exportBtn` listener**

Find the line `exportBtn.addEventListener('click', () => {` and insert this entire function immediately before it:

```js
function generateHTMLReport() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2,'0');
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const yy = String(now.getFullYear()).slice(2);
  const hh = String(now.getHours()).padStart(2,'0');
  const min = String(now.getMinutes()).padStart(2,'0');
  const dateLabel = `${dd}/${mm}/${yy} ${hh}:${min}`;
  const filename = `dashboard-report-${dd}-${mm}-${yy}-${hh}-${min}.html`;

  const atRisk = projects.filter(p => p.health === 'Red' || p.health === 'Yellow')
    .sort((a,b) => (a.health === 'Red' ? -1 : 1) - (b.health === 'Red' ? -1 : 1));

  const backupNames = new Set((backups[0]?.projects || []).map(p => p.name));
  const newProjects = projects.filter(p => !backupNames.has(p.name));

  const uniquePMs = [...new Set(projects.map(p => p.manager).filter(Boolean))].sort();

  function healthPill(health) {
    const colors = {
      Green: 'background:rgba(74,222,128,0.16);color:#bbf7d0',
      Yellow: 'background:rgba(251,191,36,0.15);color:#fde68a',
      Red: 'background:rgba(248,113,113,0.14);color:#fecaca',
    };
    const h = health || 'Green';
    return `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:0.82rem;font-weight:700;${colors[h]||colors.Green}">${h}</span>`;
  }

  function progressBar(val) {
    const v = Math.max(0, Math.round(Number(val)||0));
    const fill = v > 100 ? 'linear-gradient(90deg,#f97316,#fb923c)' : v < 50 ? 'linear-gradient(90deg,#22c55e,#86efac)' : v <= 75 ? 'linear-gradient(90deg,#facc15,#fde68a)' : 'linear-gradient(90deg,#f87171,#fecaca)';
    const color = v > 100 ? '#f97316' : v < 50 ? '#bbf7d0' : v <= 75 ? '#fde68a' : '#fecaca';
    return `<div style="width:100%;background:#142033;border-radius:999px;overflow:hidden;height:8px;margin-bottom:4px"><div style="height:100%;border-radius:999px;width:${Math.min(v,100)}%;background:${fill}"></div></div><small style="color:${color};font-weight:700">${v}%${v>100?' ⚠':''}</small>`;
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const atRiskRows = atRisk.length
    ? atRisk.map(p => `<tr>
        <td>${esc(p.customer||'-')}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${healthPill(p.health)}</td>
        <td style="color:#fde68a">${esc(p.riskReason||'No risk reason provided')}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="color:#94a3b8;font-style:italic;">No projects currently at risk.</td></tr>`;

  const newRows = newProjects.length
    ? newProjects.map(p => `<tr>
        <td>${esc(p.customer||'-')}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.manager||'-')}</td>
        <td>${esc(formatDate(p.startDate))}</td>
        <td>${esc(formatDate(p.dueDate))}</td>
      </tr>`).join('')
    : '';

  const grouped = projects.reduce((acc, p) => {
    const key = p.manager || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const allProjectsRows = Object.keys(grouped).sort((a,b) => a.localeCompare(b)).map(manager => {
    const rows = grouped[manager].map(p => `<tr data-pm="${esc(p.manager||'')}" data-health="${esc(p.health||'Green')}" data-progress="${Math.round(Number(p.progress)||0)}">
      <td>${esc(p.customer||'-')}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(String(p.nrr||0))} hrs</td>
      <td>${esc(formatDate(p.startDate))}</td>
      <td>${esc(formatDate(p.dueDate))}</td>
      <td>${healthPill(p.health)}</td>
      <td>${progressBar(p.progress)}</td>
      <td>${p.statusText ? p.statusText : '<span style="color:#f97316;font-style:italic">No Status Yet</span>'}</td>
      <td>${esc((p.comments||'').split(', ').join('\n'))}</td>
    </tr>`).join('');
    return `<tbody class="pm-group-body">
      <tr class="pm-group-header-row"><td colspan="9" style="padding:10px 8px 6px;color:#7dd3fc;font-weight:700;font-size:0.95rem;border-bottom:1px solid #223249">${esc(manager)} <span style="font-weight:400;font-size:0.85rem;color:#bfdbfe">(Number Of Projects: ${grouped[manager].length})</span></td></tr>
      ${rows}
    </tbody>`;
  }).join('');

  const pmOptions = uniquePMs.map(pm => `<option value="${esc(pm)}">${esc(pm)}</option>`).join('');

  const newSection = newProjects.length && backups.length ? `
    <section style="margin-bottom:32px">
      <h2 style="font-size:1.1rem;color:#7dd3fc;margin-bottom:12px">Newly Added Projects</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Customer</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Project</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">PM</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Start</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">End</th>
        </tr></thead>
        <tbody>${newRows}</tbody>
      </table>
    </section>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Project Manager Dashboard — Status Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:'Inter',sans-serif;background:#07111f;color:#eff6ff;padding:32px}
h1{margin:0 0 4px;font-size:1.6rem}
.eyebrow{text-transform:uppercase;letter-spacing:.2em;font-size:.72rem;color:#a5b4fc;margin-bottom:8px}
.stats{display:flex;gap:16px;margin-bottom:32px}
.stat{background:#0f172a;border:1px solid #223249;border-radius:16px;padding:16px 24px;min-width:140px}
.stat p{margin:0 0 4px;color:#bfdbfe;font-size:.9rem}
.stat h3{margin:0;font-size:2rem}
section{background:#0f172a;border:1px solid #223249;border-radius:16px;padding:20px;margin-bottom:24px}
h2{margin:0 0 14px;font-size:1.1rem;color:#eff6ff}
table{width:100%;border-collapse:collapse}
th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #223249;font-size:.9rem;vertical-align:top}
th{color:#bfdbfe;font-weight:600}
.filter-bar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.filter-bar select{background:#0b1220;color:#eff6ff;border:1px solid #223249;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:.9rem}
.toggle-btn{background:rgba(15,23,42,.95);border:1px solid #223249;border-radius:12px;padding:9px 16px;color:#eff6ff;font-family:inherit;font-size:.9rem;cursor:pointer;margin-bottom:12px}
.toggle-btn:hover{background:rgba(30,41,59,.95)}
#allTable{display:none;overflow-x:auto}
@media print{.filter-bar,.toggle-btn{display:none!important}#allTable{display:block!important}}
</style>
</head>
<body>
<p class="eyebrow">Executive View</p>
<h1>Project Manager Dashboard — Status Report</h1>
<p style="color:#94a3b8;margin:4px 0 24px">Generated: ${dateLabel}</p>

<div class="stats">
  <div class="stat" style="border-top:4px solid #38bdf8">
    <p>Total Projects</p>
    <h3>${projects.length}</h3>
  </div>
  <div class="stat" style="border-top:4px solid ${atRisk.length > 0 ? '#f97316' : '#4ade80'}">
    <p>At Risk</p>
    <h3 style="color:${atRisk.length > 0 ? '#f97316' : '#eff6ff'}">${atRisk.length}</h3>
  </div>
</div>

<section>
  <h2>Projects At Risk</h2>
  <table>
    <thead><tr>
      <th>Customer</th><th>Project</th><th>Health</th><th>Risk Reason</th>
    </tr></thead>
    <tbody>${atRiskRows}</tbody>
  </table>
</section>

${newSection}

<section>
  <h2>All Projects</h2>
  <div class="filter-bar">
    <select id="rPmFilter" onchange="applyFilters()">
      <option value="">All PMs</option>${pmOptions}
    </select>
    <select id="rHealthFilter" onchange="applyFilters()">
      <option value="">All Health</option>
      <option value="Green">Green</option>
      <option value="Yellow">Yellow</option>
      <option value="Red">Red</option>
    </select>
    <select id="rProgressFilter" onchange="applyFilters()">
      <option value="">All Progress</option>
      <option value="0-39">0–39%</option>
      <option value="40-69">40–69%</option>
      <option value="70-100">70–100%</option>
    </select>
  </div>
  <button class="toggle-btn" onclick="toggleAll(this)">▶ Show all projects (${projects.length})</button>
  <div id="allTable">
    <table>
      <thead><tr>
        <th>Customer</th><th>Project</th><th>NRR(h)</th><th>Start</th><th>End</th>
        <th>Health</th><th>Progress</th><th>Project Status</th><th>Manager Notes</th>
      </tr></thead>
      ${allProjectsRows}
    </table>
  </div>
</section>

<script>
function toggleAll(btn){
  const t=document.getElementById('allTable');
  const open=t.style.display==='block';
  t.style.display=open?'none':'block';
  btn.textContent=open?'▶ Show all projects (${projects.length})':'▼ Hide all projects';
}
function applyFilters(){
  const pm=document.getElementById('rPmFilter').value;
  const health=document.getElementById('rHealthFilter').value;
  const prog=document.getElementById('rProgressFilter').value;
  document.querySelectorAll('#allTable tbody.pm-group-body tr[data-pm]').forEach(row=>{
    const rPm=row.dataset.pm;
    const rHealth=row.dataset.health;
    const rProg=Number(row.dataset.progress);
    let show=true;
    if(pm && rPm!==pm) show=false;
    if(health && rHealth!==health) show=false;
    if(prog==='0-39' && rProg>=40) show=false;
    if(prog==='40-69' && (rProg<40||rProg>=70)) show=false;
    if(prog==='70-100' && rProg<70) show=false;
    row.style.display=show?'':'none';
  });
}
</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Replace the existing exportBtn click handler**

Find and replace the entire existing handler:

```js
exportBtn.addEventListener('click', () => {
  const lines = [
```

...through...

```js
  URL.revokeObjectURL(url);
});
```

Replace the entire block with:

```js
exportBtn.addEventListener('click', generateHTMLReport);
```

- [ ] **Step 3: Verify the report generates correctly**

Refresh `http://localhost:8080`. Click "Export report". A `.html` file should download. Open it in a browser and verify:
1. Header shows title, date, Total Projects count, At Risk count
2. At Risk section lists Yellow/Red projects sorted Red first, with risk reason
3. Newly Added section appears only if backups exist and there are new projects
4. Filter bar has PM / Health / Progress dropdowns
5. "Show all projects" button toggles the table
6. Filters apply to the table rows in real time

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: replace CSV export with polished self-contained HTML report"
```

---

### Task 2: Push to GitHub

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
