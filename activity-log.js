// Standalone Activity Log page — deliberately does NOT load app-core.js/app-render.js
// (those have hundreds of top-level document.getElementById calls for dashboard elements
// that don't exist on this page). Small, self-contained duplicates of just what's needed.

const PROXY_BASE = 'https://pm-proxy.demo.qa.kaltura.ai';
const KV_SECRET = 'HPZTjoBph4Cz9AMGwiSsYcJf086bdgRX';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getJiraLabel(jira) {
  if (!jira) return '-';
  const browseMatch = jira.match(/\/browse\/([A-Za-z0-9-]+)/i);
  if (browseMatch) return browseMatch[1];
  const pathParts = jira.split('/').filter(Boolean);
  const lastPart = pathParts[pathParts.length - 1];
  return lastPart && lastPart !== 'browse' ? lastPart : jira;
}

const ACTIVITY_REASON_LABELS = {
  'manual-delete': 'Manual delete',
  'backup-and-delete': 'Backup & delete',
  'restore-from-backup': 'Backup restore',
  'restore-from-closed': 'Restore (Closed)',
  'add-project': 'Project added',
  'add-task': 'Task added',
  'edit-save': 'Edited',
  'import-from-jira': 'Imported (Jira)',
  'auto-add-new-project': 'Auto-added (Jira)',
  'jira-progress-sync': 'Jira field sync',
  'jira-status-sync': 'Jira status sync',
  'reconnect-sync': 'Reconnect sync',
  'user-rename-propagation': 'User renamed',
  'customer-rename-propagation': 'Customer renamed',
  'migrate-projects': 'Data migration',
  'create-backup': 'Backup created',
  'restore-to-active': 'Restored to active',
  'manual-recovery': 'Manual recovery',
};
function formatActivityReason(reason) {
  return ACTIVITY_REASON_LABELS[reason] || reason || 'Unknown';
}

async function getActivityLog() {
  try {
    const res = await fetch(`${PROXY_BASE}/activity-log`, {
      headers: { 'X-KV-Secret': KV_SECRET },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Collapse near-duplicate entries for the same store/added/removed set that land within
// a few seconds of each other — e.g. import-from-jira followed by a page-reload Jira
// sync re-detecting the same new project due to KV read-after-write lag.
function dedupeActivityEntries(entries) {
  const kept = [];
  for (const e of entries) {
    const key = JSON.stringify({
      store: e.store,
      added: (e.added || []).map(p => p.jira || p.name).sort(),
      removed: (e.removed || []).map(p => p.jira || p.name).sort(),
      edited: (e.edited || []).map(p => p.jira || p.name).sort(),
    });
    const dup = kept.find(k => k._key === key && Math.abs(k.ts - e.ts) < 30000);
    if (dup) {
      const generic = ['jira-progress-sync', 'jira-status-sync'];
      if (generic.includes(dup.reason) && !generic.includes(e.reason)) {
        Object.assign(dup, e, { _key: key });
      }
      continue;
    }
    kept.push({ ...e, _key: key });
  }
  return kept;
}

const activityLogRangeFilter = document.getElementById('activityLogRangeFilter');
const refreshActivityLogBtn = document.getElementById('refreshActivityLogBtn');
const activityLogMain = document.getElementById('activityLogMain');
const activityContentPopover = document.getElementById('activityContentPopover');

// Click-to-toggle preview of the actual Project Status / PM Personal Notes text behind
// an "(updated)" entry, without needing to reopen the project in the dashboard.
function openContentPopover(anchorBtn) {
  const html = anchorBtn.dataset.content || '';
  activityContentPopover.innerHTML = html || '<span class="muted">(empty)</span>';
  activityContentPopover.classList.remove('hidden');
  const rect = anchorBtn.getBoundingClientRect();
  const popRect = activityContentPopover.getBoundingClientRect();
  let left = rect.left;
  if (left + popRect.width > window.innerWidth - 12) left = window.innerWidth - popRect.width - 12;
  activityContentPopover.style.left = `${Math.max(12, left)}px`;
  activityContentPopover.style.top = `${rect.bottom + window.scrollY + 6}px`;
  activityContentPopover._anchor = anchorBtn;
}
function closeContentPopover() {
  activityContentPopover.classList.add('hidden');
  activityContentPopover._anchor = null;
}

document.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-content]');
  if (toggle) {
    if (activityContentPopover._anchor === toggle) { closeContentPopover(); return; }
    openContentPopover(toggle);
    return;
  }
  if (!activityContentPopover.classList.contains('hidden') && !activityContentPopover.contains(event.target)) {
    closeContentPopover();
  }
});

async function renderActivityLogPanel() {
  closeContentPopover();
  const el = activityLogMain;
  el.innerHTML = '<p class="muted">Loading…</p>';
  const log = await getActivityLog();
  const hours = Number(activityLogRangeFilter.value) || 24;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const entries = dedupeActivityEntries(
    (Array.isArray(log) ? log : []).filter(e => e.ts >= cutoff).sort((a, b) => b.ts - a.ts)
  );

  if (!entries.length) {
    el.innerHTML = `<p class="muted">No activity in the last ${hours} hours.</p>`;
    return;
  }

  const jiraRef = (p) => p.jira ? ` (<a href="${escapeHtml(p.jira)}" target="_blank" rel="noreferrer">${escapeHtml(getJiraLabel(p.jira))}</a>)` : '';
  const rows = entries.map(e => {
    const time = new Date(e.ts).toLocaleString('default', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const countChange = e.beforeCount !== e.afterCount
      ? `<span style="color:${e.afterCount > e.beforeCount ? '#4ade80' : '#f87171'};font-weight:600;">${e.beforeCount} → ${e.afterCount}</span>`
      : `${e.beforeCount} → ${e.afterCount}`;
    const addedList = (e.added || []).map(p => `<div style="color:#4ade80;">+ ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name || '-')}${jiraRef(p)}</div>`).join('');
    const removedList = (e.removed || []).map(p => `<div style="color:#f87171;">− ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name || '-')}${jiraRef(p)}</div>`).join('');
    const editedList = (e.edited || []).map(p => {
      const changeLines = (p.changes || []).map(c => {
        const toDisplay = c.content
          ? `<button type="button" class="activity-content-toggle" data-content="${escapeHtml(c.content)}">${escapeHtml(c.to)}</button>`
          : escapeHtml(c.to);
        return `<div style="color:#94a3b8;padding-left:14px;">${escapeHtml(c.field)}: ${escapeHtml(c.from)} → ${toDisplay}</div>`;
      }).join('');
      return `<div style="color:#7dd3fc;">✎ ${escapeHtml(p.customer ? p.customer + ' — ' : '')}${escapeHtml(p.name || '-')}${jiraRef(p)}</div>${changeLines}`;
    }).join('');
    return `
      <tr>
        <td style="white-space:nowrap;">${escapeHtml(time)}</td>
        <td style="white-space:nowrap;">${escapeHtml(e.user || '-')}</td>
        <td style="white-space:nowrap;">${escapeHtml(e.store || '-')}</td>
        <td style="white-space:nowrap;">${escapeHtml(formatActivityReason(e.reason))}</td>
        <td style="white-space:nowrap;">${countChange}</td>
        <td>${addedList}${removedList}${editedList}</td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div style="overflow-x:auto;">
      <table class="activity-log-table">
        <thead><tr>
          <th>When</th><th>By</th><th>Store</th><th>Reason</th><th>Count</th><th style="width:100%;">Added/Removed/Edited</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

activityLogRangeFilter.addEventListener('change', renderActivityLogPanel);
refreshActivityLogBtn.addEventListener('click', renderActivityLogPanel);

renderActivityLogPanel();
