# Shared KV Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all localStorage reads/writes with Cloudflare KV via the proxy worker, making all data shared across users.

**Architecture:** Two tasks — (1) add `/kv/:key` routes to the worker backed by DASHBOARD_KV, (2) replace localStorage in app.js with async KV calls + one-way migration + 30s auto-refresh. Task 2 depends on Task 1.

**Tech Stack:** Vanilla JS, Cloudflare Workers, Cloudflare KV.

## Global Constraints

- No build step — changes take effect by refreshing `index.html`.
- KV namespace bound as `DASHBOARD_KV` in kvibe worker environment (prerequisite).
- Proxy URL: `https://pm-proxy.demo.qa.kaltura.ai`
- Routes: `GET /kv/:key` and `PUT /kv/:key` (prefix is `/kv/`, not `/data/`).
- KV keys are the full localStorage key strings: `project-dashboard-projects-v1`, `project-dashboard-users-v1`, `project-dashboard-settings-v1`, `project-dashboard-customers-v1`, `project-dashboard-backups-v1`.
- All 5 keys loaded in parallel on page load.
- Migration is one-way: if KV returns null, read localStorage, write to KV, clear localStorage. Never write to localStorage again after migration.
- Auto-refresh polls `project-dashboard-projects-v1` every 30 seconds.
- Last-write-wins — no locking or conflict resolution.
- `saveProjects/Users/Customers/Settings/Backups` become async — callers use fire-and-forget (`.catch(()=>{})`) or `await`.

---

### Task 1: Add /kv/:key routes to proxy-worker.js

**Files:**
- Modify: `proxy-worker.js` — add GET and PUT routes for `/kv/:key`

**Interfaces:**
- Produces:
  - `GET https://pm-proxy.demo.qa.kaltura.ai/kv/project-dashboard-projects-v1` → JSON value or `null`
  - `PUT https://pm-proxy.demo.qa.kaltura.ai/kv/project-dashboard-projects-v1` with JSON body → `{"ok":true}`

- [ ] **Step 1: Add KV routes to proxy-worker.js**

In [proxy-worker.js](proxy-worker.js), find the `export default { async fetch(request, env) {` function. After the OPTIONS preflight handler and before the `/health` route, add:

```js
    // GET /kv/:key — read from KV
    if (method === 'GET' && path.startsWith('/kv/')) {
      const key = path.substring(4); // e.g. "project-dashboard-projects-v1"
      const value = await env.DASHBOARD_KV.get(key);
      return json(value ? JSON.parse(value) : null);
    }

    // PUT /kv/:key — write to KV
    if (method === 'PUT' && path.startsWith('/kv/')) {
      const key = path.substring(4);
      const body = await request.text();
      await env.DASHBOARD_KV.put(key, body);
      return json({ ok: true });
    }
```

Also update the routes comment at the top of the file to include:
```
 *   GET  /kv/:key                   (read from KV — DASHBOARD_KV binding required)
 *   PUT  /kv/:key                   (write to KV)
```

- [ ] **Step 2: Deploy worker to kvibe and verify**

After deploying, test in browser console (from any tab logged into kvibe or with public access):
```js
// Write test value
fetch('https://pm-proxy.demo.qa.kaltura.ai/kv/test-kv-key', {
  method: 'PUT',
  headers: {'Content-Type':'application/json'},
  body: JSON.stringify({hello:'world'})
}).then(r=>r.json()).then(console.log)
// Expected: {"ok":true}

// Read it back
fetch('https://pm-proxy.demo.qa.kaltura.ai/kv/test-kv-key')
  .then(r=>r.json()).then(console.log)
// Expected: {"hello":"world"}

// Read non-existent key
fetch('https://pm-proxy.demo.qa.kaltura.ai/kv/nonexistent-key')
  .then(r=>r.json()).then(console.log)
// Expected: null
```

- [ ] **Step 3: Commit**

```bash
git add proxy-worker.js
git commit -m "feat: add /kv/:key read/write routes to worker backed by DASHBOARD_KV"
```

---

### Task 2: Replace localStorage with KV in app.js

**Files:**
- Modify: `app.js` — add `loadKv()`, `saveKv()`, async save functions, `initData()`, `startKvRefresh()`; replace localStorage declarations; replace page-load calls

**Interfaces:**
- Consumes: `GET/PUT https://pm-proxy.demo.qa.kaltura.ai/kv/:key` from Task 1
- Produces:
  - `async saveProjects()`, `async saveUsers()`, `async saveCustomers()`, `async saveSettings()`, `async saveBackups()`
  - `async initData()` — loads all data, migrates if needed, renders
  - `startKvRefresh()` — polls projects every 30s

- [ ] **Step 1: Add loadKv and saveKv helpers**

In [app.js](app.js), find `const STORAGE_KEY = 'project-dashboard-projects-v1';` (around line 48). Insert BEFORE it:

```js
const PROXY = 'https://pm-proxy.demo.qa.kaltura.ai';

async function loadKv(key) {
  try {
    const res = await fetch(`${PROXY}/kv/${encodeURIComponent(key)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveKv(key, value) {
  try {
    await fetch(`${PROXY}/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  } catch {}
}

```

- [ ] **Step 2: Replace save functions with async KV versions**

In [app.js](app.js), replace each save function:

```js
// FIND AND REPLACE:
function saveUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
// WITH:
async function saveUsers() { await saveKv(USERS_KEY, users); }

// FIND AND REPLACE:
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
// WITH:
async function saveSettings() { await saveKv(SETTINGS_KEY, settings); }

// FIND AND REPLACE:
function saveCustomers() {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
}
// WITH:
async function saveCustomers() { await saveKv(CUSTOMERS_KEY, customers); }

// FIND AND REPLACE:
function saveBackups() {
  localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
}
// WITH:
async function saveBackups() { await saveKv(BACKUPS_KEY, backups); }

// FIND AND REPLACE:
function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
// WITH:
async function saveProjects() { await saveKv(STORAGE_KEY, projects); }
```

- [ ] **Step 3: Replace synchronous localStorage declarations with empty defaults**

In [app.js](app.js), replace these variable declarations:

```js
// FIND AND REPLACE:
const USERS_KEY = 'project-dashboard-users-v1';
let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
// WITH:
const USERS_KEY = 'project-dashboard-users-v1';
let users = [];

// FIND AND REPLACE:
const SETTINGS_KEY = 'project-dashboard-settings-v1';
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
// WITH:
const SETTINGS_KEY = 'project-dashboard-settings-v1';
let settings = {};

// FIND AND REPLACE:
const CUSTOMERS_KEY = 'project-dashboard-customers-v1';
let customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
// WITH:
const CUSTOMERS_KEY = 'project-dashboard-customers-v1';
let customers = [];

// FIND AND REPLACE:
const BACKUPS_KEY = 'project-dashboard-backups-v1';
let backups = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');
// WITH:
const BACKUPS_KEY = 'project-dashboard-backups-v1';
let backups = [];

// FIND AND REPLACE (around line 197):
let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;
migrateProjects();
// WITH:
let projects = defaultProjects;
```

- [ ] **Step 4: Fix migrateProjects to handle async saveProjects**

In [app.js](app.js), find `migrateProjects()`:
```js
  if (changed) saveProjects();
```
Replace with:
```js
  if (changed) saveProjects().catch(() => {});
```

- [ ] **Step 5: Add initData() and startKvRefresh()**

In [app.js](app.js), find `async function saveProjects()`. Add immediately AFTER it:

```js
async function initData() {
  // Load all 5 keys in parallel
  const [kvProjects, kvUsers, kvCustomers, kvSettings, kvBackups] = await Promise.all([
    loadKv(STORAGE_KEY),
    loadKv(USERS_KEY),
    loadKv(CUSTOMERS_KEY),
    loadKv(SETTINGS_KEY),
    loadKv(BACKUPS_KEY),
  ]);

  // One-way migration: if KV empty, seed from localStorage then clear it
  async function migrateKey(kvValue, lsKey, setter, kvSaveKey) {
    if (kvValue !== null) return kvValue;
    const local = localStorage.getItem(lsKey);
    if (!local) return null;
    try {
      const parsed = JSON.parse(local);
      await saveKv(lsKey, parsed);
      localStorage.removeItem(lsKey);
      return parsed;
    } catch { return null; }
  }

  projects  = (await migrateKey(kvProjects,  STORAGE_KEY,   null, STORAGE_KEY))   || defaultProjects;
  users     = (await migrateKey(kvUsers,     USERS_KEY,     null, USERS_KEY))     || [];
  customers = (await migrateKey(kvCustomers, CUSTOMERS_KEY, null, CUSTOMERS_KEY)) || [];
  settings  = (await migrateKey(kvSettings,  SETTINGS_KEY,  null, SETTINGS_KEY))  || {};
  backups   = (await migrateKey(kvBackups,   BACKUPS_KEY,   null, BACKUPS_KEY))   || [];

  migrateProjects();
  renderAll();
  syncProjectProgressFromJira();
  syncStatusFromJira();
  startAutoProjectPoll();
  startKvRefresh();
}

function startKvRefresh() {
  setInterval(async () => {
    const fresh = await loadKv(STORAGE_KEY);
    if (fresh) {
      projects = fresh;
      migrateProjects();
      renderAll();
    }
  }, 30000);
}
```

- [ ] **Step 6: Replace page-load calls at bottom of app.js**

In [app.js](app.js), find the last lines (around line 2914):
```js
syncProjectProgressFromJira();
syncStatusFromJira();
startAutoProjectPoll();
```

Replace with:
```js
initData();
```

- [ ] **Step 7: Verify in browser**

1. Open the app. Open DevTools → Network tab, filter by `pm-proxy`.
2. On load: 5 parallel GET requests to `/kv/project-dashboard-*` should appear.
3. If first load with localStorage data: 5 PUT requests should follow (migration), then localStorage should be empty.
4. Edit and save a project: one PUT to `/kv/project-dashboard-projects-v1`.
5. Open the same URL in a second browser / incognito tab: both tabs should show the same data.
6. Edit in tab 1, wait 30 seconds — tab 2 should auto-refresh and show the change.

- [ ] **Step 8: Commit**

```bash
git add app.js
git commit -m "feat: replace localStorage with shared Cloudflare KV storage"
```
