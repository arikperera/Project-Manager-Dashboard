# Jira Import Feature — Design Spec

**Date:** 2026-06-22

## Problem

PMs currently add projects one at a time via the "Add new project" modal. When a PM has 10–20 active Jira initiatives, importing them all manually is tedious. This feature adds a bulk import flow that searches Jira for a PM's active initiatives and imports selected ones with SF enrichment.

## Goals

1. "Import from Jira" button in the top navigation opens an import modal.
2. Step 1: Live PM name autocomplete via Jira user search API.
3. Step 2: List all active initiatives for the selected PM with checkboxes; already-imported projects shown with "Already imported" badge.
4. Import selected new projects using the existing `buildProjectFromEnrichment` pipeline.
5. One new proxy route: `GET /jira/user/search`.

## Out of Scope

- Importing from issue types other than `Initiative`
- Updating/overwriting existing projects
- Importing from multiple PMs at once

---

## Section 1 — Import button

In `index.html`, add to the `.topbar-actions` div, after "Add new project":

```html
<button id="importFromJiraBtn" class="secondary-btn">Import from Jira</button>
```

---

## Section 2 — Import modal: Step 1 (PM search)

New modal in `index.html`:

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
      <p id="importPmStatus" style="color:#64748b;font-size:0.88rem;margin-top:8px;"></p>
    </div>
    <div id="importStep2" class="hidden">
      <div id="importStep2Header" style="margin-bottom:12px;"></div>
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
      <p id="importProgress" style="color:#7dd3fc;font-size:0.88rem;margin-top:8px;text-align:center;"></p>
    </div>
  </div>
</div>
```

**Step 1 behaviour:**
- Input triggers search after 2+ characters typed (debounced 300ms)
- Calls `GET /jira/user/search?query=<text>` via proxy
- Results shown in `#importPmResults` as `.autocomplete-list` items: `{displayName} — {emailAddress}`
- Clicking a result: hides Step 1, shows Step 2, fetches projects for that PM
- While searching: `#importPmStatus` shows "Searching..."
- No results: shows "No users found"

---

## Section 3 — Import modal: Step 2 (project selection)

**Step 2 behaviour:**

- Header: `<p>Importing projects for <strong>{displayName}</strong></p>`
- Fetches: `GET /jira/search?jql=issuetype+%3D+Initiative+AND+assignee+%3D+%22{accountId}%22+AND+(status+%3D+Open+OR+status+%3D+%22in+progress%22)&fields=summary,status,assignee&maxResults=50` via proxy
- Each result rendered as a row:

```html
<label class="import-project-row">
  <input type="checkbox" value="{issueKey}" data-jira-url="{jiraUrl}"> 
  <span class="import-key">{issueKey}</span>
  <span class="import-summary">{summary}</span>
  <span class="import-status">{status.name}</span>
  <!-- if already imported: -->
  <span class="import-badge-existing">Already imported</span>
</label>
```

- Already-imported detection: compare issue key against `getExistingJiraKeys()` (already in `app.js`)
- Already-imported rows: checkbox pre-checked, disabled, styled with opacity 0.5
- "Select all new" checkbox: checks/unchecks only non-disabled checkboxes
- `#importCount` shows: "12 projects · 3 already imported"

**Import button behaviour:**
1. Collect checked, non-disabled issue keys
2. For each: fetch SF enrichment via `http://localhost:8081/sf/enrich?jiraKey={key}`
3. Build project via `buildProjectFromEnrichment(issue, sfData)` — same as polling flow
4. `projects.unshift(project)` for each
5. Show progress: "Importing 2 of 5..."
6. After all done: `saveProjects()`, `renderAll()`, `syncProjectProgressFromJira()`, close modal
7. Show toast: "Imported 5 projects"

**Back button:** returns to Step 1, clears Step 2 state.

---

## Section 4 — Proxy: new /jira/user/search route

In `proxy.ps1`, add before the generic `/jira/` handler:

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
        } finally { $wresp.Close() }
        Write-Response $res 200 $body
        Write-Host "  OK  /jira/user/search?query=$query" -ForegroundColor Green
    } catch [System.Net.WebException] {
        $wresp = $_.Exception.Response
        if ($wresp) {
            try {
                $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                $body = $sr.ReadToEnd()
                $sr.Close()
            } finally { $wresp.Close() }
            Write-Response $res ([int]$wresp.StatusCode) $body
        } else {
            Write-Response $res 502 "{`"error`":`"$($_.Exception.Message)`"}"
        }
        Write-Host "  ERR /jira/user/search $($_.Exception.Message)" -ForegroundColor Red
    }
    continue
}
```

---

## CSS additions

```css
.import-project-row { display:grid; grid-template-columns:auto 90px 1fr 80px auto; align-items:center; gap:8px; padding:8px 10px; border:1px solid var(--line); border-radius:10px; cursor:pointer; background:rgba(15,23,42,0.95); font-size:0.88rem; }
.import-project-row:hover { background:rgba(30,41,59,0.95); }
.import-project-row.existing { opacity:0.5; cursor:default; }
.import-key { color:#7dd3fc; font-weight:600; white-space:nowrap; }
.import-summary { color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.import-status { color:#94a3b8; font-size:0.82rem; white-space:nowrap; }
.import-badge-existing { background:rgba(100,116,139,0.2); color:#94a3b8; border-radius:999px; padding:2px 8px; font-size:0.78rem; white-space:nowrap; }
```

---

## Data flow summary

```
User types "Tal"
  → GET /jira/user/search?query=Tal
  → Jira returns [{accountId, displayName, emailAddress}, ...]
  → User clicks "Tal Sabo"
  → GET /jira/search?jql=issuetype=Initiative AND assignee="accountId" AND ...
  → Jira returns issues list
  → User selects projects, clicks Import
  → For each: GET /sf/enrich?jiraKey=PSVAMB-xxx
  → buildProjectFromEnrichment(issue, sfData)
  → projects.unshift(project)
  → saveProjects() + renderAll()
```
