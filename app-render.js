
async function trySyncLocalToKV() {
  // Strip anything tombstoned (deleted by this browser OR any other session while we
  // were offline) before pushing our possibly-stale local copy back to KV — otherwise
  // a reconnecting browser with an old in-memory list can resurrect someone else's delete.
  const projectDeleteIds = await getCombinedDeleteIds(STORAGE_KEY);
  const taskDeleteIds = await getCombinedDeleteIds(TASKS_KEY);
  const cleanProjects = projectDeleteIds.size ? projects.filter(p => !projectDeleteIds.has(getItemDeleteKey(p))) : projects;
  const cleanTasks = taskDeleteIds.size ? tasks.filter(t => !taskDeleteIds.has(getItemDeleteKey(t))) : tasks;
  if (cleanProjects.length !== projects.length) { projects = cleanProjects; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {} }
  if (cleanTasks.length !== tasks.length) { tasks = cleanTasks; try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {} }

  await logSaveDiff(STORAGE_KEY, 'projects', projects, 'reconnect-sync');
  await logSaveDiff(TASKS_KEY, 'tasks', tasks, 'reconnect-sync');

  // Push in-memory data (which has offline deletes/adds applied) to KV
  const stores = [
    [STORAGE_KEY, projects],
    [USERS_KEY, users],
    [CUSTOMERS_KEY, customers],
    [BACKUPS_KEY, backups],
    [TASKS_KEY, tasks],
    [CLOSED_PROJECTS_KEY, closedProjects],
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

// Pulls fresh projects/tasks from KV, applying the same tombstone/pending-delete protection
// used at page load — so a deleted item never reappears regardless of how the refresh was triggered
// (poll tick, Refresh Dashboard button, or a plain browser reload).
async function refreshProjectsAndTasksFromKv() {
  let changed = false;

  const freshProjects = await kvGet(STORAGE_KEY);
  if (freshProjects) {
    // Combined delete set: this browser's pending deletes + shared KV tombstones (other sessions' deletes)
    const pendingDelIds = await getCombinedDeleteIds(STORAGE_KEY);
    // Strip any pending-deleted projects that KV still has (KV write may have failed on delete)
    const kvFiltered = freshProjects.filter(p => !pendingDelIds.has(getItemDeleteKey(p)));
    _saveBaseline[STORAGE_KEY] = JSON.parse(JSON.stringify(kvFiltered));
    const kvJiraKeys = new Set(kvFiltered.map(p => p.jira).filter(Boolean));
    // Merge in local-only items for DISPLAY only (added moments ago, save still in flight) —
    // deliberately NOT written back to KV here. A stale tab can hold a local-only item
    // indefinitely (e.g. a leftover of something deleted elsewhere whose tombstone has since
    // cleared); auto-pushing it back would resurrect it. Genuine offline-add persistence is
    // handled by the save-with-retry in saveProjects/saveTasks and by trySyncLocalToKV on
    // reconnect, both of which apply full tombstone protection.
    const localOnly = projects.filter(p => p.jira && !kvJiraKeys.has(p.jira) && !pendingDelIds.has(getItemDeleteKey(p)));
    const merged = localOnly.length > 0 ? [...kvFiltered, ...localOnly] : kvFiltered;
    if (JSON.stringify(merged) !== JSON.stringify(projects)) {
      projects = merged;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch {}
      changed = true;
    }
  }

  const freshTasks = await kvGet(TASKS_KEY);
  if (freshTasks) {
    const pendingDelTaskIds = await getCombinedDeleteIds(TASKS_KEY);
    const kvFilteredTasks = freshTasks.filter(t => !pendingDelTaskIds.has(getItemDeleteKey(t)));
    const kvTaskIds = new Set(kvFilteredTasks.map(t => t.id).filter(Boolean));
    const localOnlyTasks = tasks.filter(t => t.id && !kvTaskIds.has(t.id) && !pendingDelTaskIds.has(t.id));
    const mergedTasks = localOnlyTasks.length > 0 ? [...kvFilteredTasks, ...localOnlyTasks] : kvFilteredTasks;
    if (JSON.stringify(mergedTasks) !== JSON.stringify(tasks)) {
      tasks = mergedTasks;
      try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch {}
      changed = true;
    }
  }

  return changed;
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

    const changed = await refreshProjectsAndTasksFromKv();
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

// The Jira write always authenticates as the shared service account, so Jira's own
// "posted by" metadata can't reflect the real person — but the comment text can. Prefix
// it with whoever is actually logged into the dashboard (via pm-identity), falling back
// to a generic label if that lookup fails for any reason.
async function getDashboardAttributionPrefix() {
  const realUserName = await getCurrentUserName().catch(() => '');
  return realUserName ? `Dashboard (${realUserName})` : 'Dashboard';
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

// Shows an hourglass + busy label on a button while an async action runs, so a save that
// takes a moment (KV write, Jira sync, comment post/delete) doesn't look unresponsive.
// Restores the button's exact original content/state afterward, success or failure.
function setButtonBusy(btn, busy, busyText) {
  if (!btn) return;
  if (busy) {
    if (btn.dataset.busyOriginalHtml === undefined) btn.dataset.busyOriginalHtml = btn.innerHTML;
    const label = busyText === undefined ? 'Working...' : busyText;
    // Spinner is its own element (not baked into a text string) so the rotation animation
    // applies cleanly to just the icon, independent of whatever label text sits beside it.
    btn.innerHTML = '';
    const spinner = document.createElement('span');
    spinner.className = 'btn-spinner';
    spinner.textContent = '⏳';
    btn.appendChild(spinner);
    if (label) btn.appendChild(document.createTextNode(label));
    btn.disabled = true;
  } else {
    if (btn.dataset.busyOriginalHtml !== undefined) {
      btn.innerHTML = btn.dataset.busyOriginalHtml;
      delete btn.dataset.busyOriginalHtml;
    }
    btn.disabled = false;
  }
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
  const selectedAddedMonth = addedMonthFilter.value;
  const selectedRegion = regionFilter.value;

  function matchItem(item) {
    const owner = item.manager || item.owner || '';
    const matchesPm = selectedPm === 'All' || owner === selectedPm;
    const matchesHealth = selectedHealth === 'All' || item.health === selectedHealth;
    const matchesDueMonth = !selectedDueMonth || (item.dueDate || '').startsWith(selectedDueMonth);
    const matchesAddedMonth = !selectedAddedMonth || (item.startDate || '').startsWith(selectedAddedMonth);
    const jiraId = (getJiraIssueKey(item.jira) || '').split('-').pop();
    const matchesSearch = !term || `${item.name || ''} ${owner} ${item.customer || ''} ${jiraId}`.toLowerCase().includes(term);
    let matchesProgress = true;
    if (selectedProgress === '0-39') matchesProgress = item.progress < 40;
    if (selectedProgress === '40-69') matchesProgress = item.progress >= 40 && item.progress < 70;
    if (selectedProgress === '70-100') matchesProgress = item.progress >= 70;
    if (selectedProgress === '100+') matchesProgress = Number(item.progress) >= 100;
    const matchesRegion = !selectedRegion || item.region === selectedRegion;
    return matchesPm && matchesHealth && matchesDueMonth && matchesAddedMonth && matchesSearch && matchesProgress && matchesRegion;
  }

  const filteredProjects = projects.filter(matchItem);
  const filteredTasks = tasks.filter(matchItem);
  return [...filteredProjects, ...filteredTasks];
}

function renderTable() {
  const filteredProjects = getFilteredProjects();
  const countBadge = document.getElementById('projectsCountBadge');
  if (countBadge) countBadge.textContent = filteredProjects.filter(p => p.type !== 'task').length;
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
              <button type="button" class="secondary-btn small-btn" data-edit-project="${project.type === 'task' ? tasks.indexOf(project) : projects.indexOf(project)}" data-item-type="${project.type || 'project'}">${project.type === 'task' ? 'Edit Task' : 'Edit Project'}</button>
              <button type="button" class="ghost-btn small-btn" style="margin-top:4px;display:block;" data-open-comments="${project.type === 'task' ? tasks.indexOf(project) : projects.indexOf(project)}" data-item-type="${project.type || 'project'}">Comments</button>
              <button type="button" class="ghost-btn small-btn" style="margin-top:4px;display:block;" data-delete-project="${project.type === 'task' ? tasks.indexOf(project) : projects.indexOf(project)}" data-item-type="${project.type || 'project'}">${project.type === 'task' ? 'Delete Task' : 'Delete Project'}</button>
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

  const addedMonthOptions = [['', 'Project added month']];
  for (let i = 0; i >= -2; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    addedMonthOptions.push([value, label]);
  }
  const currentAddedMonth = addedMonthFilter.value;
  addedMonthFilter.innerHTML = addedMonthOptions.map(([v, l]) => `<option value="${v}"${v === currentAddedMonth ? ' selected' : ''}>${l}</option>`).join('');
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
  pmNotesLabel.style.display = itemType === 'task' ? 'none' : '';
  document.getElementById('pmNotesEditorBlock').style.display = itemType === 'task' ? 'none' : '';
  if (itemType !== 'task') {
    if (item.pmNotes) {
      pmNotesEditor.innerHTML = item.pmNotes;
      pmNotesEditor.removeAttribute('data-placeholder-active');
    } else {
      pmNotesEditor.innerHTML = '<span style="font-style:italic;opacity:0.5;">No notes yet</span>';
      pmNotesEditor.setAttribute('data-placeholder-active', '1');
    }
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
  editStatusToolbar.linkPopup.style.display = 'none';
  pmNotesEditor.innerHTML = '';
  pmNotesEditor.removeAttribute('data-placeholder-active');
  pmNotesToolbar.linkPopup.style.display = 'none';
  editPmStatus.value = '';
  pmStatusLabel.style.display = 'none';
  editRiskReason.value = '';
  editRegion.value = '';
  riskReasonLabel.style.display = '';
}

const commentComposerToolbar = setupRichEditorToolbar(
  commentComposerEditor,
  document.getElementById('commentComposerBlock'),
  {}
);
setupMentionAutocomplete(commentComposerEditor);

async function openCommentsModal(itemType, itemIndex) {
  const item = itemType === 'task' ? tasks[itemIndex] : projects[itemIndex];
  if (!item) return;
  const issueKey = getJiraIssueKey(item.jira);
  if (!issueKey) {
    showToast('No Jira issue linked to this item', 'error');
    return;
  }
  commentsModal.dataset.issueKey = issueKey;
  commentsModalTitle.textContent = `${item.name || item.parentProjectName || '-'} (${issueKey})`;
  commentComposerEditor.innerHTML = '';
  commentComposerEditor.removeAttribute('data-placeholder-active');
  commentsModal.classList.remove('hidden');
  commentsModal.setAttribute('aria-hidden', 'false');
  await fetchAndRenderComments(issueKey);
}

function closeCommentsModal() {
  commentsModal.classList.add('hidden');
  commentsModal.setAttribute('aria-hidden', 'true');
  commentComposerEditor.innerHTML = '';
  commentComposerEditor.removeAttribute('data-placeholder-active');
  commentComposerToolbar.linkPopup.style.display = 'none';
  hideMentionDropdown();
  delete commentsModal.dataset.issueKey;
}

async function fetchAndRenderComments(issueKey) {
  commentsList.innerHTML = '<div class="comments-list-empty">Loading…</div>';
  try {
    const res = await fetch(`${PROXY_BASE}/jira/issue/${issueKey}/comment`, {
      headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
    });
    if (!res.ok) { commentsList.innerHTML = '<div class="comments-list-empty">Failed to load comments</div>'; return; }
    const data = await res.json();
    const comments = Array.isArray(data.comments) ? data.comments : [];
    comments.sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0));
    if (!comments.length) {
      commentsList.innerHTML = '<div class="comments-list-empty">No comments yet</div>';
      return;
    }
    commentsList.innerHTML = comments.map(c => {
      const author = c.author?.displayName || 'Unknown';
      const created = c.created ? new Date(c.created).toLocaleString() : '';
      const bodyHtml = c.body ? adfToHtml(c.body) : '';
      return `<div class="comment-item">
        <div class="comment-meta">
          <span class="comment-author">${escapeHtml(author)}</span>
          <span class="comment-meta-right">
            <span>${escapeHtml(created)}</span>
            <button type="button" class="comment-delete-btn" data-delete-comment="${escapeHtml(String(c.id))}" title="Delete comment" aria-label="Delete comment"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 3a1 1 0 0 0-1 1v1H4a1 1 0 1 0 0 2h16a1 1 0 1 0 0-2h-4V4a1 1 0 0 0-1-1H9Zm-3 6 .84 12.02A2 2 0 0 0 8.83 23h6.34a2 2 0 0 0 1.99-1.98L18 9H6Z"/></svg></button>
          </span>
        </div>
        <div class="comment-body">${bodyHtml}</div>
      </div>`;
    }).join('');
  } catch {
    commentsList.innerHTML = '<div class="comments-list-empty">Failed to load comments</div>';
  }
}

async function deleteJiraComment(issueKey, commentId) {
  try {
    const res = await fetch(`${PROXY_BASE}/jira/issue/${issueKey}/comment/${commentId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
    });
    return res.ok;
  } catch {
    return false;
  }
}

commentsList.addEventListener('click', async (event) => {
  const btn = event.target.closest('[data-delete-comment]');
  if (!btn) return;
  const commentId = btn.dataset.deleteComment;
  const issueKey = commentsModal.dataset.issueKey;
  if (!commentId || !issueKey) return;
  const confirmed = await showAppConfirm('Delete this comment from Jira? This cannot be undone.', {
    title: 'Delete comment?',
    eyebrow: 'Comments',
    danger: true,
    confirmLabel: 'Delete',
  });
  if (!confirmed) return;
  setButtonBusy(btn, true, '');
  const ok = await deleteJiraComment(issueKey, commentId);
  if (ok) {
    showToast('Comment deleted', 'success');
    // Remove the item directly instead of re-fetching the whole list from Jira —
    // avoids a second round-trip (and a visible delay) just to drop one item.
    const item = btn.closest('.comment-item');
    if (item) item.remove();
    if (!commentsList.querySelector('.comment-item')) {
      commentsList.innerHTML = '<div class="comments-list-empty">No comments yet</div>';
    }
  } else {
    showToast('Failed to delete comment (check Jira permissions)', 'error');
    setButtonBusy(btn, false);
  }
});

async function postComposerComment(issueKey) {
  const html = commentComposerEditor.getAttribute('data-placeholder-active') ? '' : commentComposerEditor.innerHTML.trim();
  if (!html || !html.replace(/<[^>]+>/g, '').trim()) {
    showToast('Comment is empty', 'error');
    return;
  }
  const attribution = await getDashboardAttributionPrefix();
  const adf = htmlToAdf(html);
  // Attribution goes on its own line, with the actual comment starting on the next —
  // rather than merged into the first line of whatever the user typed.
  adf.content.unshift({ type: 'paragraph', content: [{ type: 'text', text: `${attribution}:` }] });
  try {
    const res = await fetch(`${PROXY_BASE}/jira/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-KV-Secret': KV_SECRET },
      body: JSON.stringify({ body: adf }),
    });
    if (!res.ok) {
      showToast('Failed to post comment', 'error');
      return;
    }
    showToast('Comment posted', 'success');
    closeCommentsModal();
  } catch {
    showToast('Failed to post comment', 'error');
  }
}

closeCommentsModalBtn.addEventListener('click', closeCommentsModal);
cancelCommentsModalBtn.addEventListener('click', closeCommentsModal);
commentsModal.addEventListener('click', (event) => {
  if (event.target === commentsModal) closeCommentsModal();
});
saveCommentBtn.addEventListener('click', async () => {
  const issueKey = commentsModal.dataset.issueKey;
  if (!issueKey) return;
  setButtonBusy(saveCommentBtn, true, 'Posting...');
  await postComposerComment(issueKey);
  setButtonBusy(saveCommentBtn, false);
});

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

  backupSidebar.innerHTML = backups.map(b => {
    const isRecent = b.timestamp && (Date.now() - b.timestamp) < 3 * 24 * 60 * 60 * 1000;
    return `
    <div class="backup-entry${b.id === selectedBackupId ? ' selected' : ''}" data-backup-id="${escapeHtml(b.id)}">
      <span${isRecent ? ' style="color:#fbbf24;font-weight:700;" title="Created within the last 3 days"' : ''}>${escapeHtml(b.label)}</span>
    </div>
  `;
  }).join('');

  const backup = backups.find(b => b.id === selectedBackupId);
  renderBackupMain(backup);
}

function renderBackupMain(backup) {
  const allItems = [...(backup.projects || []), ...(backup.tasks || [])];
  const grouped = allItems.reduce((acc, p) => {
    const key = p.manager || p.owner || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const tableRows = Object.keys(grouped).sort((a, b) => a.localeCompare(b)).map(manager => `
    <div class="pm-group" style="margin-bottom:10px;">
      <div class="pm-group-header"><h4 style="display:flex;align-items:center;">${getUserAvatarHtml(manager)}${escapeHtml(manager)}</h4><span>${(() => {
        const projCount = grouped[manager].filter(p => p.type !== 'task').length;
        const taskCount = grouped[manager].filter(p => p.type === 'task').length;
        return `${projCount} project${projCount === 1 ? '' : 's'}${taskCount ? ` · ${taskCount} task${taskCount === 1 ? '' : 's'}` : ''}`;
      })()}</span></div>
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
                return allItems.indexOf(b) - allItems.indexOf(a);
              }).map(p => {
              const pv = Math.max(0, Math.min(100, Math.round(Number(p.progress) || 0)));
              return `<tr>
                <td>${escapeHtml(p.customer || '-')}</td>
                <td>${escapeHtml(p.name || p.parentProjectName || '-')}</td>
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
      <label><input type="checkbox" id="restoreTasks" checked> Restore tasks</label>
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
    const restoreTasksEl = document.getElementById('restoreTasks');
    const restoreUsersEl = document.getElementById('restoreUsers');
    if (!restoreProjectsEl.checked && !restoreTasksEl.checked && !restoreUsersEl.checked) return;
    if (restoreProjectsEl.checked) {
      projects = JSON.parse(JSON.stringify(backup.projects));
      // Clear tombstones for everything in this snapshot — otherwise saveProjects would
      // strip back out anything that was deleted after this backup was taken.
      for (const p of projects) {
        if (p.jira) {
          removePendingDelete(p.jira, STORAGE_KEY);
          await removeKvTombstone(p.jira, STORAGE_KEY);
        }
      }
      await saveProjects('restore-from-backup', { skipMerge: true });
    }
    if (restoreTasksEl.checked && Array.isArray(backup.tasks)) {
      tasks = JSON.parse(JSON.stringify(backup.tasks));
      for (const t of tasks) {
        if (t.id) {
          removePendingDelete(t.id, TASKS_KEY);
          await removeKvTombstone(t.id, TASKS_KEY);
        }
      }
      await saveTasks('restore-from-backup');
    }
    if (restoreUsersEl.checked) {
      users = JSON.parse(JSON.stringify(backup.users));
      await saveUsers();
    }
    renderAll();
    closeBackupsModal();
  });

  document.getElementById('deleteBackupBtn').addEventListener('click', async () => {
    backups = backups.filter(b => b.id !== backup.id);
    await addKvTombstone(backup.id, BACKUPS_KEY);
    await saveBackups('manual-delete');
    selectedBackupId = backups.length ? backups[0].id : null;
    renderBackupsPanel();
  });
}

function getQuarterKey(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const q = Math.floor(d.getMonth() / 3) + 1;
  const yy = String(d.getFullYear()).slice(2);
  return `Q${q}${yy}`;
}

function populateClosedFilterOptions() {
  const uniquePMs = [...new Set(closedProjects.map(p => p.manager).filter(Boolean))].sort();
  const currentPm = closedPmFilter.value;
  closedPmFilter.innerHTML = ['<option value="All">All PMs</option>', ...uniquePMs.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)].join('');
  if (uniquePMs.includes(currentPm) || currentPm === 'All') closedPmFilter.value = currentPm;

  const monthSet = new Set(closedProjects.map(p => (p.closedAt || '').slice(0, 7)).filter(Boolean));
  const months = [...monthSet].sort((a, b) => b.localeCompare(a));
  const currentMonth = closedMonthFilter.value;
  closedMonthFilter.innerHTML = ['<option value="">All closed months</option>', ...months.map(m => {
    const label = new Date(`${m}-01T00:00:00`).toLocaleString('default', { month: 'long', year: 'numeric' });
    return `<option value="${m}">${label}</option>`;
  })].join('');
  if (months.includes(currentMonth)) closedMonthFilter.value = currentMonth;

  const quarterSet = new Set(closedProjects.map(p => getQuarterKey(p.closedAt)).filter(Boolean));
  const quarters = [...quarterSet].sort().reverse();
  const currentQuarter = closedQuarterFilter.value;
  closedQuarterFilter.innerHTML = ['<option value="">All closed quarters</option>', ...quarters.map(q => `<option value="${q}">${q}</option>`)].join('');
  if (quarters.includes(currentQuarter)) closedQuarterFilter.value = currentQuarter;
}

function getFilteredClosedProjects() {
  const term = closedSearchInput.value.toLowerCase().trim();
  const selectedPm = closedPmFilter.value;
  const selectedRegion = closedRegionFilter.value;
  const selectedMonth = closedMonthFilter.value;
  const selectedQuarter = closedQuarterFilter.value;

  return closedProjects.filter(p => {
    const matchesPm = selectedPm === 'All' || (p.manager || '') === selectedPm;
    const matchesRegion = !selectedRegion || p.region === selectedRegion;
    const matchesMonth = !selectedMonth || (p.closedAt || '').slice(0, 7) === selectedMonth;
    const matchesQuarter = !selectedQuarter || getQuarterKey(p.closedAt) === selectedQuarter;
    const jiraId = (getJiraIssueKey(p.jira) || '').split('-').pop();
    const matchesSearch = !term || `${p.name || ''} ${p.manager || ''} ${p.customer || ''} ${jiraId}`.toLowerCase().includes(term);
    return matchesPm && matchesRegion && matchesMonth && matchesQuarter && matchesSearch;
  });
}

function renderClosedProjectsPanel() {
  const el = document.getElementById('closedProjectsMain');
  populateClosedFilterOptions();

  const filtered = closedProjects.length ? getFilteredClosedProjects() : [];
  const countBadge = document.getElementById('closedProjectsCountBadge');
  if (countBadge) countBadge.textContent = filtered.length;

  if (!closedProjects.length) {
    el.innerHTML = '<p class="muted">No closed projects yet. Projects moved here when you Backup &amp; Delete them.</p>';
    return;
  }

  if (!filtered.length) {
    el.innerHTML = '<p class="muted">No closed projects match the current filters.</p>';
    return;
  }

  const grouped = filtered.reduce((acc, p) => {
    const key = p.manager || 'Unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  el.innerHTML = Object.keys(grouped).sort((a, b) => a.localeCompare(b)).map(manager => `
    <div class="pm-group" style="margin-bottom:10px;">
      <div class="pm-group-header"><h4 style="display:flex;align-items:center;">${getUserAvatarHtml(manager)}${escapeHtml(manager)}</h4><span>${grouped[manager].length} project${grouped[manager].length === 1 ? '' : 's'}</span></div>
      <div style="overflow-x:auto;">
        <table class="pm-table">
          <thead><tr>
            <th>Customer</th><th>Opportunity</th><th>Jira / AT</th><th>NRR(h)</th>
            <th>Start</th><th>End</th><th>Closed</th><th>Manager Notes</th><th></th>
          </tr></thead>
          <tbody>
            ${grouped[manager].slice().sort((a, b) => new Date(b.closedAt || 0).getTime() - new Date(a.closedAt || 0).getTime()).map(p => `
              <tr>
                <td>${(() => { const custLink = p.accountUrl || (customers.find(c => c.name === p.customer)?.sfLink) || ''; return custLink ? `<a href="${escapeHtml(custLink)}" target="_blank" rel="noreferrer">${escapeHtml(p.customer || '-')}</a>` : escapeHtml(p.customer || '-'); })()}</td>
                <td>${p.oppLink ? `<a href="${escapeHtml(p.oppLink)}" target="_blank" rel="noreferrer">${escapeHtml(p.name || '-')}</a>` : escapeHtml(p.name || '-')}</td>
                <td class="jira-at-cell">
                  ${p.jira ? `<a class="jira-at-btn" href="${escapeHtml(p.jira)}" target="_blank" rel="noreferrer">${escapeHtml(getJiraLabel(p.jira))}</a>` : '<span style="color:#64748b">—</span>'}
                  ${p.atLink ? `<a class="jira-at-btn" href="${escapeHtml(p.atLink)}" target="_blank" rel="noreferrer">AT</a>` : ''}
                </td>
                <td>${escapeHtml(String(p.nrr || 0))} hrs</td>
                <td>${escapeHtml(formatDate(p.startDate))}</td>
                <td>${escapeHtml(formatDate(p.dueDate))}</td>
                <td>${(() => {
                  const closedTs = p.closedAt ? new Date(p.closedAt).getTime() : 0;
                  const isRecent = closedTs && (Date.now() - closedTs) < 3 * 24 * 60 * 60 * 1000;
                  const label = escapeHtml(formatDate((p.closedAt || '').slice(0, 10)));
                  return isRecent ? `<span style="color:#fbbf24;font-weight:700;" title="Closed within the last 3 days">${label}</span>` : label;
                })()}</td>
                <td><div class="cell-scroll">${escapeHtml((p.comments || '-').split(', ').join('\n'))}</div></td>
                <td><button type="button" class="secondary-btn small-btn restore-closed-project-btn" data-jira="${escapeHtml(p.jira || '')}">Restore</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.restore-closed-project-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jira = btn.dataset.jira;
      // Refresh from KV right before mutating — same reasoning as backupAndDeleteProjectBtn.
      const freshClosed = await kvGet(CLOSED_PROJECTS_KEY);
      if (Array.isArray(freshClosed)) closedProjects = freshClosed;
      const idx = closedProjects.findIndex(p => (p.jira || '') === jira);
      if (idx < 0) return;
      const [restored] = closedProjects.splice(idx, 1);
      delete restored.closedAt;
      removePendingDelete(jira, STORAGE_KEY);
      await removeKvTombstone(jira, STORAGE_KEY);
      projects.push(restored);
      await saveClosedProjects('restore-to-active');
      await saveProjects('restore-from-closed');
      renderClosedProjectsPanel();
      renderAll();
      showToast(`${restored.name} restored to active projects.`, 'success');
    });
  });
}

function openClosedProjectsModal() {
  renderClosedProjectsPanel();
  closedProjectsModal.classList.remove('hidden');
  closedProjectsModal.setAttribute('aria-hidden', 'false');
}

function closeClosedProjectsModal() {
  closedProjectsModal.classList.add('hidden');
  closedProjectsModal.setAttribute('aria-hidden', 'true');
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
  if (itemType !== 'task') {
    const rawNotes = pmNotesEditor.getAttribute('data-placeholder-active') ? '' : pmNotesEditor.innerHTML.trim();
    selectedProject.pmNotes = isEmptyStatus(rawNotes) ? '' : rawNotes;
  }

  setButtonBusy(saveEditModalBtn, true, 'Saving...');
  if (itemType === 'task') { await saveTasks('edit-save'); } else { await saveProjects('edit-save'); }
  setButtonBusy(saveEditModalBtn, false);
  renderAll();
  closeEditProjectModal();

  if (itemType !== 'task') {
    const issueKey = getJiraIssueKey(selectedProject.jira);
    if (issueKey) {
      const jiraWriteError = (label) => (e) => {
        console.error(`[${label}→Jira]`, e); showToast(`Jira ${label} sync failed: ${e.message}`);
      };
      writeRiskReasonToJira(issueKey, riskOptionId || null).catch(jiraWriteError('riskReason'));
      writeRiskRateToJira(issueKey, selectedProject.health).catch(jiraWriteError('riskRate'));
      if (newDueDate) writeDueDateToJira(issueKey, newDueDate).catch(jiraWriteError('dueDate'));
      if (selectedProject.region) writeRegionToJira(issueKey, selectedProject.region).catch(jiraWriteError('region'));
      writeStatusToJira(issueKey, selectedProject.statusText).catch(jiraWriteError('status'));
      if (managerChanged) writeAssigneeToJira(issueKey, selectedProject.manager).catch(jiraWriteError('assignee'));
    }
  }
});

modalProjectForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const pmName = document.getElementById('modalProjectPm').value.trim();
  const csmName = document.getElementById('modalProjectCsm').value.trim();
  const salesName = document.getElementById('modalProjectSales').value.trim();
  const nrrValue = document.getElementById('modalProjectNrrValue').value.trim();
  const mrrValue = document.getElementById('modalProjectMrrValue').value.trim();
  const jiraValue = document.getElementById('modalProjectJira').value.trim();

  projects.unshift({
    customer: document.getElementById('modalProjectCustomer').value.trim() || 'Unknown',
    name: document.getElementById('modalProjectName').value.trim(),
    oppLink: document.getElementById('modalProjectOppLink').value.trim(),
    manager: pmName || 'Unassigned',
    jira: jiraValue,
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

  // Clear any lingering tombstone for this jira key — otherwise saveProjects would strip
  // this deliberate add right back out, since it still matches a prior deletion.
  if (jiraValue) {
    removePendingDelete(jiraValue, STORAGE_KEY);
    await removeKvTombstone(jiraValue, STORAGE_KEY);
  }

  const newProjectJiraKey = getJiraIssueKey(jiraValue);
  const newProjectDueDate = parseDateInput(document.getElementById('modalProjectDueDate').value);
  await saveProjects('add-project');
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

openActivityLogBtn.addEventListener('click', () => {
  closeSettingsModal();
  window.open('activity-log.html', '_blank');
});
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
      saveProjects('customer-rename-propagation');
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
  const commentsButton = event.target.closest('[data-open-comments]');
  if (commentsButton) {
    openCommentsModal(
      commentsButton.dataset.itemType || 'project',
      Number(commentsButton.dataset.openComments)
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

const editStatusToolbar = setupRichEditorToolbar(
  editStatusEditor,
  document.getElementById('editStatusEditorBlock'),
  { placeholderHtml: '<span style="font-style:italic;opacity:0.5;">No Status Entered</span>' }
);
setupMentionAutocomplete(editStatusEditor);

const pmNotesToolbar = setupRichEditorToolbar(
  pmNotesEditor,
  document.getElementById('pmNotesEditorBlock'),
  { placeholderHtml: '<span style="font-style:italic;opacity:0.5;">No notes yet</span>' }
);

searchInput.addEventListener('input', renderTable);
const FILTER_STORAGE_KEY = 'project-dashboard-filters-v1';

function saveFilters() {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
      pm: pmFilter.value,
      health: healthFilter.value,
      progress: progressFilter.value,
      duemonth: duemonthFilter.value,
      addedmonth: addedMonthFilter.value,
      region: regionFilter.value,
      search: searchInput.value,
    }));
  } catch {}
}

function restoreFilters() {
  try {
    // URL params take priority over localStorage
    const params = new URLSearchParams(window.location.search);
    const urlPm = params.get('pm');
    const urlHealth = params.get('health');
    const urlRegion = params.get('region');
    const urlProgress = params.get('progress');
    const urlAddedMonth = params.get('addedmonth');
    const urlSearch = params.get('search');

    if (urlPm || urlHealth || urlRegion || urlProgress || urlAddedMonth || urlSearch) {
      // URL params present — use them and save to localStorage
      if (urlPm) pmFilter.value = urlPm;
      if (urlHealth) healthFilter.value = urlHealth;
      if (urlRegion) regionFilter.value = urlRegion;
      if (urlProgress) progressFilter.value = urlProgress;
      if (urlAddedMonth) addedMonthFilter.value = urlAddedMonth;
      if (urlSearch) searchInput.value = urlSearch;
      saveFilters();
      return;
    }

    // Fall back to localStorage
    const saved = JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || 'null');
    if (!saved) return;
    if (saved.pm) pmFilter.value = saved.pm;
    if (saved.health) healthFilter.value = saved.health;
    if (saved.progress && saved.progress !== 'All' && saved.progress !== '') {
      progressFilter.value = saved.progress;
      if (progressFilter.value !== saved.progress) progressFilter.selectedIndex = 0;
    }
    if (saved.duemonth) duemonthFilter.value = saved.duemonth;
    if (saved.addedmonth) addedMonthFilter.value = saved.addedmonth;
    if (saved.region) regionFilter.value = saved.region;
    if (saved.search) searchInput.value = saved.search;
  } catch {}
}

function resetFilters() {
  pmFilter.value = 'All';
  healthFilter.value = 'All';
  // Replace progress options to force a clean reset
  progressFilter.innerHTML = '<option value="All" selected>All progress</option><option value="0-39">0–39%</option><option value="40-69">40–69%</option><option value="70-100">70–100%</option><option value="100+">Above 100%</option>';
  duemonthFilter.selectedIndex = 0;
  addedMonthFilter.selectedIndex = 0;
  regionFilter.selectedIndex = 0;
  searchInput.value = '';
  localStorage.removeItem(FILTER_STORAGE_KEY);
  renderAll();
}

pmFilter.addEventListener('change', () => { saveFilters(); renderTable(); });
healthFilter.addEventListener('change', () => { saveFilters(); renderTable(); });
progressFilter.addEventListener('change', () => { saveFilters(); renderTable(); });
duemonthFilter.addEventListener('change', () => { saveFilters(); renderTable(); });
addedMonthFilter.addEventListener('change', () => { saveFilters(); renderTable(); });
regionFilter.addEventListener('change', () => { saveFilters(); renderAll(); });
searchInput.addEventListener('input', saveFilters);

document.getElementById('refreshDashboardBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshDashboardBtn');
  const orig = btn.textContent;
  btn.textContent = '↻ Syncing...';
  btn.disabled = true;
  try {
    await refreshProjectsAndTasksFromKv();
    syncProjectProgressFromJira();
    renderAll();
  } finally {
    btn.textContent = orig;
    btn.disabled = false;
  }
});
document.getElementById('resetFiltersBtn').addEventListener('click', resetFilters);

editHealth.addEventListener('change', () => {
  pmStatusLabel.style.display = ['Yellow', 'Red'].includes(editHealth.value) ? '' : 'none';
  riskReasonLabel.style.display = '';
});

