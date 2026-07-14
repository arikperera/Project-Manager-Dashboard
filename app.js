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
  const ok = await kvPut(STORAGE_KEY, projects);
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
        if (!recentlySaved && (!localTime || jiraTime > localTime)) {
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

async function trySyncLocalToKV() {
  // Push in-memory data (which has offline deletes/adds applied) to KV
  const stores = [
    [STORAGE_KEY, projects],
    [USERS_KEY, users],
    [CUSTOMERS_KEY, customers],
    [BACKUPS_KEY, backups],
    [TASKS_KEY, tasks],
  ];
  for (const [key, data] of stores) {
    await kvPut(key, data).catch(() => {});
  }
  // Clear all pending deletes since KV is now in sync
  try { localStorage.setItem(PENDING_DELETES_KEY, '[]'); } catch {}
  const banner = document.getElementById('offline-banner');
  if (banner) banner.style.display = 'none';
  showToast('Back online — changes synced to cloud.', 'success');
}

let _kvPollTimer = null;
function startKvPoll() {
  const intervalMs = (settings.pollIntervalMinutes ?? 15) * 60 * 1000;
  if (_kvPollTimer) clearInterval(_kvPollTimer);
  _kvPollTimer = setInterval(async () => {
    // Skip refresh while any modal is open to avoid clobbering unsaved edits
    if (document.querySelector('.modal:not(.hidden)')) return;

    // Health check — detect reconnection
    let isOnline = false;
    try {
      const h = await fetch(`${PROXY_BASE}/health`, { headers: { 'X-KV-Secret': KV_SECRET } });
      isOnline = h.ok;
    } catch {}

    if (!isOnline) {
      _wasOffline = true;
      showOfflineBanner();
      return;
    }

    // Just came back online — push local data to KV before pulling
    if (_wasOffline) {
      _wasOffline = false;
      await trySyncLocalToKV();
    }

    let changed = false;

    const freshProjects = await kvGet(STORAGE_KEY);
    if (freshProjects && JSON.stringify(freshProjects) !== JSON.stringify(projects)) {
      projects = freshProjects;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
      changed = true;
    }

    const freshTasks = await kvGet(TASKS_KEY);
    if (freshTasks && JSON.stringify(freshTasks) !== JSON.stringify(tasks)) {
      tasks = freshTasks;
      try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
      changed = true;
    }

    if (changed) renderAll();
  }, intervalMs);
}

let _pollTimer = null;
function startAutoProjectPoll() {
  pollForNewProjects();
  const intervalMs = ((settings.pollIntervalMinutes ?? 15) * 60 * 1000);
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(pollForNewProjects, intervalMs);
}

let _bannerTimer = null;
let _dismissHideTimer = null;


function showNewProjectsBanner(addedKeys) {
  if (_dismissHideTimer) { clearTimeout(_dismissHideTimer); _dismissHideTimer = null; }

  const banner = document.getElementById('newProjectsBanner');
  const msg = document.getElementById('newProjectsBannerMsg');
  if (!banner || !msg) return;

  const count = addedKeys.length;
  const keyLinks = addedKeys.map(({ key, sfUnavailable }) => {
    const suffix = sfUnavailable ? ' (SF data unavailable)' : '';
    const safeKey = escapeHtml(key);
    return `<a data-jirakey="${safeKey}">${safeKey}${suffix}</a>`;
  }).join(', ');

  msg.innerHTML = `<strong>${count} new project${count > 1 ? 's' : ''} added</strong> — ${keyLinks}`;

  banner.classList.remove('hidden');
  requestAnimationFrame(() => banner.classList.add('visible'));

  if (_bannerTimer) clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(() => dismissNewProjectsBanner(), 10000);
}

function dismissNewProjectsBanner() {
  if (_bannerTimer) { clearTimeout(_bannerTimer); _bannerTimer = null; }
  const banner = document.getElementById('newProjectsBanner');
  if (!banner) return;
  banner.classList.remove('visible');
  _dismissHideTimer = setTimeout(() => banner.classList.add('hidden'), 300);
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

document.getElementById('newProjectsBannerDismiss').addEventListener('click', dismissNewProjectsBanner);

async function fetchAndStoreAvatars() {
  const usersNeedingAvatar = users.filter(u => u.jiraAccountId && !u.avatarUrl);
  if (!usersNeedingAvatar.length) return;
  let changed = false;
  for (const user of usersNeedingAvatar) {
    try {
      const res = await fetch(`${PROXY_BASE}/jira/user/search?query=${encodeURIComponent(getUserDisplayName(user))}`, {
        headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
      });
      if (!res.ok) continue;
      const results = await res.json();
      const match = results.find(u => u.accountId === user.jiraAccountId) || results.find(u => u.displayName === getUserDisplayName(user));
      if (match?.avatarUrls) {
        user.avatarUrl = match.avatarUrls['24x24'] || match.avatarUrls['16x16'] || Object.values(match.avatarUrls)[0] || '';
        changed = true;
      }
    } catch {}
  }
  if (changed) await saveUsers();
}

async function getOrFetchJiraAccountId(displayName) {
  if (!displayName) return null;
  // Check if already stored on user
  const user = users.find(u => getUserDisplayName(u) === displayName);
  if (user && user.jiraAccountId) return user.jiraAccountId;
  // Search Jira for accountId
  try {
    const res = await fetch(`${PROXY_BASE}/jira/user/search?query=${encodeURIComponent(displayName)}`, {
      headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
    });
    if (!res.ok) return null;
    const results = await res.json();
    const match = results.find(u => u.displayName === displayName);
    if (match && user) {
      user.jiraAccountId = match.accountId;
      saveUsers().catch(() => {});
    }
    return match ? match.accountId : null;
  } catch { return null; }
}

async function writeAssigneeToJira(issueKey, displayName) {
  const accountId = await getOrFetchJiraAccountId(displayName);
  if (!accountId) throw new Error(`Jira account not found for: ${displayName}`);
  await jiraProxyPut(issueKey, { fields: { assignee: { accountId } } });
}

async function jiraProxyPut(issueKey, body) {
  const res = await fetch(`${PROXY_BASE}/jira/issue/${issueKey}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Jira write failed: ${res.status}`);
}

async function addJiraComment(issueKey, updatedBy) {
  if (!updatedBy) return;
  const payload = {
    body: {
      type: 'doc',
      version: 1,
      content: [{
        type: 'paragraph',
        content: [{ type: 'text', text: `Updated via PM Dashboard by: ${updatedBy}` }]
      }]
    }
  };
  try {
    const res = await fetch(`${PROXY_BASE}/jira/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[comment→Jira]', res.status, err);
    }
  } catch (e) {
    console.error('[comment→Jira]', e);
  }
}

async function writeRiskReasonToJira(issueKey, optionId) {
  if (!cachedRiskReasonFieldId) await resolveJiraFieldIds();
  if (!cachedRiskReasonFieldId) throw new Error('Risk Reason field ID not resolved');
  await jiraProxyPut(issueKey, { fields: { [cachedRiskReasonFieldId]: optionId ? { id: optionId } : null } });
}

async function writeStatusToJira(issueKey, statusText) {
  const adf = htmlToAdf(statusText || '');
  await jiraProxyPut(issueKey, { fields: { description: adf } });
}

async function writeRiskRateToJira(issueKey, health) {
  if (!cachedRiskRateFieldId || !cachedRiskRateOptions) await resolveJiraFieldIds();
  if (!cachedRiskRateFieldId) throw new Error('Risk Rate field ID not resolved');
  if (!cachedRiskRateOptions) throw new Error('Risk Rate options not resolved');
  const optionId = cachedRiskRateOptions[health];
  if (!optionId) throw new Error(`Risk Rate option not found for health: ${health}`);
  await jiraProxyPut(issueKey, { fields: { [cachedRiskRateFieldId]: { id: optionId } } });
}

let cachedVMForecastFieldId = null;

async function writeRegionToJira(issueKey, region) {
  if (!region) return;
  if (!cachedRegionFieldId) await resolveJiraFieldIds();
  if (!cachedRegionFieldId) throw new Error('Region field ID not resolved');
  await jiraProxyPut(issueKey, { fields: { [cachedRegionFieldId]: { value: region } } });
}

async function writeDueDateToJira(issueKey, dateStr) {
  if (!dateStr) return;
  if (!cachedVMForecastFieldId) await resolveJiraFieldIds();
  if (!cachedVMForecastFieldId) throw new Error('VM Forecast Commit Date field ID not resolved');
  await jiraProxyPut(issueKey, { fields: { [cachedVMForecastFieldId]: dateStr } });
}

function showToast(message, type = 'error') {
  const existing = document.getElementById('appToast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'appToast';
  toast.textContent = message;
  const bg = type === 'error' ? '#7f1d1d' : '#14532d';
  toast.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${bg};color:#fff;padding:12px 18px;border-radius:12px;font-size:0.9rem;box-shadow:0 4px 16px rgba(0,0,0,0.4);max-width:360px;`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

function showOfflineBanner() {
  const el = document.getElementById('offline-banner');
  if (el) el.style.display = 'block';
}

function showEditModalWarning(message) {
  const card = editProjectModal.querySelector('.modal-card');
  const existing = card.querySelector('.edit-warning-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'edit-warning-banner';
  banner.textContent = message;
  banner.style.cssText = 'background:#854d0e;color:#fef9c3;padding:10px 14px;border-radius:10px;margin-bottom:12px;font-size:0.88rem;';
  card.insertBefore(banner, card.firstChild);
  setTimeout(() => banner.remove(), 4000);
}

function getFilteredProjects() {
  const term = searchInput.value.toLowerCase().trim();
  const selectedPm = pmFilter.value;
  const selectedHealth = healthFilter.value;
  const selectedProgress = progressFilter.value;
  const selectedDueMonth = duemonthFilter.value;
  const selectedRegion = regionFilter.value;

  function matchItem(item) {
    const owner = item.manager || item.owner || '';
    const matchesPm = selectedPm === 'All' || owner === selectedPm;
    const matchesHealth = selectedHealth === 'All' || item.health === selectedHealth;
    const matchesDueMonth = !selectedDueMonth || (item.dueDate || '').startsWith(selectedDueMonth);
    const matchesSearch = !term || `${item.name || ''} ${owner} ${item.customer || ''} ${item.jira || ''}`.toLowerCase().includes(term);
    let matchesProgress = true;
    if (selectedProgress === '0-39') matchesProgress = item.progress < 40;
    if (selectedProgress === '40-69') matchesProgress = item.progress >= 40 && item.progress < 70;
    if (selectedProgress === '70-100') matchesProgress = item.progress >= 70;
    const matchesRegion = !selectedRegion || item.region === selectedRegion;
    return matchesPm && matchesHealth && matchesDueMonth && matchesSearch && matchesProgress && matchesRegion;
  }

  const filteredProjects = projects.filter(matchItem);
  const filteredTasks = tasks.filter(matchItem);
  return [...filteredProjects, ...filteredTasks];
}

function renderTable() {
  const filteredProjects = getFilteredProjects();
  const grouped = filteredProjects.reduce((acc, project) => {
    const key = project.manager || project.owner || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(project);
    return acc;
  }, {});

  portfolioGroups.innerHTML = '';

  Object.keys(grouped).sort((a, b) => a.localeCompare(b)).forEach((manager) => {
    const section = document.createElement('section');
    section.className = 'pm-group';

    const header = document.createElement('div');
    header.className = 'pm-group-header';
    header.innerHTML = `<h4 style="display:flex;align-items:center;">${getUserAvatarHtml(manager)}${escapeHtml(manager)} <span style="font-size:0.88rem;font-weight:400;margin-left:6px;">(Number Of Projects: ${grouped[manager].filter(p => p.type !== 'task').length}${grouped[manager].some(p => p.type === 'task') ? ` · ${grouped[manager].filter(p => p.type === 'task').length} task${grouped[manager].filter(p => p.type === 'task').length > 1 ? 's' : ''}` : ''})</span></h4>`;
    section.appendChild(header);

    const table = document.createElement('table');
    table.className = 'pm-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Customer name</th>
          <th>Opportunity</th>
          <th>Jira / AT</th>
          <th>NRR(h)</th>
          <th>Start</th>
          <th>End</th>
          <th>Project Health</th>
          <th>Project Budget</th>
          <th>Project Status</th>
          <th>Manager Notes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${grouped[manager].slice().sort((a, b) => {
            const custA = (a.customer || '').toLowerCase();
            const custB = (b.customer || '').toLowerCase();
            if (custA !== custB) return custA.localeCompare(custB);
            return projects.indexOf(b) - projects.indexOf(a);
          }).map((project) => {
          const progressValue = normalizeProgress(project.progress) ?? 0;
          const progressTone = getProgressTone(progressValue);
          const progressFillTone = getProgressFillTone(progressValue);
          return `
          <tr data-jirakey="${getJiraIssueKey(project.jira) || ''}">
            <td>${(() => { const custLink = project.accountUrl || (customers.find(c => c.name === project.customer)?.sfLink) || ''; return custLink ? `<a href="${escapeHtml(custLink)}" target="_blank" rel="noreferrer">${escapeHtml(project.customer || '-')}</a>` : escapeHtml(project.customer || '-'); })()}</td>
            <td>${project.oppLink ? `<a href="${escapeHtml(project.oppLink)}" target="_blank" rel="noreferrer">${escapeHtml(project.name || project.parentProjectName || '-')}</a>` : escapeHtml(project.name || project.parentProjectName || '-')}</td>
            <td class="jira-at-cell">
              ${project.jira ? `<a class="jira-at-btn" href="${escapeHtml(project.jira)}" target="_blank" rel="noreferrer">${escapeHtml(getJiraLabel(project.jira))}</a>` : '<span style="color:#64748b">—</span>'}
              ${project.atLink ? `<a class="jira-at-btn" href="${escapeHtml(project.atLink)}" target="_blank" rel="noreferrer">AT</a>` : ''}
            </td>
            <td>${project.type === 'task' || project.nrr == null ? '-' : `${project.nrr} hrs`}</td>
            <td>${formatDate(project.startDate)}</td>
            <td>${formatDate(project.dueDate)}</td>
            <td>
              <div class="health-wrap">
                <span class="health-pill health-${(project.health || 'green').toLowerCase()}">${project.health || 'Green'}</span>
                ${(project.health === 'Yellow' || project.health === 'Red') ? `<div class="health-tooltip">${escapeHtml(project.pmStatus || 'No info was set by PM')}</div>` : ''}
              </div>
            </td>
            <td>
              ${project.type === 'task' ? '-' : (() => {
                let tip = '';
                if (project.riskReason) {
                  tip = `Risk reason was set\n${project.riskReason}`;
                } else if (progressValue >= 100) {
                  tip = 'No more hours for the project';
                } else if (project.estimatedHours != null && project.remainingHours != null) {
                  const used = project.actualHours != null ? project.actualHours : (project.estimatedHours - project.remainingHours);
                  tip = `${used} hours have been completed out of ${project.estimatedHours}, with ${project.remainingHours} hours remaining`;
                } else if (project.actualHours != null && project.estimatedHours != null) {
                  tip = `${project.actualHours} hours have been completed out of ${project.estimatedHours}`;
                } else if (project.actualHours != null) {
                  tip = project.actualHours === 0 ? 'No hours reported yet' : `${project.actualHours} hours reported`;
                }
                const blink = (() => {
                  const ack = project.riskReason;
                  if (progressValue >= 100 && !ack) return '<span class="progress-blink-wrap"><span class="progress-blink">⚠</span><span class="progress-blink-tip">Edit the project and set over budget risk reason</span></span>';
                  if (progressValue >= 76 && progressValue < 100) return '<span class="progress-blink-wrap"><span class="progress-blink progress-blink-dollar">$</span><span class="progress-blink-tip">The allocated project hours are nearly exhausted. Please coordinate with the CSM to secure additional hours.</span></span>';
                  return '';
                })();
                return `<div class="progress-wrap">${tip ? `<div class="progress-tooltip">${escapeHtml(tip).replace(/\n/g,'<br>')}</div>` : ''}<div class="progress-bar"><div class="progress-fill ${progressFillTone}" style="width:${Math.min(progressValue, 100)}%"></div></div><small class="progress-label ${progressTone}">${progressValue}% &middot; ${buildHoursLabel(project.actualHours, project.estimatedHours, project.nrr)}</small></div>${blink}`;
              })()}
            </td>
            <td><div class="cell-scroll">${isEmptyStatus(project.statusText) ? STATUS_PLACEHOLDER : project.statusText}</div></td>
            <td><div class="cell-scroll">${(project.comments || '-').split(', ').join('<br>')}</div></td>
            <td style="white-space:nowrap;">
              <button type="button" class="secondary-btn small-btn" data-edit-project="${project.type === 'task' ? tasks.indexOf(project) : projects.indexOf(project)}" data-item-type="${project.type || 'project'}">Edit</button>
              <button type="button" class="ghost-btn small-btn" style="margin-top:4px;display:block;" data-delete-project="${project.type === 'task' ? tasks.indexOf(project) : projects.indexOf(project)}" data-item-type="${project.type || 'project'}">Delete</button>
            </td>
          </tr>
        `;
        }).join('')}
      </tbody>
    `;
    section.appendChild(table);
    portfolioGroups.appendChild(section);
  });

  if (!Object.keys(grouped).length) {
    portfolioGroups.innerHTML = '<p class="muted">No projects match the current filters.</p>';
  }
}

function renderSelect() {
  if (projectSelect) {
    projectSelect.innerHTML = projects
      .map((project, index) => `<option value="${index}">${project.name}</option>`)
      .join('');
  }

  const uniqueManagers = [...new Set([
    ...projects.map(p => p.manager).filter(Boolean),
    ...tasks.map(t => t.owner).filter(Boolean),
  ])].sort();
  const currentPm = pmFilter.value;
  pmFilter.innerHTML = ['<option value="All">All PMs</option>', ...uniqueManagers.map((manager) => `<option value="${manager}">${manager}</option>`)].join('');
  pmFilter.value = currentPm;

  const currentRegion = regionFilter.value;
  // (no innerHTML rebuild needed — regionFilter is static HTML)
  regionFilter.value = currentRegion;

  const now = new Date();
  const monthOptions = [['', 'Projects Due completion']];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    monthOptions.push([value, label]);
  }
  const currentDueMonth = duemonthFilter.value;
  duemonthFilter.innerHTML = monthOptions.map(([v, l]) => `<option value="${v}"${v === currentDueMonth ? ' selected' : ''}>${l}</option>`).join('');
}

function renderSummary() {
  const selectedRegion = regionFilter ? regionFilter.value : '';
  const scoped = selectedRegion ? projects.filter(p => p.region === selectedRegion) : projects;

  const total = scoped.length;
  const atRisk = scoped.filter((project) => Number(project.progress) >= 100).length;
  const healthGreen  = scoped.filter(p => (p.health || 'Green') === 'Green').length;
  const healthYellow = scoped.filter(p => p.health === 'Yellow').length;
  const healthRed    = scoped.filter(p => p.health === 'Red').length;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const endOfMonth = `${currentMonth}-31`; // safe upper bound — string compare works since format is YYYY-MM-DD
  const dueThisMonth = scoped.filter((project) =>
    project.dueDate && project.dueDate <= endOfMonth && project.status !== 'Completed'
  );

  document.getElementById('totalProjects').textContent = total;
  document.getElementById('healthGreenCount').textContent  = healthGreen;
  document.getElementById('healthYellowCount').textContent = healthYellow;
  document.getElementById('healthRedCount').textContent    = healthRed;
  document.getElementById('atRiskCount').textContent = atRisk;
  document.getElementById('dueThisMonthCount').textContent = dueThisMonth.length;
}

function openEditProjectModal(itemType, itemIndex) {
  // Support legacy single-argument call: openEditProjectModal(projectIndex)
  if (itemIndex === undefined) { itemIndex = itemType; itemType = 'project'; }
  const item = itemType === 'task' ? tasks[itemIndex] : projects[itemIndex];
  if (!item) return;

  editCustomerName.value = item.customer || '';
  editCustomerName.readOnly = itemType === 'task';
  editProjectName.value = item.name || item.parentProjectName || '';
  editProjectName.readOnly = itemType === 'task';
  const pmNames = itemType === 'task'
    ? users.map(u => getUserDisplayName(u)).filter(Boolean).sort()
    : getUsersByRole('PM');
  const currentManager = itemType === 'task' ? (item.owner || '') : (item.manager || '');
  editProjectManager.innerHTML = pmNames.map(n => `<option value="${escapeHtml(n)}"${n === currentManager ? ' selected' : ''}>${escapeHtml(n)}</option>`).join('');
  if (!pmNames.includes(currentManager) && currentManager) {
    editProjectManager.innerHTML = `<option value="${escapeHtml(currentManager)}" selected>${escapeHtml(currentManager)}</option>` + editProjectManager.innerHTML;
  }
  editHealth.value = item.health || 'Green';
  editPmStatus.value = item.pmStatus || '';
  const isAtRisk = ['Yellow', 'Red'].includes(item.health);
  pmStatusLabel.style.display = isAtRisk ? '' : 'none';
  const matchingOption = Array.from(editRiskReason.options).find(o => o.text === item.riskReason);
  editRiskReason.value = matchingOption ? matchingOption.value : '';
  editRegion.value = item.region || '';
  riskReasonLabel.style.display = '';
  const editDueDateText = document.getElementById('editDueDateText');
  editDueDateText.value = item.dueDate ? formatDateDMY(item.dueDate) : '';
  document.getElementById('editAtLink').value = item.atLink || '';
  document.getElementById('editDueDateHidden').value = item.dueDate || '';
  if (item.statusText) {
    editStatusEditor.innerHTML = item.statusText;
    editStatusEditor.removeAttribute('data-placeholder-active');
  } else {
    editStatusEditor.innerHTML = '<span style="font-style:italic;opacity:0.5;">No Status Entered</span>';
    editStatusEditor.setAttribute('data-placeholder-active', '1');
  }
  editProjectForm.dataset.itemType = itemType;
  editProjectForm.dataset.itemIndex = String(itemIndex);
  editProjectForm.dataset.projectIndex = String(itemIndex); // keep for backward compat

  editProjectModal.classList.remove('hidden');
  editProjectModal.setAttribute('aria-hidden', 'false');
}

function closeEditProjectModal() {
  editProjectModal.classList.add('hidden');
  editProjectModal.setAttribute('aria-hidden', 'true');
  editProjectForm.reset();
  editStatusEditor.innerHTML = '';
  editStatusEditor.removeAttribute('data-placeholder-active');
  document.getElementById('editorLinkPopup').style.display = 'none';
  editPmStatus.value = '';
  pmStatusLabel.style.display = 'none';
  editRiskReason.value = '';
  editRegion.value = '';
  riskReasonLabel.style.display = '';
}

function renderRiskList() {
  if (!riskList) return;
  const atRiskProjects = projects.filter((project) => project.status === 'At Risk' || project.status === 'Delayed');
  riskList.innerHTML = atRiskProjects.length
    ? atRiskProjects
        .map(
          (project) => `<li><strong>${project.name}</strong>${project.comments || 'Needs attention.'}</li>`
        )
        .join('')
    : '<li><strong>No critical risks</strong>All projects are currently on track or completed.</li>';
}

function renderUsersModal() {
  const hasUsers = users.length > 0;

  usersModalBody.innerHTML = hasUsers
    ? [...users].sort((a, b) => getUserDisplayName(a).localeCompare(getUserDisplayName(b))).map(u => `
        <div class="user-row" data-user-id="${escapeHtml(u.id)}">
          <div>
            <span>${escapeHtml(getUserDisplayName(u))}</span>
            <small style="color:#a5b4fc;margin-left:8px;">${getUserRoles(u).join(', ')}</small>
          </div>
          <div>
            <button type="button" class="ghost-btn small-btn" data-edit-user="${escapeHtml(u.id)}">Edit</button>
            <button type="button" class="ghost-btn small-btn" data-delete-user="${escapeHtml(u.id)}">Delete</button>
          </div>
        </div>
      `).join('')
    : '<p class="muted">No users added yet. Click Add user to get started.</p>';
}

let selectedBackupId = null;

function renderBackupsPanel() {
  if (!backups.length) {
    backupSidebar.innerHTML = '<p class="muted" style="font-size:0.88rem;">No backups yet.</p>';
    backupMain.innerHTML = '<p class="muted">No backups yet. Click Create backup to save your first snapshot.</p>';
    return;
  }

  if (!selectedBackupId || !backups.find(b => b.id === selectedBackupId)) {
    selectedBackupId = backups[0].id;
  }

  backupSidebar.innerHTML = backups.map(b => `
    <div class="backup-entry${b.id === selectedBackupId ? ' selected' : ''}" data-backup-id="${escapeHtml(b.id)}">
      ${escapeHtml(b.label)}
    </div>
  `).join('');

  const backup = backups.find(b => b.id === selectedBackupId);
  renderBackupMain(backup);
}

function renderBackupMain(backup) {
  const grouped = backup.projects.reduce((acc, p) => {
    const key = p.manager || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const tableRows = Object.keys(grouped).sort((a, b) => a.localeCompare(b)).map(manager => `
    <div class="pm-group" style="margin-bottom:10px;">
      <div class="pm-group-header"><h4 style="display:flex;align-items:center;">${getUserAvatarHtml(manager)}${escapeHtml(manager)}</h4><span>${grouped[manager].length} project${grouped[manager].length === 1 ? '' : 's'}</span></div>
      <div style="overflow-x:auto;">
        <table class="pm-table">
          <thead><tr>
            <th>Customer</th><th>Opportunity</th><th>Jira / AT</th><th>NRR(h)</th>
            <th>Start</th><th>End</th><th>Project Health</th><th>Project Budget</th>
            <th>Project Status</th><th>Manager Notes</th>
          </tr></thead>
          <tbody>
            ${grouped[manager].slice().sort((a, b) => {
                const ca = (a.customer || '').toLowerCase();
                const cb = (b.customer || '').toLowerCase();
                if (ca !== cb) return ca.localeCompare(cb);
                return backup.projects.indexOf(b) - backup.projects.indexOf(a);
              }).map(p => {
              const pv = Math.max(0, Math.min(100, Math.round(Number(p.progress) || 0)));
              return `<tr>
                <td>${escapeHtml(p.customer || '-')}</td>
                <td>${escapeHtml(p.name)}</td>
                <td class="jira-at-cell">
                  ${p.jira ? `<a class="jira-at-btn" href="${escapeHtml(p.jira)}" target="_blank" rel="noreferrer">${escapeHtml(getJiraLabel(p.jira))}</a>` : '<span style="color:#64748b">—</span>'}
                  ${p.atLink ? `<a class="jira-at-btn" href="${escapeHtml(p.atLink)}" target="_blank" rel="noreferrer">AT</a>` : ''}
                </td>
                <td>${escapeHtml(String(p.nrr || 0))} hrs</td>
                <td>${escapeHtml(formatDate(p.startDate))}</td>
                <td>${escapeHtml(formatDate(p.dueDate))}</td>
                <td>
                  <div class="health-wrap">
                    <span class="health-pill health-${escapeHtml((p.health || 'green').toLowerCase())}">${escapeHtml(p.health || 'Green')}</span>
                    ${(p.health === 'Yellow' || p.health === 'Red') ? `<div class="health-tooltip">${escapeHtml(p.pmStatus || 'No info was set by PM')}</div>` : ''}
                  </div>
                </td>
                <td>
                  <div class="progress-wrap">
                    ${(() => { let tip = ''; if (p.riskReason) { tip = `Risk reason was set\n${p.riskReason}`; } else if (pv >= 100) { tip = 'No more hours for the project'; } else if (p.estimatedHours != null && p.remainingHours != null) { const used = p.actualHours != null ? p.actualHours : (p.estimatedHours - p.remainingHours); tip = `${used} hours have been completed out of ${p.estimatedHours}, with ${p.remainingHours} hours remaining`; } return tip ? `<div class="progress-tooltip">${escapeHtml(tip).replace(/\n/g,'<br>')}</div>` : ''; })()}
                    <div class="progress-bar"><div class="progress-fill ${getProgressFillTone(pv)}" style="width:${Math.min(pv,100)}%"></div></div>
                    <small class="progress-label ${getProgressTone(pv)}">${pv}%</small>
                  </div>${(() => { const ack = p.riskReason; if (pv >= 100 && !ack) return '<span class="progress-blink-wrap"><span class="progress-blink">⚠</span><span class="progress-blink-tip">Edit the project and set over budget risk reason</span></span>'; if (pv >= 76 && pv < 100) return '<span class="progress-blink-wrap"><span class="progress-blink progress-blink-dollar">$</span><span class="progress-blink-tip">The allocated project hours are nearly exhausted. Please coordinate with the CSM to secure additional hours.</span></span>'; return ''; })()}
                </td>
                <td><div class="cell-scroll">${isEmptyStatus(p.statusText) ? STATUS_PLACEHOLDER : p.statusText}</div></td>
                <td><div class="cell-scroll">${escapeHtml((p.comments || '-').split(', ').join('\n'))}</div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');

  const roleGroups = ['PM', 'CSM', 'Sales'].map(role => {
    const members = backup.users.filter(u => u.role === role);
    if (!members.length) return '';
    return `<div style="margin-bottom:10px;">
      <p class="eyebrow" style="margin-bottom:6px;">${escapeHtml(role)}</p>
      ${members.map(u => `<div class="user-row"><span>${escapeHtml(getUserDisplayName(u))}</span></div>`).join('')}
    </div>`;
  }).join('');

  backupMain.innerHTML = `
    <div class="backup-action-bar">
      <h4>${escapeHtml(backup.label)}</h4>
      <button type="button" class="secondary-btn small-btn" id="restoreBackupBtn">Restore</button>
      <button type="button" class="ghost-btn small-btn" id="deleteBackupBtn">Delete</button>
    </div>
    <div id="restoreConfirm" style="display:none;" class="backup-restore-confirm">
      <label><input type="checkbox" id="restoreProjects" checked> Restore projects</label>
      <label><input type="checkbox" id="restoreUsers" checked> Restore users</label>
      <button type="button" class="primary-btn small-btn" id="confirmRestoreBtn">Confirm</button>
      <button type="button" class="ghost-btn small-btn" id="cancelRestoreBtn">Cancel</button>
    </div>
    <div>${tableRows || '<p class="muted">No projects in this backup.</p>'}</div>
    <div class="backup-users-section">
      <h4>Users</h4>
      ${roleGroups || '<p class="muted">No users in this backup.</p>'}
    </div>
  `;

  document.getElementById('restoreBackupBtn').addEventListener('click', () => {
    document.getElementById('restoreConfirm').style.display = 'flex';
  });

  document.getElementById('cancelRestoreBtn').addEventListener('click', () => {
    document.getElementById('restoreConfirm').style.display = 'none';
  });

  document.getElementById('confirmRestoreBtn').addEventListener('click', async () => {
    const restoreProjectsEl = document.getElementById('restoreProjects');
    const restoreUsersEl = document.getElementById('restoreUsers');
    if (!restoreProjectsEl.checked && !restoreUsersEl.checked) return;
    if (restoreProjectsEl.checked) {
      projects = JSON.parse(JSON.stringify(backup.projects));
      await saveProjects();
    }
    if (restoreUsersEl.checked) {
      users = JSON.parse(JSON.stringify(backup.users));
      await saveUsers();
    }
    renderAll();
    closeBackupsModal();
  });

  document.getElementById('deleteBackupBtn').addEventListener('click', () => {
    backups = backups.filter(b => b.id !== backup.id);
    saveBackups();
    selectedBackupId = backups.length ? backups[0].id : null;
    renderBackupsPanel();
  });
}

function openBackupsModal() {
  selectedBackupId = backups.length ? backups[0].id : null;
  renderBackupsPanel();
  backupsModal.classList.remove('hidden');
  backupsModal.setAttribute('aria-hidden', 'false');
}

function closeBackupsModal() {
  backupsModal.classList.add('hidden');
  backupsModal.setAttribute('aria-hidden', 'true');
}

let deleteProjectIndex = -1;

function openDeleteProjectModal(itemType, itemIndex) {
  // Support legacy single-argument call: openDeleteProjectModal(projectIndex)
  if (itemIndex === undefined) { itemIndex = itemType; itemType = 'project'; }
  const item = itemType === 'task' ? tasks[itemIndex] : projects[itemIndex];
  if (!item) return;
  deleteProjectIndex = itemIndex;
  deleteProjectModal.dataset.itemType = itemType;
  deleteProjectModalTitle.textContent = item.name || item.parentProjectName || 'Task';
  deleteProjectModal.classList.remove('hidden');
  deleteProjectModal.setAttribute('aria-hidden', 'false');
}

function closeDeleteProjectModal() {
  deleteProjectModal.classList.add('hidden');
  deleteProjectModal.setAttribute('aria-hidden', 'true');
  deleteProjectIndex = -1;
}

function openUsersModal() {
  renderUsersModal();
  addUserForm.style.display = 'none';
  document.getElementById('usersSearchInput').value = '';
  usersModal.classList.remove('hidden');
  usersModal.setAttribute('aria-hidden', 'false');
}

function closeUsersModal() {
  usersModal.classList.add('hidden');
  usersModal.setAttribute('aria-hidden', 'true');
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  resetAddUserForm();
  if (addUserReturnContext) {
    const src = addUserReturnContext.sourceModal || projectModal;
    addUserReturnContext = null;
    src.classList.remove('hidden');
    src.setAttribute('aria-hidden', 'false');
  }
}

function renderCustomersModal() {
  if (!customers.length) {
    customersModalBody.innerHTML = '<p class="muted">No customers added yet. Click Add customer to get started.</p>';
    return;
  }
  customersModalBody.innerHTML = [...customers].sort((a, b) => a.name.localeCompare(b.name)).map(c => `
    <div class="user-row" data-customer-id="${escapeHtml(c.id)}">
      <div style="min-width:0;overflow:hidden;">
        <span style="word-break:break-word;">${escapeHtml(c.name)}</span>
        ${c.sfLink ? `<br><a href="${escapeHtml(c.sfLink)}" target="_blank" rel="noreferrer" style="font-size:0.82rem;color:#7dd3fc;">SF link</a>` : ''}
      </div>
      <div style="flex-shrink:0;margin-left:8px;">
        <button type="button" class="ghost-btn small-btn" data-edit-customer="${escapeHtml(c.id)}">Edit</button>
        <button type="button" class="ghost-btn small-btn" data-delete-customer="${escapeHtml(c.id)}">Delete</button>
      </div>
    </div>
  `).join('');
}

function openCustomersModal() {
  renderCustomersModal();
  addCustomerListForm.style.display = 'none';
  addCustomerListBtn.style.display = '';
  document.getElementById('customersSearchInput').value = '';
  customersModal.classList.remove('hidden');
  customersModal.setAttribute('aria-hidden', 'false');
}

function closeCustomersModal() {
  customersModal.classList.add('hidden');
  customersModal.setAttribute('aria-hidden', 'true');
  addCustomerListForm.style.display = 'none';
  addCustomerListBtn.style.display = '';
  document.getElementById('listNewCustomerName').value = '';
  document.getElementById('listNewCustomerSfLink').value = '';
}

function renderAll() {
  renderTable();
  renderSelect();
  renderSummary();
  renderRiskList();
}

function openAddNewChoice() {
  addNewChoiceModal.classList.remove('hidden');
  addNewChoiceModal.setAttribute('aria-hidden', 'false');
}

function closeAddNewChoice() {
  addNewChoiceModal.classList.add('hidden');
  addNewChoiceModal.setAttribute('aria-hidden', 'true');
}

function openTaskModal() {
  document.getElementById('taskCustomer').value = '';
  document.getElementById('taskProject').innerHTML = '<option value="">— select customer first —</option>';
  document.getElementById('taskJira').value = '';
  document.getElementById('taskOwner').value = '';
  document.getElementById('taskRegion').value = '';
  taskModal.classList.remove('hidden');
  taskModal.setAttribute('aria-hidden', 'false');
}

function closeTaskModal() {
  taskModal.classList.add('hidden');
  taskModal.setAttribute('aria-hidden', 'true');
}

function openModal() {
  projectModal.classList.remove('hidden');
  projectModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  projectModal.classList.add('hidden');
  projectModal.setAttribute('aria-hidden', 'true');
  modalProjectForm.reset();
  addUserReturnContext = null;
  addCustomerReturnContext = null;
}

editProjectForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const itemType = editProjectForm.dataset.itemType || 'project';
  const selectedIndex = Number(editProjectForm.dataset.itemIndex ?? editProjectForm.dataset.projectIndex ?? -1);
  const selectedProject = itemType === 'task' ? tasks[selectedIndex] : projects[selectedIndex];
  if (!selectedProject) return;

  const newCustomer = editCustomerName.value.trim();
  const newName = editProjectName.value.trim();
  if (newCustomer && itemType !== 'task') selectedProject.customer = newCustomer;
  if (newName && itemType !== 'task') selectedProject.name = newName;
  const previousManager = itemType === 'task' ? selectedProject.owner : selectedProject.manager;
  if (editProjectManager.value) {
    if (itemType === 'task') {
      selectedProject.owner = editProjectManager.value;
    } else {
      selectedProject.manager = editProjectManager.value;
    }
  }
  const managerChanged = (itemType === 'task' ? selectedProject.owner : selectedProject.manager) !== previousManager;
  selectedProject.health = editHealth.value;
  selectedProject.pmStatus = ['Yellow', 'Red'].includes(selectedProject.health)
    ? editPmStatus.value.trim()
    : '';
  const riskOptionId = editRiskReason.value;
  const riskOptionLabel = riskOptionId ? editRiskReason.options[editRiskReason.selectedIndex].text : '';
  selectedProject.riskReason = riskOptionLabel;
  selectedProject.region = editRegion.value;
  selectedProject.atLink = document.getElementById('editAtLink').value.trim();
  const newDueDate = parseDateInput(document.getElementById('editDueDateText').value);
  if (newDueDate) selectedProject.dueDate = newDueDate;
  const rawStatus = editStatusEditor.getAttribute('data-placeholder-active') ? '' : editStatusEditor.innerHTML.trim();
  selectedProject.statusText = isEmptyStatus(rawStatus) ? '' : rawStatus;
  selectedProject.statusUpdatedAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  if (itemType === 'task') { await saveTasks(); } else { await saveProjects(); }
  renderAll();
  closeEditProjectModal();

  if (itemType !== 'task') {
    const issueKey = getJiraIssueKey(selectedProject.jira);
    if (issueKey) {
      const jiraWriteError = (label) => (e) => {
        console.error(`[${label}→Jira]`, e); showToast(`Jira ${label} sync failed: ${e.message}`);
      };
      const updatedBy = selectedProject.manager || '';
      writeRiskReasonToJira(issueKey, riskOptionId || null).catch(jiraWriteError('riskReason'));
      writeRiskRateToJira(issueKey, selectedProject.health).catch(jiraWriteError('riskRate'));
      if (newDueDate) writeDueDateToJira(issueKey, newDueDate).catch(jiraWriteError('dueDate'));
      if (selectedProject.region) writeRegionToJira(issueKey, selectedProject.region).catch(jiraWriteError('region'));
      writeStatusToJira(issueKey, selectedProject.statusText).catch(jiraWriteError('status'));
      if (managerChanged) writeAssigneeToJira(issueKey, selectedProject.manager).catch(jiraWriteError('assignee'));
      addJiraComment(issueKey, updatedBy).catch(() => {});
    }
  }
});

modalProjectForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const pmName = document.getElementById('modalProjectPm').value.trim();
  const csmName = document.getElementById('modalProjectCsm').value.trim();
  const salesName = document.getElementById('modalProjectSales').value.trim();
  const nrrValue = document.getElementById('modalProjectNrrValue').value.trim();
  const mrrValue = document.getElementById('modalProjectMrrValue').value.trim();

  projects.unshift({
    customer: document.getElementById('modalProjectCustomer').value.trim() || 'Unknown',
    name: document.getElementById('modalProjectName').value.trim(),
    oppLink: document.getElementById('modalProjectOppLink').value.trim(),
    manager: pmName || 'Unassigned',
    jira: document.getElementById('modalProjectJira').value.trim(),
    nrr: Number(document.getElementById('modalProjectNrr').value),
    nrrUsd: nrrValue ? Number(nrrValue) || null : null,
    mrrUsd: mrrValue ? Number(mrrValue) || null : null,
    startDate: parseDateInput(document.getElementById('modalProjectStartDate').value),
    dueDate: parseDateInput(document.getElementById('modalProjectDueDate').value),
    status: 'On Track',
    health: 'Green',
    progress: 0,
    statusText: '',
    csm: csmName || '',
    sales: salesName || '',
    comments: `NRR: ${formatCurrency(nrrValue || '0')}, MRR: ${formatCurrency(mrrValue || '0')}, CSM: ${csmName || '-'}, Sales: ${salesName || '-'}`,
    region: document.getElementById('modalProjectRegion').value,
  });

  const newProjectJiraKey = getJiraIssueKey(document.getElementById('modalProjectJira').value.trim());
  const newProjectDueDate = parseDateInput(document.getElementById('modalProjectDueDate').value);
  saveProjects();
  renderAll();
  closeModal();
  syncProjectProgressFromJira();
  if (newProjectJiraKey && newProjectDueDate) {
    writeDueDateToJira(newProjectJiraKey, newProjectDueDate).catch(() => {});
  }
});

function restoreSourceModal() {
  if (addCustomerReturnContext) {
    const src = addCustomerReturnContext.sourceModal || projectModal;
    addCustomerReturnContext = null;
    src.classList.remove('hidden');
    src.setAttribute('aria-hidden', 'false');
  }
}
closeAddCustomerModalBtn.addEventListener('click', () => { closeAddCustomerModal(); restoreSourceModal(); });
cancelAddCustomerBtn.addEventListener('click', () => { closeAddCustomerModal(); restoreSourceModal(); });
addCustomerModal.addEventListener('click', (e) => { if (e.target === addCustomerModal) cancelAddCustomerBtn.click(); });

saveAddCustomerBtn.addEventListener('click', () => {
  const name = document.getElementById('newCustomerName').value.trim();
  const sfLink = document.getElementById('newCustomerSfLink').value.trim();
  if (!name) return;
  if (customers.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert(`A customer named "${name}" already exists.`);
    return;
  }
  customers.push({ id: `cust_${Date.now()}`, name, sfLink });
  saveCustomers();
  if (addCustomerReturnContext) {
    addCustomerReturnContext.inputEl.value = name;
  }
  closeAddCustomerModal();
  restoreSourceModal();
});

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
  document.getElementById('settingsSFStatus').textContent = settings.sfConfigured
    ? '✓ Credentials previously saved. Leave blank to keep them unchanged.'
    : '';
  settingsModal.classList.remove('hidden');
  settingsModal.setAttribute('aria-hidden', 'false');
});
function closeSettingsModal() {
  if (document.activeElement && settingsModal.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  settingsModal.classList.add('hidden');
  settingsModal.setAttribute('aria-hidden', 'true');
}
closeSettingsBtn.addEventListener('click', closeSettingsModal);
cancelSettingsBtn.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettingsModal(); });
saveSettingsBtn.addEventListener('click', async () => {
  settings.jiraEmail = document.getElementById('settingsJiraEmail').value.trim();
  settings.jiraToken = document.getElementById('settingsJiraToken').value.trim();
  settings.pollIntervalMinutes = parseInt(document.getElementById('settingsPollInterval').value, 10) || 15;
  const rawAssignees = document.getElementById('settingsWatchedAssignees').value;
  settings.watchedAssignees = rawAssignees.split(',').map(s => s.trim()).filter(Boolean);
  saveSettings();

  try {
    await fetch('https://pm-proxy.demo.qa.kaltura.ai/settings', {
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
      await fetch('https://pm-proxy.demo.qa.kaltura.ai/settings/sf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sfUsername, sfPasswordWithToken: sfPassword, sfClientId, sfClientSecret }),
      });
      settings.sfConfigured = true;
      saveSettings();
      document.getElementById('settingsSFStatus').textContent = 'SF credentials saved.';
    } catch {
      document.getElementById('settingsSFStatus').textContent = 'SF credentials not saved — proxy not running.';
    }
  }

  startAutoProjectPoll();
  closeSettingsModal();
  syncProjectProgressFromJira();
});

// Version label
document.getElementById('appVersionLabel').textContent = 'v' + APP_VERSION;

// What's New modal
const whatsNewModal = document.getElementById('whatsNewModal');
const closeWhatsNewBtn = document.getElementById('closeWhatsNewBtn');

function renderWhatsNew() {
  const body = document.getElementById('whatsNewBody');
  body.innerHTML = CHANGELOG.map(entry => `
    <div style="margin-bottom:20px;">
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;">
        <span style="font-weight:700;color:#7dd3fc;">v${entry.version}</span>
        <span style="font-size:0.8rem;color:#64748b;">${entry.date}</span>
      </div>
      <ul style="margin:0;padding-left:18px;color:#cbd5e1;font-size:0.9rem;line-height:1.7;">
        ${entry.features.map(f => `<li>${f}</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

document.getElementById('whatsNewBtn').addEventListener('click', () => {
  renderWhatsNew();
  whatsNewModal.classList.remove('hidden');
  whatsNewModal.setAttribute('aria-hidden', 'false');
});

closeWhatsNewBtn.addEventListener('click', () => {
  whatsNewModal.classList.add('hidden');
  whatsNewModal.setAttribute('aria-hidden', 'true');
});

whatsNewModal.addEventListener('click', (e) => {
  if (e.target === whatsNewModal) {
    whatsNewModal.classList.add('hidden');
    whatsNewModal.setAttribute('aria-hidden', 'true');
  }
});

manageCustomersBtn.addEventListener('click', openCustomersModal);
closeCustomersModalBtn.addEventListener('click', closeCustomersModal);
customersModal.addEventListener('click', (e) => { if (e.target === customersModal) closeCustomersModal(); });
document.getElementById('customersSearchInput').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  customersModalBody.querySelectorAll('.user-row').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
});

addCustomerListBtn.addEventListener('click', () => {
  addCustomerListForm.style.display = 'grid';
  addCustomerListBtn.style.display = 'none';
});

cancelCustomerListBtn.addEventListener('click', () => {
  addCustomerListForm.style.display = 'none';
  addCustomerListBtn.style.display = '';
  document.getElementById('listNewCustomerName').value = '';
  document.getElementById('listNewCustomerSfLink').value = '';
});

saveCustomerListBtn.addEventListener('click', () => {
  const name = document.getElementById('listNewCustomerName').value.trim();
  const sfLink = document.getElementById('listNewCustomerSfLink').value.trim();
  if (!name) return;
  if (customers.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    alert(`A customer named "${name}" already exists.`);
    return;
  }
  customers.push({ id: `cust_${Date.now()}`, name, sfLink });
  saveCustomers();
  addCustomerListForm.style.display = 'none';
  addCustomerListBtn.style.display = '';
  document.getElementById('listNewCustomerName').value = '';
  document.getElementById('listNewCustomerSfLink').value = '';
  renderCustomersModal();
});

customersModalBody.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('[data-delete-customer]');
  const editBtn = e.target.closest('[data-edit-customer]');
  const saveEditBtn = e.target.closest('.save-edit-customer');
  const cancelEditBtn = e.target.closest('.cancel-edit-customer');

  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteCustomer;
    customers = customers.filter(c => c.id !== id);
    saveCustomers();
    renderCustomersModal();
    return;
  }

  if (editBtn) {
    const id = editBtn.dataset.editCustomer;
    const cust = customers.find(c => c.id === id);
    if (!cust) return;
    const row = editBtn.closest('.user-row');
    row.outerHTML = `
      <div class="user-row-edit" data-editing-customer-id="${escapeHtml(id)}">
        <label style="grid-column:1/3">Customer name<input type="text" class="edit-cust-name" value="${escapeHtml(cust.name)}" /></label>
        <label style="grid-column:1/3">Salesforce link<input type="url" class="edit-cust-sf" value="${escapeHtml(cust.sfLink || '')}" /></label>
        <div class="modal-actions" style="grid-column:1/3;">
          <button type="button" class="ghost-btn small-btn cancel-edit-customer">Cancel</button>
          <button type="button" class="primary-btn small-btn save-edit-customer">Save</button>
        </div>
      </div>`;
    return;
  }

  if (cancelEditBtn) { renderCustomersModal(); return; }

  if (saveEditBtn) {
    const row = saveEditBtn.closest('[data-editing-customer-id]');
    const id = row.dataset.editingCustomerId;
    const cust = customers.find(c => c.id === id);
    if (!cust) return;
    const newName = row.querySelector('.edit-cust-name').value.trim() || cust.name;
    const newSf = row.querySelector('.edit-cust-sf').value.trim();
    const oldName = cust.name;
    cust.name = newName;
    cust.sfLink = newSf;
    if (oldName !== newName) {
      projects.forEach(p => { if (p.customer === oldName) p.customer = newName; });
      saveProjects();
      renderAll();
    }
    saveCustomers();
    renderCustomersModal();
  }
});

if (addNewBtn) {
  addNewBtn.addEventListener('click', openAddNewChoice);
} else if (addProjectBtn) {
  addProjectBtn.addEventListener('click', openModal);
}
addNewChoiceModal.addEventListener('click', (e) => { if (e.target === addNewChoiceModal) closeAddNewChoice(); });
addNewChoiceProjectBtn.addEventListener('click', () => { closeAddNewChoice(); openModal(); });
addNewChoiceTaskBtn.addEventListener('click', () => { closeAddNewChoice(); openTaskModal(); });
closeTaskModalBtn.addEventListener('click', closeTaskModal);
cancelTaskModalBtn.addEventListener('click', closeTaskModal);
taskModal.addEventListener('click', (e) => { if (e.target === taskModal) closeTaskModal(); });
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
closeEditModalBtn.addEventListener('click', closeEditProjectModal);
cancelEditModalBtn.addEventListener('click', closeEditProjectModal);

editProjectModal.addEventListener('click', (event) => {
  if (event.target === editProjectModal) closeEditProjectModal();
});

portfolioGroups.addEventListener('click', (event) => {
  // Open links inside status cells in a new tab
  const link = event.target.closest('.cell-scroll a');
  if (link && !link.dataset.editProject && !link.dataset.deleteProject) {
    event.preventDefault();
    window.open(link.href, '_blank', 'noopener,noreferrer');
    return;
  }
  const editButton = event.target.closest('[data-edit-project]');
  if (editButton) {
    openEditProjectModal(
      editButton.dataset.itemType || 'project',
      Number(editButton.dataset.editProject)
    );
    return;
  }
  const deleteButton = event.target.closest('[data-delete-project]');
  if (deleteButton) {
    openDeleteProjectModal(
      deleteButton.dataset.itemType || 'project',
      Number(deleteButton.dataset.deleteProject)
    );
  }
});

editProjectModal.addEventListener('click', (event) => {
  const toolbarButton = event.target.closest('[data-rich-command]');
  if (toolbarButton) {
    event.preventDefault();
    document.execCommand(toolbarButton.dataset.richCommand, false, null);
    editStatusEditor.focus();
    return;
  }
  const colorLabel = event.target.closest('.toolbar-color-btn');
  if (colorLabel) {
    editStatusEditor.focus();
  }
});

document.getElementById('editorColorPicker').addEventListener('change', (event) => {
  const color = event.target.value;
  document.getElementById('editorColorSwatch').style.background = color;
  document.execCommand('foreColor', false, color);
  editStatusEditor.focus();
});

document.getElementById('editorFontSize').addEventListener('change', (e) => {
  const size = e.target.value;
  if (!size) return;
  editStatusEditor.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;

  if (!sel.isCollapsed) {
    // Text selected — wrap it in a span with the chosen size
    const range = sel.getRangeAt(0);
    try {
      const frag = range.extractContents();
      const span = document.createElement('span');
      span.style.fontSize = size + 'pt';
      span.appendChild(frag);
      range.insertNode(span);
      sel.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.addRange(newRange);
    } catch {}
  } else {
    // No selection — insert a zero-width space span so future typing uses this size
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = size + 'pt';
    span.innerHTML = '​'; // zero-width space as anchor
    range.insertNode(span);
    // Place cursor inside the span after the zero-width space
    const newRange = document.createRange();
    newRange.setStart(span.firstChild, 1);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
  // Keep value visible
});

let _savedLinkSelection = null;
document.getElementById('editorInsertLink').addEventListener('click', () => {
  _savedLinkSelection = window.getSelection()?.getRangeAt(0)?.cloneRange() || null;
  const selectedText = window.getSelection()?.toString() || '';
  document.getElementById('editorLinkText').value = selectedText;
  document.getElementById('editorLinkUrl').value = '';
  const popup = document.getElementById('editorLinkPopup');
  popup.style.display = popup.style.display === 'flex' ? 'none' : 'flex';
  if (popup.style.display === 'flex') document.getElementById('editorLinkUrl').focus();
});

document.getElementById('editorLinkCancel').addEventListener('click', () => {
  document.getElementById('editorLinkPopup').style.display = 'none';
  editStatusEditor.focus();
});

document.getElementById('editorLinkInsert').addEventListener('click', () => {
  const url = document.getElementById('editorLinkUrl').value.trim();
  const text = document.getElementById('editorLinkText').value.trim() || url;
  if (!url) return;
  editStatusEditor.focus();
  if (_savedLinkSelection) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(_savedLinkSelection);
  }
  document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(text)}</a>`);
  document.getElementById('editorLinkPopup').style.display = 'none';
  _savedLinkSelection = null;
});

editStatusEditor.addEventListener('focus', () => {
  if (editStatusEditor.getAttribute('data-placeholder-active')) {
    editStatusEditor.innerHTML = '';
    editStatusEditor.removeAttribute('data-placeholder-active');
  }
});

editStatusEditor.addEventListener('blur', (e) => {
  // Don't trigger placeholder if focus moved to an element inside the edit modal
  if (e.relatedTarget && editProjectModal.contains(e.relatedTarget)) return;
  if (!editStatusEditor.textContent.trim() && !editStatusEditor.querySelector('img, br, li, div')) {
    editStatusEditor.innerHTML = '<span style="font-style:italic;opacity:0.5;">No Status Entered</span>';
    editStatusEditor.setAttribute('data-placeholder-active', '1');
  }
});


searchInput.addEventListener('input', renderTable);
pmFilter.addEventListener('change', renderTable);
healthFilter.addEventListener('change', renderTable);
progressFilter.addEventListener('change', renderTable);
duemonthFilter.addEventListener('change', renderTable);
regionFilter.addEventListener('change', renderAll);

editHealth.addEventListener('change', () => {
  pmStatusLabel.style.display = ['Yellow', 'Red'].includes(editHealth.value) ? '' : 'none';
  riskReasonLabel.style.display = '';
});

function generateHTMLReport() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2,'0');
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const yy = String(now.getFullYear()).slice(2);
  const hh = String(now.getHours()).padStart(2,'0');
  const min = String(now.getMinutes()).padStart(2,'0');
  const dateLabel = `${dd}/${mm}/${yy} ${hh}:${min}`;
  const filename = `dashboard-report-${dd}-${mm}-${yy}-${hh}-${min}.html`;

  // Strip inline color from <a> tags so report CSS controls link colors
  function cleanStatusHtml(html) {
    if (!html) return html;
    return html.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
      const cleaned = attrs.replace(/\bstyle="[^"]*"/gi, '');
      return `<a${cleaned}>`;
    });
  }

  const atRisk = projects.filter(p => Number(p.progress) >= 100)
    .sort((a, b) => Number(b.progress) - Number(a.progress));

  const healthAtRisk = projects.filter(p => p.health === 'Red' || p.health === 'Yellow')
    .sort((a, b) => {
      if (a.health === b.health) return 0;
      return a.health === 'Red' ? -1 : 1;
    });

  const backupNames = new Set((backups[0]?.projects || []).map(p => p.name));
  const newProjects = backups.length >= 1 ? projects.filter(p => !backupNames.has(p.name)) : [];

  const uniquePMs = [...new Set([...projects.map(p => p.manager), ...tasks.map(t => t.owner)].filter(Boolean))].sort();

  function healthPill(health, pmStatus) {
    const colors = {
      Green: 'background:rgba(74,222,128,0.16);color:#bbf7d0',
      Yellow: 'background:rgba(251,191,36,0.15);color:#fde68a',
      Red: 'background:rgba(220,38,38,0.22);color:#ef4444;border:1px solid rgba(220,38,38,0.4)',
    };
    const h = health || 'Green';
    const pill = `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:0.82rem;font-weight:700;${colors[h]||colors.Green}">${h}</span>`;
    return pill;
  }

  function progressBar(val, estimatedHours, remainingHours, actualHours, health, riskReason, nrr) {
    const v = Math.max(0, Math.round(Number(val)||0));
    const fill = v < 50 ? 'linear-gradient(90deg,#22c55e,#86efac)' : v <= 75 ? 'linear-gradient(90deg,#facc15,#fde68a)' : v <= 90 ? 'linear-gradient(90deg,#f97316,#fb923c)' : 'linear-gradient(90deg,#dc2626,#ef4444)';
    const color = v < 50 ? '#bbf7d0' : v <= 75 ? '#fde68a' : v <= 90 ? '#fdba74' : '#ef4444';
    const ack = riskReason;
    const blink = v >= 100 && !ack ? ' <span class="rpt-blink-wrap"><span style="animation:progress-blink 1s step-start infinite;color:#ef4444">⚠</span><span class="rpt-tooltip" style="color:#fde68a;width:200px">Edit the project and set over budget risk reason</span></span>' : (v >= 76 && v < 100 ? ' <span class="rpt-blink-wrap"><span style="animation:progress-blink 1s step-start infinite;color:#4ade80;font-weight:700;">$</span><span class="rpt-tooltip" style="color:#bbf7d0;width:260px">The allocated project hours are nearly exhausted. Please coordinate with the CSM to secure additional hours.</span></span>' : '');
    let tip = '';
    if (riskReason) tip = `Risk reason was set\n${riskReason}`;
    else if (v >= 100) tip = 'No more hours for the project';
    else if (estimatedHours != null && remainingHours != null) {
      const used = actualHours != null ? actualHours : (estimatedHours - remainingHours);
      tip = `${used} hours have been completed out of ${estimatedHours}, with ${remainingHours} hours remaining`;
    } else if (actualHours != null && estimatedHours != null) {
      tip = `${actualHours} hours have been completed out of ${estimatedHours}`;
    } else if (actualHours != null) {
      tip = actualHours === 0 ? 'No hours reported yet' : `${actualHours} hours reported`;
    }
    const hoursLabel = buildHoursLabel(actualHours, estimatedHours, nrr);
    const bar = `<div style="width:100%;background:#142033;border-radius:999px;overflow:hidden;height:8px;margin-bottom:4px"><div style="height:100%;border-radius:999px;width:${Math.min(v,100)}%;background:${fill}"></div></div><small style="color:${color};font-weight:700">${v}% &middot; ${hoursLabel}</small>`;
    const barWithTip = tip ? `<span class="rpt-progress-wrap">${bar}<span class="rpt-tooltip">${tip.replace(/\n/g,'<br>')}</span></span>` : bar;
    return barWithTip + blink;
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function rptAvatar(name) {
    const u = users.find(u => getUserDisplayName(u) === name);
    if (u?.avatarUrl) return `<img src="${esc(u.avatarUrl)}" alt="${esc(name)}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;margin-right:5px;vertical-align:middle;border:1px solid rgba(255,255,255,0.15);" onerror="this.style.display='none'">`;
    const initials = name.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:#334155;color:#94a3b8;font-size:9px;font-weight:600;margin-right:5px;vertical-align:middle;flex-shrink:0;">${esc(initials)}</span>`;
  }

  function pmCell(p) {
    const name = p.manager || '-';
    if (name === '-') return '-';
    return `<span style="display:inline-flex;align-items:center;">${rptAvatar(name)}${esc(name)}</span>`;
  }

  function custCell(p) {
    const link = p.accountUrl || (customers.find(c => c.name === p.customer)?.sfLink) || '';
    return link ? `<a href="${esc(link)}" target="_blank" style="color:#7dd3fc;">${esc(p.customer||'-')}</a>` : esc(p.customer||'-');
  }

  function oppCell(p) {
    const name = esc(p.name || p.parentProjectName || '-');
    return p.oppLink ? `<a href="${esc(p.oppLink)}" target="_blank" style="color:#7dd3fc;">${name}</a>` : `<strong>${name}</strong>`;
  }

  function jiraCell(p) {
    const jiraLabel = p.jira ? getJiraLabel(p.jira) : '';
    const atLabel = p.atLink ? 'AT' : '';
    const parts = [];
    if (jiraLabel) parts.push(`<a href="${esc(p.jira)}" target="_blank" style="color:#7dd3fc;">${esc(jiraLabel)}</a>`);
    if (atLabel) parts.push(`<a href="${esc(p.atLink)}" target="_blank" style="color:#a78bfa;">AT</a>`);
    return parts.join(' ') || '<span style="color:#64748b">—</span>';
  }

  const atRiskRows = atRisk.length
    ? atRisk.map(p => `<tr data-region="${esc(p.region||'')}">
        <td>${custCell(p)}</td>
        <td>${oppCell(p)}</td>
        <td>${jiraCell(p)}</td>
        <td>${pmCell(p)}</td>
        <td>${progressBar(p.progress, p.estimatedHours, p.remainingHours, p.actualHours, p.health, p.riskReason, p.nrr)}</td>
        <td style="color:#fde68a">${esc(p.riskReason||'No risk reason set')}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="color:#94a3b8;font-style:italic;">No over-budget projects.</td></tr>`;

  const healthRows = healthAtRisk.length
    ? healthAtRisk.map(p => `<tr data-region="${esc(p.region||'')}">
        <td>${custCell(p)}</td>
        <td>${oppCell(p)}</td>
        <td>${jiraCell(p)}</td>
        <td>${pmCell(p)}</td>
        <td>${healthPill(p.health, p.pmStatus)}</td>
        <td style="color:#cbd5e1;font-size:0.9rem;">${isEmptyStatus(p.pmStatus) ? '<em style="color:#64748b;">No status set by PM</em>' : cleanStatusHtml(p.pmStatus)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="color:#94a3b8;font-style:italic;">No projects with Yellow or Red health.</td></tr>`;

  const newRows = newProjects.length
    ? newProjects.map(p => `<tr data-region="${esc(p.region||'')}">
        <td>${custCell(p)}</td>
        <td>${oppCell(p)}</td>
        <td>${jiraCell(p)}</td>
        <td>${pmCell(p)}</td>
        <td>${esc(String(p.nrr||0))} hrs</td>
        <td>${esc(formatDate(p.startDate))}</td>
        <td>${esc(formatDate(p.dueDate))}</td>
        <td>${healthPill(p.health, p.pmStatus)}</td>
        <td>${progressBar(p.progress, p.estimatedHours, p.remainingHours, p.actualHours, p.health, p.riskReason, p.nrr)}</td>
        <td>${isEmptyStatus(p.statusText) ? STATUS_PLACEHOLDER : cleanStatusHtml(p.statusText)}</td>
        <td>${(p.comments||'').split(/, (?=NRR:|MRR:|CSM:|Sales:)/).map(esc).join('<br>')}</td>
      </tr>`).join('')
    : '';

  const allItems = [
    ...projects,
    ...tasks.map(t => ({ ...t, manager: t.owner, name: t.name || t.parentProjectName })),
  ];
  const grouped = allItems.reduce((acc, p) => {
    const key = p.manager || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const allProjectsRows = Object.keys(grouped).sort((a,b) => a.localeCompare(b)).map(manager => {
    const rows = grouped[manager].slice().sort((a, b) => {
      const ca = (a.customer || '').toLowerCase();
      const cb = (b.customer || '').toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return projects.indexOf(b) - projects.indexOf(a);
    }).map(p => `<tr data-pm="${esc(p.manager||'')}" data-health="${esc(p.health||'Green')}" data-progress="${Math.round(Number(p.progress)||0)}" data-region="${esc(p.region||'')}">
      <td>${custCell(p)}</td>
      <td>${oppCell(p)}</td>
      <td>${jiraCell(p)}</td>
      <td>${pmCell(p)}</td>
      <td>${esc(String(p.nrr||0))} hrs</td>
      <td>${esc(formatDate(p.startDate))}</td>
      <td>${esc(formatDate(p.dueDate))}</td>
      <td>${healthPill(p.health, p.pmStatus)}</td>
      <td>${progressBar(p.progress, p.estimatedHours, p.remainingHours, p.actualHours, p.health, p.riskReason, p.nrr)}</td>
      <td>${isEmptyStatus(p.statusText) ? STATUS_PLACEHOLDER : p.statusText}</td>
      <td>${(p.comments||'').split(/, (?=NRR:|MRR:|CSM:|Sales:)/).map(esc).join('<br>')}</td>
    </tr>`).join('');
    const projCount = grouped[manager].filter(p => p.type !== 'task').length;
    const taskCount = grouped[manager].filter(p => p.type === 'task').length;
    const countLabel = `(Number Of Projects: ${projCount}${taskCount ? ` · ${taskCount} task${taskCount > 1 ? 's' : ''}` : ''})`;
    const avatarHtml = (() => {
      const u = users.find(u => getUserDisplayName(u) === manager);
      if (u?.avatarUrl) return `<img src="${esc(u.avatarUrl)}" alt="${esc(manager)}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;margin-right:6px;vertical-align:middle;border:1px solid rgba(255,255,255,0.15);" onerror="this.style.display='none'">`;
      const initials = manager.split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
      return `<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#334155;color:#94a3b8;font-size:10px;font-weight:600;margin-right:6px;vertical-align:middle;flex-shrink:0;">${esc(initials)}</span>`;
    })();
    return `
    <div style="margin-bottom:18px;">
      <div style="color:#7dd3fc;font-weight:700;font-size:0.95rem;padding:8px 0 6px;display:flex;align-items:center;">
        ${avatarHtml}${esc(manager)} <span style="font-weight:400;font-size:0.85rem;color:#bfdbfe;margin-left:6px;">${countLabel}</span>
      </div>
      <table style="table-layout:fixed;width:100%;border-collapse:collapse;">
        <colgroup>
          <col style="width:8%"><col style="width:12%"><col style="width:7%"><col style="width:7%"><col style="width:5%"><col style="width:6%"><col style="width:6%">
          <col style="width:7%"><col style="width:7%"><col style="width:18%"><col style="width:13%">
        </colgroup>
        <thead><tr style="border-bottom:1px solid #223249;">
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Customer</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Opportunity</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Jira/AT</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">PM</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">NRR(h)</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Start</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">End</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Project Health</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Project Budget</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Project Status</th>
          <th style="text-align:left;padding:6px 8px;color:#bfdbfe;font-size:0.85rem;">Manager Notes</th>
        </tr></thead>
        <tbody class="pm-group-body">${rows}</tbody>
      </table>
    </div>`;
  }).join('');

  const pmOptions = uniquePMs.map(pm => `<option value="${esc(pm)}">${esc(pm)}</option>`).join('');

  const newSection = newProjects.length && backups.length >= 1 ? `
    <section style="margin-bottom:32px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h2 style="font-size:1.1rem;color:#7dd3fc;margin:0">Newly Added Projects</h2>
        <select onchange="changePageSize(this)" style="background:#0b1220;color:#eff6ff;border:1px solid #223249;border-radius:8px;padding:5px 10px;font-size:0.85rem;cursor:pointer;">
          <option value="5">Show 5</option><option value="10">Show 10</option>
        </select>
      </div>
      <div class="paginated-section" data-page="0" data-page-size="5">
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <colgroup>
          <col style="width:8%"><col style="width:12%"><col style="width:7%"><col style="width:7%"><col style="width:5%"><col style="width:6%"><col style="width:6%">
          <col style="width:7%"><col style="width:7%"><col style="width:18%"><col style="width:13%">
        </colgroup>
        <thead><tr>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Customer</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Opportunity</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Jira/AT</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">PM</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">NRR(h)</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Start</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">End</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Project Health</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Project Budget</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Project Status</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Manager Notes</th>
        </tr></thead>
        <tbody>${newRows}</tbody>
      </table>
      <div class="pager"></div>
      </div>
    </section>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<base target="_blank">
<title>Project Manager Dashboard — Status Report</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif;background:#07111f;color:#eff6ff;padding:32px}
a,a:visited{color:#7dd3fc !important;text-decoration:none}a:hover{text-decoration:underline}
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
.rpt-health-wrap,.rpt-progress-wrap,.rpt-blink-wrap{position:relative;display:inline-block}
.rpt-tooltip{display:none;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:#111c30;border:1px solid #223249;border-radius:8px;padding:6px 10px;font-size:0.8rem;white-space:normal;width:220px;z-index:100;pointer-events:none;box-shadow:0 4px 12px rgba(2,6,23,.5)}
.rpt-health-wrap:hover .rpt-tooltip,.rpt-progress-wrap:hover .rpt-tooltip,.rpt-blink-wrap:hover .rpt-tooltip{display:block}
@keyframes progress-blink{0%,100%{opacity:1}50%{opacity:0}}
@media print{.filter-bar,.toggle-btn,.pager,select{display:none!important}#allTable{display:block!important}.paginated-section tbody tr{display:table-row!important}}
.pager{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px;font-size:0.88rem;color:#bfdbfe}
.pager button{background:rgba(15,23,42,.95);border:1px solid #223249;border-radius:8px;padding:5px 12px;color:#eff6ff;cursor:pointer;font-size:0.85rem}
.pager button:hover{background:rgba(30,41,59,.95)}
.pager button:disabled{opacity:0.35;cursor:default}
</style>
</head>
<body>
<p class="eyebrow">Executive View</p>
<h1>Project Manager Dashboard — Status Report</h1>
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

${(() => {
  const totalNrr = projects.reduce((s, p) => s + (Number(p.nrrUsd) || 0), 0);
  const totalMrr = projects.reduce((s, p) => s + (Number(p.mrrUsd) || 0), 0);
  const newNrr = newProjects.reduce((s, p) => s + (Number(p.nrrUsd) || 0), 0);
  const newMrr = newProjects.reduce((s, p) => s + (Number(p.mrrUsd) || 0), 0);
  const hGreen  = projects.filter(p => (p.health || 'Green') === 'Green').length;
  const hYellow = projects.filter(p => p.health === 'Yellow').length;
  const hRed    = projects.filter(p => p.health === 'Red').length;
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
  return `<div class="stats" id="rptStats" ${regionDataAttr}>
  <div class="stat" style="border-top:4px solid #38bdf8">
    <p>Total Projects</p>
    <h3 id="rptTotal" data-orig="${projects.length}">${projects.length}</h3>
  </div>
  <div class="stat" style="border-top:4px solid #a78bfa">
    <p>Total MRR/NRR</p>
    <div style="font-size:0.95rem;margin-top:4px;line-height:1.8;">
      <div>MRR: <strong id="rptMrr" data-orig="${formatCurrency(totalMrr)}">${formatCurrency(totalMrr)}</strong></div>
      <div>NRR: <strong id="rptNrr" data-orig="${formatCurrency(totalNrr)}">${formatCurrency(totalNrr)}</strong></div>
    </div>
  </div>
  <div class="stat" style="border-top:4px solid #4ade80">
    <p>Project Health</p>
    <div style="font-size:0.9rem;margin-top:4px;line-height:1.8;">
      <div>🟢 <span id="rptHGreen" data-orig="${hGreen}">${hGreen}</span> Green</div>
      <div>🟡 <span id="rptHYellow" data-orig="${hYellow}">${hYellow}</span> Yellow</div>
      <div>🔴 <span id="rptHRed" data-orig="${hRed}">${hRed}</span> Red</div>
    </div>
  </div>
  <div class="stat" style="border-top:4px solid ${atRisk.length > 0 ? '#f97316' : '#4ade80'}">
    <p>Over Budget Projects</p>
    <h3 id="rptAtRisk" data-orig="${atRisk.length}" style="color:${atRisk.length > 0 ? '#f97316' : '#eff6ff'}">${atRisk.length}</h3>
  </div>
  <div class="stat" style="border-top:4px solid #38bdf8">
    <p>Newly Added Projects</p>
    <h3 id="rptNewCount" data-orig="${newProjects.length}">${newProjects.length}</h3>
    ${backups[0]?.timestamp ? `<p style="margin:4px 0 0;font-size:0.78rem;color:#64748b">since ${(() => { const d=new Date(backups[0].timestamp); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2); })()}</p>` : ''}
  </div>
  <div class="stat" style="border-top:4px solid #a78bfa">
    <p>Added MRR/NRR</p>
    <div style="font-size:0.95rem;margin-top:4px;line-height:1.8;">
      <div>MRR: <strong id="rptNewMrr" data-orig="${formatCurrency(newMrr)}">${formatCurrency(newMrr)}</strong></div>
      <div>NRR: <strong id="rptNewNrr" data-orig="${formatCurrency(newNrr)}">${formatCurrency(newNrr)}</strong></div>
    </div>
    ${backups[0]?.timestamp ? `<p style="margin:4px 0 0;font-size:0.78rem;color:#64748b">since ${(() => { const d=new Date(backups[0].timestamp); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2); })()}</p>` : ''}
  </div>
</div>`;
})()}

<section>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <h2 style="margin:0">Over Budget Projects</h2>
    <select onchange="changePageSize(this)" style="background:#0b1220;color:#eff6ff;border:1px solid #223249;border-radius:8px;padding:5px 10px;font-size:0.85rem;cursor:pointer;">
      <option value="5">Show 5</option><option value="10">Show 10</option>
    </select>
  </div>
  <div class="paginated-section" data-page="0" data-page-size="5">
    <table style="table-layout:fixed;width:100%">
      <colgroup><col style="width:14%"><col style="width:18%"><col style="width:10%"><col style="width:10%"><col style="width:18%"><col style="width:30%"></colgroup>
      <thead><tr>
        <th>Customer</th><th>Opportunity</th><th>Jira/AT</th><th>PM</th><th>Project Budget</th><th>Risk Reason (Budget)</th>
      </tr></thead>
      <tbody>${atRiskRows}</tbody>
    </table>
    <div class="pager"></div>
  </div>

  <div style="border-top:1px solid #223249;margin:24px 0 14px;"></div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <h2 style="margin:0">Project Health</h2>
    <select onchange="changePageSize(this)" style="background:#0b1220;color:#eff6ff;border:1px solid #223249;border-radius:8px;padding:5px 10px;font-size:0.85rem;cursor:pointer;">
      <option value="5">Show 5</option><option value="10">Show 10</option>
    </select>
  </div>
  <div class="paginated-section" data-page="0" data-page-size="5">
    <table style="table-layout:fixed;width:100%">
      <colgroup><col style="width:14%"><col style="width:18%"><col style="width:10%"><col style="width:10%"><col style="width:10%"><col style="width:38%"></colgroup>
      <thead><tr>
        <th>Customer</th><th>Opportunity</th><th>Jira/AT</th><th>PM</th><th>Project Health</th><th>Project Status by PM</th>
      </tr></thead>
      <tbody>${healthRows}</tbody>
    </table>
    <div class="pager"></div>
  </div>
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
      <option value="">All Project Budget</option>
      <option value="0-39">0–39%</option>
      <option value="40-69">40–69%</option>
      <option value="70-100">70–100%</option>
    </select>
  </div>
  <button class="toggle-btn" onclick="toggleAll(this)">▶ Show all projects (${projects.length})</button>
  <div id="allTable">
    ${allProjectsRows}
  </div>
</section>

<script>
function toggleAll(btn){
  const t=document.getElementById('allTable');
  const open=t.style.display==='block';
  t.style.display=open?'none':'block';
  btn.textContent=open?'▶ Show all projects (${projects.length})':'▼ Hide all projects';
}
function renderPager(section) {
  // Only paginate rows not hidden by the region filter (class region-hidden)
  const rows = Array.from(section.querySelectorAll('tbody tr')).filter(r => !r.classList.contains('region-hidden'));
  const pageSize = parseInt(section.dataset.pageSize) || 5;
  const page = parseInt(section.dataset.page) || 0;
  const total = rows.length;
  const pages = Math.ceil(total / pageSize);
  rows.forEach((r, i) => { r.style.display = (i >= page * pageSize && i < (page + 1) * pageSize) ? '' : 'none'; });
  const pager = section.querySelector('.pager');
  if (!pager) return;
  if (pages <= 1) { pager.innerHTML = ''; return; }
  pager.innerHTML = '<button onclick="goPage(this,-1)"' + (page===0?' disabled':'') + '>← Prev</button>'
    + '<span>Page ' + (page+1) + ' of ' + pages + '</span>'
    + '<button onclick="goPage(this,1)"' + (page>=pages-1?' disabled':'') + '>Next →</button>';
}
function goPage(btn, dir) {
  const section = btn.closest('.paginated-section');
  const eligibleRows = Array.from(section.querySelectorAll('tbody tr')).filter(r => !r.classList.contains('region-hidden'));
  const pages = Math.ceil(eligibleRows.length / (parseInt(section.dataset.pageSize)||5));
  section.dataset.page = Math.max(0, Math.min(pages-1, (parseInt(section.dataset.page)||0) + dir));
  renderPager(section);
}
function changePageSize(sel) {
  const section = sel.closest('section').querySelector('.paginated-section');
  section.dataset.pageSize = sel.value;
  section.dataset.page = 0;
  renderPager(section);
}
function initPaginators() {
  document.querySelectorAll('.paginated-section').forEach(s => renderPager(s));
}
window.addEventListener('DOMContentLoaded', initPaginators);

function applyFilters(){
  const pm=document.getElementById('rPmFilter').value;
  const health=document.getElementById('rHealthFilter').value;
  const prog=document.getElementById('rProgressFilter').value;
  const region=document.getElementById('rRegionFilter').value;
  if(pm||health||prog){
    const t=document.getElementById('allTable');
    if(t.style.display!=='block'){
      t.style.display='block';
      const btn=document.querySelector('.toggle-btn');
      if(btn) btn.textContent='▼ Hide all projects';
    }
  }
  document.querySelectorAll('#allTable tbody.pm-group-body').forEach(tbody=>{
    let anyVisible=false;
    tbody.querySelectorAll('tr[data-pm]').forEach(row=>{
      const rPm=row.dataset.pm;
      const rHealth=row.dataset.health;
      const rProg=Number(row.dataset.progress);
      let show=true;
      if(pm && rPm!==pm) show=false;
      if(health && rHealth!==health) show=false;
      if(prog==='0-39' && rProg>=40) show=false;
      if(prog==='40-69' && (rProg<40||rProg>=70)) show=false;
      if(prog==='70-100' && rProg<70) show=false;
      if(region && row.dataset.region!==region) show=false;
      if(row.classList.contains('region-hidden')) show=false;
      row.style.display=show?'':'none';
      if(show) anyVisible=true;
    });
    // Hide the entire group div (parent of the table) when no rows are visible
    const groupDiv = tbody.closest('div[style*="margin-bottom"]');
    if(groupDiv) groupDiv.style.display=anyVisible?'':'none';
  });
}
function applyRegionFilter() {
  const region = document.getElementById('rRegionFilter').value;
  // Mark non-matching rows with region-hidden class (not inline style) so
  // renderPager can distinguish region filtering from pagination hiding.
  document.querySelectorAll('tr[data-region]').forEach(row => {
    if (!region || row.dataset.region === region) {
      row.classList.remove('region-hidden');
    } else {
      row.classList.add('region-hidden');
      row.style.display = 'none';
    }
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
  // Reset pagination so page windows respect the new filter, then re-apply
  // PM/health/progress filters on top of the region selection.
  initPaginators();
  applyFilters();
}
function formatCurrencyRpt(v) {
  if (!v) return '$0';
  if (v >= 1000000) return '$' + (v/1000000).toFixed(1) + 'M';
  if (v >= 1000) return '$' + (v/1000).toFixed(1) + 'K';
  return '$' + Math.round(v);
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

const exportChoiceModal = document.getElementById('exportChoiceModal');
const exportOnlyBtn = document.getElementById('exportOnlyBtn');
const exportAndBackupBtn = document.getElementById('exportAndBackupBtn');
const exportCancelBtn = document.getElementById('exportCancelBtn');

exportBtn.addEventListener('click', () => {
  exportChoiceModal.classList.remove('hidden');
  exportChoiceModal.setAttribute('aria-hidden', 'false');
});
exportChoiceModal.addEventListener('click', (e) => {
  if (e.target === exportChoiceModal) {
    exportChoiceModal.classList.add('hidden');
    exportChoiceModal.setAttribute('aria-hidden', 'true');
  }
});
exportOnlyBtn.addEventListener('click', () => {
  exportChoiceModal.classList.add('hidden');
  exportChoiceModal.setAttribute('aria-hidden', 'true');
  generateHTMLReport();
});
exportAndBackupBtn.addEventListener('click', () => {
  exportChoiceModal.classList.add('hidden');
  exportChoiceModal.setAttribute('aria-hidden', 'true');
  generateHTMLReport();
  createBackup(createBackupBtn);
});
exportCancelBtn.addEventListener('click', () => {
  exportChoiceModal.classList.add('hidden');
  exportChoiceModal.setAttribute('aria-hidden', 'true');
});

manageUsersBtn.addEventListener('click', openUsersModal);
closeUsersModalBtn.addEventListener('click', closeUsersModal);
usersModal.addEventListener('click', (e) => { if (e.target === usersModal) closeUsersModal(); });
document.getElementById('usersSearchInput').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  usersModalBody.querySelectorAll('.user-row').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
});

addUserBtn.addEventListener('click', () => {
  addUserForm.style.display = 'grid';
  addUserBtn.style.display = 'none';
  document.getElementById('newUserJiraSearch').value = '';
  document.getElementById('newUserJiraAccountId').value = '';
  document.getElementById('newUserJiraResults').classList.add('hidden');
});

// Jira user search autocomplete in Add User form
let _addUserSearchTimer = null;
document.getElementById('newUserJiraSearch').addEventListener('input', (e) => {
  clearTimeout(_addUserSearchTimer);
  const q = e.target.value.trim();
  const results = document.getElementById('newUserJiraResults');
  if (q.length < 2) { results.classList.add('hidden'); return; }
  _addUserSearchTimer = setTimeout(async () => {
    try {
      const res = await fetch(`${PROXY_BASE}/jira/user/search?query=${encodeURIComponent(q)}`, {
        headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
      });
      if (!res.ok) return;
      const jiraUsers = await res.json();
      if (!jiraUsers.length) { results.innerHTML = '<li style="padding:8px 14px;color:#64748b;">No users found</li>'; results.classList.remove('hidden'); return; }
      results.innerHTML = jiraUsers.map(u => `
        <li data-account-id="${escapeHtml(u.accountId)}" data-display-name="${escapeHtml(u.displayName)}" data-email="${escapeHtml(u.emailAddress||'')}" style="padding:8px 14px;cursor:pointer;">
          <span style="font-weight:600;color:#eff6ff;">${escapeHtml(u.displayName)}</span>
          <span style="color:#64748b;font-size:0.85rem;margin-left:6px;">${escapeHtml(u.emailAddress||'')}</span>
        </li>`).join('');
      results.classList.remove('hidden');
    } catch {}
  }, 300);
});

document.getElementById('newUserJiraResults').addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-account-id]');
  if (!li) return;
  e.preventDefault();
  const displayName = li.getAttribute('data-display-name');
  const parts = displayName.trim().split(/\s+/);
  document.getElementById('newUserFirstName').value = parts[0] || '';
  document.getElementById('newUserLastName').value = parts.slice(1).join(' ') || '';
  document.getElementById('newUserJiraAccountId').value = li.getAttribute('data-account-id');
  document.getElementById('newUserJiraSearch').value = displayName;
  document.getElementById('newUserJiraResults').classList.add('hidden');
});

// Sync Jira Account IDs for all existing users
document.getElementById('syncUsersFromJiraBtn').addEventListener('click', async () => {
  const btn = document.getElementById('syncUsersFromJiraBtn');
  btn.textContent = '↻ Syncing...';
  btn.disabled = true;
  let updated = 0;
  for (const user of users) {
    if (user.jiraAccountId) continue;
    const displayName = getUserDisplayName(user);
    const accountId = await getOrFetchJiraAccountId(displayName);
    if (accountId) updated++;
  }
  await fetchAndStoreAvatars();
  await saveUsers();
  btn.textContent = '↻ Sync Jira IDs';
  btn.disabled = false;
  renderUsersModal();
  showToast(`Synced Jira IDs for ${updated} user${updated !== 1 ? 's' : ''}`, 'success');
});

function resetAddUserForm() {
  document.getElementById('newUserJiraSearch').value = '';
  document.getElementById('newUserJiraAccountId').value = '';
  document.getElementById('newUserJiraResults').classList.add('hidden');
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRolePM').checked = false;
  document.getElementById('newUserRoleCSM').checked = false;
  document.getElementById('newUserRoleSales').checked = false;
  document.getElementById('newUserRoleIE').checked = false;
}

cancelAddUserBtn.addEventListener('click', () => {
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  resetAddUserForm();
});

saveAddUserBtn.addEventListener('click', () => {
  const firstName = document.getElementById('newUserFirstName').value.trim();
  const lastName = document.getElementById('newUserLastName').value.trim();
  const roles = ['PM', 'CSM', 'Sales', 'IE'].filter(r => document.getElementById(`newUserRole${r}`).checked);
  if (!firstName || !lastName) return;
  if (!roles.length) { alert('Please select at least one role.'); return; }

  const displayName = `${firstName} ${lastName}`.trim();
  const existingUser = users.find(u => getUserDisplayName(u) === displayName);
  if (existingUser) {
    const existingRoles = getUserRoles(existingUser);
    const merged = [...new Set([...existingRoles, ...roles])];
    existingUser.roles = merged;
  } else {
    const jiraAccountId = document.getElementById('newUserJiraAccountId').value.trim() || null;
    users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, roles, jiraAccountId });
  }
  saveUsers();
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  resetAddUserForm();
  renderUsersModal();

  if (addUserReturnContext) {
    const { inputEl, sourceModal } = addUserReturnContext;
    inputEl.value = `${firstName} ${lastName}`.trim();
    addUserReturnContext = null;
    usersModal.classList.add('hidden');
    usersModal.setAttribute('aria-hidden', 'true');
    const src = sourceModal || projectModal;
    src.classList.remove('hidden');
    src.setAttribute('aria-hidden', 'false');
  }
});

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
      <div class="user-row-edit" data-editing-id="${escapeHtml(userId)}">
        <label style="grid-column:1">First name<input type="text" class="edit-first" value="${escapeHtml(user.firstName)}" /></label>
        <label style="grid-column:2">Last name<input type="text" class="edit-last" value="${escapeHtml(user.lastName)}" /></label>
        <label style="grid-column:1/3">Roles
          <div style="display:flex;gap:14px;margin-top:4px;">
            <label style="display:flex;align-items:center;gap:4px;color:#dbeafe;font-size:0.9rem;"><input type="checkbox" class="edit-role-cb" value="PM" ${getUserRoles(user).includes('PM') ? 'checked' : ''}> PM</label>
            <label style="display:flex;align-items:center;gap:4px;color:#dbeafe;font-size:0.9rem;"><input type="checkbox" class="edit-role-cb" value="CSM" ${getUserRoles(user).includes('CSM') ? 'checked' : ''}> CSM</label>
            <label style="display:flex;align-items:center;gap:4px;color:#dbeafe;font-size:0.9rem;"><input type="checkbox" class="edit-role-cb" value="Sales" ${getUserRoles(user).includes('Sales') ? 'checked' : ''}> Sales</label>
            <label style="display:flex;align-items:center;gap:4px;color:#dbeafe;font-size:0.9rem;"><input type="checkbox" class="edit-role-cb" value="IE" ${getUserRoles(user).includes('IE') ? 'checked' : ''}> IE</label>
          </div>
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
    const newRoles = [...editingRow.querySelectorAll('.edit-role-cb:checked')].map(cb => cb.value);
    if (newRoles.length) user.roles = newRoles;
    const newName = getUserDisplayName(user);

    propagateUserRename(oldName, newName);
    saveUsers();
    saveProjects();
    renderAll();
    renderUsersModal();
  }
});

createBackupBtn.addEventListener('click', () => createBackup(createBackupBtn));
backupsPanelBtn.addEventListener('click', openBackupsModal);
closeBackupsModalBtn.addEventListener('click', closeBackupsModal);
backupsModal.addEventListener('click', (e) => { if (e.target === backupsModal) closeBackupsModal(); });

backupSidebar.addEventListener('click', (e) => {
  const entry = e.target.closest('[data-backup-id]');
  if (!entry) return;
  selectedBackupId = entry.dataset.backupId;
  renderBackupsPanel();
});

const atRiskCard = document.getElementById('atRiskCard');
const atRiskPopup = document.getElementById('atRiskPopup');
const atRiskTrigger = document.getElementById('atRiskTrigger');

let atRiskHideTimer = null;

function showAtRiskPopup() {
  clearTimeout(atRiskHideTimer);
  const atRiskProjects = projects.filter(p => Number(p.progress) >= 100);
  if (!atRiskProjects.length) return;
  atRiskPopup.innerHTML = atRiskProjects.map((p, i) =>
    `<a href="#" data-scroll-project="${escapeHtml(p.name)}">${i + 1}. ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name)}</a>`
  ).join('');
  atRiskPopup.classList.remove('hidden');
}

function hideAtRiskPopup() {
  atRiskHideTimer = setTimeout(() => atRiskPopup.classList.add('hidden'), 600);
}

atRiskTrigger.addEventListener('mouseenter', showAtRiskPopup);
atRiskTrigger.addEventListener('mouseleave', hideAtRiskPopup);
atRiskPopup.addEventListener('mouseenter', () => clearTimeout(atRiskHideTimer));
atRiskPopup.addEventListener('mouseleave', hideAtRiskPopup);

atRiskPopup.addEventListener('click', (e) => {
  const link = e.target.closest('[data-scroll-project]');
  if (!link) return;
  e.preventDefault();
  const projectName = link.dataset.scrollProject;
  const rows = portfolioGroups.querySelectorAll('tr');
  for (const row of rows) {
    const nameCell = row.querySelector('td:nth-child(2)');
    if (nameCell && (nameCell.textContent.trim() === projectName || nameCell.querySelector('a')?.textContent.trim() === projectName)) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.outline = '2px solid rgba(56,189,248,0.6)';
      setTimeout(() => { row.style.outline = ''; }, 2000);
      break;
    }
  }
  atRiskPopup.classList.add('hidden');
});

// Health Yellow/Red popups
const healthPopups = [];
function makeHealthPopup(triggerId, popupId, healthValue) {
  const trigger = document.getElementById(triggerId);
  const popup = document.getElementById(popupId);
  if (!trigger || !popup) return;
  let hideTimer = null;
  healthPopups.push({ popup, hideTimer: () => hideTimer, setHideTimer: (t) => { hideTimer = t; } });
  function showPopup() {
    clearTimeout(hideTimer);
    // Hide all other health popups immediately
    healthPopups.forEach(hp => { if (hp.popup !== popup) hp.popup.classList.add('hidden'); });
    const filtered = projects.filter(p => p.health === healthValue);
    if (!filtered.length) return;
    popup.innerHTML = filtered.map((p, i) =>
      `<a href="#" data-scroll-project="${escapeHtml(p.name)}">${i + 1}. ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name)}</a>`
    ).join('');
    popup.classList.remove('hidden');
  }
  function hidePopup() {
    hideTimer = setTimeout(() => popup.classList.add('hidden'), 600);
  }
  trigger.addEventListener('mouseenter', showPopup);
  trigger.addEventListener('mouseleave', hidePopup);
  popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  popup.addEventListener('mouseleave', hidePopup);
  popup.addEventListener('click', (e) => {
    const link = e.target.closest('[data-scroll-project]');
    if (!link) return;
    e.preventDefault();
    const projectName = link.dataset.scrollProject;
    const rows = portfolioGroups.querySelectorAll('tr');
    for (const row of rows) {
      const nameCell = row.querySelector('td:nth-child(2)');
      if (nameCell && (nameCell.textContent.trim() === projectName || nameCell.querySelector('a')?.textContent.trim() === projectName)) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.outline = '2px solid rgba(56,189,248,0.6)';
        setTimeout(() => { row.style.outline = ''; }, 2000);
        break;
      }
    }
    popup.classList.add('hidden');
  });
}
makeHealthPopup('healthYellowTrigger', 'healthYellowPopup', 'Yellow');
makeHealthPopup('healthRedTrigger', 'healthRedPopup', 'Red');

const dueThisMonthTrigger = document.getElementById('dueThisMonthTrigger');
const dueThisMonthPopup = document.getElementById('dueThisMonthPopup');

let dueThisMonthHideTimer = null;

function showDueThisMonthPopup() {
  clearTimeout(dueThisMonthHideTimer);
  const due = getDueThisMonthProjects();
  if (!due.length) return;
  dueThisMonthPopup.innerHTML = due.map((p, i) =>
    `<a href="#" data-scroll-project="${escapeHtml(p.name)}">${i + 1}. ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name)}</a>`
  ).join('');
  dueThisMonthPopup.classList.remove('hidden');
}

function hideDueThisMonthPopup() {
  dueThisMonthHideTimer = setTimeout(() => dueThisMonthPopup.classList.add('hidden'), 600);
}

dueThisMonthTrigger.addEventListener('mouseenter', showDueThisMonthPopup);
dueThisMonthTrigger.addEventListener('mouseleave', hideDueThisMonthPopup);
dueThisMonthPopup.addEventListener('mouseenter', () => clearTimeout(dueThisMonthHideTimer));
dueThisMonthPopup.addEventListener('mouseleave', hideDueThisMonthPopup);

dueThisMonthPopup.addEventListener('click', (e) => {
  const link = e.target.closest('[data-scroll-project]');
  if (!link) return;
  e.preventDefault();
  const projectName = link.dataset.scrollProject;
  dueThisMonthPopup.classList.add('hidden');
  const rows = document.querySelectorAll('#portfolioGroups tr[data-project-name]');
  for (const row of rows) {
    if (row.dataset.projectName === projectName) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.outline = '2px solid #a78bfa';
      setTimeout(() => { row.style.outline = ''; }, 2000);
      break;
    }
  }
});

function getDueThisMonthProjects() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const endOfMonth = `${currentMonth}-31`;
  const selectedRegion = regionFilter ? regionFilter.value : '';
  return projects.filter((p) =>
    p.dueDate && p.dueDate <= endOfMonth && p.status !== 'Completed' &&
    (!selectedRegion || p.region === selectedRegion)
  );
}

function buildDueMonthHtml() {
  const due = getDueThisMonthProjects().slice().sort((a, b) => (a.manager || '').localeCompare(b.manager || ''));
  const thStyle = 'padding:8px 12px;border:1px solid #ccc;background:#f0f0f0;font-weight:600;text-align:left;';
  const tdStyle = 'padding:8px 12px;border:1px solid #ccc;';
  const headers = ['#', 'PM', 'Customer', 'Jira', 'PM Comments', 'Manager Comments'];
  const headerRow = headers.map(h => `<th style="${thStyle}">${h}</th>`).join('');
  const dataRows = due.map((p, i) => {
    const jiraKey = getJiraLabel(p.jira);
    const jiraCell = p.jira ? `<a href="${escapeHtml(p.jira)}">${escapeHtml(jiraKey)}</a>` : '-';
    return `<tr>
      <td style="${tdStyle};color:#888;text-align:center;width:30px;">${i + 1}</td>
      <td style="${tdStyle}">${escapeHtml(p.manager || '-')}</td>
      <td style="${tdStyle}">${escapeHtml(p.customer || '-')}</td>
      <td style="${tdStyle}">${jiraCell}</td>
      <td style="${tdStyle}"></td>
      <td style="${tdStyle}"></td>
    </tr>`;
  }).join('');
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
  <thead><tr>${headerRow}</tr></thead>
  <tbody>${dataRows}</tbody>
</table>`;
}

function buildDueMonthPlainText() {
  const due = getDueThisMonthProjects().slice().sort((a, b) => (a.manager || '').localeCompare(b.manager || ''));
  const header = '#\tPM\tCustomer\tJira\tPM Comments\tManager Comments';
  const rows = due.map((p, i) => `${i + 1}\t${p.manager || ''}\t${p.customer || ''}\t${getJiraLabel(p.jira) || ''}\t\t`);
  return [header, ...rows].join('\n');
}

const mailDueMonthBtn = document.getElementById('mailDueMonthBtn');

mailDueMonthBtn.addEventListener('click', () => {
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const subject = `Projects Due Completion This Month – ${monthLabel}`;
  const html = buildDueMonthHtml();
  const plain = buildDueMonthPlainText();
  navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob([html], { type: 'text/html' }),
    'text/plain': new Blob([plain], { type: 'text/plain' }),
  })]).then(() => {
    window.location.href = `mailto:emea.pm@kaltura.com?subject=${encodeURIComponent(subject)}`;
    mailDueMonthBtn.textContent = '✓';
    setTimeout(() => { mailDueMonthBtn.textContent = '✉'; }, 2000);
  });
});

cancelDeleteProjectBtn.addEventListener('click', closeDeleteProjectModal);
deleteProjectModal.addEventListener('click', (e) => { if (e.target === deleteProjectModal) closeDeleteProjectModal(); });

deleteProjectBtn.addEventListener('click', async () => {
  if (deleteProjectIndex < 0) return;
  const itemType = deleteProjectModal.dataset.itemType || 'project';
  if (itemType === 'task') {
    const deletedId = tasks[deleteProjectIndex]?.id;
    tasks.splice(deleteProjectIndex, 1);
    if (deletedId) addPendingDelete(deletedId, TASKS_KEY);
    await saveTasks();
  } else {
    const deletedKey = getItemDeleteKey(projects[deleteProjectIndex] || {});
    projects.splice(deleteProjectIndex, 1);
    if (deletedKey) addPendingDelete(deletedKey, STORAGE_KEY);
    await saveProjects();
  }
  renderAll();
  closeDeleteProjectModal();
});

backupAndDeleteProjectBtn.addEventListener('click', async () => {
  if (deleteProjectIndex < 0) return;
  if (!backups.length) {
    alert('No backup exists yet. Please create a backup first before deleting.');
    return;
  }
  const itemType = deleteProjectModal.dataset.itemType || 'project';
  const item = itemType === 'task' ? tasks[deleteProjectIndex] : projects[deleteProjectIndex];
  const latestBackup = backups[0];
  const existingIndex = latestBackup.projects.findIndex(p => p.name === (item.name || item.parentProjectName));
  if (existingIndex >= 0) {
    latestBackup.projects[existingIndex] = JSON.parse(JSON.stringify(item));
  } else {
    latestBackup.projects.push(JSON.parse(JSON.stringify(item)));
  }
  await saveBackups();
  if (itemType === 'task') {
    const deletedId = tasks[deleteProjectIndex]?.id;
    tasks.splice(deleteProjectIndex, 1);
    if (deletedId) addPendingDelete(deletedId, TASKS_KEY);
    await saveTasks();
  } else {
    const deletedKey = getItemDeleteKey(projects[deleteProjectIndex] || {});
    projects.splice(deleteProjectIndex, 1);
    if (deletedKey) addPendingDelete(deletedKey, STORAGE_KEY);
    await saveProjects();
  }
  renderAll();
  closeDeleteProjectModal();
});

function positionTooltip(container, e) {
  const wrap = e.target.closest('.health-wrap') || e.target.closest('.progress-wrap') || e.target.closest('.progress-blink-wrap');
  if (!wrap) return;
  const tooltip = wrap.querySelector('.health-tooltip') || wrap.querySelector('.progress-tooltip') || wrap.querySelector('.progress-blink-tip');
  if (!tooltip) return;
  tooltip.style.left = (e.clientX + 12) + 'px';
  tooltip.style.top = (e.clientY - tooltip.offsetHeight - 8) + 'px';
}

portfolioGroups.addEventListener('mousemove', (e) => positionTooltip(portfolioGroups, e));
backupMain.addEventListener('mousemove', (e) => positionTooltip(backupMain, e));

// ── Jira Import ──────────────────────────────────────────────────────────────

let importDebounceTimer = null;
let importSelectedPm = null; // { accountId, displayName }
let importFetchedIssues = []; // raw Jira issue objects

function openImportModal() {
  clearTimeout(importDebounceTimer);
  importPmSearch.value = '';
  importPmResults.classList.add('hidden');
  importPmStatus.textContent = '';
  importStep1.classList.remove('hidden');
  importStep2.classList.add('hidden');
  importProjectList.innerHTML = '';
  importStep2Header.textContent = '';
  importCount.textContent = '';
  importProgress.textContent = '';
  importSelectAll.checked = false;
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
let _importSelecting = false;
importModal.addEventListener('click', (e) => {
  if (e.target === importModal && !_importSelecting) closeImportModal();
  _importSelecting = false;
});

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
      const useProxy = true;
      const userSearchUrl = useProxy
        ? `https://pm-proxy.demo.qa.kaltura.ai/jira/user/search?query=${encodeURIComponent(q)}`
        : `https://kaltura.atlassian.net/rest/api/3/user/search?query=${encodeURIComponent(q)}&maxResults=10`;
      const userSearchOpts = useProxy
        ? { headers: { Accept: 'application/json' } }
        : { credentials: 'include', headers: { Accept: 'application/json' } };
      const res = await fetch(userSearchUrl, userSearchOpts);
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

importPmResults.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-account-id]');
  if (!li) return;
  e.preventDefault();
  _importSelecting = true;
  const accountId = li.getAttribute('data-account-id');
  const displayName = li.getAttribute('data-display-name');
  importSelectedPm = { accountId, displayName };
  importPmSearch.value = displayName;
  importPmResults.classList.add('hidden');
  loadImportStep2(importSelectedPm);
});

// Step 2: Load initiatives for selected PM
async function loadImportStep2(pm) {
  importStep1.classList.add('hidden');
  importStep2.classList.remove('hidden');
  importPmResults.classList.add('hidden');
  importStep2Header.innerHTML = `Importing projects for <strong>${escapeHtml(pm.displayName)}</strong>`;
  importProjectList.innerHTML = '<p style="color:#64748b;padding:8px 0;">Loading...</p>';
  importCount.textContent = '';
  importSelectAll.checked = false;
  importProgress.textContent = '';

  // Ensure custom field IDs are resolved before building search URL
  if (!cachedAccountNameFieldId || !cachedVMForecastFieldId || !cachedNrrFieldId || !cachedMrrFieldId || !cachedEstHoursFieldId || !cachedRiskReasonFieldId || !cachedRiskRateFieldId) await resolveJiraFieldIds();

  const jql = `issuetype = Initiative AND assignee = "${pm.accountId}" AND (status = Open OR status = "in progress") ORDER BY created ASC`;
  const extraFields = [cachedAccountNameFieldId, cachedMrrFieldId, cachedNrrFieldId, cachedEstHoursFieldId, cachedVMForecastFieldId, cachedRiskReasonFieldId, cachedRiskRateFieldId, cachedAccountOwnerFieldId, cachedOppUrlFieldId, cachedAccountUrlFieldId, cachedAccountCsmFieldId].filter(Boolean).join(',');
  const useProxy = true;
  const url = useProxy
    ? `https://pm-proxy.demo.qa.kaltura.ai/jira/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,created${extraFields ? ',' + extraFields : ''}&maxResults=200`
    : `https://kaltura.atlassian.net/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,created${extraFields ? ',' + extraFields : ''}&maxResults=200`;
  const fetchOpts = useProxy
    ? { headers: { Accept: 'application/json' } }
    : { credentials: 'include', headers: { Accept: 'application/json' } };

  try {
    const res = await fetch(url, fetchOpts);
    if (!res.ok) {
      const errText = await res.text();
      console.error('[import search]', res.status, url, errText);
      importProjectList.innerHTML = `<p style="color:#ef4444;">Failed to load projects (${res.status}).</p>`;
      return;
    }
    const data = await res.json();
    importFetchedIssues = (data.issues || []).map(i => ({
      key: i.key,
      summary: i.fields.summary,
      jiraUrl: `https://kaltura.atlassian.net/browse/${i.key}`,
      assigneeEmail: i.fields.assignee?.emailAddress || '',
      assigneeDisplayName: i.fields.assignee?.displayName || pm.displayName,
      assigneeAccountId: i.fields.assignee?.accountId || '',
      created: i.fields.created || '',
      status: i.fields.status?.name || '',
      accountName: cachedAccountNameFieldId ? (i.fields[cachedAccountNameFieldId] || '') : '',
      mrrUsd: cachedMrrFieldId ? (i.fields[cachedMrrFieldId] ?? '') : '',
      nrrUsd: cachedNrrFieldId ? (i.fields[cachedNrrFieldId] ?? '') : '',
      estimatedHours: cachedEstHoursFieldId ? (i.fields[cachedEstHoursFieldId] ?? '') : '',
      dueDate: cachedVMForecastFieldId ? (i.fields[cachedVMForecastFieldId] || '') : '',
      riskReason: cachedRiskReasonFieldId ? (i.fields[cachedRiskReasonFieldId]?.value || '') : '',
      healthFromJira: cachedRiskRateFieldId ? (i.fields[cachedRiskRateFieldId]?.value || 'Green') : 'Green',
      accountOwnerName: cachedAccountOwnerFieldId ? (typeof i.fields[cachedAccountOwnerFieldId] === 'string' ? i.fields[cachedAccountOwnerFieldId] : (i.fields[cachedAccountOwnerFieldId]?.displayName || i.fields[cachedAccountOwnerFieldId]?.name || '')) : '',
      accountOwnerAccountId: cachedAccountOwnerFieldId ? (i.fields[cachedAccountOwnerFieldId]?.accountId || '') : '',
      oppUrl: cachedOppUrlFieldId ? (validSfUrl(i.fields[cachedOppUrlFieldId]) || '') : '',
      accountUrl: cachedAccountUrlFieldId ? (validSfUrl(i.fields[cachedAccountUrlFieldId]) || '') : '',
      accountCsmName: cachedAccountCsmFieldId ? (typeof i.fields[cachedAccountCsmFieldId] === 'string' ? i.fields[cachedAccountCsmFieldId] : (i.fields[cachedAccountCsmFieldId]?.displayName || i.fields[cachedAccountCsmFieldId]?.name || '')) : '',
    }));

    const existing = getExistingJiraKeys();
    const alreadyImported = importFetchedIssues.filter(i => existing.has(i.key)).length;
    importCount.textContent = `${importFetchedIssues.length} project${importFetchedIssues.length !== 1 ? 's' : ''} · ${alreadyImported} already imported`;

    if (!importFetchedIssues.length) {
      importProjectList.innerHTML = '<p style="color:#64748b;padding:8px 0;">No active initiatives found.</p>';
      return;
    }

    importProjectList.innerHTML = [...importFetchedIssues].sort((a, b) => (a.accountName || '').localeCompare(b.accountName || '')).map(issue => {
      const isExisting = existing.has(issue.key);
      return `
        <label class="import-project-row${isExisting ? ' existing' : ''}">
          <input type="checkbox" value="${escapeHtml(issue.key)}" ${isExisting ? 'checked disabled' : ''}>
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
      const sfResp = await fetch(`https://pm-proxy.demo.qa.kaltura.ai/sf/enrich?jiraKey=${encodeURIComponent(issue.key)}`, {
        headers: { Accept: 'application/json' },
      });
      if (sfResp.ok) sfData = await sfResp.json();
    } catch {}
    const project = buildProjectFromEnrichment(issue, sfData);
    projects.unshift(project);

    // Auto-create PM user if not already in users list, store jiraAccountId
    const pmDisplayName = project.manager;
    if (pmDisplayName && pmDisplayName !== 'Unassigned') {
      const existingUser = users.find(u => getUserDisplayName(u) === pmDisplayName);
      if (!existingUser) {
        const parts = pmDisplayName.trim().split(/\s+/);
        const firstName = parts[0] || pmDisplayName;
        const lastName = parts.slice(1).join(' ') || '';
        users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, roles: ['PM'], jiraAccountId: issue.assigneeAccountId || null });
      } else if (!existingUser.jiraAccountId && issue.assigneeAccountId) {
        existingUser.jiraAccountId = issue.assigneeAccountId;
      }
    }

    // Auto-create Account Owner as Sales user if not already in users list
    if (issue.accountOwnerName) {
      await ensureUserExists(issue.accountOwnerName, issue.accountOwnerAccountId, 'Sales');
    }
    // Auto-create Account CSM as CSM user if not already in users list
    if (issue.accountCsmName) {
      await ensureUserExists(issue.accountCsmName, '', 'CSM');
    }

    // Auto-create customer if not already in customers list
    const customerName = project.customer;
    if (customerName) {
      const customerExists = customers.some(c => c.name === customerName);
      if (!customerExists) {
        customers.push({ id: `cust_${Date.now()}_${done}`, name: customerName, sfLink: project.oppLink || '' });
      }
    }

    done++;
  }

  await Promise.all([saveUsers(), saveCustomers(), saveProjects()]);
  closeImportModal();
  location.reload();
});

const editDueDateTextEl = document.getElementById('editDueDateText');
const editDueDateHiddenEl = document.getElementById('editDueDateHidden');
const editDueDatePickerBtn = document.getElementById('editDueDatePickerBtn');

setupDateInput(editDueDateTextEl);

editDueDateTextEl.addEventListener('blur', () => {
  const iso = parseDateInput(editDueDateTextEl.value);
  editDueDateHiddenEl.value = iso || '';
});

editDueDateHiddenEl.addEventListener('change', () => {
  if (editDueDateHiddenEl.value) {
    editDueDateTextEl.value = formatDateDMY(editDueDateHiddenEl.value);
  }
});

editDueDatePickerBtn.addEventListener('click', () => {
  editDueDateHiddenEl.showPicker();
});

function wireDateField(textId, hiddenId, btnId) {
  const text = document.getElementById(textId);
  const hidden = document.getElementById(hiddenId);
  const btn = document.getElementById(btnId);
  setupDateInput(text);
  text.addEventListener('blur', () => { hidden.value = parseDateInput(text.value) || ''; });
  hidden.addEventListener('change', () => { if (hidden.value) text.value = formatDateDMY(hidden.value); });
  btn.addEventListener('click', () => hidden.showPicker());
}

wireDateField('modalProjectStartDate', 'modalProjectStartDateHidden', 'modalStartPickerBtn');
wireDateField('modalProjectDueDate', 'modalProjectDueDateHidden', 'modalEndPickerBtn');

taskModalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const custName = document.getElementById('taskCustomer').value.trim();
  const projName = document.getElementById('taskProject').value.trim();
  const jira = document.getElementById('taskJira').value.trim();
  const owner = document.getElementById('taskOwner').value.trim();
  const region = document.getElementById('taskRegion').value;
  if (!custName || !projName || !owner) return;
  tasks.push({
    id: `task_${Date.now()}`,
    type: 'task',
    customer: custName,
    parentProjectName: projName,
    jira,
    owner,
    region,
    health: 'Green',
    riskReason: '',
    pmStatus: '',
    statusText: '',
    comments: '',
    progress: 0,
    nrr: null,
    nrrUsd: null,
    mrrUsd: null,
    startDate: '',
    dueDate: '',
    status: 'On Track',
    atLink: '',
    estimatedHours: null,
    remainingHours: null,
    actualHours: null,
  });
  await saveTasks();
  renderAll();
  closeTaskModal();
});

// Render immediately from localStorage cache so the page is never blank
// NOTE: do NOT call migrateProjects() here — it calls saveProjects() which would
// overwrite KV with defaultProjects if localStorage is empty after migration
renderAll();
initAutocompletes();
initTaskFormAutocompletes();

async function init() {
  await initData();
  await migrateProjects();
  renderAll();
  startKvPoll();
  startAutoProjectPoll();
  syncStatusFromJira();
  syncProjectProgressFromJira();
  checkJiraConnectivity();
  fetchAndStoreAvatars();
}

async function checkJiraConnectivity() {
  // Just a quiet connectivity check — Jira issues don't mean dashboard is offline
  try {
    await fetch(`${PROXY_BASE}/jira/field`, { headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET } });
  } catch {}
}

init();
