# Jira Import Feature — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bulk Jira import flow — search for a PM by name, see their active Initiative issues, select which to import, and build projects via the existing SF enrichment pipeline.

**Architecture:** Three tasks — (1) proxy route for user search, (2) HTML + CSS for the modal, (3) JS wiring for the full import flow. Tasks 1 and 2 are independent; Task 3 depends on both.

**Tech Stack:** Vanilla JS, HTML, CSS, PowerShell proxy. No new dependencies.

## Global Constraints

- No build step — changes take effect by refreshing `index.html`.
- No frameworks, no npm.
- JQL used verbatim: `issuetype = Initiative AND assignee = "{accountId}" AND (status = Open OR status = "in progress") ORDER BY created ASC`
- Proxy `/jira/user/search` must use the same stream-close pattern as the `/jira/field` route (close `$sr` and `$wresp` in finally blocks).
- Already-imported detection uses `getExistingJiraKeys()` (existing function in `app.js`).
- SF enrichment uses existing `fetch('http://localhost:8081/sf/enrich?jiraKey=...')` pattern from `pollForNewProjects`.
- Project building uses existing `buildProjectFromEnrichment(issue, sfData)` — `issue` must have: `{ key, summary, jiraUrl, assigneeEmail, assigneeDisplayName, created, status }`.

---

### Task 1: Add /jira/user/search proxy route

**Files:**
- Modify: `proxy.ps1` — add new route before the generic `/jira/` handler

**Interfaces:**
- Produces: `GET /jira/user/search?query=<text>` → JSON array of `[{ accountId, displayName, emailAddress }, ...]`

- [ ] **Step 1: Add the /jira/user/search route to proxy.ps1**

In [proxy.ps1](proxy.ps1), find the line:
```powershell
        if ($path.StartsWith("/jira/")) {
```

Insert the following block IMMEDIATELY BEFORE that line:

```powershell
        if ($req.HttpMethod -eq "GET" -and $path -eq "/jira/user/search") {
            $s = Get-JiraSettings
            if (-not $s -or -not $s.jiraEmail -or -not $s.jiraToken) {
                Write-Response $res 401 '{"error":"No credentials."}'
                continue
            }
            $query = $req.QueryString["query"]
            $creds = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($s.jiraEmail):$($s.jiraToken)"))
            try {
                $wr = [System.Net.WebRequest]::Create("https://kaltura.atlassian.net/rest/api/3/user/search?query=$([Uri]::EscapeDataString($query))&maxResults=10")
                $wr.Method = "GET"
                $wr.Headers.Add("Authorization", "Basic $creds")
                $wr.Accept = "application/json"
                $wr.Timeout = 45000
                $wresp = $wr.GetResponse()
                try {
                    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                    $body = $sr.ReadToEnd()
                    $sr.Close()
                } finally {
                    $wresp.Close()
                }
                Write-Response $res 200 $body
                Write-Host "  OK  /jira/user/search?query=$query" -ForegroundColor Green
            } catch [System.Net.WebException] {
                $wresp = $_.Exception.Response
                if ($wresp) {
                    try {
                        $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                        $body = $sr.ReadToEnd()
                        $sr.Close()
                    } finally {
                        $wresp.Close()
                    }
                    Write-Response $res ([int]$wresp.StatusCode) $body
                } else {
                    Write-Response $res 502 "{`"error`":`"$($_.Exception.Message)`"}"
                }
                Write-Host "  ERR /jira/user/search $($_.Exception.Message)" -ForegroundColor Red
            }
            continue
        }

```

- [ ] **Step 2: Verify by restarting proxy and testing**

Restart proxy.ps1, then open the browser console and run:
```js
fetch('http://localhost:8081/jira/user/search?query=tal', {headers:{Accept:'application/json'}})
  .then(r=>r.json()).then(console.log)
```
Expected: Array of user objects with `accountId`, `displayName`, `emailAddress`.

- [ ] **Step 3: Commit**

```bash
git add proxy.ps1
git commit -m "feat: add /jira/user/search proxy route for PM autocomplete"
```

---

### Task 2: Add import modal HTML and CSS

**Files:**
- Modify: `index.html` — add Import button + modal
- Modify: `styles.css` — add import row styles

**Interfaces:**
- Produces: DOM elements with IDs: `importFromJiraBtn`, `importModal`, `closeImportModalBtn`, `importPmSearch`, `importPmResults`, `importPmStatus`, `importStep1`, `importStep2`, `importStep2Header`, `importSelectAll`, `importCount`, `importProjectList`, `importBackBtn`, `importConfirmBtn`, `importProgress`

- [ ] **Step 1: Add Import from Jira button to topbar**

In [index.html](index.html), find:
```html
            <button id="addProjectBtn" class="secondary-btn">Add new project</button>
```

Add immediately after it:
```html
            <button id="importFromJiraBtn" class="secondary-btn">Import from Jira</button>
```

- [ ] **Step 2: Add import modal HTML**

In [index.html](index.html), find the `whatsNewModal` div (added in the versioning task). Insert the following BEFORE the whatsNewModal div:

```html
    <div id="importModal" class="modal hidden" aria-hidden="true">
      <div class="modal-card" style="max-width:520px;">
        <div class="modal-header">
          <h3>Import from Jira</h3>
          <button id="closeImportModalBtn" class="ghost-btn" type="button">✕</button>
        </div>
        <div id="importStep1">
          <label style="display:block;margin-bottom:8px;color:#bfdbfe;">Search PM by name</label>
          <input id="importPmSearch" type="text" placeholder="e.g. Tal Sabo" autocomplete="off"
                 style="width:100%;border:1px solid var(--line);background:#0b1220;color:var(--text);border-radius:12px;padding:10px 12px;font-size:0.95rem;" />
          <div id="importPmResults" class="autocomplete-list hidden"></div>
          <p id="importPmStatus" style="color:#64748b;font-size:0.88rem;margin-top:8px;min-height:20px;"></p>
        </div>
        <div id="importStep2" class="hidden">
          <div id="importStep2Header" style="margin-bottom:12px;color:#bfdbfe;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="display:flex;align-items:center;gap:6px;color:#bfdbfe;font-size:0.9rem;cursor:pointer;">
              <input type="checkbox" id="importSelectAll"> Select all new
            </label>
            <span id="importCount" style="font-size:0.88rem;color:#64748b;"></span>
          </div>
          <div id="importProjectList" style="max-height:340px;overflow-y:auto;display:grid;gap:6px;"></div>
          <div class="modal-actions" style="margin-top:12px;">
            <button id="importBackBtn" class="ghost-btn">← Back</button>
            <button id="importConfirmBtn" class="primary-btn">Import selected</button>
          </div>
          <p id="importProgress" style="color:#7dd3fc;font-size:0.88rem;margin-top:8px;text-align:center;min-height:20px;"></p>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Add CSS for import rows**

In [styles.css](styles.css), at the end of the file add:

```css
.import-project-row { display:grid; grid-template-columns:auto 90px 1fr 80px auto; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--line); border-radius:10px; cursor:pointer; background:rgba(15,23,42,0.95); font-size:0.88rem; }
.import-project-row:hover { background:rgba(30,41,59,0.95); }
.import-project-row.existing { opacity:0.5; cursor:default; }
.import-key { color:#7dd3fc; font-weight:600; white-space:nowrap; }
.import-summary { color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.import-status { color:#94a3b8; font-size:0.82rem; white-space:nowrap; }
.import-badge-existing { background:rgba(100,116,139,0.2); color:#94a3b8; border-radius:999px; padding:2px 8px; font-size:0.78rem; white-space:nowrap; }
```

- [ ] **Step 4: Verify in browser**

Open `index.html`. The "Import from Jira" button should appear in the top nav. Clicking it should open the modal showing the PM search input. The modal should close with ✕ (wiring comes in Task 3 — just verify the HTML renders without errors in the console).

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "feat: add Import from Jira modal HTML and CSS"
```

---

### Task 3: Wire up import flow in app.js

**Files:**
- Modify: `app.js` — add all JS for the import modal

**Interfaces:**
- Consumes:
  - `getExistingJiraKeys()` → `Set<string>` of existing Jira keys
  - `buildProjectFromEnrichment(issue, sfData)` → project object. `issue` shape: `{ key, summary, jiraUrl, assigneeEmail, assigneeDisplayName, created, status }`
  - `projects` array (global)
  - `saveProjects()`, `renderAll()`, `syncProjectProgressFromJira()`, `showToast(msg, type)`
  - All DOM IDs from Task 2

- [ ] **Step 1: Add DOM references for import modal**

In [app.js](app.js), find the block of `const` DOM element references near the top (where `addProjectBtn`, `editProjectModal` etc. are declared). Add:

```js
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
```

- [ ] **Step 2: Add the full import flow JS**

In [app.js](app.js), find the area near the bottom where other modal event handlers are wired up (near `whatsNewBtn` listener). Add the following complete block:

```js
// ── Jira Import ──────────────────────────────────────────────────────────────

let importDebounceTimer = null;
let importSelectedPm = null; // { accountId, displayName }
let importFetchedIssues = []; // raw Jira issue objects

function openImportModal() {
  importPmSearch.value = '';
  importPmResults.classList.add('hidden');
  importPmStatus.textContent = '';
  importStep1.classList.remove('hidden');
  importStep2.classList.add('hidden');
  importSelectedPm = null;
  importFetchedIssues = [];
  importModal.classList.remove('hidden');
  importModal.setAttribute('aria-hidden', 'false');
  setTimeout(() => importPmSearch.focus(), 50);
}

function closeImportModal() {
  importModal.classList.add('hidden');
  importModal.setAttribute('aria-hidden', 'true');
}

importFromJiraBtn.addEventListener('click', openImportModal);
closeImportModalBtn.addEventListener('click', closeImportModal);
importModal.addEventListener('click', (e) => { if (e.target === importModal) closeImportModal(); });

// Step 1: PM search autocomplete
importPmSearch.addEventListener('input', () => {
  clearTimeout(importDebounceTimer);
  const q = importPmSearch.value.trim();
  if (q.length < 2) {
    importPmResults.classList.add('hidden');
    importPmStatus.textContent = '';
    return;
  }
  importPmStatus.textContent = 'Searching...';
  importDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`http://localhost:8081/jira/user/search?query=${encodeURIComponent(q)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) { importPmStatus.textContent = 'Search failed.'; return; }
      const users = await res.json();
      importPmStatus.textContent = '';
      if (!users.length) {
        importPmResults.innerHTML = '<li style="padding:8px 14px;color:#64748b;">No users found</li>';
        importPmResults.classList.remove('hidden');
        return;
      }
      importPmResults.innerHTML = users.map(u => `
        <li data-account-id="${escapeHtml(u.accountId)}" data-display-name="${escapeHtml(u.displayName)}"
            style="padding:8px 14px;cursor:pointer;">
          <span style="font-weight:600;color:#eff6ff;">${escapeHtml(u.displayName)}</span>
          <span style="color:#64748b;font-size:0.85rem;margin-left:6px;">${escapeHtml(u.emailAddress || '')}</span>
        </li>
      `).join('');
      importPmResults.classList.remove('hidden');
    } catch {
      importPmStatus.textContent = 'Search failed.';
    }
  }, 300);
});

importPmResults.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-account-id]');
  if (!li) return;
  importSelectedPm = { accountId: li.dataset.accountId, displayName: li.dataset.displayName };
  importPmResults.classList.add('hidden');
  loadImportStep2(importSelectedPm);
});

// Step 2: Load initiatives for selected PM
async function loadImportStep2(pm) {
  importStep1.classList.add('hidden');
  importStep2.classList.remove('hidden');
  importStep2Header.innerHTML = `Importing projects for <strong>${escapeHtml(pm.displayName)}</strong>`;
  importProjectList.innerHTML = '<p style="color:#64748b;padding:8px 0;">Loading...</p>';
  importCount.textContent = '';
  importSelectAll.checked = false;
  importProgress.textContent = '';

  const jql = `issuetype = Initiative AND assignee = "${pm.accountId}" AND (status = Open OR status = "in progress") ORDER BY created ASC`;
  const url = `http://localhost:8081/jira/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,created&maxResults=50`;

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) { importProjectList.innerHTML = '<p style="color:#ef4444;">Failed to load projects.</p>'; return; }
    const data = await res.json();
    importFetchedIssues = (data.issues || []).map(i => ({
      key: i.key,
      summary: i.fields.summary,
      jiraUrl: `https://kaltura.atlassian.net/browse/${i.key}`,
      assigneeEmail: i.fields.assignee?.emailAddress || '',
      assigneeDisplayName: i.fields.assignee?.displayName || pm.displayName,
      created: i.fields.created || '',
      status: i.fields.status?.name || '',
    }));

    const existing = getExistingJiraKeys();
    const alreadyImported = importFetchedIssues.filter(i => existing.has(i.key)).length;
    importCount.textContent = `${importFetchedIssues.length} project${importFetchedIssues.length !== 1 ? 's' : ''} · ${alreadyImported} already imported`;

    if (!importFetchedIssues.length) {
      importProjectList.innerHTML = '<p style="color:#64748b;padding:8px 0;">No active initiatives found.</p>';
      return;
    }

    importProjectList.innerHTML = importFetchedIssues.map(issue => {
      const isExisting = existing.has(issue.key);
      return `
        <label class="import-project-row${isExisting ? ' existing' : ''}">
          <input type="checkbox" value="${escapeHtml(issue.key)}" ${isExisting ? 'checked disabled' : 'checked'}>
          <span class="import-key">${escapeHtml(issue.key)}</span>
          <span class="import-summary" title="${escapeHtml(issue.summary)}">${escapeHtml(issue.summary)}</span>
          <span class="import-status">${escapeHtml(issue.status)}</span>
          ${isExisting ? '<span class="import-badge-existing">Already imported</span>' : '<span></span>'}
        </label>
      `;
    }).join('');
  } catch {
    importProjectList.innerHTML = '<p style="color:#ef4444;">Failed to load projects.</p>';
  }
}

// Select all new toggle
importSelectAll.addEventListener('change', () => {
  importProjectList.querySelectorAll('input[type="checkbox"]:not(:disabled)').forEach(cb => {
    cb.checked = importSelectAll.checked;
  });
});

// Back button
importBackBtn.addEventListener('click', () => {
  importStep2.classList.add('hidden');
  importStep1.classList.remove('hidden');
  importPmSearch.value = '';
  importPmResults.classList.add('hidden');
  importPmStatus.textContent = '';
});

// Import selected
importConfirmBtn.addEventListener('click', async () => {
  const checked = [...importProjectList.querySelectorAll('input[type="checkbox"]:not(:disabled):checked')]
    .map(cb => cb.value);
  if (!checked.length) { importProgress.textContent = 'No new projects selected.'; return; }

  importConfirmBtn.disabled = true;
  importBackBtn.disabled = true;
  const toImport = importFetchedIssues.filter(i => checked.includes(i.key));
  let done = 0;

  for (const issue of toImport) {
    importProgress.textContent = `Importing ${done + 1} of ${toImport.length}...`;
    let sfData = { sfSkipped: true };
    try {
      const sfResp = await fetch(`http://localhost:8081/sf/enrich?jiraKey=${encodeURIComponent(issue.key)}`, {
        headers: { Accept: 'application/json' },
      });
      if (sfResp.ok) sfData = await sfResp.json();
    } catch {}
    const project = buildProjectFromEnrichment(issue, sfData);
    projects.unshift(project);
    done++;
  }

  saveProjects();
  renderAll();
  syncProjectProgressFromJira();
  closeImportModal();
  importConfirmBtn.disabled = false;
  importBackBtn.disabled = false;
  showToast(`Imported ${done} project${done !== 1 ? 's' : ''}`, 'success');
});
```

- [ ] **Step 3: Verify full flow in browser**

1. Restart proxy (Task 1 must be done).
2. Open `index.html`, click "Import from Jira".
3. Type "Tal" — dropdown should show Tal Sabo and other matching users.
4. Click Tal Sabo — Step 2 loads showing her initiatives with checkboxes.
5. Projects already in the dashboard show "Already imported" badge with checkbox disabled.
6. Deselect a couple, click "Import selected" — progress shows "Importing 1 of 3...", then toast "Imported 3 projects".
7. Projects appear at the top of the dashboard.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: wire up Jira import flow — PM search, project selection, SF enrichment"
```
