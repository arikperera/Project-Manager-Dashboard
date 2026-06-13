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

function getUsersByRole(role) {
  return users.filter(u => u.role === role).map(getUserDisplayName);
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
  });
}

const defaultProjects = [
  { customer: 'Client Customer', name: 'Client Portal', manager: 'Ava', jira: 'https://jira.example.com/CP', nrr: 120, startDate: '2026-05-05', dueDate: '2026-06-30', status: 'On Track', statusText: 'Backend APIs are stable and user testing is in progress.', health: 'Green', progress: 78, comments: 'NRR: 120h, MRR: 8k, CSM: John, Sales: Sara' },
  { customer: 'Mobile Customer', name: 'Mobile Launch', manager: 'Noah', jira: 'https://jira.example.com/ML', nrr: 85, startDate: '2026-04-20', dueDate: '2026-06-18', status: 'At Risk', statusText: 'Vendor dependency delayed design approvals.', health: 'Yellow', progress: 54, comments: 'NRR: 85h, MRR: 6k, CSM: Maya, Sales: Leo' },
  { customer: 'Data Customer', name: 'Data Sync Upgrade', manager: 'Mia', jira: 'https://jira.example.com/DS', nrr: 140, startDate: '2026-05-12', dueDate: '2026-07-05', status: 'Delayed', statusText: 'Data mapping needs a second review cycle.', health: 'Red', progress: 38, comments: 'NRR: 140h, MRR: 10k, CSM: Emma, Sales: Omar' },
  { customer: 'Reporting Customer', name: 'Reporting Hub', manager: 'Liam', jira: 'https://jira.example.com/RH', nrr: 60, startDate: '2026-03-10', dueDate: '2026-06-10', status: 'Completed', statusText: 'All stakeholders have approved the final dashboard.', health: 'Green', progress: 100, comments: 'NRR: 60h, MRR: 4k, CSM: Alex, Sales: Nina' },
];

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
const editStatusEditor = document.getElementById('editStatusEditor');
const editHealth = document.getElementById('editHealth');
const editProgress = document.getElementById('editProgress');
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
const statusFilter = document.getElementById('statusFilter');

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

function triggerAddCustomerFromAutocomplete(name, returnInput) {
  document.getElementById('newCustomerName').value = name;
  document.getElementById('newCustomerSfLink').value = '';
  addCustomerReturnContext = { inputEl: returnInput };
  projectModal.classList.add('hidden');
  projectModal.setAttribute('aria-hidden', 'true');
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
  document.getElementById('newUserRole').value = role;
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

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y.slice(2)}`;
}

function normalizeProgress(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Math.round(numericValue));
}

function getProgressTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-neutral';
  if (numericValue > 100) return 'progress-overrun';
  if (numericValue < 50) return 'progress-green';
  if (numericValue <= 75) return 'progress-yellow';
  return 'progress-red';
}

function getProgressFillTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-fill-neutral';
  if (numericValue > 100) return 'progress-fill-overrun';
  if (numericValue < 50) return 'progress-fill-green';
  if (numericValue <= 75) return 'progress-fill-yellow';
  return 'progress-fill-red';
}

async function syncProjectProgressFromJira() {
  const issueKeys = projects
    .map((project) => getJiraIssueKey(project.jira))
    .filter(Boolean);

  if (!issueKeys.length) return;

  const useProxy = settings.jiraEmail && settings.jiraToken;

  for (const key of [...new Set(issueKeys)]) {
    try {
      const url = useProxy
        ? `http://localhost:8081/jira/issue/${key}?fields=*all&expand=names`
        : `https://kaltura.atlassian.net/rest/api/3/issue/${key}?fields=*all&expand=names`;
      const fetchOpts = useProxy
        ? { headers: { Accept: 'application/json' } }
        : { credentials: 'include', headers: { Accept: 'application/json' } };
      const response = await fetch(url, fetchOpts);

      if (!response.ok) continue;

      const data = await response.json();

      // Resolve custom field ID from the names map returned in the same response
      let percent = null;
      if (data.names) {
        const fieldEntry = Object.entries(data.names).find(([, name]) => name === 'Project Progress Percentage');
        if (fieldEntry) {
          const [fieldId] = fieldEntry;
          const rawValue = data.fields?.[fieldId];
          // Handle plain number, object with .value, or object with .percent
          const extracted = (rawValue !== null && typeof rawValue === 'object')
            ? (rawValue.value ?? rawValue.percent ?? null)
            : rawValue;
          percent = normalizeProgress(extracted);
        }
      }

      // Fall back to built-in Jira progress (subtask-based)
      if (percent === null) {
        percent = normalizeProgress(data?.fields?.progress?.percent ?? data?.fields?.progress);
      }

      if (percent !== null) {
        projects.forEach((project) => {
          if (getJiraIssueKey(project.jira) === key) {
            project.progress = percent;
          }
        });
      }
    } catch (error) {
      console.warn(`Jira progress fetch failed for ${key}`, error);
    }
  }

  saveProjects();
  renderAll();
}

function getFilteredProjects() {
  const term = searchInput.value.toLowerCase().trim();
  const selectedPm = pmFilter.value;
  const selectedHealth = healthFilter.value;
  const selectedProgress = progressFilter.value;
  const selectedStatus = statusFilter.value;

  return projects.filter((project) => {
    const matchesPm = selectedPm === 'All' || project.manager === selectedPm;
    const matchesHealth = selectedHealth === 'All' || project.health === selectedHealth;
    const matchesStatus = selectedStatus === 'All' || project.status === selectedStatus;
    const matchesSearch = !term || `${project.name} ${project.manager || ''} ${project.jira || ''}`.toLowerCase().includes(term);

    let matchesProgress = true;
    if (selectedProgress === '0-39') matchesProgress = project.progress < 40;
    if (selectedProgress === '40-69') matchesProgress = project.progress >= 40 && project.progress < 70;
    if (selectedProgress === '70-100') matchesProgress = project.progress >= 70;

    return matchesPm && matchesHealth && matchesStatus && matchesSearch && matchesProgress;
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
    header.innerHTML = `<h4>${manager}</h4><span>${grouped[manager].length} project${grouped[manager].length === 1 ? '' : 's'}</span>`;
    section.appendChild(header);

    const table = document.createElement('table');
    table.className = 'pm-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Customer name</th>
          <th>Project</th>
          <th>Jira</th>
          <th>NRR(h)</th>
          <th>Start</th>
          <th>End</th>
          <th>Health</th>
          <th>Progress</th>
          <th>Project Status</th>
          <th>Manager Notes</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${grouped[manager].map((project) => {
          const progressValue = normalizeProgress(project.progress) ?? 0;
          const progressTone = getProgressTone(progressValue);
          const progressFillTone = getProgressFillTone(progressValue);
          return `
          <tr>
            <td>${(() => { const cust = customers.find(c => c.name === project.customer); return cust && cust.sfLink ? `<a href="${escapeHtml(cust.sfLink)}" target="_blank" rel="noreferrer">${escapeHtml(project.customer || '-')}</a>` : escapeHtml(project.customer || '-'); })()}</td>
            <td>${project.oppLink ? `<a href="${escapeHtml(project.oppLink)}" target="_blank" rel="noreferrer">${escapeHtml(project.name)}</a>` : escapeHtml(project.name)}</td>
            <td><a href="${project.jira || '#'}" target="_blank" rel="noreferrer">${getJiraLabel(project.jira)}</a></td>
            <td>${project.nrr} hrs</td>
            <td>${formatDate(project.startDate)}</td>
            <td>${formatDate(project.dueDate)}</td>
            <td><span class="health-pill health-${(project.health || 'green').toLowerCase()}">${project.health || 'Green'}</span></td>
            <td>
              <div class="progress-bar"><div class="progress-fill ${progressFillTone}" style="width:${Math.min(progressValue, 100)}%"></div></div>
              <small class="progress-label ${progressTone}">${progressValue}%${progressValue > 100 ? ' ⚠' : ''}</small>
            </td>
            <td><div class="cell-scroll">${project.statusText || '-'}</div></td>
            <td><div class="cell-scroll">${(project.comments || '-').split(', ').join('<br>')}</div></td>
            <td><button type="button" class="secondary-btn small-btn" data-edit-project="${projects.indexOf(project)}">Edit</button></td>
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

}

function renderSummary() {
  const total = projects.length;
  const onTrack = projects.filter((project) => project.status === 'On Track').length;
  const atRisk = projects.filter((project) => project.status === 'At Risk' || project.status === 'Delayed').length;
  const completionRate = Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / total);

  document.getElementById('totalProjects').textContent = total;
  document.getElementById('onTrackCount').textContent = onTrack;
  document.getElementById('atRiskCount').textContent = atRisk;
  document.getElementById('completionRate').textContent = `${completionRate}%`;
}

function openEditProjectModal(projectIndex) {
  const project = projects[projectIndex];
  if (!project) return;

  editCustomerName.value = project.customer || '';
  editProjectName.value = project.name;
  editProgress.value = project.progress ?? '';
  editHealth.value = project.health || 'Green';
  editStatusEditor.innerHTML = project.statusText || '';
  editProjectForm.dataset.projectIndex = String(projectIndex);

  editProjectModal.classList.remove('hidden');
  editProjectModal.setAttribute('aria-hidden', 'false');
}

function closeEditProjectModal() {
  editProjectModal.classList.add('hidden');
  editProjectModal.setAttribute('aria-hidden', 'true');
  editProjectForm.reset();
  editProgress.value = '';
  editStatusEditor.innerHTML = '';
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
  const roles = ['PM', 'CSM', 'Sales'];
  const grouped = roles.map(role => ({
    role,
    members: users.filter(u => u.role === role),
  }));

  const hasUsers = users.length > 0;

  usersModalBody.innerHTML = hasUsers
    ? grouped.map(({ role, members }) => members.length === 0 ? '' : `
        <div style="margin-bottom:14px;">
          <p class="eyebrow" style="margin-bottom:6px;">${role}</p>
          ${members.map(u => `
            <div class="user-row" data-user-id="${escapeHtml(u.id)}">
              <span>${escapeHtml(getUserDisplayName(u))}</span>
              <div>
                <button type="button" class="ghost-btn small-btn" data-edit-user="${escapeHtml(u.id)}">Edit</button>
                <button type="button" class="ghost-btn small-btn" data-delete-user="${escapeHtml(u.id)}">Delete</button>
              </div>
            </div>
          `).join('')}
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
            <th>Customer</th><th>Project</th><th>Jira</th><th>NRR(h)</th>
            <th>Start</th><th>End</th><th>Health</th><th>Progress</th>
            <th>Project Status</th><th>Manager Notes</th>
          </tr></thead>
          <tbody>
            ${grouped[manager].map(p => {
              const pv = Math.max(0, Math.min(100, Math.round(Number(p.progress) || 0)));
              return `<tr>
                <td>${escapeHtml(p.customer || '-')}</td>
                <td>${escapeHtml(p.name)}</td>
                <td><a href="${escapeHtml(p.jira || '#')}" target="_blank" rel="noreferrer">${escapeHtml(getJiraLabel(p.jira))}</a></td>
                <td>${escapeHtml(String(p.nrr || 0))} hrs</td>
                <td>${escapeHtml(formatDate(p.startDate))}</td>
                <td>${escapeHtml(formatDate(p.dueDate))}</td>
                <td><span class="health-pill health-${escapeHtml((p.health || 'green').toLowerCase())}">${escapeHtml(p.health || 'Green')}</span></td>
                <td>
                  <div class="progress-bar"><div class="progress-fill" style="width:${pv}%;background:linear-gradient(90deg,#38bdf8,#a78bfa)"></div></div>
                  <small>${pv}%</small>
                </td>
                <td><div class="cell-scroll">${p.statusText || '-'}</div></td>
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

function openUsersModal() {
  renderUsersModal();
  addUserForm.style.display = 'none';
  usersModal.classList.remove('hidden');
  usersModal.setAttribute('aria-hidden', 'false');
}

function closeUsersModal() {
  usersModal.classList.add('hidden');
  usersModal.setAttribute('aria-hidden', 'true');
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
}

function renderCustomersModal() {
  if (!customers.length) {
    customersModalBody.innerHTML = '<p class="muted">No customers added yet. Click Add customer to get started.</p>';
    return;
  }
  customersModalBody.innerHTML = customers.map(c => `
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
}

editProjectForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const selectedIndex = Number(editProjectForm.dataset.projectIndex ?? -1);
  const selectedProject = projects[selectedIndex];
  if (!selectedProject) return;

  selectedProject.health = editHealth.value;
  const manualProgress = normalizeProgress(editProgress.value);
  if (manualProgress !== null) selectedProject.progress = manualProgress;
  selectedProject.statusText = editStatusEditor.innerHTML.trim() || selectedProject.statusText;

  saveProjects();
  renderAll();
  closeEditProjectModal();
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
    startDate: document.getElementById('modalProjectStartDate').value,
    dueDate: document.getElementById('modalProjectDueDate').value,
    status: 'On Track',
    health: 'Green',
    progress: 0,
    statusText: 'New project created.',
    csm: csmName || '',
    sales: salesName || '',
    comments: `NRR: ${nrrValue || '0h'}, MRR: ${mrrValue || '0'}, CSM: ${csmName || '-'}, Sales: ${salesName || '-'}`,
  });

  saveProjects();
  renderAll();
  closeModal();
  syncProjectProgressFromJira();
});

closeAddCustomerModalBtn.addEventListener('click', () => {
  closeAddCustomerModal();
  if (addCustomerReturnContext) {
    addCustomerReturnContext = null;
    projectModal.classList.remove('hidden');
    projectModal.setAttribute('aria-hidden', 'false');
  }
});
cancelAddCustomerBtn.addEventListener('click', () => {
  closeAddCustomerModal();
  if (addCustomerReturnContext) {
    addCustomerReturnContext = null;
    projectModal.classList.remove('hidden');
    projectModal.setAttribute('aria-hidden', 'false');
  }
});
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
  closeAddCustomerModal();
  if (addCustomerReturnContext) {
    addCustomerReturnContext.inputEl.value = name;
    addCustomerReturnContext = null;
    projectModal.classList.remove('hidden');
    projectModal.setAttribute('aria-hidden', 'false');
  }
});

settingsBtn.addEventListener('click', () => {
  document.getElementById('settingsJiraEmail').value = settings.jiraEmail || '';
  document.getElementById('settingsJiraToken').value = settings.jiraToken || '';
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
  saveSettings();
  try {
    await fetch('http://localhost:8081/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jiraEmail: settings.jiraEmail, jiraToken: settings.jiraToken }),
    });
  } catch (e) {
    console.warn('Proxy not running — start proxy.ps1 for Jira sync to work.', e);
  }
  closeSettingsModal();
  syncProjectProgressFromJira();
});

manageCustomersBtn.addEventListener('click', openCustomersModal);
closeCustomersModalBtn.addEventListener('click', closeCustomersModal);
customersModal.addEventListener('click', (e) => { if (e.target === customersModal) closeCustomersModal(); });

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
projectModal.addEventListener('click', (event) => {
  if (event.target === projectModal) closeModal();
});

editProjectModal.addEventListener('click', (event) => {
  if (event.target === editProjectModal) closeEditProjectModal();
});

portfolioGroups.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-project]');
  if (!editButton) return;

  openEditProjectModal(Number(editButton.dataset.editProject));
});

editProjectModal.addEventListener('click', (event) => {
  const toolbarButton = event.target.closest('[data-rich-command]');
  if (!toolbarButton) return;

  event.preventDefault();
  document.execCommand(toolbarButton.dataset.richCommand, false, null);
  editStatusEditor.focus();
});

searchInput.addEventListener('input', renderTable);
pmFilter.addEventListener('change', renderTable);
healthFilter.addEventListener('change', renderTable);
progressFilter.addEventListener('change', renderTable);
statusFilter.addEventListener('change', renderTable);

exportBtn.addEventListener('click', () => {
  const lines = [
    'Project Dashboard Report',
    'Generated on: ' + new Date().toLocaleDateString(),
    '',
    'Customer name,Project,PM,Jira,NRR,Start Date,End Date,Status,Health,Progress,Project Status,Manager Notes',
    ...projects.map((project) =>
      [project.customer || '', project.name, project.manager || '', getJiraLabel(project.jira), project.nrr || 0, project.startDate || '', project.dueDate || '', project.status, project.health || 'Green', `${project.progress}%`, project.statusText || '', project.comments || ''].join(',')
    ),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'project-dashboard-report.csv';
  link.click();
  URL.revokeObjectURL(url);
});

manageUsersBtn.addEventListener('click', openUsersModal);
closeUsersModalBtn.addEventListener('click', closeUsersModal);
usersModal.addEventListener('click', (e) => { if (e.target === usersModal) closeUsersModal(); });

addUserBtn.addEventListener('click', () => {
  addUserForm.style.display = 'grid';
  addUserBtn.style.display = 'none';
});

cancelAddUserBtn.addEventListener('click', () => {
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
});

saveAddUserBtn.addEventListener('click', () => {
  const firstName = document.getElementById('newUserFirstName').value.trim();
  const lastName = document.getElementById('newUserLastName').value.trim();
  const role = document.getElementById('newUserRole').value;
  if (!firstName || !lastName) return;

  const displayName = `${firstName} ${lastName}`.trim();
  if (users.some(u => getUserDisplayName(u) === displayName)) {
    alert(`A user named "${displayName}" already exists.`);
    return;
  }
  users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, role });
  saveUsers();
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
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
        <label style="grid-column:1">Role
          <select class="edit-role">
            <option value="PM"${user.role === 'PM' ? ' selected' : ''}>PM</option>
            <option value="CSM"${user.role === 'CSM' ? ' selected' : ''}>CSM</option>
            <option value="Sales"${user.role === 'Sales' ? ' selected' : ''}>Sales</option>
          </select>
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
    user.role = editingRow.querySelector('.edit-role').value;
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

atRiskCard.addEventListener('mouseenter', () => {
  const atRiskProjects = projects.filter(p => p.status === 'At Risk' || p.status === 'Delayed');
  if (!atRiskProjects.length) return;
  atRiskPopup.innerHTML = atRiskProjects.map(p => {
    const id = `project-${escapeHtml(p.name.replace(/\s+/g, '-'))}`;
    return `<a href="#projects" data-scroll-project="${escapeHtml(p.name)}">${escapeHtml(p.name)}</a>`;
  }).join('');
  atRiskPopup.classList.remove('hidden');
});

atRiskCard.addEventListener('mouseleave', () => {
  atRiskPopup.classList.add('hidden');
});

atRiskPopup.addEventListener('click', (e) => {
  const link = e.target.closest('[data-scroll-project]');
  if (!link) return;
  const projectName = link.dataset.scrollProject;
  const rows = portfolioGroups.querySelectorAll('tr');
  for (const row of rows) {
    const nameCell = row.querySelector('td:nth-child(2)');
    if (nameCell && nameCell.textContent.trim() === projectName) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.style.outline = '2px solid rgba(56,189,248,0.6)';
      setTimeout(() => { row.style.outline = ''; }, 2000);
      break;
    }
  }
  atRiskPopup.classList.add('hidden');
});

renderAll();
initAutocompletes();
syncProjectProgressFromJira();
