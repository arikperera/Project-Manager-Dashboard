const STORAGE_KEY = 'project-dashboard-projects-v1';

const USERS_KEY = 'project-dashboard-users-v1';
let users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

function saveUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getUserDisplayName(user) {
  return `${user.firstName} ${user.lastName}`.trim();
}

function getUsersByRole(role) {
  return users.filter(u => u.role === role).map(getUserDisplayName);
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

function setupAutocomplete(input, getOptions) {
  const list = input.closest('.autocomplete-wrap').querySelector('.autocomplete-list');
  let activeIndex = -1;

  function showList(items) {
    list.innerHTML = items.map(item => `<li>${item}</li>`).join('');
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
    const term = input.value.trim().toLowerCase();
    const opts = getOptions();
    const matches = term ? opts.filter(o => o.toLowerCase().includes(term)) : opts;
    showList(matches);
  });

  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    const opts = getOptions();
    const matches = term ? opts.filter(o => o.toLowerCase().includes(term)) : opts;
    showList(matches);
  });

  input.addEventListener('keydown', (e) => {
    const items = list.querySelectorAll('li');
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(activeIndex + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); input.value = items[activeIndex].textContent; hideList(); }
    else if (e.key === 'Escape') { hideList(); }
  });

  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    input.value = li.textContent;
    hideList();
  });

  document.addEventListener('click', (e) => {
    if (!input.closest('.autocomplete-wrap').contains(e.target)) hideList();
  });
}

function initAutocompletes() {
  setupAutocomplete(document.getElementById('modalProjectPm'), () => [...new Set(projects.map(p => p.manager).filter(Boolean))]);
  setupAutocomplete(document.getElementById('modalProjectCsm'), () => [...new Set(projects.map(p => p.csm).filter(Boolean))]);
  setupAutocomplete(document.getElementById('modalProjectSales'), () => [...new Set(projects.map(p => p.sales).filter(Boolean))]);
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
  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

function getProgressTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-neutral';
  if (numericValue < 50) return 'progress-green';
  if (numericValue <= 75) return 'progress-yellow';
  return 'progress-red';
}

function getProgressFillTone(value) {
  const numericValue = normalizeProgress(value);
  if (numericValue === null) return 'progress-fill-neutral';
  if (numericValue < 50) return 'progress-fill-green';
  if (numericValue <= 75) return 'progress-fill-yellow';
  return 'progress-fill-red';
}

async function syncProjectProgressFromJira() {
  const issueKeys = projects
    .map((project) => getJiraIssueKey(project.jira))
    .filter(Boolean);

  if (!issueKeys.length) return;

  for (const key of [...new Set(issueKeys)]) {
    try {
      const response = await fetch(
        `https://kaltura.atlassian.net/rest/api/3/issue/${key}?fields=*all&expand=names`,
        { credentials: 'include', headers: { Accept: 'application/json' } }
      );

      if (!response.ok) continue;

      const data = await response.json();

      // Resolve custom field ID from the names map returned in the same response
      let percent = null;
      if (data.names) {
        const fieldEntry = Object.entries(data.names).find(([, name]) => name === 'Project Progress Percentage');
        console.log(`[Jira sync] ${key} — field entry:`, fieldEntry);
        if (fieldEntry) {
          const [fieldId] = fieldEntry;
          const rawValue = data.fields?.[fieldId];
          console.log(`[Jira sync] ${key} — raw field value:`, rawValue);
          // Handle plain number, object with .value, or object with .percent
          const extracted = (rawValue !== null && typeof rawValue === 'object')
            ? (rawValue.value ?? rawValue.percent ?? null)
            : rawValue;
          percent = normalizeProgress(extracted);
        }
      }
      console.log(`[Jira sync] ${key} — resolved percent:`, percent);

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
            <td>${project.customer || '-'}</td>
            <td>${project.name}</td>
            <td><a href="${project.jira || '#'}" target="_blank" rel="noreferrer">${getJiraLabel(project.jira)}</a></td>
            <td>${project.nrr} hrs</td>
            <td>${formatDate(project.startDate)}</td>
            <td>${formatDate(project.dueDate)}</td>
            <td><span class="health-pill health-${(project.health || 'green').toLowerCase()}">${project.health || 'Green'}</span></td>
            <td>
              <div class="progress-bar"><div class="progress-fill ${progressFillTone}" style="width:${progressValue}%"></div></div>
              <small class="progress-label ${progressTone}">${progressValue}%</small>
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
  const uniqueCsms = [...new Set(projects.map((project) => project.csm).filter(Boolean))];
  const uniqueSales = [...new Set(projects.map((project) => project.sales).filter(Boolean))];

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
            <div class="user-row" data-user-id="${u.id}">
              <span>${getUserDisplayName(u)}</span>
              <div>
                <button type="button" class="ghost-btn small-btn" data-edit-user="${u.id}">Edit</button>
                <button type="button" class="ghost-btn small-btn" data-delete-user="${u.id}">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      `).join('')
    : '<p class="muted">No users added yet. Click Add user to get started.</p>';
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
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
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

  users.push({ id: `u_${Date.now()}_${users.length}`, firstName, lastName, role });
  saveUsers();
  addUserForm.style.display = 'none';
  addUserBtn.style.display = '';
  document.getElementById('newUserFirstName').value = '';
  document.getElementById('newUserLastName').value = '';
  document.getElementById('newUserRole').value = 'PM';
  renderUsersModal();
});

renderAll();
initAutocompletes();
syncProjectProgressFromJira();
