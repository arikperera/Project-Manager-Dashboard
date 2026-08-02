const PROXY_BASE = 'https://pm-proxy.demo.qa.kaltura.ai';
const KV_SECRET = 'HPZTjoBph4Cz9AMGwiSsYcJf086bdgRX';
const APP_VERSION = '1.6.0';
const CHANGELOG = [
  {
    version: '1.6.0',
    date: '2026-07-02',
    features: [
      'Tasks — new "Add new" button lets users choose between a full project or a task linked to an existing project',
      'Tasks — task form: customer autocomplete, project filtered by customer, Jira auto-filled, region auto-filled read-only, task owner with add-new-user suggestion',
      'Tasks — appear in the dashboard grouped by task owner, with NRR and Project Budget showing "-"',
      'Tasks — edit modal: customer/project read-only, all other fields editable; task owner list shows all users regardless of role',
      'Tasks — Complete/Delete works the same as projects including Backup & Delete',
      'Tasks — no Jira writes; data stored in KV only',
      'Tasks — included in HTML report under owner\'s group; not counted in Total Projects',
      'IE role — new user role for Integration Engineers, available in add/edit user forms',
      'Risk Reason — new option: "Project actual work does not match estimation"',
      'Region sync — changing Region in dashboard now writes back to Jira',
      'Data safety — localStorage written before KV on every save; KV empty array no longer overwrites local data',
    ]
  },
  {
    version: '1.5.0',
    date: '2026-06-28',
    features: [
      'Region field — projects now have a Region (APAC, EMEA, North America, LatAm, Internal, ROW) synced from Jira and editable in both Add and Edit modals',
      'Region filter — dashboard filter row now includes a Region dropdown; filters live like other filters and persists across edits',
      'Report: region selector in report header scopes all stat boxes (Total Projects, MRR/NRR, Project Health, Over Budget, Newly Added, Added MRR/NRR) and all tables',
      'Report: All Projects PM filter now hides PM group headers when all their projects are filtered out',
      'Report: Newly Added and Added MRR/NRR stat boxes now show the backup date they compare against ("since dd/mm/yy")',
      'Report: Project Budget column now shows actual vs planned hours on the same line as the percentage (e.g. 690% · 0 / 10h)',
      'Dashboard: PM filter no longer resets when saving an edit',
    ]
  },
  {
    version: '1.4.0',
    date: '2026-06-25',
    features: [
      'Dashboard: "On track" replaced with "Project health" showing Green/Yellow/Red counts',
      'Dashboard: "Project At risk" renamed to "Over Budget Projects" (counts projects ≥100% budget)',
      'Report: 6 stat boxes — Total Projects, Total MRR/NRR, Project Health, Over Budget, Newly Added, Added MRR/NRR',
      'Report: new "Project Health" section listing Yellow/Red projects with PM status',
      'Report: "Over Budget" section shows Project Budget widget and Risk Reason',
      'Report: PM column added to All Projects table, aligned with Newly Added Projects table',
      'Report: links styled in correct color, Manager Notes displayed on separate lines',
    ]
  },
  {
    version: '1.3.1',
    date: '2026-06-25',
    features: [
      'Project Health imported from Jira — Risk Rate (Green/Yellow/Red) now imported on project import',
      'Project At risk (budget) — correctly counts projects at 100%+ budget consumption',
      'PM name fix — full display name imported from Jira instead of short name',
      'Due-month email — PM column added as first column, sorted by PM name',
      'No blank flash on reload — dashboard renders instantly from local cache while KV loads',
      'Data safety — guard prevents default sample data from overwriting real KV data',
    ]
  },
  {
    version: '1.3.0',
    date: '2026-06-24',
    features: [
      'Shared storage — all data stored in Cloudflare KV and shared across all users in real-time',
      'Import: Risk Reason (Budget) now imported from Jira on project import',
      'Edit modal: CSM and Sales names are now editable fields',
      'No flash on reload — dashboard shows data instantly while KV syncs in background',
      'Offline mode — falls back to local data with banner when worker is unreachable',
    ]
  },
  {
    version: '1.2.1',
    date: '2026-06-24',
    features: [
      'Import fix — Customer name, NRR(h), End date, NRR(USD) and MRR(USD) now correctly populated from Jira on import',
      'Currency format — values now show with $ prefix (e.g. $14.8K instead of 14.8K)',
      'Customer list — Edit/Delete buttons stay on same line for long customer names',
    ]
  },
  {
    version: '1.2.0',
    date: '2026-06-23',
    features: [
      'Shared proxy — all Jira API calls route through a shared cloud worker; no local proxy needed',
      'Auto-create users and customers on import — PM and customer are added automatically if they don\'t exist',
      'No import limit — project import returns up to 200 projects per PM',
      'Project Budget tooltip — projects with zero actual hours now show "No hours reported yet"',
    ]
  },
  {
    version: '1.1.0',
    date: '2026-06-23',
    features: [
      'Import from Jira — bulk import initiatives by PM name with live autocomplete; auto-fills customer, NRR hours, MRR/NRR, due date from Jira',
      'Project Status ↔ Jira sync — bidirectional sync with Jira Initiative Description on page load and save; supports bullet lists, numbered lists, nested indentation, and task lists (☐/☑)',
      'Reassign PM — edit modal now has a PM selector to move a project between PMs',
      'Project Health → Jira Risk Rate — changing health updates the Jira Risk Rate field automatically',
      'Larger status cell — Project Status column shows ~10 lines before scrolling',
      'Editor improvements — content no longer lost when clicking toolbar buttons',
    ]
  },
  {
    version: '1.0.0',
    date: '2026-06-21',
    features: [
      'Initial release',
      'PM Status field for Yellow/Red health projects',
      'Project Health hover tooltip in all views',
      'Color picker in project status editor',
      'Due date and Risk Rate sync to Jira',
      'Project Budget column with blink warning',
    ]
  }
];

const STORAGE_KEY = 'project-dashboard-projects-v1';

const USERS_KEY = 'project-dashboard-users-v1';
let users = JSON.parse(localStorage.getItem('project-dashboard-users-v1') || '[]');

async function saveUsers() {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch {}
  const ok = await kvPut(USERS_KEY, users);
  if (!ok) _wasOffline = true;
}

const SETTINGS_KEY = 'project-dashboard-settings-v1';
let settings = JSON.parse(localStorage.getItem('project-dashboard-settings-v1') || '{}');

async function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  await kvPut(SETTINGS_KEY, settings);
}

const CUSTOMERS_KEY = 'project-dashboard-customers-v1';
let customers = JSON.parse(localStorage.getItem('project-dashboard-customers-v1') || '[]');

async function saveCustomers() {
  try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {}
  const ok = await kvPut(CUSTOMERS_KEY, customers);
  if (!ok) _wasOffline = true;
}

function getCustomerNames() {
  return customers.map(c => c.name);
}

let cachedRiskReasonFieldId = null;
let cachedProgressPctFieldId = null;
let cachedEstHoursFieldId = null;
let cachedRemEffortFieldId = null;
let cachedActEffortFieldId = null;
let cachedRiskRateFieldId = null;
let cachedRiskRateOptions = null;
let cachedAccountNameFieldId = null;
let cachedAccountOwnerFieldId = null;
let cachedOppUrlFieldId = null;
let cachedAccountUrlFieldId = null;
let cachedAccountCsmFieldId = null;
let cachedMrrFieldId = null;
let cachedNrrFieldId = null;
let cachedRegionFieldId = null;

const TASKS_KEY = 'project-dashboard-tasks-v1';
let tasks = JSON.parse(localStorage.getItem('project-dashboard-tasks-v1') || '[]');

const PENDING_DELETES_KEY = 'project-dashboard-pending-deletes-v1';

function getPendingDeletes() {
  return JSON.parse(localStorage.getItem(PENDING_DELETES_KEY) || '[]');
}

function addPendingDelete(id, storeKey) {
  const pending = getPendingDeletes();
  if (!pending.find(d => d.id === id && d.storeKey === storeKey)) {
    pending.push({ id, storeKey });
    try { localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending)); } catch {}
  }
}

function removePendingDelete(id, storeKey) {
  const pending = getPendingDeletes().filter(d => !(d.id === id && d.storeKey === storeKey));
  try { localStorage.setItem(PENDING_DELETES_KEY, JSON.stringify(pending)); } catch {}
}

function getItemDeleteKey(item) {
  // Use jira URL for projects (no id field), id for tasks/customers
  return item.jira || item.id || '';
}

function applyPendingDeletes(arr, storeKey) {
  const pending = getPendingDeletes().filter(d => d.storeKey === storeKey);
  if (!pending.length) return arr;
  return arr.filter(item => !pending.find(d => d.id === getItemDeleteKey(item)));
}

async function saveTasks() {
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
  const ok = await kvPut(TASKS_KEY, tasks);
  if (ok) {
    // Clear any pending deletes for tasks since KV is now up to date
    getPendingDeletes().filter(d => d.storeKey === TASKS_KEY)
      .forEach(d => removePendingDelete(d.id, TASKS_KEY));
  } else {
    _wasOffline = true;
  }
}

const BACKUPS_KEY = 'project-dashboard-backups-v1';
let backups = JSON.parse(localStorage.getItem('project-dashboard-backups-v1') || '[]');

async function kvGet(key) {
  try {
    const res = await fetch(`${PROXY_BASE}/kv/${encodeURIComponent(key)}`, {
      headers: { 'X-KV-Secret': KV_SECRET },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function kvPut(key, value) {
  try {
    const res = await fetch(`${PROXY_BASE}/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-KV-Secret': KV_SECRET },
      body: JSON.stringify(value),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function initData() {
  // Check if worker is reachable before touching KV
  let workerHealthy = false;
  try {
    const healthRes = await fetch(`${PROXY_BASE}/health`, {
      headers: { 'X-KV-Secret': KV_SECRET },
    });
    workerHealthy = healthRes.ok;
  } catch {
    workerHealthy = false;
  }

  if (!workerHealthy) {
    showOfflineBanner();
    projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;
    users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');
    backups = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');
    tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    return;
  }

  const [kvProjects, kvUsers, kvSettings, kvCustomers, kvBackups, kvTasks] = await Promise.all([
    kvGet(STORAGE_KEY),
    kvGet(USERS_KEY),
    kvGet(SETTINGS_KEY),
    kvGet(CUSTOMERS_KEY),
    kvGet(BACKUPS_KEY),
    kvGet(TASKS_KEY),
  ]);

  async function hydrateKey(kvValue, lsKey, fallback) {
    if (kvValue !== null) {
      let value = Array.isArray(kvValue) ? kvValue : kvValue;

      if (Array.isArray(kvValue)) {
        // Step 1: apply offline deletes on top of KV
        const beforeDeletes = value.length;
        value = applyPendingDeletes(value, lsKey);
        const hadDeletes = value.length < beforeDeletes;

        // Step 2: merge offline adds — items in localStorage not present in KV (by id)
        const lsValue = JSON.parse(localStorage.getItem(lsKey) || 'null');
        if (Array.isArray(lsValue) && lsValue.length > 0) {
          const kvIds = new Set(value.map(item => item.id).filter(Boolean));
          const pendingDeleteIds = new Set(getPendingDeletes().filter(d => d.storeKey === lsKey).map(d => d.id));
          const offlineAdds = lsValue.filter(item => item.id && !kvIds.has(item.id) && !pendingDeleteIds.has(item.id));
          if (offlineAdds.length > 0) {
            value = [...value, ...offlineAdds];
          }
        }

        const needsSync = hadDeletes || value.length > kvValue.length;
        if (needsSync) {
          kvPut(lsKey, value).then(() => {
            getPendingDeletes().filter(d => d.storeKey === lsKey)
              .forEach(d => removePendingDelete(d.id, lsKey));
          }).catch(() => {});
        } else {
          // No offline changes — clear any stale pending deletes for this key
          getPendingDeletes().filter(d => d.storeKey === lsKey)
            .forEach(d => removePendingDelete(d.id, lsKey));
        }
      }

      try { localStorage.setItem(lsKey, JSON.stringify(value)); } catch {}
      return value;
    }
    // KV unreachable — fall back to localStorage
    const lsValue = JSON.parse(localStorage.getItem(lsKey) || 'null');
    return lsValue !== null ? lsValue : fallback;
  }

  [projects, users, settings, customers, backups, tasks] = await Promise.all([
    hydrateKey(kvProjects, STORAGE_KEY, defaultProjects),
    hydrateKey(kvUsers, USERS_KEY, []),
    hydrateKey(kvSettings, SETTINGS_KEY, {}),
    hydrateKey(kvCustomers, CUSTOMERS_KEY, []),
    hydrateKey(kvBackups, BACKUPS_KEY, []),
    hydrateKey(kvTasks, TASKS_KEY, []),
  ]);
  // Always keep backups sorted newest first
  backups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Cache KV data to localStorage so next load renders instantly
  try { localStorage.setItem(STORAGE_KEY,   JSON.stringify(projects));  } catch {}
  try { localStorage.setItem(USERS_KEY,     JSON.stringify(users));     } catch {}
  try { localStorage.setItem(SETTINGS_KEY,  JSON.stringify(settings));  } catch {}
  try { localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers)); } catch {}
  try { localStorage.setItem(BACKUPS_KEY,   JSON.stringify(backups));   } catch {}
  try { localStorage.setItem(TASKS_KEY,    JSON.stringify(tasks));     } catch {}
}

async function saveBackups() {
  try { localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups)); } catch {}
  const ok = await kvPut(BACKUPS_KEY, backups);
  if (!ok) _wasOffline = true;
}

function formatBackupLabel(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `Backup ${dd}/${mm}/${yy} ${hh}:${min}`;
}

function createBackup(btn) {
  const ts = Date.now();
  const backup = {
    id: `bk_${ts}`,
    label: formatBackupLabel(ts),
    timestamp: ts,
    projects: JSON.parse(JSON.stringify(projects)),
    users: JSON.parse(JSON.stringify(users)),
  };
  backups.unshift(backup);
  backups.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  saveBackups();

  const dd = String(new Date(ts).getDate()).padStart(2, '0');
  const mm = String(new Date(ts).getMonth() + 1).padStart(2, '0');
  const yy = String(new Date(ts).getFullYear()).slice(2);
  const hh = String(new Date(ts).getHours()).padStart(2, '0');
  const min = String(new Date(ts).getMinutes()).padStart(2, '0');
  const filename = `dashboard-backup-${dd}-${mm}-${yy}-${hh}-${min}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);

  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.textContent = original; }, 2000);
  }
}

function getUserAvatarHtml(displayName, size = 22) {
  const user = users.find(u => getUserDisplayName(u) === displayName);
  if (user?.avatarUrl) {
    return `<img src="${escapeHtml(user.avatarUrl)}" alt="${escapeHtml(displayName)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.15);" onerror="this.style.display='none'">`;
  }
  // Initials fallback
  const initials = displayName.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:#334155;color:#94a3b8;font-size:${Math.round(size*0.45)}px;font-weight:600;margin-right:6px;vertical-align:middle;flex-shrink:0;">${escapeHtml(initials)}</span>`;
}

function getUserDisplayName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function getUserRoles(user) {
  if (Array.isArray(user.roles)) return user.roles;
  if (user.role) return [user.role];
  return [];
}

function getUsersByRole(role) {
  return users.filter(u => getUserRoles(u).includes(role)).map(getUserDisplayName);
}

const STATUS_PLACEHOLDER = '<span style="font-style:italic;opacity:0.5;">No Status Entered</span>';
function isEmptyStatus(html) {
  if (!html) return true;
  const t = html.replace(/<[^>]+>/g, '').trim();
  return !t || /no status yet|no status entered/i.test(t);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function propagateUserRename(oldName, newName) {
  if (oldName === newName) return;
  projects.forEach(project => {
    if (project.manager === oldName) project.manager = newName;
    if (project.csm === oldName) project.csm = newName;
    if (project.sales === oldName) project.sales = newName;
    if (project.comments) {
      project.comments = project.comments.split(oldName).join(newName);
    }
  });
}

const defaultProjects = [
  { customer: 'Client Customer', name: 'Client Portal', manager: 'Ava', jira: 'https://jira.example.com/CP', nrr: 120, startDate: '2026-05-05', dueDate: '2026-06-30', status: 'On Track', statusText: 'Backend APIs are stable and user testing is in progress.', health: 'Green', progress: 78, comments: 'NRR: 120h, MRR: 8k, CSM: John, Sales: Sara' },
  { customer: 'Mobile Customer', name: 'Mobile Launch', manager: 'Noah', jira: 'https://jira.example.com/ML', nrr: 85, startDate: '2026-04-20', dueDate: '2026-06-18', status: 'At Risk', statusText: 'Vendor dependency delayed design approvals.', health: 'Yellow', progress: 54, comments: 'NRR: 85h, MRR: 6k, CSM: Maya, Sales: Leo' },
  { customer: 'Data Customer', name: 'Data Sync Upgrade', manager: 'Mia', jira: 'https://jira.example.com/DS', nrr: 140, startDate: '2026-05-12', dueDate: '2026-07-05', status: 'Delayed', statusText: 'Data mapping needs a second review cycle.', health: 'Red', progress: 38, comments: 'NRR: 140h, MRR: 10k, CSM: Emma, Sales: Omar' },
  { customer: 'Reporting Customer', name: 'Reporting Hub', manager: 'Liam', jira: 'https://jira.example.com/RH', nrr: 60, startDate: '2026-03-10', dueDate: '2026-06-10', status: 'Completed', statusText: 'All stakeholders have approved the final dashboard.', health: 'Green', progress: 100, comments: 'NRR: 60h, MRR: 4k, CSM: Alex, Sales: Nina' },
];

async function migrateProjects() {
  let changed = false;
  for (const p of projects) {
    if (p.pmStatus === undefined) { p.pmStatus = ''; changed = true; }
    if (p.atLink === undefined) { p.atLink = ''; changed = true; }
    if (p.estimatedHours === undefined) { p.estimatedHours = null; changed = true; }
    if (p.remainingHours === undefined) { p.remainingHours = null; changed = true; }
    if (p.actualHours === undefined) { p.actualHours = null; changed = true; }
    if (p.statusUpdatedAt === undefined) { p.statusUpdatedAt = ''; changed = true; }
    if (p.region === undefined) { p.region = ''; changed = true; }
    if (p.accountUrl === undefined) { p.accountUrl = ''; changed = true; }
    if (p.nrrUsd === undefined || p.nrrUsd === null) {
      // Try to backfill from comments: "NRR: $14.8K, MRR: $0K, ..."
      const nrrMatch = (p.comments || '').match(/NRR:\s*\$?([\d.]+)K?/i);
      p.nrrUsd = nrrMatch ? parseFloat(nrrMatch[1]) * (nrrMatch[0].includes('K') ? 1000 : 1) : null;
      changed = true;
    }
    if (p.mrrUsd === undefined || p.mrrUsd === null) {
      const mrrMatch = (p.comments || '').match(/MRR:\s*\$?([\d.]+)K?/i);
      p.mrrUsd = mrrMatch ? parseFloat(mrrMatch[1]) * (mrrMatch[0].includes('K') ? 1000 : 1) : null;
      changed = true;
    }
  }
  // Never save if projects is still the default sample data — would overwrite real KV data
  if (changed && projects !== defaultProjects) await saveProjects();
}

// Pre-populate from localStorage for instant render while KV loads in background
let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;

const statusClasses = {
  'On Track': 'status-ontrack',
  'At Risk': 'status-risk',
  'Delayed': 'status-delayed',
  'Completed': 'status-completed',
};

const portfolioGroups = document.getElementById('portfolioGroups');
const projectSelect = document.getElementById('projectSelect');
const editProjectModal = document.getElementById('editProjectModal');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');
const editProjectForm = document.getElementById('editProjectForm');
const editCustomerName = document.getElementById('editCustomerName');
const editProjectName = document.getElementById('editProjectName');
const editProjectManager = document.getElementById('editProjectManager');
const editStatusEditor = document.getElementById('editStatusEditor');
const editHealth = document.getElementById('editHealth');
const editPmStatus = document.getElementById('editPmStatus');
const pmStatusLabel = document.getElementById('pmStatusLabel');
const editRiskReason = document.getElementById('editRiskReason');
const editRegion = document.getElementById('editRegion');
const riskReasonLabel = document.getElementById('riskReasonLabel');
const riskList = document.getElementById('riskList');
const exportBtn = document.getElementById('exportBtn');
const manageUsersBtn = document.getElementById('manageUsersBtn');
const usersModal = document.getElementById('usersModal');
const closeUsersModalBtn = document.getElementById('closeUsersModalBtn');
const usersModalBody = document.getElementById('usersModalBody');
const addUserBtn = document.getElementById('addUserBtn');
const addUserForm = document.getElementById('addUserForm');
const cancelAddUserBtn = document.getElementById('cancelAddUserBtn');
const saveAddUserBtn = document.getElementById('saveAddUserBtn');
const addCustomerModal = document.getElementById('addCustomerModal');
const closeAddCustomerModalBtn = document.getElementById('closeAddCustomerModalBtn');
const cancelAddCustomerBtn = document.getElementById('cancelAddCustomerBtn');
const saveAddCustomerBtn = document.getElementById('saveAddCustomerBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const deleteProjectModal = document.getElementById('deleteProjectModal');
const deleteProjectModalTitle = document.getElementById('deleteProjectModalTitle');
const cancelDeleteProjectBtn = document.getElementById('cancelDeleteProjectBtn');
const deleteProjectBtn = document.getElementById('deleteProjectBtn');
const backupAndDeleteProjectBtn = document.getElementById('backupAndDeleteProjectBtn');
const manageCustomersBtn = document.getElementById('manageCustomersBtn');
const customersModal = document.getElementById('customersModal');
const closeCustomersModalBtn = document.getElementById('closeCustomersModalBtn');
const customersModalBody = document.getElementById('customersModalBody');
const addCustomerListBtn = document.getElementById('addCustomerListBtn');
const addCustomerListForm = document.getElementById('addCustomerListForm');
const cancelCustomerListBtn = document.getElementById('cancelCustomerListBtn');
const saveCustomerListBtn = document.getElementById('saveCustomerListBtn');
const createBackupBtn = document.getElementById('createBackupBtn');
const backupsPanelBtn = document.getElementById('backupsPanelBtn');
const backupsModal = document.getElementById('backupsModal');
const closeBackupsModalBtn = document.getElementById('closeBackupsModalBtn');
const backupMain = document.getElementById('backupMain');
const backupSidebar = document.getElementById('backupSidebar');
const addProjectBtn = document.getElementById('addProjectBtn') || document.getElementById('addNewBtn');
const addNewBtn = document.getElementById('addNewBtn');
const addNewChoiceModal = document.getElementById('addNewChoiceModal');
const addNewChoiceProjectBtn = document.getElementById('addNewChoiceProjectBtn');
const addNewChoiceTaskBtn = document.getElementById('addNewChoiceTaskBtn');
const taskModal = document.getElementById('taskModal');
const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
const cancelTaskModalBtn = document.getElementById('cancelTaskModalBtn');
const taskModalForm = document.getElementById('taskModalForm');
const projectModal = document.getElementById('projectModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const closeSaveBtn = document.getElementById('closeSaveBtn');
const modalProjectForm = document.getElementById('modalProjectForm');
const searchInput = document.getElementById('searchInput');
const pmFilter = document.getElementById('pmFilter');
const pmList = null;
const csmList = null;
const salesList = null;
const healthFilter = document.getElementById('healthFilter');
const progressFilter = document.getElementById('progressFilter');
const duemonthFilter = document.getElementById('duemonthFilter');
const regionFilter = document.getElementById('regionFilter');
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

async function saveProjects() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
  let ok = await kvPut(STORAGE_KEY, projects);
  if (!ok) {
    // Retry once after a short delay
    await new Promise(r => setTimeout(r, 800));
    ok = await kvPut(STORAGE_KEY, projects);
  }
  if (ok) {
    getPendingDeletes().filter(d => d.storeKey === STORAGE_KEY)
      .forEach(d => removePendingDelete(d.id, STORAGE_KEY));
  } else {
    _wasOffline = true;
  }
}

let addUserReturnContext = null;

function setupAutocomplete(input, getOptions, role, addCallback, addLabel) {
  const list = input.closest('.autocomplete-wrap').querySelector('.autocomplete-list');
  let activeIndex = -1;

  function buildList(matches, typedTerm) {
    const items = matches.map(item => `<li>${escapeHtml(item)}</li>`);
    const exactMatch = matches.some(m => m.toLowerCase() === typedTerm.toLowerCase());
    if (typedTerm && !exactMatch) {
      if (role) {
        items.push(`<li class="autocomplete-add" data-add-name="${escapeHtml(typedTerm)}" data-add-role="${escapeHtml(role)}">➕ Add "${escapeHtml(typedTerm)}" as new ${escapeHtml(role)}</li>`);
      } else if (addCallback) {
        items.push(`<li class="autocomplete-add" data-add-name="${escapeHtml(typedTerm)}">➕ Add "${escapeHtml(typedTerm)}" as new ${escapeHtml(addLabel || 'customer')}</li>`);
      }
    }
    list.innerHTML = items.join('');
    activeIndex = -1;
    list.classList.toggle('hidden', items.length === 0);
  }

  function hideList() {
    list.classList.add('hidden');
    activeIndex = -1;
  }

  function setActive(index) {
    const items = list.querySelectorAll('li');
    items.forEach(li => li.classList.remove('active'));
    if (index >= 0 && index < items.length) {
      items[index].classList.add('active');
      items[index].scrollIntoView({ block: 'nearest' });
    }
    activeIndex = index;
  }

  input.addEventListener('focus', () => {
    const term = input.value.trim();
    const opts = getOptions();
    const matches = term ? opts.filter(o => o.toLowerCase().includes(term.toLowerCase())) : opts;
    buildList(matches, term);
  });

  input.addEventListener('input', () => {
    const term = input.value.trim();
    const opts = getOptions();
    const matches = term ? opts.filter(o => o.toLowerCase().includes(term.toLowerCase())) : opts;
    buildList(matches, term);
  });

  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('li');
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const active = items[activeIndex];
      if (active.classList.contains('autocomplete-add')) {
        if (active.dataset.addRole) {
          triggerAddUserFromAutocomplete(active.dataset.addName, active.dataset.addRole, input);
        } else if (addCallback) {
          addCallback(active.dataset.addName, input);
        }
      } else {
        input.value = active.textContent;
        input.dispatchEvent(new Event('change'));
      }
      hideList();
    }
    else if (e.key === 'Escape') { hideList(); }
  });

  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    if (li.classList.contains('autocomplete-add')) {
      if (li.dataset.addRole) {
        triggerAddUserFromAutocomplete(li.dataset.addName, li.dataset.addRole, input);
      } else if (addCallback) {
        addCallback(li.dataset.addName, input);
      }
    } else {
      input.value = li.textContent;
      input.dispatchEvent(new Event('change'));
    }
    hideList();
  });

  document.addEventListener('click', (e) => {
    if (!input.closest('.autocomplete-wrap').contains(e.target)) hideList();
  });
}

let addCustomerReturnContext = null;

function triggerAddCustomerFromAutocomplete(name, returnInput, sourceModal) {
  document.getElementById('newCustomerName').value = name;
  document.getElementById('newCustomerSfLink').value = '';
  const src = sourceModal || projectModal;
  addCustomerReturnContext = { inputEl: returnInput, sourceModal: src };
  src.classList.add('hidden');
  src.setAttribute('aria-hidden', 'true');
  addCustomerModal.classList.remove('hidden');
  addCustomerModal.setAttribute('aria-hidden', 'false');
}

function closeAddCustomerModal() {
  addCustomerModal.classList.add('hidden');
  addCustomerModal.setAttribute('aria-hidden', 'true');
  document.getElementById('newCustomerName').value = '';
  document.getElementById('newCustomerSfLink').value = '';
}

function triggerAddUserFromAutocomplete(name, role, returnInput) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';

  document.getElementById('newUserFirstName').value = firstName;
  document.getElementById('newUserLastName').value = lastName;
  if (role) document.getElementById(`newUserRole${role}`).checked = true;
  addUserForm.style.display = 'grid';
  addUserBtn.style.display = 'none';

  addUserReturnContext = { inputEl: returnInput, fullName: name };

  projectModal.classList.add('hidden');
  projectModal.setAttribute('aria-hidden', 'true');
  usersModal.classList.remove('hidden');
  usersModal.setAttribute('aria-hidden', 'false');
}

function initAutocompletes() {
  setupAutocomplete(document.getElementById('modalProjectPm'), () => getUsersByRole('PM'), 'PM');
  setupAutocomplete(document.getElementById('modalProjectCsm'), () => getUsersByRole('CSM'), 'CSM');
  setupAutocomplete(document.getElementById('modalProjectSales'), () => getUsersByRole('Sales'), 'Sales');
  setupAutocomplete(document.getElementById('modalProjectCustomer'), () => getCustomerNames(), null, triggerAddCustomerFromAutocomplete);
  setupAutocomplete(document.getElementById('editCustomerName'), () => getCustomerNames(), null,
    (name, input) => triggerAddCustomerFromAutocomplete(name, input, editProjectModal));
}

function initTaskFormAutocompletes() {
  const custInput = document.getElementById('taskCustomer');
  const projSelect = document.getElementById('taskProject');
  const jiraInput = document.getElementById('taskJira');

  function updateProjectList() {
    const custName = custInput.value.trim();
    const activeStatuses = ['On Track', 'At Risk', 'Delayed', 'Open', 'In Progress'];
    const matchingProjects = projects
      .filter(p => p.customer === custName && activeStatuses.includes(p.status))
      .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    projSelect.innerHTML = matchingProjects.length
      ? '<option value="">— select project —</option>' + matchingProjects.map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="">— no active projects for this customer —</option>';
    jiraInput.value = '';
    document.getElementById('taskRegion').value = '';
  }

  setupAutocomplete(custInput, () => [...getCustomerNames()].sort((a, b) => a.localeCompare(b)), null, null);

  custInput.addEventListener('input', updateProjectList);
  custInput.addEventListener('change', updateProjectList);

  projSelect.addEventListener('change', () => {
    const projName = projSelect.value;
    const proj = projects.find(p => p.name === projName && p.customer === custInput.value.trim());
    jiraInput.value = proj ? (proj.jira || '') : '';
    document.getElementById('taskRegion').value = proj ? (proj.region || '') : '';
  });

  setupAutocomplete(document.getElementById('taskOwner'), () => users.map(u => getUserDisplayName(u)).sort(), null,
    (name, input) => {
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      document.getElementById('newUserFirstName').value = firstName;
      document.getElementById('newUserLastName').value = lastName;
      addUserForm.style.display = 'grid';
      addUserBtn.style.display = 'none';
      addUserReturnContext = { inputEl: input, fullName: name, sourceModal: taskModal };
      taskModal.classList.add('hidden');
      taskModal.setAttribute('aria-hidden', 'true');
      usersModal.classList.remove('hidden');
      usersModal.setAttribute('aria-hidden', 'false');
    },
    'user'
  );
}

function getJiraLabel(jira) {
  if (!jira) return '-';

  const browseMatch = jira.match(/\/browse\/([A-Za-z0-9-]+)/i);
  if (browseMatch) return browseMatch[1];

  const pathParts = jira.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];

  return lastPart && lastPart !== 'browse' ? lastPart : jira;
}

function getJiraIssueKey(jira) {
  if (!jira) return '';

  const browseMatch = jira.match(/\/browse\/([A-Za-z0-9-]+)/i);
  if (browseMatch) return browseMatch[1];

  const pathMatch = jira.match(/\/([A-Z]+-[0-9]+)(?:\/|$)/);
  return pathMatch ? pathMatch[1] : '';
}

function validSfUrl(url) {
  if (!url || typeof url !== 'string') return '';
  // Reject URLs with N/A, null, undefined, or non-SF-looking IDs
  if (/\/N\/A\//i.test(url) || /\/null\//i.test(url) || /\/undefined\//i.test(url)) return '';
  // Must look like a real Salesforce URL
  if (!url.startsWith('http')) return '';
  return url;
}

function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '$0K';
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return String(val);
  const k = num / 1000;
  const rounded = Math.round(k * 10) / 10;
  return `$${rounded}K`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y.slice(2)}`;
}

function formatDateDMY(dateStr) {
  return formatDate(dateStr);
}

function setupDateInput(input) {
  input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length > 6) val = val.slice(0, 6);
    if (val.length >= 5) val = val.slice(0,2) + '/' + val.slice(2,4) + '/' + val.slice(4);
    else if (val.length >= 3) val = val.slice(0,2) + '/' + val.slice(2);
    e.target.value = val;
  });
}

function parseDateInput(val) {
  if (!val) return '';
  const parts = val.trim().split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const fullYear = y.length === 2 ? `20${y}` : y;
    return `${fullYear}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return val;
}

function normalizeProgress(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Math.round(numericValue));
}

function getProgressTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-neutral';
  if (numericValue < 50) return 'progress-green';
  if (numericValue <= 75) return 'progress-yellow';
  if (numericValue <= 90) return 'progress-orange';
  return 'progress-red';
}

function getProgressFillTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-fill-neutral';
  if (numericValue < 50) return 'progress-fill-green';
  if (numericValue <= 75) return 'progress-fill-yellow';
  if (numericValue <= 90) return 'progress-fill-orange';
  return 'progress-fill-red';
}

function buildHoursLabel(actualHours, estimatedHours, nrr) {
  const actual = Math.round(actualHours ?? 0);
  const est = (estimatedHours != null && estimatedHours !== '') ? Number(estimatedHours) : null;
  const planned = est != null ? Math.round(est) : ((nrr != null && nrr !== '') ? Math.round(Number(nrr)) : null);
  if (planned != null) return `${actual} / ${planned}h`;
  return `${actual}h actual`;
}

function applyFieldNames(names) {
  for (const [id, name] of Object.entries(names)) {
    if (name === 'Risk Reason') cachedRiskReasonFieldId = id;
    if (name === 'VM Forecast Commit Date') cachedVMForecastFieldId = id;
    if (name === 'Project Progress Percentage') cachedProgressPctFieldId = id;
    if (name === 'Estimated PS Hours') cachedEstHoursFieldId = id;
    if (name === 'Remaining Effort') cachedRemEffortFieldId = id;
    if (name === 'Actual Effort(H)') cachedActEffortFieldId = id;
    if (name === 'Risk Rate') cachedRiskRateFieldId = id;
    if (name === 'Account Name') cachedAccountNameFieldId = id;
    if (name === 'Account Owner') cachedAccountOwnerFieldId = id;
    if (name === 'Opportunity URL') cachedOppUrlFieldId = id;
    if (name === 'Account URL') cachedAccountUrlFieldId = id;
    if (name === 'Account Customer Success Manager') cachedAccountCsmFieldId = id;
    if (name === 'MRR (USD)') cachedMrrFieldId = id;
    if (name === 'NRR(USD)') cachedNrrFieldId = id;
    if (name === 'Region') cachedRegionFieldId = id;
  }
}

async function resolveJiraFieldIds() {
  const useProxy = true;
  const opts = useProxy
    ? { headers: { Accept: 'application/json' } }
    : { credentials: 'include', headers: { Accept: 'application/json' } };

  // First try /jira/field (lightweight)
  try {
    const url = useProxy
      ? 'https://pm-proxy.demo.qa.kaltura.ai/jira/field'
      : 'https://kaltura.atlassian.net/rest/api/3/field';
    const res = await fetch(url, opts);
    if (res.ok) {
      const fields = await res.json();
      const namesMap = {};
      for (const f of fields) namesMap[f.id] = f.name;
      applyFieldNames(namesMap);
    }
  } catch {}

  // If critical fields are still missing, fetch from a real issue's names map
  if (!cachedAccountNameFieldId || !cachedVMForecastFieldId || !cachedEstHoursFieldId || !cachedRiskRateFieldId) {
    const firstKey = projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean)[0];
    if (firstKey) {
      try {
        const url = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${firstKey}?fields=*all&expand=names`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${firstKey}?fields=*all&expand=names`;
        const res = await fetch(url, opts);
        if (res.ok) {
          const data = await res.json();
          if (data.names) applyFieldNames(data.names);
        }
      } catch {}
    }
  }

  if (cachedRiskRateFieldId && !cachedRiskRateOptions) {
    await resolveRiskRateOptions(cachedRiskRateFieldId);
  }
}

async function resolveRiskRateOptions(fieldId) {
  const issueKey = projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean)[0];
  if (!issueKey) return;
  const useProxy = true;
  const url = useProxy
    ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${issueKey}/editmeta`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}/editmeta`;
  const opts = useProxy
    ? { headers: { Accept: 'application/json' } }
    : { credentials: 'include', headers: { Accept: 'application/json' } };
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return;
    const data = await res.json();
    const field = data.fields?.[fieldId];
    if (!field?.allowedValues) return;
    cachedRiskRateOptions = {};
    for (const opt of field.allowedValues) {
      cachedRiskRateOptions[opt.value] = opt.id;
    }
  } catch {}
}

async function syncProjectProgressFromJira() {
  const issueKeys = projects
    .map((project) => getJiraIssueKey(project.jira))
    .filter(Boolean);

  if (!issueKeys.length) return;

  const useProxy = true;

  await resolveJiraFieldIds();

  // Build fields param from cached IDs — only request what we need
  const fieldIds = ['progress', 'assignee', cachedProgressPctFieldId, cachedEstHoursFieldId, cachedRemEffortFieldId, cachedActEffortFieldId, cachedRegionFieldId, cachedRiskRateFieldId, cachedVMForecastFieldId, cachedAccountOwnerFieldId, cachedAccountCsmFieldId, cachedOppUrlFieldId, cachedAccountUrlFieldId].filter(Boolean);
  const fieldsParam = fieldIds.join(',');

  const uniqueKeys = [...new Set(issueKeys)];
  const BATCH_SIZE = 10;
  let changed = false;

  for (let i = 0; i < uniqueKeys.length; i += BATCH_SIZE) {
    const batch = uniqueKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (key) => {
      try {
        const url = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${key}?fields=${fieldsParam}`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${key}?fields=${fieldsParam}`;
        const fetchOpts = useProxy
          ? { headers: { Accept: 'application/json' } }
          : { credentials: 'include', headers: { Accept: 'application/json' } };
        const response = await fetch(url, fetchOpts);
        if (!response.ok) return;

        const data = await response.json();
        const f = data.fields || {};

        let percent = null;
        if (cachedProgressPctFieldId) {
          const raw = f[cachedProgressPctFieldId];
          const extracted = (raw !== null && typeof raw === 'object') ? (raw.value ?? raw.percent ?? null) : raw;
          percent = normalizeProgress(extracted);
        }
        if (percent === null) percent = normalizeProgress(f.progress?.percent ?? f.progress);

        const readHours = (fieldId) => {
          if (!fieldId) return null;
          const raw = f[fieldId];
          const v = (raw !== null && typeof raw === 'object') ? (raw.value ?? null) : raw;
          return (v !== null && Number.isFinite(Number(v))) ? Math.round(Number(v)) : null;
        };
        const estimatedHours = readHours(cachedEstHoursFieldId);
        const remainingHours = readHours(cachedRemEffortFieldId);
        const actualHours = readHours(cachedActEffortFieldId);
        const healthVal = cachedRiskRateFieldId ? (f[cachedRiskRateFieldId]?.value || null) : null;

        const rawOwner = cachedAccountOwnerFieldId ? f[cachedAccountOwnerFieldId] : null;
        const accountOwnerName = rawOwner ? (typeof rawOwner === 'string' ? rawOwner : (rawOwner.displayName || rawOwner.name || '')) : null;

        const rawCsm = cachedAccountCsmFieldId ? f[cachedAccountCsmFieldId] : null;
        const accountCsmName = rawCsm ? (typeof rawCsm === 'string' ? rawCsm : (rawCsm.displayName || rawCsm.name || '')) : null;

        const oppUrl = cachedOppUrlFieldId ? (validSfUrl(f[cachedOppUrlFieldId]) || null) : null;
        const accountUrl = cachedAccountUrlFieldId ? (validSfUrl(f[cachedAccountUrlFieldId]) || null) : null;

        projects.forEach((project) => {
          if (getJiraIssueKey(project.jira) !== key) return;
          if (percent !== null) { project.progress = percent; changed = true; }
          if (estimatedHours !== null) { project.estimatedHours = estimatedHours; changed = true; }
          if (remainingHours !== null) { project.remainingHours = remainingHours; changed = true; }
          if (actualHours !== null) { project.actualHours = actualHours; changed = true; }
          if (healthVal) { project.health = healthVal; changed = true; }
          if (cachedVMForecastFieldId && f[cachedVMForecastFieldId]) { project.dueDate = f[cachedVMForecastFieldId]; changed = true; }
          if (f.assignee?.displayName) { project.manager = f.assignee.displayName; changed = true; }
          if (cachedRegionFieldId) {
            const rawRegion = f[cachedRegionFieldId];
            const regionVal = typeof rawRegion === 'object' && rawRegion !== null ? (rawRegion.value || '') : (rawRegion || '');
            if (regionVal && !project.region) { project.region = regionVal; changed = true; }
          }
          if (accountOwnerName) {
            project.sales = accountOwnerName;
            project.comments = (project.comments || '').replace(/Sales:\s*[^,\n]*/i, `Sales: ${accountOwnerName}`);
            changed = true;
          }
          if (accountCsmName) {
            project.csm = accountCsmName;
            project.comments = (project.comments || '').replace(/CSM:\s*[^,\n]*/i, `CSM: ${accountCsmName}`);
            changed = true;
          }
          if (oppUrl) { project.oppLink = oppUrl; changed = true; }
          if (accountUrl) { project.accountUrl = accountUrl; changed = true; }
        });
      } catch (error) {
        console.warn(`Jira sync failed for ${key}`, error);
      }
    }));
    if (changed) { saveProjects(); renderAll(); changed = false; }
  }
}

async function syncStatusFromJira() {
  const useProxy = true;
  const BATCH_SIZE = 10;
  let changed = false;

  const projectsWithKeys = projects
    .map(p => ({ project: p, issueKey: getJiraIssueKey(p.jira) }))
    .filter(({ issueKey }) => !!issueKey);

  for (let i = 0; i < projectsWithKeys.length; i += BATCH_SIZE) {
    const batch = projectsWithKeys.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async ({ project, issueKey }) => {
      try {
        const url = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${issueKey}?fields=description,updated`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}?fields=description,updated`;
        const opts = useProxy
          ? { headers: { Accept: 'application/json' } }
          : { credentials: 'include', headers: { Accept: 'application/json' } };
        const res = await fetch(url, opts);
        if (!res.ok) return;
        const data = await res.json();
        const jiraUpdated = data.fields?.updated || '';
        const localUpdated = project.statusUpdatedAt || '';
        const jiraTime = jiraUpdated ? new Date(jiraUpdated).getTime() : 0;
        const localTime = localUpdated ? new Date(localUpdated).getTime() : 0;

        const recentlySaved = localTime && (Date.now() - localTime) < 10 * 60 * 1000;
        const localIsEmpty = !project.statusText || isEmptyStatus(project.statusText);
        if (localIsEmpty || (!recentlySaved && (!localTime || jiraTime > localTime))) {
          // Jira is newer and local wasn't recently edited — pull from Jira
          const adf = data.fields?.description;
          const html = adf ? adfToHtml(adf) : '';
          if (html !== project.statusText) {
            project.statusText = html;
            project.statusUpdatedAt = jiraUpdated;
            changed = true;
          }
        }
        // Note: push-on-load disabled — Jira's issue-level `updated` tracks all field changes,
        // not just description, so it cannot reliably determine if dashboard status is newer.
        // Dashboard→Jira sync happens only on explicit edit-modal save.
      } catch {}
    }));
  }

  if (changed) {
    saveProjects();
    renderAll();
  }
}

function adfToHtml(adf) {
  if (!adf || !adf.content) return '';
  return adf.content.map(node => adfBlockToHtml(node)).join('');
}

function adfBlockToHtml(node) {
  if (!node) return '';
  if (node.type === 'paragraph') {
    const inner = (node.content || []).map(adfInlineToHtml).join('');
    return `<div>${inner || '<br>'}</div>`;
  }
  if (node.type === 'bulletList') {
    const items = (node.content || []).map(item => {
      const children = (item.content || []).map(adfBlockToHtml).join('');
      return `<li>${children}</li>`;
    }).join('');
    return `<ul>${items}</ul>`;
  }
  if (node.type === 'orderedList') {
    const items = (node.content || []).map((item, idx) => {
      const children = (item.content || []).map(adfBlockToHtml).join('');
      return `<li>${children}</li>`;
    }).join('');
    return `<ol>${items}</ol>`;
  }
  if (node.type === 'heading') {
    const level = node.attrs?.level || 1;
    const inner = (node.content || []).map(adfInlineToHtml).join('');
    return `<h${level}>${inner}</h${level}>`;
  }
  if (node.type === 'taskList') {
    return (node.content || []).map(item => {
      const box = item.attrs?.state === 'DONE' ? '☑' : '☐';
      const text = (item.content || []).map(adfInlineToHtml).join('');
      return `<div>${box} ${text}</div>`;
    }).join('');
  }
  if (node.type === 'hardBreak') return '<br>';
  // fallback: render content if present
  return (node.content || []).map(adfBlockToHtml).join('');
}

function adfInlineToHtml(node) {
  if (!node) return '';
  if (node.type === 'hardBreak') return '<br>';
  if (node.type === 'inlineCard') {
    const url = node.attrs?.url || '';
    if (/^https?:/i.test(url)) return `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;
    return '';
  }
  if (node.type !== 'text') return '';
  let text = escapeHtml(node.text || '');
  if (!text) return '';
  const marks = node.marks || [];
  for (const mark of marks) {
    if (mark.type === 'strong') text = `<strong>${text}</strong>`;
    else if (mark.type === 'em') text = `<em>${text}</em>`;
    else if (mark.type === 'underline') text = `<u>${text}</u>`;
    else if (mark.type === 'textColor') {
      const color = mark.attrs?.color || '';
      if (/^#[0-9a-fA-F]{3,8}$|^rgb\(/.test(color)) text = `<span style="color:${escapeHtml(color)}">${text}</span>`;
    }
    else if (mark.type === 'link') {
      const href = mark.attrs?.href || '';
      if (/^https?:|^mailto:/i.test(href)) text = `<a href="${escapeHtml(href)}">${text}</a>`;
    }
  }
  return text;
}

function htmlToAdf(html) {
  if (!html || !html.trim()) return { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  const div = document.createElement('div');
  div.innerHTML = html;
  const content = htmlNodesToAdf(div.childNodes);
  return { version: 1, type: 'doc', content: content.length ? content : [{ type: 'paragraph', content: [] }] };
}

function htmlNodesToAdf(nodes) {
  const result = [];
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) result.push({ type: 'paragraph', content: [{ type: 'text', text }] });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'ul' || tag === 'ol') {
        const listType = tag === 'ul' ? 'bulletList' : 'orderedList';
        const items = [];
        for (const child of node.children) {
          const childTag = child.tagName.toLowerCase();
          if (childTag === 'ul' || childTag === 'ol') {
            // Bare nested list (browser indent quirk) — attach to last listItem
            const nestedType = childTag === 'ul' ? 'bulletList' : 'orderedList';
            const nestedItems = [...child.children].map(li => {
              const parsed = htmlNodesToAdf(li.childNodes);
              const content = parsed.length
                ? parsed.map(n => (n.type === 'paragraph' || n.type === 'bulletList' || n.type === 'orderedList') ? n : { type: 'paragraph', content: [n] })
                : [{ type: 'paragraph', content: [] }];
              return { type: 'listItem', content };
            }).filter(i => i.content.length > 0);
            if (nestedItems.length) {
              const nested = { type: nestedType, content: nestedItems };
              if (items.length > 0) {
                items[items.length - 1].content.push(nested);
              } else {
                items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [] }, nested] });
              }
            }
          } else if (childTag === 'li') {
            const parsed = htmlNodesToAdf(child.childNodes);
            const content = parsed.length
              ? parsed.map(n => (n.type === 'paragraph' || n.type === 'bulletList' || n.type === 'orderedList') ? n : { type: 'paragraph', content: [n] })
              : [{ type: 'paragraph', content: [] }];
            items.push({ type: 'listItem', content });
          }
        }
        if (items.length) result.push({ type: listType, content: items });
      } else if (tag === 'li') {
        const inner = htmlNodesToAdf(node.childNodes);
        result.push({ type: 'listItem', content: inner.length ? inner : [{ type: 'paragraph', content: [] }] });
      } else if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1]);
        const content = htmlInlineToAdf(node);
        result.push({ type: 'heading', attrs: { level }, content });
      } else if (tag === 'div' || tag === 'p') {
        // If div contains block-level children (ul/ol/div/p), recurse as blocks
        const hasBlockChildren = [...node.childNodes].some(c =>
          c.nodeType === Node.ELEMENT_NODE && /^(ul|ol|div|p|h[1-6]|br)$/.test(c.tagName.toLowerCase())
        );
        if (hasBlockChildren) {
          result.push(...htmlNodesToAdf(node.childNodes));
        } else {
          const content = htmlInlineToAdf(node);
          result.push({ type: 'paragraph', content });
        }
      } else if (tag === 'br') {
        result.push({ type: 'paragraph', content: [] });
      } else {
        // span, b, i, strong, em, etc. at block level — wrap in paragraph
        const content = htmlInlineToAdf(node);
        if (content.length) result.push({ type: 'paragraph', content });
      }
    }
  }
  return result;
}

function htmlInlineToAdf(el) {
  const result = [];
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) result.push({ type: 'text', text });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toLowerCase();
      if (tag === 'br') {
        result.push({ type: 'hardBreak' });
      } else {
        const inner = htmlInlineToAdf(node);
        if (tag === 'strong' || tag === 'b') {
          inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'strong' }]; } });
        } else if (tag === 'em' || tag === 'i') {
          inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'em' }]; } });
        } else if (tag === 'u') {
          inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'underline' }]; } });
        } else if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'link', attrs: { href } }]; } });
        } else if (tag === 'span') {
          const color = node.style?.color || '';
          if (color) {
            inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'textColor', attrs: { color } }]; } });
          }
        } else if (tag === 'font') {
          const color = node.getAttribute('color') || '';
          if (color) {
            inner.forEach(n => { if (n.type === 'text') { n.marks = [...(n.marks || []), { type: 'textColor', attrs: { color } }]; } });
          }
        }
        result.push(...inner);
      }
    }
  }
  return result.filter(n => n.type !== 'text' || n.text);
}

function getExistingJiraKeys() {
  return new Set(projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean));
}

async function ensureUserExists(displayName, jiraAccountId, role) {
  if (!displayName) return;
  const existing = users.find(u => getUserDisplayName(u) === displayName);
  if (existing) {
    // Add role if missing
    const roles = getUserRoles(existing);
    if (!roles.includes(role)) {
      existing.roles = [...roles, role];
      await saveUsers();
    }
    return;
  }
  const parts = displayName.trim().split(/\s+/);
  const firstName = parts[0] || displayName;
  const lastName = parts.slice(1).join(' ') || '';
  users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, roles: [role], jiraAccountId: jiraAccountId || null });
  await saveUsers();
}

function buildProjectFromEnrichment(issue, sfData) {
  const pmMapping = settings.pmMapping || {};
  const manager = pmMapping[issue.assigneeEmail] || issue.assigneeDisplayName || 'Unassigned';
  const startDate = issue.created ? issue.created.slice(0, 10) : '';
  const nrr = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.nrr ?? '') : (issue.nrrUsd ?? '');
  const mrr = sfData && !sfData.sfSkipped && !sfData.sfError ? (sfData.mrr ?? '') : (issue.mrrUsd ?? '');
  const csmName = sfData && !sfData.sfSkipped && !sfData.sfError
    ? (sfData.csmName ?? '')
    : (issue.accountCsmName || '');
  const salesName = sfData && !sfData.sfSkipped && !sfData.sfError
    ? (sfData.salesName ?? '')
    : (issue.accountOwnerName || '');
  const sfOk = sfData && !sfData.sfSkipped && !sfData.sfError;
  return {
    customer:    sfOk ? (sfData.customer || '') : (issue.accountName || ''),
    name:        sfOk ? (sfData.name || issue.summary) : issue.summary,
    manager,
    jira:        issue.jiraUrl,
    nrr:         sfOk ? (sfData.nrrHours ?? '') : (issue.estimatedHours ?? ''),
    nrrUsd:      nrr !== '' ? Number(nrr) || null : null,
    mrrUsd:      mrr !== '' ? Number(mrr) || null : null,
    comments:    `NRR: ${formatCurrency(nrr || '0')}, MRR: ${formatCurrency(mrr || '0')}, CSM: ${csmName || '-'}, Sales: ${salesName || '-'}`,
    startDate,
    dueDate:     issue.dueDate || '',
    health:      issue.healthFromJira || 'Green',
    status:      'On Track',
    progress:    0,
    statusText:  '',
    oppLink:     sfOk ? (sfData.oppUrl || '') : (issue.oppUrl || ''),
    accountUrl:  sfOk ? (sfData.accountUrl || '') : (issue.accountUrl || ''),
    atLink:      '',
    riskReason:  issue.riskReason || '',
    region:      issue.region || '',
    csm:         csmName,
    sales:       salesName,
  };
}

async function pollForNewProjects() {
  if (!settings.jiraEmail || !settings.jiraToken) return;
  let newIssues;
  try {
    const resp = await fetch('https://pm-proxy.demo.qa.kaltura.ai/jira/new-assignments', {
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
    // Enrich issue with extra Jira fields (account name, hours, MRR/NRR, due date)
    const extraFieldIds = [cachedAccountNameFieldId, cachedMrrFieldId, cachedNrrFieldId, cachedEstHoursFieldId, cachedVMForecastFieldId, cachedRegionFieldId, cachedAccountOwnerFieldId, cachedOppUrlFieldId, cachedAccountUrlFieldId, cachedAccountCsmFieldId].filter(Boolean);
    if (extraFieldIds.length) {
      try {
        const useProxy = true;
        const fieldsParam = extraFieldIds.join(',');
        const extraUrl = useProxy
          ? `https://pm-proxy.demo.qa.kaltura.ai/jira/issue/${issue.key}?fields=${fieldsParam}`
          : `https://kaltura.atlassian.net/rest/api/3/issue/${issue.key}?fields=${fieldsParam}`;
        const extraResp = await fetch(extraUrl, useProxy ? { headers: { Accept: 'application/json' } } : { credentials: 'include', headers: { Accept: 'application/json' } });
        if (extraResp.ok) {
          const extraData = await extraResp.json();
          const f = extraData.fields || {};
          if (cachedAccountNameFieldId) issue.accountName = f[cachedAccountNameFieldId] || '';
          if (cachedMrrFieldId) issue.mrrUsd = f[cachedMrrFieldId] ?? '';
          if (cachedNrrFieldId) issue.nrrUsd = f[cachedNrrFieldId] ?? '';
          if (cachedEstHoursFieldId) issue.estimatedHours = f[cachedEstHoursFieldId] ?? '';
          if (cachedVMForecastFieldId) issue.dueDate = f[cachedVMForecastFieldId] || '';
          if (cachedRegionFieldId) {
            const rawR = f[cachedRegionFieldId];
            issue.region = typeof rawR === 'object' && rawR !== null ? (rawR.value || '') : (rawR || '');
          }
          if (cachedAccountOwnerFieldId) {
            const rawOwner = f[cachedAccountOwnerFieldId];
            issue.accountOwnerName = typeof rawOwner === 'string' ? rawOwner : (rawOwner?.displayName || rawOwner?.name || '');
            issue.accountOwnerAccountId = rawOwner?.accountId || '';
          }
          if (cachedOppUrlFieldId) issue.oppUrl = validSfUrl(f[cachedOppUrlFieldId]) || '';
          if (cachedAccountUrlFieldId) issue.accountUrl = validSfUrl(f[cachedAccountUrlFieldId]) || '';
          if (cachedAccountCsmFieldId) {
            const rawCsm = f[cachedAccountCsmFieldId];
            issue.accountCsmName = typeof rawCsm === 'string' ? rawCsm : (rawCsm?.displayName || rawCsm?.name || '');
          }
        }
      } catch {}
    }

    let sfData = { sfSkipped: true };
    try {
      const sfResp = await fetch(`https://pm-proxy.demo.qa.kaltura.ai/sf/enrich?jiraKey=${encodeURIComponent(issue.key)}`, {
        headers: { Accept: 'application/json' },
      });
      if (sfResp.ok) sfData = await sfResp.json();
    } catch {
      // sfData stays sfSkipped
    }
    const project = buildProjectFromEnrichment(issue, sfData);
    projects.push(project);
    if (issue.accountOwnerName) {
      await ensureUserExists(issue.accountOwnerName, issue.accountOwnerAccountId, 'Sales');
    }
    if (issue.accountCsmName) {
      await ensureUserExists(issue.accountCsmName, '', 'CSM');
    }
    addedKeys.push({ key: issue.key, sfUnavailable: !!(sfData.sfSkipped || sfData.sfError) });
  }
  saveProjects();
  renderAll();
  showNewProjectsBanner(addedKeys);
}

let _wasOffline = false;
