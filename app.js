const APP_VERSION = '1.0.0';
const CHANGELOG = [
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
let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

function saveUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const SETTINGS_KEY = 'project-dashboard-settings-v1';
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const CUSTOMERS_KEY = 'project-dashboard-customers-v1';
let customers = JSON.parse(localStorage.getItem(CUSTOMERS_KEY) || '[]');

function saveCustomers() {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
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

const BACKUPS_KEY = 'project-dashboard-backups-v1';
let backups = JSON.parse(localStorage.getItem(BACKUPS_KEY) || '[]');

function saveBackups() {
  localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups));
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

function migrateProjects() {
  let changed = false;
  for (const p of projects) {
    if (p.pmStatus === undefined) { p.pmStatus = ''; changed = true; }
    if (p.atLink === undefined) { p.atLink = ''; changed = true; }
    if (p.estimatedHours === undefined) { p.estimatedHours = null; changed = true; }
    if (p.remainingHours === undefined) { p.remainingHours = null; changed = true; }
    if (p.actualHours === undefined) { p.actualHours = null; changed = true; }
  }
  if (changed) saveProjects();
}

let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || defaultProjects;
migrateProjects();

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
const editStatusEditor = document.getElementById('editStatusEditor');
const editHealth = document.getElementById('editHealth');
const editPmStatus = document.getElementById('editPmStatus');
const pmStatusLabel = document.getElementById('pmStatusLabel');
const editRiskReason = document.getElementById('editRiskReason');
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
const addProjectBtn = document.getElementById('addProjectBtn');
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

function saveProjects() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

let addUserReturnContext = null;

function setupAutocomplete(input, getOptions, role, addCallback) {
  const list = input.closest('.autocomplete-wrap').querySelector('.autocomplete-list');
  let activeIndex = -1;

  function buildList(matches, typedTerm) {
    const items = matches.map(item => `<li>${escapeHtml(item)}</li>`);
    const exactMatch = matches.some(m => m.toLowerCase() === typedTerm.toLowerCase());
    if (typedTerm && !exactMatch) {
      if (role) {
        items.push(`<li class="autocomplete-add" data-add-name="${escapeHtml(typedTerm)}" data-add-role="${escapeHtml(role)}">➕ Add "${escapeHtml(typedTerm)}" as new ${escapeHtml(role)}</li>`);
      } else if (addCallback) {
        items.push(`<li class="autocomplete-add" data-add-name="${escapeHtml(typedTerm)}">➕ Add "${escapeHtml(typedTerm)}" as new customer</li>`);
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

function formatCurrency(val) {
  if (!val) return '0';
  const str = String(val).trim();
  const prefix = str.match(/^[^0-9.]*/)?.[0] || '';
  const num = parseFloat(str.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return str;
  const k = num / 1000;
  const rounded = Math.round(k * 10) / 10;
  return `${prefix}${rounded}K`;
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

async function resolveJiraFieldIds() {
  const useProxy = settings.jiraEmail && settings.jiraToken;
  const url = useProxy
    ? 'http://localhost:8081/jira/field'
    : 'https://kaltura.atlassian.net/rest/api/3/field';
  const opts = useProxy
    ? { headers: { Accept: 'application/json' } }
    : { credentials: 'include', headers: { Accept: 'application/json' } };
  try {
    const res = await fetch(url, opts);
    if (!res.ok) return;
    const fields = await res.json();
    for (const f of fields) {
      if (f.name === 'Risk Reason') cachedRiskReasonFieldId = f.id;
      if (f.name === 'VM Forecast Commit Date') cachedVMForecastFieldId = f.id;
      if (f.name === 'Project Progress Percentage') cachedProgressPctFieldId = f.id;
      if (f.name === 'Estimated PS Hours') cachedEstHoursFieldId = f.id;
      if (f.name === 'Remaining Effort') cachedRemEffortFieldId = f.id;
      if (f.name === 'Actual Effort(H)') cachedActEffortFieldId = f.id;
      if (f.name === 'Risk Rate') cachedRiskRateFieldId = f.id;
    }
    if (cachedRiskRateFieldId && !cachedRiskRateOptions) {
      await resolveRiskRateOptions(cachedRiskRateFieldId);
    }
  } catch {}
}

async function resolveRiskRateOptions(fieldId) {
  const issueKey = projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean)[0];
  if (!issueKey) return;
  const useProxy = settings.jiraEmail && settings.jiraToken;
  const url = useProxy
    ? `http://localhost:8081/jira/issue/${issueKey}/editmeta`
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

  const useProxy = settings.jiraEmail && settings.jiraToken;

  await resolveJiraFieldIds();

  // Build fields param from cached IDs — only request what we need
  const fieldIds = ['progress', cachedProgressPctFieldId, cachedEstHoursFieldId, cachedRemEffortFieldId, cachedActEffortFieldId].filter(Boolean);
  const fieldsParam = fieldIds.join(',');

  for (const key of [...new Set(issueKeys)]) {
    try {
      const url = useProxy
        ? `http://localhost:8081/jira/issue/${key}?fields=${fieldsParam}`
        : `https://kaltura.atlassian.net/rest/api/3/issue/${key}?fields=${fieldsParam}`;
      const fetchOpts = useProxy
        ? { headers: { Accept: 'application/json' } }
        : { credentials: 'include', headers: { Accept: 'application/json' } };
      const response = await fetch(url, fetchOpts);

      if (!response.ok) continue;

      const data = await response.json();
      const f = data.fields || {};

      let percent = null;
      if (cachedProgressPctFieldId) {
        const raw = f[cachedProgressPctFieldId];
        const extracted = (raw !== null && typeof raw === 'object') ? (raw.value ?? raw.percent ?? null) : raw;
        percent = normalizeProgress(extracted);
      }
      if (percent === null) {
        percent = normalizeProgress(f.progress?.percent ?? f.progress);
      }

      const readHours = (fieldId) => {
        if (!fieldId) return null;
        const raw = f[fieldId];
        const v = (raw !== null && typeof raw === 'object') ? (raw.value ?? null) : raw;
        return (v !== null && Number.isFinite(Number(v))) ? Math.round(Number(v)) : null;
      };
      const estimatedHours = readHours(cachedEstHoursFieldId);
      const remainingHours = readHours(cachedRemEffortFieldId);
      const actualHours = readHours(cachedActEffortFieldId);

      if (percent !== null || estimatedHours !== null || remainingHours !== null || actualHours !== null) {
        projects.forEach((project) => {
          if (getJiraIssueKey(project.jira) === key) {
            if (percent !== null) project.progress = percent;
            if (estimatedHours !== null) project.estimatedHours = estimatedHours;
            if (remainingHours !== null) project.remainingHours = remainingHours;
            if (actualHours !== null) project.actualHours = actualHours;
          }
        });
      }
    } catch (error) {
      console.warn(`Jira sync failed for ${key}`, error);
    }
  }

  saveProjects();
  renderAll();
}

function getExistingJiraKeys() {
  return new Set(projects.map(p => getJiraIssueKey(p.jira)).filter(Boolean));
}

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
  const sfOk = sfData && !sfData.sfSkipped && !sfData.sfError;
  return {
    customer:    sfOk ? (sfData.customer || '') : '',
    name:        sfOk ? (sfData.name || issue.summary) : issue.summary,
    manager,
    jira:        issue.jiraUrl,
    nrr:         sfOk ? (sfData.nrrHours ?? '') : '',
    comments:    `NRR: ${formatCurrency(nrr || '0')}, MRR: ${formatCurrency(mrr || '0')}, CSM: ${csmName || '-'}, Sales: ${salesName || '-'}`,
    startDate,
    dueDate:     '',
    health:      'Green',
    status:      'On Track',
    progress:    0,
    statusText:  '',
    oppLink:     sfOk ? (sfData.oppUrl || '') : '',
    atLink:      '',
    riskReason:  '',
    csm:         csmName,
    sales:       salesName,
  };
}

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

async function writeRiskReasonToJira(issueKey, optionId) {
  if (!cachedRiskReasonFieldId) await resolveJiraFieldIds();
  if (!cachedRiskReasonFieldId) throw new Error('Risk Reason field ID not resolved');
  const useProxy = settings.jiraEmail && settings.jiraToken;
  const url = useProxy
    ? `http://localhost:8081/jira/issue/${issueKey}`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}`;
  const res = await fetch(url, {
    method: 'PUT',
    ...(useProxy ? {} : { credentials: 'include' }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fields: { [cachedRiskReasonFieldId]: optionId ? { id: optionId } : null } }),
  });
  if (!res.ok) throw new Error(`Jira write failed: ${res.status}`);
}

async function writeRiskRateToJira(issueKey, health) {
  if (!cachedRiskRateFieldId || !cachedRiskRateOptions) await resolveJiraFieldIds();
  if (!cachedRiskRateFieldId) throw new Error('Risk Rate field ID not resolved');
  if (!cachedRiskRateOptions) throw new Error('Risk Rate options not resolved');
  const optionId = cachedRiskRateOptions[health];
  if (!optionId) throw new Error(`Risk Rate option not found for health: ${health}`);
  const useProxy = settings.jiraEmail && settings.jiraToken;
  const url = useProxy
    ? `http://localhost:8081/jira/issue/${issueKey}`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}`;
  const res = await fetch(url, {
    method: 'PUT',
    ...(useProxy ? {} : { credentials: 'include' }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fields: { [cachedRiskRateFieldId]: { id: optionId } } }),
  });
  if (!res.ok) throw new Error(`Jira write failed: ${res.status}`);
}

let cachedVMForecastFieldId = null;

async function writeDueDateToJira(issueKey, dateStr) {
  if (!dateStr) return;
  if (!cachedVMForecastFieldId) await resolveJiraFieldIds();
  if (!cachedVMForecastFieldId) throw new Error('VM Forecast Commit Date field ID not resolved');
  const useProxy = settings.jiraEmail && settings.jiraToken;
  const url = useProxy
    ? `http://localhost:8081/jira/issue/${issueKey}`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}`;
  const res = await fetch(url, {
    method: 'PUT',
    ...(useProxy ? {} : { credentials: 'include' }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fields: { [cachedVMForecastFieldId]: dateStr } }),
  });
  if (!res.ok) throw new Error(`Jira write failed: ${res.status}`);
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

  return projects.filter((project) => {
    const matchesPm = selectedPm === 'All' || project.manager === selectedPm;
    const matchesHealth = selectedHealth === 'All' || project.health === selectedHealth;
    const matchesDueMonth = !selectedDueMonth || (project.dueDate || '').startsWith(selectedDueMonth);
    const matchesSearch = !term || `${project.name} ${project.manager || ''} ${project.customer || ''} ${project.jira || ''}`.toLowerCase().includes(term);

    let matchesProgress = true;
    if (selectedProgress === '0-39') matchesProgress = project.progress < 40;
    if (selectedProgress === '40-69') matchesProgress = project.progress >= 40 && project.progress < 70;
    if (selectedProgress === '70-100') matchesProgress = project.progress >= 70;

    return matchesPm && matchesHealth && matchesDueMonth && matchesSearch && matchesProgress;
  });
}

function renderTable() {
  const filteredProjects = getFilteredProjects();
  const grouped = filteredProjects.reduce((acc, project) => {
    const key = project.manager || 'Unassigned';
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
    header.innerHTML = `<h4>${manager} <span style="font-size:0.88rem;font-weight:400;">(Number Of Projects: ${grouped[manager].length})</span></h4>`;
    section.appendChild(header);

    const table = document.createElement('table');
    table.className = 'pm-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Customer name</th>
          <th>Project</th>
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
            <td>${(() => { const cust = customers.find(c => c.name === project.customer); return cust && cust.sfLink ? `<a href="${escapeHtml(cust.sfLink)}" target="_blank" rel="noreferrer">${escapeHtml(project.customer || '-')}</a>` : escapeHtml(project.customer || '-'); })()}</td>
            <td>${project.oppLink ? `<a href="${escapeHtml(project.oppLink)}" target="_blank" rel="noreferrer">${escapeHtml(project.name)}</a>` : escapeHtml(project.name)}</td>
            <td class="jira-at-cell">
              ${project.jira ? `<a class="jira-at-btn" href="${escapeHtml(project.jira)}" target="_blank" rel="noreferrer">${escapeHtml(getJiraLabel(project.jira))}</a>` : '<span style="color:#64748b">—</span>'}
              ${project.atLink ? `<a class="jira-at-btn" href="${escapeHtml(project.atLink)}" target="_blank" rel="noreferrer">AT</a>` : ''}
            </td>
            <td>${project.nrr} hrs</td>
            <td>${formatDate(project.startDate)}</td>
            <td>${formatDate(project.dueDate)}</td>
            <td>
              <div class="health-wrap">
                <span class="health-pill health-${(project.health || 'green').toLowerCase()}">${project.health || 'Green'}</span>
                ${(project.health === 'Yellow' || project.health === 'Red') ? `<div class="health-tooltip">${escapeHtml(project.pmStatus || 'No info was set by PM')}</div>` : ''}
              </div>
            </td>
            <td>
              <div class="progress-wrap">
                ${(() => {
                  let tip = '';
                  if (project.riskReason) {
                    tip = `Risk reason was set\n${project.riskReason}`;
                  } else if (progressValue >= 100) {
                    tip = 'No more hours for the project';
                  } else if (project.estimatedHours != null && project.remainingHours != null) {
                    const used = project.actualHours != null ? project.actualHours : (project.estimatedHours - project.remainingHours);
                    tip = `${used} hours have been completed out of ${project.estimatedHours}, with ${project.remainingHours} hours remaining`;
                  }
                  return tip ? `<div class="progress-tooltip">${escapeHtml(tip).replace(/\n/g,'<br>')}</div>` : '';
                })()}
                <div class="progress-bar"><div class="progress-fill ${progressFillTone}" style="width:${Math.min(progressValue, 100)}%"></div></div>
                <small class="progress-label ${progressTone}">${progressValue}%</small>
              </div>${(() => { const ack = project.riskReason; if (ack) return ''; if (progressValue > 90) return '<span class="progress-blink-wrap"><span class="progress-blink">⚠</span><span class="progress-blink-tip">Edit the project and set over budget risk reason</span></span>'; return ''; })()}
            </td>
            <td><div class="cell-scroll">${isEmptyStatus(project.statusText) ? STATUS_PLACEHOLDER : project.statusText}</div></td>
            <td><div class="cell-scroll">${(project.comments || '-').split(', ').join('<br>')}</div></td>
            <td style="white-space:nowrap;">
              <button type="button" class="secondary-btn small-btn" data-edit-project="${projects.indexOf(project)}">Edit</button>
              <button type="button" class="ghost-btn small-btn" style="margin-top:4px;display:block;" data-delete-project="${projects.indexOf(project)}">Delete</button>
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

  const uniqueManagers = [...new Set(projects.map((project) => project.manager).filter(Boolean))];
  pmFilter.innerHTML = ['<option value="All">All PMs</option>', ...uniqueManagers.map((manager) => `<option value="${manager}">${manager}</option>`)].join('');

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

function openEditProjectModal(projectIndex) {
  const project = projects[projectIndex];
  if (!project) return;

  editCustomerName.value = project.customer || '';
  editProjectName.value = project.name;
  editHealth.value = project.health || 'Green';
  editPmStatus.value = project.pmStatus || '';
  const isAtRisk = ['Yellow', 'Red'].includes(project.health);
  pmStatusLabel.style.display = isAtRisk ? '' : 'none';
  const matchingOption = Array.from(editRiskReason.options).find(o => o.text === project.riskReason);
  editRiskReason.value = matchingOption ? matchingOption.value : '';
  riskReasonLabel.style.display = '';
  const editDueDateText = document.getElementById('editDueDateText');
  editDueDateText.value = project.dueDate ? formatDateDMY(project.dueDate) : '';
  document.getElementById('editAtLink').value = project.atLink || '';
  document.getElementById('editDueDateHidden').value = project.dueDate || '';
  if (project.statusText) {
    editStatusEditor.innerHTML = project.statusText;
    editStatusEditor.removeAttribute('data-placeholder-active');
  } else {
    editStatusEditor.innerHTML = '<span style="font-style:italic;opacity:0.5;">No Status Entered</span>';
    editStatusEditor.setAttribute('data-placeholder-active', '1');
  }
  editProjectForm.dataset.projectIndex = String(projectIndex);

  editProjectModal.classList.remove('hidden');
  editProjectModal.setAttribute('aria-hidden', 'false');
}

function closeEditProjectModal() {
  editProjectModal.classList.add('hidden');
  editProjectModal.setAttribute('aria-hidden', 'true');
  editProjectForm.reset();
  editStatusEditor.innerHTML = '';
  editStatusEditor.removeAttribute('data-placeholder-active');
  editPmStatus.value = '';
  pmStatusLabel.style.display = 'none';
  editRiskReason.value = '';
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
      <div class="pm-group-header"><h4>${escapeHtml(manager)}</h4><span>${grouped[manager].length} project${grouped[manager].length === 1 ? '' : 's'}</span></div>
      <div style="overflow-x:auto;">
        <table class="pm-table">
          <thead><tr>
            <th>Customer</th><th>Project</th><th>Jira / AT</th><th>NRR(h)</th>
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
                  </div>${(() => { const ack = (p.health === 'Yellow' || p.health === 'Red') && p.riskReason; if (ack) return ''; if (pv > 90) return '<span class="progress-blink-wrap"><span class="progress-blink">⚠</span><span class="progress-blink-tip">Edit the project and set over budget risk reason</span></span>'; return ''; })()}
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

  document.getElementById('confirmRestoreBtn').addEventListener('click', () => {
    const restoreProjectsEl = document.getElementById('restoreProjects');
    const restoreUsersEl = document.getElementById('restoreUsers');
    if (!restoreProjectsEl.checked && !restoreUsersEl.checked) return;
    if (restoreProjectsEl.checked) {
      projects = JSON.parse(JSON.stringify(backup.projects));
      saveProjects();
    }
    if (restoreUsersEl.checked) {
      users = JSON.parse(JSON.stringify(backup.users));
      saveUsers();
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

function openDeleteProjectModal(projectIndex) {
  const project = projects[projectIndex];
  if (!project) return;
  deleteProjectIndex = projectIndex;
  deleteProjectModalTitle.textContent = project.name;
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
    addUserReturnContext = null;
    projectModal.classList.remove('hidden');
    projectModal.setAttribute('aria-hidden', 'false');
  }
}

function renderCustomersModal() {
  if (!customers.length) {
    customersModalBody.innerHTML = '<p class="muted">No customers added yet. Click Add customer to get started.</p>';
    return;
  }
  customersModalBody.innerHTML = [...customers].sort((a, b) => a.name.localeCompare(b.name)).map(c => `
    <div class="user-row" data-customer-id="${escapeHtml(c.id)}">
      <div>
        <span>${escapeHtml(c.name)}</span>
        ${c.sfLink ? `<br><a href="${escapeHtml(c.sfLink)}" target="_blank" rel="noreferrer" style="font-size:0.82rem;color:#7dd3fc;">SF link</a>` : ''}
      </div>
      <div>
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

  const selectedIndex = Number(editProjectForm.dataset.projectIndex ?? -1);
  const selectedProject = projects[selectedIndex];
  if (!selectedProject) return;

  const newCustomer = editCustomerName.value.trim();
  const newName = editProjectName.value.trim();
  if (newCustomer) selectedProject.customer = newCustomer;
  if (newName) selectedProject.name = newName;
  selectedProject.health = editHealth.value;
  selectedProject.pmStatus = ['Yellow', 'Red'].includes(selectedProject.health)
    ? editPmStatus.value.trim()
    : '';
  const riskOptionId = editRiskReason.value;
  const riskOptionLabel = riskOptionId ? editRiskReason.options[editRiskReason.selectedIndex].text : '';
  selectedProject.riskReason = riskOptionLabel;
  selectedProject.atLink = document.getElementById('editAtLink').value.trim();
  const newDueDate = parseDateInput(document.getElementById('editDueDateText').value);
  if (newDueDate) selectedProject.dueDate = newDueDate;
  const rawStatus = editStatusEditor.getAttribute('data-placeholder-active') ? '' : editStatusEditor.innerHTML.trim();
  selectedProject.statusText = isEmptyStatus(rawStatus) ? '' : rawStatus;

  saveProjects();
  renderAll();
  closeEditProjectModal();

  const issueKey = getJiraIssueKey(selectedProject.jira);
  if (issueKey) {
    writeRiskReasonToJira(issueKey, riskOptionId || null).catch(e => { console.error('[riskReason→Jira]', e); showToast(`Jira risk reason sync failed: ${e.message}`); });
    writeRiskRateToJira(issueKey, selectedProject.health).catch(e => { console.error('[riskRate→Jira]', e); showToast(`Jira risk rate sync failed: ${e.message}`); });
    if (newDueDate) writeDueDateToJira(issueKey, newDueDate).catch(e => { console.error('[dueDate→Jira]', e); showToast(`Jira due date sync failed: ${e.message}`); });
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
    startDate: parseDateInput(document.getElementById('modalProjectStartDate').value),
    dueDate: parseDateInput(document.getElementById('modalProjectDueDate').value),
    status: 'On Track',
    health: 'Green',
    progress: 0,
    statusText: '',
    csm: csmName || '',
    sales: salesName || '',
    comments: `NRR: ${formatCurrency(nrrValue || '0')}, MRR: ${formatCurrency(mrrValue || '0')}, CSM: ${csmName || '-'}, Sales: ${salesName || '-'}`,
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

addProjectBtn.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
cancelModalBtn.addEventListener('click', closeModal);
closeEditModalBtn.addEventListener('click', closeEditProjectModal);
cancelEditModalBtn.addEventListener('click', closeEditProjectModal);

editProjectModal.addEventListener('click', (event) => {
  if (event.target === editProjectModal) closeEditProjectModal();
});

portfolioGroups.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-project]');
  if (editButton) {
    openEditProjectModal(Number(editButton.dataset.editProject));
    return;
  }
  const deleteButton = event.target.closest('[data-delete-project]');
  if (deleteButton) {
    openDeleteProjectModal(Number(deleteButton.dataset.deleteProject));
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

editStatusEditor.addEventListener('focus', () => {
  if (editStatusEditor.getAttribute('data-placeholder-active')) {
    editStatusEditor.innerHTML = '';
    editStatusEditor.removeAttribute('data-placeholder-active');
  }
});

editStatusEditor.addEventListener('blur', () => {
  if (!editStatusEditor.textContent.trim() && !editStatusEditor.querySelector('img, br')) {
    editStatusEditor.innerHTML = '<span style="font-style:italic;opacity:0.5;">No Status Entered</span>';
    editStatusEditor.setAttribute('data-placeholder-active', '1');
  }
});


searchInput.addEventListener('input', renderTable);
pmFilter.addEventListener('change', renderTable);
healthFilter.addEventListener('change', renderTable);
progressFilter.addEventListener('change', renderTable);
duemonthFilter.addEventListener('change', renderTable);

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

  const atRisk = projects.filter(p => p.health === 'Red' || p.health === 'Yellow')
    .sort((a,b) => {
      if (a.health === b.health) return 0;
      return a.health === 'Red' ? -1 : 1;
    });

  const backupNames = new Set((backups[0]?.projects || []).map(p => p.name));
  const newProjects = backups.length >= 1 ? projects.filter(p => !backupNames.has(p.name)) : [];

  const uniquePMs = [...new Set(projects.map(p => p.manager).filter(Boolean))].sort();

  function healthPill(health, pmStatus) {
    const colors = {
      Green: 'background:rgba(74,222,128,0.16);color:#bbf7d0',
      Yellow: 'background:rgba(251,191,36,0.15);color:#fde68a',
      Red: 'background:rgba(220,38,38,0.22);color:#ef4444;border:1px solid rgba(220,38,38,0.4)',
    };
    const h = health || 'Green';
    const pill = `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:0.82rem;font-weight:700;${colors[h]||colors.Green}">${h}</span>`;
    if (h === 'Yellow' || h === 'Red') {
      const tip = esc(pmStatus || 'No info was set by PM');
      return `<span class="rpt-health-wrap">${pill}<span class="rpt-tooltip" style="color:#fde68a">${tip}</span></span>`;
    }
    return pill;
  }

  function progressBar(val, estimatedHours, remainingHours, actualHours, health, riskReason) {
    const v = Math.max(0, Math.round(Number(val)||0));
    const fill = v < 50 ? 'linear-gradient(90deg,#22c55e,#86efac)' : v <= 75 ? 'linear-gradient(90deg,#facc15,#fde68a)' : v <= 90 ? 'linear-gradient(90deg,#f97316,#fb923c)' : 'linear-gradient(90deg,#dc2626,#ef4444)';
    const color = v < 50 ? '#bbf7d0' : v <= 75 ? '#fde68a' : v <= 90 ? '#fdba74' : '#ef4444';
    const ack = riskReason;
    const blink = ack ? '' : v > 90 ? ' <span class="rpt-blink-wrap"><span style="animation:progress-blink 1s step-start infinite;color:#ef4444">⚠</span><span class="rpt-tooltip" style="color:#fde68a;width:200px">Edit the project and set over budget risk reason</span></span>' : '';
    let tip = '';
    if (riskReason) tip = `Risk reason was set\n${riskReason}`;
    else if (v >= 100) tip = 'No more hours for the project';
    else if (estimatedHours != null && remainingHours != null) {
      const used = actualHours != null ? actualHours : (estimatedHours - remainingHours);
      tip = `${used} hours have been completed out of ${estimatedHours}, with ${remainingHours} hours remaining`;
    }
    const bar = `<div style="width:100%;background:#142033;border-radius:999px;overflow:hidden;height:8px;margin-bottom:4px"><div style="height:100%;border-radius:999px;width:${Math.min(v,100)}%;background:${fill}"></div></div><small style="color:${color};font-weight:700">${v}%</small>`;
    const barWithTip = tip ? `<span class="rpt-progress-wrap">${bar}<span class="rpt-tooltip">${tip.replace(/\n/g,'<br>')}</span></span>` : bar;
    return barWithTip + blink;
  }

  function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  const atRiskRows = atRisk.length
    ? atRisk.map(p => `<tr>
        <td>${esc(p.customer||'-')}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${healthPill(p.health, p.pmStatus)}</td>
        <td style="color:#fde68a">${esc(p.riskReason||'No risk reason provided')}</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="color:#94a3b8;font-style:italic;">No projects currently at risk.</td></tr>`;

  const newRows = newProjects.length
    ? newProjects.map(p => `<tr>
        <td>${esc(p.customer||'-')}</td>
        <td><strong>${esc(p.name)}</strong></td>
        <td>${esc(p.manager||'-')}</td>
        <td>${esc(String(p.nrr||0))} hrs</td>
        <td>${esc(formatDate(p.startDate))}</td>
        <td>${esc(formatDate(p.dueDate))}</td>
        <td>${healthPill(p.health, p.pmStatus)}</td>
        <td>${progressBar(p.progress, p.estimatedHours, p.remainingHours, p.actualHours, p.health, p.riskReason)}</td>
        <td>${isEmptyStatus(p.statusText) ? STATUS_PLACEHOLDER : p.statusText}</td>
        <td>${esc((p.comments||'').split(', ').join('\n'))}</td>
      </tr>`).join('')
    : '';

  const grouped = projects.reduce((acc, p) => {
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
    }).map(p => `<tr data-pm="${esc(p.manager||'')}" data-health="${esc(p.health||'Green')}" data-progress="${Math.round(Number(p.progress)||0)}">
      <td>${esc(p.customer||'-')}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(String(p.nrr||0))} hrs</td>
      <td>${esc(formatDate(p.startDate))}</td>
      <td>${esc(formatDate(p.dueDate))}</td>
      <td>${healthPill(p.health, p.pmStatus)}</td>
      <td>${progressBar(p.progress, p.estimatedHours, p.remainingHours, null, p.health, p.riskReason)}</td>
      <td>${isEmptyStatus(p.statusText) ? STATUS_PLACEHOLDER : p.statusText}</td>
      <td>${esc((p.comments||'').split(', ').join('\n'))}</td>
    </tr>`).join('');
    return `<tbody class="pm-group-body">
      <tr class="pm-group-header-row"><td colspan="9" style="padding:10px 8px 6px;color:#7dd3fc;font-weight:700;font-size:0.95rem;border-bottom:1px solid #223249">${esc(manager)} <span style="font-weight:400;font-size:0.85rem;color:#bfdbfe">(Number Of Projects: ${grouped[manager].length})</span></td></tr>
      ${rows}
    </tbody>`;
  }).join('');

  const pmOptions = uniquePMs.map(pm => `<option value="${esc(pm)}">${esc(pm)}</option>`).join('');

  const newSection = newProjects.length && backups.length >= 1 ? `
    <section style="margin-bottom:32px">
      <h2 style="font-size:1.1rem;color:#7dd3fc;margin-bottom:12px">Newly Added Projects</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Customer</th>
          <th style="text-align:left;padding:8px;color:#bfdbfe;border-bottom:1px solid #223249">Project</th>
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
    </section>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Project Manager Dashboard — Status Report</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Arial,sans-serif;background:#07111f;color:#eff6ff;padding:32px}
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
      <th>Customer</th><th>Project</th><th>Project Health</th><th>Risk Reason</th>
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
      <option value="">All Project Budget</option>
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
        <th>Project Health</th><th>Project Budget</th><th>Project Status</th><th>Manager Notes</th>
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
  if(pm||health||prog){
    const t=document.getElementById('allTable');
    if(t.style.display!=='block'){
      t.style.display='block';
      const btn=document.querySelector('.toggle-btn');
      if(btn) btn.textContent='▼ Hide all projects';
    }
  }
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
});

function resetAddUserForm() {
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRolePM').checked = false;
  document.getElementById('newUserRoleCSM').checked = false;
  document.getElementById('newUserRoleSales').checked = false;
}

cancelAddUserBtn.addEventListener('click', () => {
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  resetAddUserForm();
});

saveAddUserBtn.addEventListener('click', () => {
  const firstName = document.getElementById('newUserFirstName').value.trim();
  const lastName = document.getElementById('newUserLastName').value.trim();
  const roles = ['PM', 'CSM', 'Sales'].filter(r => document.getElementById(`newUserRole${r}`).checked);
  if (!firstName || !lastName) return;
  if (!roles.length) { alert('Please select at least one role.'); return; }

  const displayName = `${firstName} ${lastName}`.trim();
  const existingUser = users.find(u => getUserDisplayName(u) === displayName);
  if (existingUser) {
    const existingRoles = getUserRoles(existingUser);
    const merged = [...new Set([...existingRoles, ...roles])];
    existingUser.roles = merged;
  } else {
    users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, roles });
  }
  saveUsers();
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  resetAddUserForm();
  renderUsersModal();

  if (addUserReturnContext) {
    const { inputEl } = addUserReturnContext;
    inputEl.value = `${firstName} ${lastName}`.trim();
    addUserReturnContext = null;
    closeUsersModal();
    projectModal.classList.remove('hidden');
    projectModal.setAttribute('aria-hidden', 'false');
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
  const atRiskProjects = projects.filter(p => p.health === 'Yellow' || p.health === 'Red');
  if (!atRiskProjects.length) return;
  atRiskPopup.innerHTML = atRiskProjects.map((p, i) =>
    `<a href="#" data-scroll-project="${escapeHtml(p.name)}">${i + 1}. ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name)}</a>`
  ).join('');
  atRiskPopup.classList.remove('hidden');
}

function hideAtRiskPopup() {
  atRiskHideTimer = setTimeout(() => atRiskPopup.classList.add('hidden'), 150);
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
  dueThisMonthHideTimer = setTimeout(() => dueThisMonthPopup.classList.add('hidden'), 150);
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
  return projects.filter((p) => (p.dueDate || '').startsWith(currentMonth));
}

function buildDueMonthHtml() {
  const due = getDueThisMonthProjects();
  const thStyle = 'padding:8px 12px;border:1px solid #ccc;background:#f0f0f0;font-weight:600;text-align:left;';
  const tdStyle = 'padding:8px 12px;border:1px solid #ccc;';
  const headers = ['Customer', 'Jira', 'PM Comments', 'Manager Comments'];
  const headerRow = headers.map(h => `<th style="${thStyle}">${h}</th>`).join('');
  const dataRows = due.map(p => {
    const jiraKey = getJiraLabel(p.jira);
    const jiraCell = p.jira ? `<a href="${escapeHtml(p.jira)}">${escapeHtml(jiraKey)}</a>` : '-';
    return `<tr>
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
  const due = getDueThisMonthProjects();
  const header = 'Customer\tJira\tPM Comments\tManager Comments';
  const rows = due.map((p) => `${p.customer || ''}\t${getJiraLabel(p.jira) || ''}\t\t`);
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

deleteProjectBtn.addEventListener('click', () => {
  if (deleteProjectIndex < 0) return;
  projects.splice(deleteProjectIndex, 1);
  saveProjects();
  renderAll();
  closeDeleteProjectModal();
});

backupAndDeleteProjectBtn.addEventListener('click', () => {
  if (deleteProjectIndex < 0) return;
  if (!backups.length) {
    alert('No backup exists yet. Please create a backup first before deleting.');
    return;
  }
  const project = projects[deleteProjectIndex];
  const latestBackup = backups[0];
  const existingIndex = latestBackup.projects.findIndex(p => p.name === project.name);
  if (existingIndex >= 0) {
    latestBackup.projects[existingIndex] = JSON.parse(JSON.stringify(project));
  } else {
    latestBackup.projects.push(JSON.parse(JSON.stringify(project)));
  }
  saveBackups();
  projects.splice(deleteProjectIndex, 1);
  saveProjects();
  renderAll();
  closeDeleteProjectModal();
});

function positionTooltip(container, e) {
  const wrap = e.target.closest('.health-wrap') || e.target.closest('.progress-wrap');
  if (!wrap) return;
  const tooltip = wrap.querySelector('.health-tooltip') || wrap.querySelector('.progress-tooltip');
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

renderAll();
initAutocompletes();
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

syncProjectProgressFromJira();
startAutoProjectPoll();
