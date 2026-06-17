# Auto-Project Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically detect new Jira issues assigned to watched PMs, enrich them with Salesforce data via the proxy, and add them to the dashboard panel with a notification banner.

**Architecture:** A polling loop in `app.js` calls a new `/jira/new-assignments` proxy endpoint on page load and every N minutes (configurable). When new issues are found, a `/sf/enrich?jiraKey=X` proxy endpoint chains Jira→SF Opportunity→SF Account calls and returns enriched project data. `proxy.ps1` gains SF OAuth token management and two new route handlers.

**Tech Stack:** Vanilla JS (app.js), PowerShell HttpListener proxy (proxy.ps1), Salesforce REST API v59.0, Jira REST API v3.

## Global Constraints

- No build step, no npm, no framework — vanilla JS only in `app.js`
- `proxy.ps1` is PowerShell 5.1 (`[System.Net.WebRequest]`, `[System.Net.HttpListener]`)
- All proxy credentials stored in local JSON files (`jira-settings.json`, `sf-settings.json`), never committed to git
- `sf-settings.json` must be added to `.gitignore`
- SF REST API base: `https://login.salesforce.com/services/oauth2/token` for auth; instance URL returned in token response for data calls
- Jira proxy base already at `http://localhost:8081`
- PM display names must match existing manager names in the `projects` array: `"Arik"` and `"Srini"`
- Default poll interval: 15 minutes; default watched assignees: `["arik.perera@kaltura.com", "Srinivas.Duddu@kaltura.com"]`

---

### Task 1: Add `sf-settings.json` to `.gitignore` and create proxy `/settings/sf` endpoint

**Files:**
- Modify: `.gitignore`
- Modify: `proxy.ps1` (add `POST /settings/sf` route after existing `POST /settings` route, lines ~55–62)

**Interfaces:**
- Produces: `POST http://localhost:8081/settings/sf` accepts `{ sfUsername, sfPasswordWithToken, sfClientId, sfClientSecret }`, writes to `sf-settings.json`, returns `{"ok":true}`

- [ ] **Step 1: Add sf-settings.json to .gitignore**

Open `.gitignore`. If it doesn't exist, create it. Add:
```
sf-settings.json
jira-settings.json
```

- [ ] **Step 2: Add `POST /settings/sf` route to proxy.ps1**

In `proxy.ps1`, after the existing `POST /settings` block (around line 62), add:

```powershell
        if ($req.HttpMethod -eq "POST" -and $path -eq "/settings/sf") {
            $sfSettingsFile = Join-Path $PSScriptRoot "sf-settings.json"
            $reader = New-Object System.IO.StreamReader($req.InputStream)
            $json = $reader.ReadToEnd()
            Set-Content $sfSettingsFile $json -Encoding utf8
            Write-Response $res 200 '{"ok":true}'
            Write-Host "  SF settings saved." -ForegroundColor Green
            continue
        }
```

- [ ] **Step 3: Manually test the endpoint**

Start the proxy: open PowerShell, run `.\proxy.ps1`

In a second terminal, run:
```powershell
$body = '{"sfUsername":"test@test.com","sfPasswordWithToken":"testpass","sfClientId":"abc","sfClientSecret":"xyz"}'
Invoke-RestMethod -Uri "http://localhost:8081/settings/sf" -Method POST -Body $body -ContentType "application/json"
```
Expected output: `ok: True`
Verify `sf-settings.json` was created in the project folder with the correct content.

- [ ] **Step 4: Commit**

```bash
git add .gitignore proxy.ps1
git commit -m "feat: add /settings/sf proxy endpoint and gitignore sf-settings.json"
```

---

### Task 2: Add SF OAuth token management to proxy

**Files:**
- Modify: `proxy.ps1` (add SF token fetch function and in-memory cache near top of file, after `Get-JiraSettings` function)

**Interfaces:**
- Produces: `Get-SFAccessToken` function — returns `@{ accessToken = "..."; instanceUrl = "https://kaltura.my.salesforce.com" }`. Throws on failure.
- Produces: `$script:sfTokenCache` variable — hashtable with keys `accessToken`, `instanceUrl`, `expiresAt`

- [ ] **Step 1: Add SF settings reader and token cache to proxy.ps1**

After the `Get-JiraSettings` function (around line 21), add:

```powershell
$script:sfTokenCache = $null

function Get-SFSettings {
    $sfFile = Join-Path $PSScriptRoot "sf-settings.json"
    if (Test-Path $sfFile) {
        try { return Get-Content $sfFile -Raw | ConvertFrom-Json } catch {}
    }
    return $null
}

function Get-SFAccessToken {
    if ($script:sfTokenCache -and $script:sfTokenCache.expiresAt -gt (Get-Date)) {
        return $script:sfTokenCache
    }
    $s = Get-SFSettings
    if (-not $s -or -not $s.sfUsername) { throw "SF credentials not configured" }

    $body = "grant_type=password" +
            "&client_id=$([Uri]::EscapeDataString($s.sfClientId))" +
            "&client_secret=$([Uri]::EscapeDataString($s.sfClientSecret))" +
            "&username=$([Uri]::EscapeDataString($s.sfUsername))" +
            "&password=$([Uri]::EscapeDataString($s.sfPasswordWithToken))"

    $wr = [System.Net.WebRequest]::Create("https://login.salesforce.com/services/oauth2/token")
    $wr.Method = "POST"
    $wr.ContentType = "application/x-www-form-urlencoded"
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $wr.ContentLength = $bodyBytes.Length
    $wr.GetRequestStream().Write($bodyBytes, 0, $bodyBytes.Length)

    $wresp = $wr.GetResponse()
    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
    $tokenJson = $sr.ReadToEnd() | ConvertFrom-Json

    $script:sfTokenCache = @{
        accessToken = $tokenJson.access_token
        instanceUrl = $tokenJson.instance_url
        expiresAt   = (Get-Date).AddMinutes(110)
    }
    return $script:sfTokenCache
}
```

- [ ] **Step 2: Manually test token fetch**

With SF credentials saved in `sf-settings.json` (real values), restart the proxy and open a browser to `http://localhost:8081/health`. Confirm it returns `{"ok":true}`. Then test the token function by temporarily adding a log line after `Get-SFAccessToken` in the proxy main loop and checking the PowerShell console for the instance URL — or skip this until Task 4 integration test.

- [ ] **Step 3: Commit**

```bash
git add proxy.ps1
git commit -m "feat: add Salesforce OAuth token management to proxy"
```

---

### Task 3: Add `/jira/new-assignments` proxy endpoint

**Files:**
- Modify: `proxy.ps1` (add new route inside the main `while` loop, after the existing `/jira/` handler block)

**Interfaces:**
- Consumes: `Get-JiraSettings` (existing) — reads `jiraEmail`, `jiraToken`, `watchedAssignees` from `jira-settings.json`
- Produces: `GET http://localhost:8081/jira/new-assignments` — returns JSON array:
  ```json
  [
    { "key": "PSVAMB-146676", "summary": "Customer Onboarding", "assigneeEmail": "arik.perera@kaltura.com", "assigneeDisplayName": "Arik Perera", "created": "2026-06-17T10:00:00.000+0000", "jiraUrl": "https://kaltura.atlassian.net/browse/PSVAMB-146676" }
  ]
  ```

- [ ] **Step 1: Add default watchedAssignees to jira-settings.json if not present**

The proxy's `Get-JiraSettings` already reads the file. The app will send `watchedAssignees` when saving settings (Task 6). For now, manually add them to `jira-settings.json` for testing:
```json
{
  "jiraEmail": "your-existing-email",
  "jiraToken": "your-existing-token",
  "watchedAssignees": ["arik.perera@kaltura.com", "Srinivas.Duddu@kaltura.com"],
  "pollIntervalMinutes": 15,
  "pmMapping": {
    "arik.perera@kaltura.com": "Arik",
    "Srinivas.Duddu@kaltura.com": "Srini"
  }
}
```

- [ ] **Step 2: Add `/jira/new-assignments` route to proxy.ps1**

Inside the main `while` loop, after the existing `/jira/` handler block (after line 109 `continue`), add:

```powershell
        if ($req.HttpMethod -eq "GET" -and $path -eq "/jira/new-assignments") {
            $s = Get-JiraSettings
            if (-not $s -or -not $s.jiraEmail -or -not $s.jiraToken) {
                Write-Response $res 401 '{"error":"No Jira credentials configured."}'
                continue
            }
            $watched = $s.watchedAssignees
            if (-not $watched -or $watched.Count -eq 0) {
                Write-Response $res 200 '[]'
                continue
            }
            $creds = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($s.jiraEmail):$($s.jiraToken)"))
            $allIssues = @()
            foreach ($email in $watched) {
                $jql = [Uri]::EscapeDataString("assignee=`"$email`" AND project=PSVAMB AND created>=-30d ORDER BY created DESC")
                $jiraUrl = "https://kaltura.atlassian.net/rest/api/3/search?jql=$jql&fields=summary,assignee,created,status&maxResults=50"
                try {
                    $wr = [System.Net.WebRequest]::Create($jiraUrl)
                    $wr.Method = "GET"
                    $wr.Headers.Add("Authorization", "Basic $creds")
                    $wr.Accept = "application/json"
                    $wr.Timeout = 15000
                    $wresp = $wr.GetResponse()
                    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                    $data = $sr.ReadToEnd() | ConvertFrom-Json
                    foreach ($issue in $data.issues) {
                        $allIssues += @{
                            key                = $issue.key
                            summary            = $issue.fields.summary
                            assigneeEmail      = $issue.fields.assignee.emailAddress
                            assigneeDisplayName = $issue.fields.assignee.displayName
                            created            = $issue.fields.created
                            jiraUrl            = "https://kaltura.atlassian.net/browse/$($issue.key)"
                        }
                    }
                } catch {
                    Write-Host "  ERR new-assignments for $email $($_.Exception.Message)" -ForegroundColor Red
                }
            }
            $json = $allIssues | ConvertTo-Json -Compress -Depth 5
            if ($allIssues.Count -eq 1) { $json = "[$json]" }
            if ($allIssues.Count -eq 0) { $json = "[]" }
            Write-Response $res 200 $json
            Write-Host "  OK  /jira/new-assignments ($($allIssues.Count) issues)" -ForegroundColor Green
            continue
        }
```

- [ ] **Step 3: Manually test**

Restart the proxy. Open browser and navigate to:
`http://localhost:8081/jira/new-assignments`

Expected: JSON array of recent PSVAMB issues assigned to either watched email. If none exist in the last 30 days, returns `[]`.

- [ ] **Step 4: Commit**

```bash
git add proxy.ps1 jira-settings.json
git commit -m "feat: add /jira/new-assignments proxy endpoint"
```

---

### Task 4: Add `/sf/enrich` proxy endpoint

**Files:**
- Modify: `proxy.ps1` (add `/sf/enrich` route after the `/jira/new-assignments` route)

**Interfaces:**
- Consumes: `Get-SFAccessToken` (Task 2) — returns `@{ accessToken; instanceUrl }`
- Consumes: `Get-JiraSettings` (existing) — reads `jiraEmail`, `jiraToken`
- Produces: `GET http://localhost:8081/sf/enrich?jiraKey=PSVAMB-XXXXX` — returns:
  ```json
  {
    "customer": "Acme Corp",
    "name": "Acme Corp - Professional Services",
    "nrrHours": 120,
    "mrr": 5000,
    "nrr": 60000,
    "oppUrl": "https://kaltura.lightning.force.com/lightning/r/Opportunity/006TQ00000daFmrYAE/view",
    "salesName": "John Smith",
    "csmName": "Jane Doe"
  }
  ```
  Or `{ "sfSkipped": true }` if SF credentials not configured.
  Or `{ "sfError": "message" }` if enrichment fails.

- [ ] **Step 1: Add SF HTTP helper function to proxy.ps1**

After `Get-SFAccessToken`, add a helper for making authenticated SF REST calls:

```powershell
function Invoke-SFRequest($instanceUrl, $accessToken, $path) {
    $url = "$instanceUrl$path"
    $wr = [System.Net.WebRequest]::Create($url)
    $wr.Method = "GET"
    $wr.Headers.Add("Authorization", "Bearer $accessToken")
    $wr.Accept = "application/json"
    $wr.Timeout = 15000
    $wresp = $wr.GetResponse()
    $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
    return $sr.ReadToEnd() | ConvertFrom-Json
}
```

- [ ] **Step 2: Add `/sf/enrich` route to proxy.ps1**

After the `/jira/new-assignments` block, add:

```powershell
        if ($req.HttpMethod -eq "GET" -and $path -eq "/sf/enrich") {
            $sfSettings = Get-SFSettings
            if (-not $sfSettings -or -not $sfSettings.sfUsername) {
                Write-Response $res 200 '{"sfSkipped":true}'
                continue
            }
            $jiraKey = $req.QueryString["jiraKey"]
            if (-not $jiraKey) {
                Write-Response $res 400 '{"error":"jiraKey required"}'
                continue
            }
            try {
                # Step 1: Fetch Jira issue to get SF Opportunity ID from remote links
                $s = Get-JiraSettings
                $creds = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("$($s.jiraEmail):$($s.jiraToken)"))
                $wr = [System.Net.WebRequest]::Create("https://kaltura.atlassian.net/rest/api/3/issue/$jiraKey/remotelink")
                $wr.Method = "GET"
                $wr.Headers.Add("Authorization", "Basic $creds")
                $wr.Accept = "application/json"
                $wr.Timeout = 15000
                $wresp = $wr.GetResponse()
                $sr = New-Object System.IO.StreamReader($wresp.GetResponseStream())
                $remoteLinks = $sr.ReadToEnd() | ConvertFrom-Json
                $sfLink = $remoteLinks | Where-Object { $_.object.url -like "*lightning.force.com*" } | Select-Object -First 1
                if (-not $sfLink) {
                    Write-Response $res 200 '{"sfError":"No SF link found on Jira issue"}'
                    continue
                }
                $sfUrl = $sfLink.object.url
                # Extract Opportunity ID from URL: .../Opportunity/006TQ00000daFmrYAE/view
                $oppId = ($sfUrl -split "/Opportunity/")[1] -split "/" | Select-Object -First 1

                # Step 2: Get SF token and fetch Opportunity
                $token = Get-SFAccessToken
                $opp = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/Opportunity/$($oppId)?fields=Name,Total_PS_Hours__c,Amount,Kaltura_NRR__c,AccountId"
                $accountId = $opp.AccountId

                # Step 3: Fetch SF Account
                $acct = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/Account/$($accountId)?fields=Name,OwnerId,Customer_Success_Manager__c"

                # Step 4: Resolve Account Owner (Sales) name
                $salesName = ""
                if ($acct.OwnerId) {
                    try {
                        $owner = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/User/$($acct.OwnerId)?fields=Name"
                        $salesName = $owner.Name
                    } catch { $salesName = "" }
                }

                # Step 5: Resolve CSM name — field may be a lookup (ID) or text
                $csmName = ""
                if ($acct.Customer_Success_Manager__c) {
                    $csmRaw = $acct.Customer_Success_Manager__c
                    if ($csmRaw -match "^[0-9a-zA-Z]{15,18}$") {
                        try {
                            $csm = Invoke-SFRequest $token.instanceUrl $token.accessToken "/services/data/v59.0/sobjects/User/$csmRaw?fields=Name"
                            $csmName = $csm.Name
                        } catch { $csmName = $csmRaw }
                    } else {
                        $csmName = $csmRaw
                    }
                }

                $oppUrl = "https://kaltura.lightning.force.com/lightning/r/Opportunity/$oppId/view"
                $result = @{
                    customer  = $acct.Name
                    name      = $opp.Name
                    nrrHours  = $opp.Total_PS_Hours__c
                    mrr       = $opp.Amount
                    nrr       = $opp.Kaltura_NRR__c
                    oppUrl    = $oppUrl
                    salesName = $salesName
                    csmName   = $csmName
                }
                Write-Response $res 200 ($result | ConvertTo-Json -Compress)
                Write-Host "  OK  /sf/enrich $jiraKey" -ForegroundColor Green
            } catch {
                # If token expired mid-request, clear cache and let next poll retry
                $script:sfTokenCache = $null
                Write-Response $res 200 "{`"sfError`":`"$($_.Exception.Message)`"}"
                Write-Host "  ERR /sf/enrich $jiraKey $($_.Exception.Message)" -ForegroundColor Red
            }
            continue
        }
```

**Note on SF field names:** `Total_PS_Hours__c`, `Kaltura_NRR__c`, and `Customer_Success_Manager__c` are assumed field API names. If enrichment returns null for these fields, the actual names need to be verified in the Kaltura SF org via Setup → Object Manager → Opportunity/Account → Fields.

- [ ] **Step 3: Manually test**

Restart proxy. In browser navigate to:
`http://localhost:8081/sf/enrich?jiraKey=PSVAMB-146676`

Expected: JSON with `customer`, `name`, `nrrHours`, `mrr`, `nrr`, `oppUrl`, `salesName`, `csmName`.
If SF field names are wrong, some values will be `null` — note which and correct the field names in the route.

- [ ] **Step 4: Commit**

```bash
git add proxy.ps1
git commit -m "feat: add /sf/enrich proxy endpoint with Jira→SF→Account chain"
```

---

### Task 5: Polling loop in app.js

**Files:**
- Modify: `app.js` (add polling functions after `syncProjectProgressFromJira`, around line 527; add poll startup after existing `syncProjectProgressFromJira()` call at line 1946)

**Interfaces:**
- Consumes: `projects` (global array), `saveProjects()`, `renderAll()` (all existing)
- Consumes: `settings.pollIntervalMinutes`, `settings.watchedAssignees`, `settings.pmMapping` (new settings fields, set in Task 6)
- Produces: `startAutoProjectPoll()` — starts interval and runs first poll immediately
- Produces: `showNewProjectsBanner(keys)` — displays notification banner (implemented in Task 7)

- [ ] **Step 1: Add `getExistingJiraKeys()` helper to app.js**

After the `syncProjectProgressFromJira` function (around line 527), add:

```javascript
function getExistingJiraKeys() {
  return new Set(projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean));
}
```

- [ ] **Step 2: Add `buildProjectFromEnrichment()` helper to app.js**

Immediately after `getExistingJiraKeys()`, add:

```javascript
function buildProjectFromEnrichment(issue, sfData) {
  const pmMapping = settings.pmMapping || {
    'arik.perera@kaltura.com': 'Arik',
    'Srinivas.Duddu@kaltura.com': 'Srini',
  };
  const manager = pmMapping[issue.assigneeEmail] || issue.assigneeDisplayName || 'Unassigned';
  const startDate = issue.created ? issue.created.slice(0, 10) : '';
  const nrr = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.nrr ?? '') : '';
  const mrr = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.mrr ?? '') : '';
  const csmName = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.csmName ?? '') : '';
  const salesName = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.salesName ?? '') : '';
  return {
    customer:    sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.customer || '') : '',
    name:        sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.name || issue.summary) : issue.summary,
    manager,
    jira:        issue.jiraUrl,
    nrr:         sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.nrrHours ?? '') : '',
    comments:    `NRR: ${nrr}, MRR: ${mrr}, CSM: ${csmName}, Sales: ${salesName}`,
    startDate,
    dueDate:     '',
    health:      'Green',
    status:      'In Progress',
    progress:    0,
    statusText:  '',
    atLink:      sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.oppUrl || '') : '',
    riskReason:  '',
    csm:         csmName,
    sales:       salesName,
  };
}
```

- [ ] **Step 3: Add `pollForNewProjects()` async function**

Immediately after `buildProjectFromEnrichment()`, add:

```javascript
async function pollForNewProjects() {
  if (!settings.jiraEmail || !settings.jiraToken) return;
  let newIssues;
  try {
    const resp = await fetch('http://localhost:8081/jira/new-assignments', {
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return;
    newIssues = await resp.json();
  } catch {
    return;
  }
  const existing = getExistingJiraKeys();
  const toAdd = newIssues.filter(issue => !existing.has(issue.key));
  if (!toAdd.length) return;

  const addedKeys = [];
  for (const issue of toAdd) {
    let sfData = { sfSkipped: true };
    try {
      const sfResp = await fetch(`http://localhost:8081/sf/enrich?jiraKey=${encodeURIComponent(issue.key)}`, {
        headers: { Accept: 'application/json' },
      });
      if (sfResp.ok) sfData = await sfResp.json();
    } catch {
      // sfData stays sfSkipped
    }
    const project = buildProjectFromEnrichment(issue, sfData);
    projects.push(project);
    addedKeys.push({ key: issue.key, sfUnavailable: !!(sfData.sfSkipped || sfData.sfError) });
  }
  saveProjects();
  renderAll();
  showNewProjectsBanner(addedKeys);
}
```

- [ ] **Step 4: Add `startAutoProjectPoll()` function**

Immediately after `pollForNewProjects()`, add:

```javascript
let _pollTimer = null;
function startAutoProjectPoll() {
  pollForNewProjects();
  const intervalMs = ((settings.pollIntervalMinutes ?? 15) * 60 * 1000);
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(pollForNewProjects, intervalMs);
}
```

- [ ] **Step 5: Call `startAutoProjectPoll()` at startup**

Find the bottom of `app.js` where `syncProjectProgressFromJira()` is called (line ~1946). Add the call immediately after:

```javascript
syncProjectProgressFromJira();
startAutoProjectPoll();
```

- [ ] **Step 6: Open the dashboard in a browser and open DevTools console**

Confirm no JS errors on load. Confirm `pollForNewProjects` runs (check Network tab for a request to `http://localhost:8081/jira/new-assignments`).

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "feat: add auto-project polling loop with SF enrichment"
```

---

### Task 6: Settings UI — SF credentials + poll settings

**Files:**
- Modify: `index.html` (expand `settingsModal` content)
- Modify: `app.js` (update `settingsBtn` click handler to populate new fields; update `saveSettingsBtn` handler to save new fields)

**Interfaces:**
- Consumes: `settings.pollIntervalMinutes`, `settings.watchedAssignees`, `settings.pmMapping` (all new, stored in localStorage `SETTINGS_KEY`)
- Consumes: `startAutoProjectPoll()` (Task 5) — called after settings saved to restart timer with new interval
- Produces: SF credentials saved to proxy via `POST http://localhost:8081/settings/sf`
- Produces: `settings.pollIntervalMinutes`, `settings.watchedAssignees` persisted to localStorage

- [ ] **Step 1: Expand settingsModal HTML in index.html**

Replace the existing `settingsModal` content (lines 374–399) with:

```html
<div id="settingsModal" class="modal hidden" aria-hidden="true">
  <div class="modal-card" style="max-width:520px;">
    <div class="modal-header">
      <div>
        <p class="eyebrow">Configuration</p>
        <h3>Settings</h3>
      </div>
      <button id="closeSettingsBtn" class="ghost-btn" type="button" aria-label="Close">×</button>
    </div>
    <div class="status-form" style="margin-top:8px;">

      <p class="eyebrow" style="margin-bottom:6px;">Jira API</p>
      <p class="muted" style="margin-bottom:4px;">Generate a token at <a href="https://id.atlassian.net/manage-profile/security/api-tokens" target="_blank" rel="noreferrer" style="color:#7dd3fc;">id.atlassian.net</a>.</p>
      <label>Jira email<input id="settingsJiraEmail" type="email" placeholder="your@email.com" /></label>
      <label>Jira API token<input id="settingsJiraToken" type="password" placeholder="Paste your API token" /></label>

      <hr style="border-color:#334155;margin:16px 0;" />

      <p class="eyebrow" style="margin-bottom:6px;">Auto-poll</p>
      <label>Poll interval (minutes)<input id="settingsPollInterval" type="number" min="1" max="120" placeholder="15" style="width:80px;" /></label>
      <label>Watched assignees (comma-separated emails)<input id="settingsWatchedAssignees" type="text" placeholder="arik.perera@kaltura.com, Srinivas.Duddu@kaltura.com" /></label>

      <hr style="border-color:#334155;margin:16px 0;" />

      <p class="eyebrow" style="margin-bottom:6px;">Salesforce</p>
      <p class="muted" style="margin-bottom:4px;">Connected App credentials for SF enrichment. Stored locally only.</p>
      <label>SF Username<input id="settingsSFUsername" type="email" placeholder="you@kaltura.com" /></label>
      <label>SF Password + Security Token<input id="settingsSFPassword" type="password" placeholder="PasswordSecurityToken (concatenated)" /></label>
      <label>Connected App Client ID<input id="settingsSFClientId" type="text" placeholder="Consumer Key" /></label>
      <label>Connected App Client Secret<input id="settingsSFClientSecret" type="password" placeholder="Consumer Secret" /></label>
      <p id="settingsSFStatus" class="muted" style="min-height:18px;font-size:0.8rem;"></p>

      <div class="modal-actions">
        <button type="button" id="cancelSettingsBtn" class="ghost-btn">Cancel</button>
        <button type="button" id="saveSettingsBtn" class="primary-btn">Save &amp; sync</button>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Update settingsBtn click handler in app.js**

Find `settingsBtn.addEventListener('click', ...)` (line ~1129). Replace its body with:

```javascript
settingsBtn.addEventListener('click', () => {
  document.getElementById('settingsJiraEmail').value = settings.jiraEmail || '';
  document.getElementById('settingsJiraToken').value = settings.jiraToken || '';
  document.getElementById('settingsPollInterval').value = settings.pollIntervalMinutes ?? 15;
  document.getElementById('settingsWatchedAssignees').value =
    (settings.watchedAssignees || ['arik.perera@kaltura.com', 'Srinivas.Duddu@kaltura.com']).join(', ');
  document.getElementById('settingsSFUsername').value = '';
  document.getElementById('settingsSFPassword').value = '';
  document.getElementById('settingsSFClientId').value = '';
  document.getElementById('settingsSFClientSecret').value = '';
  document.getElementById('settingsSFStatus').textContent = '';
  settingsModal.classList.remove('hidden');
  settingsModal.setAttribute('aria-hidden', 'false');
});
```

- [ ] **Step 3: Update saveSettingsBtn handler in app.js**

Find `saveSettingsBtn.addEventListener('click', async () => {` (line ~1145). Replace its body with:

```javascript
saveSettingsBtn.addEventListener('click', async () => {
  settings.jiraEmail = document.getElementById('settingsJiraEmail').value.trim();
  settings.jiraToken = document.getElementById('settingsJiraToken').value.trim();
  settings.pollIntervalMinutes = parseInt(document.getElementById('settingsPollInterval').value, 10) || 15;
  const rawAssignees = document.getElementById('settingsWatchedAssignees').value;
  settings.watchedAssignees = rawAssignees.split(',').map(s => s.trim()).filter(Boolean);
  saveSettings();

  try {
    await fetch('http://localhost:8081/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jiraEmail: settings.jiraEmail, jiraToken: settings.jiraToken, watchedAssignees: settings.watchedAssignees, pollIntervalMinutes: settings.pollIntervalMinutes }),
    });
  } catch {
    console.warn('Proxy not running — start proxy.ps1 for Jira sync to work.');
  }

  const sfUsername = document.getElementById('settingsSFUsername').value.trim();
  const sfPassword = document.getElementById('settingsSFPassword').value.trim();
  const sfClientId = document.getElementById('settingsSFClientId').value.trim();
  const sfClientSecret = document.getElementById('settingsSFClientSecret').value.trim();
  if (sfUsername && sfPassword && sfClientId && sfClientSecret) {
    try {
      await fetch('http://localhost:8081/settings/sf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sfUsername, sfPasswordWithToken: sfPassword, sfClientId, sfClientSecret }),
      });
      document.getElementById('settingsSFStatus').textContent = 'SF credentials saved.';
    } catch {
      document.getElementById('settingsSFStatus').textContent = 'SF credentials not saved — proxy not running.';
    }
  }

  startAutoProjectPoll();
  closeSettingsModal();
  syncProjectProgressFromJira();
});
```

- [ ] **Step 4: Open the dashboard, click Settings, verify all fields appear**

Check:
- Jira email/token fields pre-fill from existing settings
- Poll interval shows 15
- Watched assignees shows the two default emails
- SF fields are empty (no pre-fill — credentials are proxy-side only)

- [ ] **Step 5: Enter SF credentials and click Save & sync**

Enter real SF credentials. Expected: `settingsSFStatus` shows "SF credentials saved." Verify `sf-settings.json` was written in the project folder.

- [ ] **Step 6: Commit**

```bash
git add index.html app.js
git commit -m "feat: expand settings UI with SF credentials and auto-poll config"
```

---

### Task 7: Notification banner

**Files:**
- Modify: `index.html` (add banner element before `<script src="app.js">`)
- Modify: `styles.css` (add banner styles)
- Modify: `app.js` (add `showNewProjectsBanner()` function, used in Task 5)

**Interfaces:**
- Consumes: `showNewProjectsBanner(addedKeys)` where `addedKeys` is `Array<{ key: string, sfUnavailable: boolean }>`
- Produces: Banner DOM element `#newProjectsBanner` that slides in/out

- [ ] **Step 1: Add banner HTML to index.html**

Just before `<script src="app.js"></script>` (line 435), add:

```html
<div id="newProjectsBanner" class="new-projects-banner hidden" role="status" aria-live="polite">
  <span id="newProjectsBannerMsg"></span>
  <button id="newProjectsBannerDismiss" class="ghost-btn" style="padding:2px 8px;font-size:0.8rem;">Dismiss</button>
</div>
```

- [ ] **Step 2: Add banner styles to styles.css**

At the end of `styles.css`, add:

```css
.new-projects-banner {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(-80px);
  background: #1e3a5f;
  border: 1px solid #3b82f6;
  color: #e2e8f0;
  padding: 10px 18px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 9999;
  font-size: 0.9rem;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  transition: transform 0.3s ease;
  max-width: 90vw;
}
.new-projects-banner.hidden {
  display: none;
}
.new-projects-banner.visible {
  transform: translateX(-50%) translateY(0);
}
.new-projects-banner a {
  color: #7dd3fc;
  text-decoration: underline;
  cursor: pointer;
}
```

- [ ] **Step 3: Add `showNewProjectsBanner()` and scroll-highlight to app.js**

After `startAutoProjectPoll()` (Task 5), add:

```javascript
let _bannerTimer = null;
function showNewProjectsBanner(addedKeys) {
  const banner = document.getElementById('newProjectsBanner');
  const msg = document.getElementById('newProjectsBannerMsg');
  if (!banner || !msg) return;

  const count = addedKeys.length;
  const keyLinks = addedKeys.map(({ key, sfUnavailable }) => {
    const suffix = sfUnavailable ? ' (SF data unavailable)' : '';
    return `<a data-jirakey="${key}">${key}${suffix}</a>`;
  }).join(', ');

  msg.innerHTML = `<strong>${count} new project${count > 1 ? 's' : ''} added</strong> — ${keyLinks}`;

  banner.classList.remove('hidden');
  requestAnimationFrame(() => banner.classList.add('visible'));

  if (_bannerTimer) clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => dismissNewProjectsBanner(), 10000);
}

function dismissNewProjectsBanner() {
  const banner = document.getElementById('newProjectsBanner');
  if (!banner) return;
  banner.classList.remove('visible');
  setTimeout(() => banner.classList.add('hidden'), 300);
}

document.addEventListener('click', (e) => {
  const key = e.target.dataset?.jirakey;
  if (!key) return;
  const rows = document.querySelectorAll('tr[data-jirakey]');
  const row = [...rows].find(r => r.dataset.jirakey === key);
  if (row) {
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('highlight-row');
    setTimeout(() => row.classList.remove('highlight-row'), 2000);
  }
  dismissNewProjectsBanner();
});
```

- [ ] **Step 4: Add `data-jirakey` attribute to table rows in renderTable**

Find where `<tr>` elements are built in `renderTable()` in `app.js`. Add `data-jirakey` attribute:

Grep for the tr creation pattern:
```
grep -n "createElement('tr')" app.js
```

On the `tr` element created per project, add:
```javascript
tr.dataset.jirakey = getJiraIssueKey(project.jira) || '';
```

- [ ] **Step 5: Add `highlight-row` CSS to styles.css**

```css
tr.highlight-row td {
  background-color: #1e3a5f !important;
  transition: background-color 0.3s ease;
}
```

- [ ] **Step 6: Add dismiss button handler to app.js**

After `dismissNewProjectsBanner()`, add:

```javascript
document.getElementById('newProjectsBannerDismiss').addEventListener('click', dismissNewProjectsBanner);
```

- [ ] **Step 7: Test banner manually**

Temporarily call `showNewProjectsBanner([{ key: 'PSVAMB-99999', sfUnavailable: false }])` in the browser console.
Expected: Banner slides in from top, shows "1 new project added — PSVAMB-99999", auto-dismisses after 10s.
Click the key link: page scrolls to matching row (if exists) and highlights briefly.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: add new-projects notification banner with row highlight"
```

---

### Task 8: End-to-end smoke test and cleanup

**Files:**
- No new files

- [ ] **Step 1: Full flow test**

1. Start proxy: `.\proxy.ps1`
2. Open `index.html` in browser
3. Open Settings, enter real Jira + SF credentials, save
4. Open DevTools Network tab, filter to `localhost:8081`
5. Confirm `GET /jira/new-assignments` fires on load
6. If there are real new PSVAMB issues assigned to you in the last 30 days that aren't in your projects array:
   - Confirm they appear in the panel
   - Confirm the banner shows with the correct count and keys
   - Confirm clicking a key scrolls to the row
7. If no new issues exist, manually test by temporarily changing the JQL in the proxy route from `created>=-30d` to `created>=-365d` to pick up older issues — verify the full flow, then revert.

- [ ] **Step 2: Verify SF field names**

Check the enrichment response for `nrrHours`, `mrr`, `nrr`. If any are `null`:
- In Salesforce Setup → Object Manager → Opportunity → Fields & Relationships, search for "PS Hours", "NRR", etc.
- Update the field names in the `/sf/enrich` route in `proxy.ps1` to match the actual API names.

- [ ] **Step 3: Verify CSM field on Account**

Check if `Customer_Success_Manager__c` returned a value. If null, search Account fields in SF Setup and correct the field name in `proxy.ps1`.

- [ ] **Step 4: Final commit**

```bash
git add proxy.ps1
git commit -m "fix: correct SF custom field API names after smoke test"
```
(Only needed if field names were wrong. Skip if all fields populated correctly.)
