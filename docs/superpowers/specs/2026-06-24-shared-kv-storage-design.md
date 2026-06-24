# Shared KV Storage — Design Spec

**Date:** 2026-06-24

## Problem

Each user's browser has its own localStorage — data is not shared between users. PMs importing projects on one machine can't see them on another. The app needs a single shared data store accessible to all users.

## Goals

1. Replace all localStorage reads/writes with async calls to Cloudflare KV via the existing worker.
2. Migrate existing localStorage data to KV on first load (once per browser).
3. Auto-refresh data from KV every 60 seconds so users see each other's changes.
4. Last-write-wins for simultaneous edits (no locking or merging).
5. All data types shared: `projects`, `users`, `customers`, `settings`, `backups`.

## Out of Scope

- Access control / SSO (future)
- Conflict resolution beyond last-write-wins
- Per-user data isolation

---

## Section 1 — Worker: KV namespace + new routes

### KV binding

The worker needs a KV namespace bound as `DASHBOARD_KV`. Set up in kvibe dashboard. Five keys used: `projects`, `users`, `customers`, `settings`, `backups`.

### New worker routes

Add to `proxy-worker.js`:

```js
// GET /data/:key — read from KV
if (method === 'GET' && path.startsWith('/data/')) {
  const key = path.substring(6); // e.g. "projects"
  const value = await env.DASHBOARD_KV.get(key);
  return json(value ? JSON.parse(value) : null);
}

// PUT /data/:key — write to KV
if (method === 'PUT' && path.startsWith('/data/')) {
  const key = path.substring(6);
  const body = await request.text();
  await env.DASHBOARD_KV.put(key, body);
  return json({ ok: true });
}
```

---

## Section 2 — App: async data layer

### New functions in app.js

```js
const PROXY = 'https://pm-proxy.demo.qa.kaltura.ai';

async function loadData(key) {
  try {
    const res = await fetch(`${PROXY}/data/${key}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function saveData(key, value) {
  try {
    await fetch(`${PROXY}/data/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
  } catch {}
}
```

### Updated save functions (all become async)

```js
async function saveProjects() { await saveData('projects', projects); }
async function saveUsers()    { await saveData('users', users); }
async function saveCustomers(){ await saveData('customers', customers); }
async function saveSettings() { await saveData('settings', settings); }
async function saveBackups()  { await saveData('backups', backups); }
```

### Page load — replace localStorage reads

Replace the current synchronous localStorage loads with an async `initData()` function called on startup:

```js
async function initData() {
  // Try loading from KV
  let kvProjects  = await loadData('projects');
  let kvUsers     = await loadData('users');
  let kvCustomers = await loadData('customers');
  let kvSettings  = await loadData('settings');
  let kvBackups   = await loadData('backups');

  // Migration: if KV empty, check localStorage and migrate
  if (!kvProjects) {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      kvProjects = JSON.parse(local);
      await saveData('projects', kvProjects);
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  if (!kvUsers) {
    const local = localStorage.getItem(USERS_KEY);
    if (local) {
      kvUsers = JSON.parse(local);
      await saveData('users', kvUsers);
      localStorage.removeItem(USERS_KEY);
    }
  }
  if (!kvCustomers) {
    const local = localStorage.getItem(CUSTOMERS_KEY);
    if (local) {
      kvCustomers = JSON.parse(local);
      await saveData('customers', kvCustomers);
      localStorage.removeItem(CUSTOMERS_KEY);
    }
  }
  if (!kvSettings) {
    const local = localStorage.getItem(SETTINGS_KEY);
    if (local) {
      kvSettings = JSON.parse(local);
      await saveData('settings', kvSettings);
      localStorage.removeItem(SETTINGS_KEY);
    }
  }
  if (!kvBackups) {
    const local = localStorage.getItem(BACKUPS_KEY);
    if (local) {
      kvBackups = JSON.parse(local);
      await saveData('backups', kvBackups);
      localStorage.removeItem(BACKUPS_KEY);
    }
  }

  // Apply loaded data
  projects  = kvProjects  || defaultProjects;
  users     = kvUsers     || [];
  customers = kvCustomers || [];
  settings  = kvSettings  || {};
  backups   = kvBackups   || [];

  migrateProjects();
  renderAll();
  syncProjectProgressFromJira();
  syncStatusFromJira();
  startAutoProjectPoll();
  startKvRefresh();
}
```

The existing synchronous declarations at the top of app.js change from:
```js
let projects  = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;
let users     = JSON.parse(localStorage.getItem(USERS_KEY)   || '[]');
let customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
let settings  = JSON.parse(localStorage.getItem(SETTINGS_KEY)  || '{}');
let backups   = JSON.parse(localStorage.getItem(BACKUPS_KEY)   || '[]');
```
to:
```js
let projects  = defaultProjects;
let users     = [];
let customers = [];
let settings  = {};
let backups   = [];
```

`initData()` is called once at the bottom of app.js instead of `syncProjectProgressFromJira()` etc.

---

## Section 3 — Auto-refresh every 60 seconds

```js
function startKvRefresh() {
  setInterval(async () => {
    const fresh = await loadData('projects');
    if (fresh) {
      projects = fresh;
      migrateProjects();
      renderAll();
    }
  }, 60000);
}
```

Only projects are refreshed automatically (most likely to change). Users/customers/settings refreshed on next page load.

---

## Section 4 — Conflict handling

Last-write-wins. No locking. If two users save simultaneously, the last PUT wins. Acceptable for current team size and usage patterns.

---

## Data flow summary

```
Page load:
  initData()
    → GET /data/projects, /data/users, /data/customers, /data/settings, /data/backups
    → migrate from localStorage if KV empty
    → renderAll()

User saves a project:
  saveProjects() → PUT /data/projects

Auto-refresh (every 60s):
  GET /data/projects → renderAll() if changed
```
