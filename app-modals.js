function generateHTMLReport(accountTypeChoice) {
  const typeChoice = accountTypeChoice || 'Both';
  // getItemAccountType (app-render.js) resolves a task's Account Type from its parent
  // project, same as the main dashboard's own Account Type filter — keeps this report
  // consistent with what the live dashboard would show for the same filter choice.
  const reportProjects = typeChoice === 'Both' ? projects : projects.filter(p => (p.accountType || '') === typeChoice);
  const reportTasks = typeChoice === 'Both' ? tasks : tasks.filter(t => getItemAccountType(t) === typeChoice);
  const now = new Date();
  const dd = String(now.getDate()).padStart(2,'0');
  const mm = String(now.getMonth()+1).padStart(2,'0');
  const yy = String(now.getFullYear()).slice(2);
  const hh = String(now.getHours()).padStart(2,'0');
  const min = String(now.getMinutes()).padStart(2,'0');
  const dateLabel = `${dd}/${mm}/${yy} ${hh}:${min}`;
  const typeTitleSuffix = typeChoice === 'Both' ? ' for OVP and OTT Projects' : ` - ${typeChoice} Projects`;
  const typeFilenameSuffix = typeChoice === 'Both' ? '' : `-${typeChoice.toLowerCase()}`;
  const filename = `dashboard-report${typeFilenameSuffix}-${dd}-${mm}-${yy}-${hh}-${min}.html`;

  // Strip inline color from <a> tags so report CSS controls link colors
  function cleanStatusHtml(html) {
    if (!html) return html;
    return html.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
      const cleaned = attrs.replace(/\bstyle="[^"]*"/gi, '');
      return `<a${cleaned}>`;
    });
  }

  const atRisk = reportProjects.filter(p => Number(p.progress) >= 100)
    .sort((a, b) => Number(b.progress) - Number(a.progress));

  const healthAtRisk = reportProjects.filter(p => p.health === 'Red' || p.health === 'Yellow')
    .sort((a, b) => {
      if (a.health === b.health) return 0;
      return a.health === 'Red' ? -1 : 1;
    });

  const backupNames = new Set((backups[0]?.projects || []).map(p => p.name));
  const newProjects = backups.length >= 1 ? reportProjects.filter(p => !backupNames.has(p.name)) : [];

  const uniquePMs = [...new Set([...reportProjects.map(p => p.manager), ...reportTasks.map(t => t.owner)].filter(Boolean))].sort();

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
    ? atRisk.map(p => `<tr data-region="${esc(p.region||'')}" data-type="${esc(p.accountType||'')}">
        <td>${custCell(p)}</td>
        <td>${oppCell(p)}</td>
        <td>${jiraCell(p)}</td>
        <td>${pmCell(p)}</td>
        <td>${progressBar(p.progress, p.estimatedHours, p.remainingHours, p.actualHours, p.health, p.riskReason, p.nrr)}</td>
        <td style="color:#fde68a">${esc(p.riskReason||'No risk reason set')}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="color:#94a3b8;font-style:italic;">No over-budget projects.</td></tr>`;

  const healthRows = healthAtRisk.length
    ? healthAtRisk.map(p => `<tr data-region="${esc(p.region||'')}" data-type="${esc(p.accountType||'')}">
        <td>${custCell(p)}</td>
        <td>${oppCell(p)}</td>
        <td>${jiraCell(p)}</td>
        <td>${pmCell(p)}</td>
        <td>${healthPill(p.health, p.pmStatus)}</td>
        <td style="color:#cbd5e1;font-size:0.9rem;">${isEmptyStatus(p.pmStatus) ? '<em style="color:#64748b;">No status set by PM</em>' : cleanStatusHtml(p.pmStatus)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" style="color:#94a3b8;font-style:italic;">No projects with Yellow or Red health.</td></tr>`;

  const newRows = newProjects.length
    ? newProjects.map(p => `<tr data-region="${esc(p.region||'')}" data-type="${esc(p.accountType||'')}">
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
    ...reportProjects,
    ...reportTasks.map(t => ({ ...t, manager: t.owner, name: t.name || t.parentProjectName })),
  ];
  const allProjCount = allItems.filter(p => p.type !== 'task').length;
  const allTaskCount = allItems.filter(p => p.type === 'task').length;
  const allProjectsLabel = (projCount, taskCount) =>
    `${projCount} project${projCount === 1 ? '' : 's'}${taskCount ? ` · ${taskCount} task${taskCount === 1 ? '' : 's'}` : ''}`;
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
    }).map(p => `<tr data-pm="${esc(p.manager||'')}" data-health="${esc(p.health||'Green')}" data-progress="${Math.round(Number(p.progress)||0)}" data-region="${esc(p.region||'')}" data-type="${esc(getItemAccountType(p)||'')}">
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
        <h2 style="font-size:1.1rem;margin:0">Newly Added Projects (<span id="newSectionCount" data-orig="${newProjects.length}">${newProjects.length}</span>)</h2>
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
<title>Project Manager Dashboard — Status Report${typeTitleSuffix}</title>
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
<h1>Project Manager Dashboard — Status Report${typeTitleSuffix}</h1>
<div style="display:flex;align-items:center;gap:16px;margin:4px 0 24px">
  <p style="color:#94a3b8;margin:0">Generated: ${dateLabel}</p>
  <select id="rRegionFilter" onchange="applyReportFilters()" style="background:#0b1220;color:#eff6ff;border:1px solid #223249;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:0.9rem">
    <option value="">All Regions</option>
    <option value="APAC">APAC</option>
    <option value="EMEA">EMEA</option>
    <option value="North America">North America</option>
    <option value="LatAm">LatAm</option>
    <option value="Internal">Internal</option>
    <option value="ROW">"ROW"</option>
  </select>
  ${typeChoice === 'Both' ? `<select id="rTypeFilter" onchange="applyReportFilters()" style="background:#0b1220;color:#eff6ff;border:1px solid #223249;border-radius:10px;padding:7px 12px;font-family:inherit;font-size:0.9rem">
    <option value="">All Types</option>
    <option value="OVP">OVP</option>
    <option value="OTT">OTT</option>
  </select>` : ''}
</div>

${(() => {
  const totalNrr = reportProjects.reduce((s, p) => s + (Number(p.nrrUsd) || 0), 0);
  const totalMrr = reportProjects.reduce((s, p) => s + (Number(p.mrrUsd) || 0), 0);
  const newNrr = newProjects.reduce((s, p) => s + (Number(p.nrrUsd) || 0), 0);
  const newMrr = newProjects.reduce((s, p) => s + (Number(p.mrrUsd) || 0), 0);
  const hGreen  = reportProjects.filter(p => (p.health || 'Green') === 'Green').length;
  const hYellow = reportProjects.filter(p => p.health === 'Yellow').length;
  const hRed    = reportProjects.filter(p => p.health === 'Red').length;
  const REGIONS = ['APAC','EMEA','North America','LatAm','Internal','ROW'];
  // Type filter only exists in the report when typeChoice === 'Both' (a single-type report
  // has nothing left to filter by type). Combined lookup, keyed by "region|type" (either half
  // blank means "all" for that dimension) so Region and Type filters compose correctly
  // together instead of each only knowing how to filter on its own.
  const TYPES = typeChoice === 'Both' ? ['', 'OVP', 'OTT'] : [''];
  const combinedStats = {};
  [''].concat(REGIONS).forEach(r => {
    TYPES.forEach(t => {
      const rp = reportProjects.filter(p => (!r || p.region === r) && (!t || p.accountType === t));
      const rt = reportTasks.filter(item => (!r || item.region === r) && (!t || getItemAccountType(item) === t));
      const rAtRisk = rp.filter(p => Number(p.progress) >= 100);
      const rHealthAtRisk = rp.filter(p => p.health === 'Red' || p.health === 'Yellow');
      const rNew = backups.length >= 1 ? rp.filter(p => !backupNames.has(p.name)) : [];
      combinedStats[`${r}|${t}`] = {
        total: rp.length,
        totalNrr: rp.reduce((s,p) => s + (Number(p.nrrUsd)||0), 0),
        totalMrr: rp.reduce((s,p) => s + (Number(p.mrrUsd)||0), 0),
        hGreen: rp.filter(p => (p.health||'Green')==='Green').length,
        hYellow: rp.filter(p => p.health==='Yellow').length,
        hRed: rp.filter(p => p.health==='Red').length,
        atRisk: rAtRisk.length,
        healthAtRisk: rHealthAtRisk.length,
        allProjCount: rp.length,
        allTaskCount: rt.length,
        newCount: rNew.length,
        newNrr: rNew.reduce((s,p) => s + (Number(p.nrrUsd)||0), 0),
        newMrr: rNew.reduce((s,p) => s + (Number(p.mrrUsd)||0), 0),
      };
    });
  });
  const combinedDataAttr = `data-combined-stats='${JSON.stringify(combinedStats)}'`;
  return `<div class="stats" id="rptStats" ${combinedDataAttr}>
  <div class="stat" style="border-top:4px solid #38bdf8">
    <p>Total Projects</p>
    <h3 id="rptTotal" data-orig="${reportProjects.length}">${reportProjects.length}</h3>
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
    <h2 style="margin:0">Over Budget Projects (<span id="atRiskSectionCount" data-orig="${atRisk.length}">${atRisk.length}</span>)</h2>
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
    <h2 style="margin:0">Project Health (<span id="healthSectionCount" data-orig="${healthAtRisk.length}">${healthAtRisk.length}</span>)</h2>
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
  <h2>All Projects (<span id="allProjectsSectionCount" data-orig-proj="${allProjCount}" data-orig-task="${allTaskCount}">${allProjectsLabel(allProjCount, allTaskCount)}</span>)</h2>
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
  <button class="toggle-btn" id="showAllProjectsBtn" data-count="${reportProjects.length}" onclick="toggleAll(this)">▶ Show all projects (${reportProjects.length})</button>
  <div id="allTable">
    ${allProjectsRows}
  </div>
</section>

<script>
function toggleAll(btn){
  const t=document.getElementById('allTable');
  const open=t.style.display==='block';
  t.style.display=open?'none':'block';
  // data-count is kept in sync with the current Region/Type filter by applyReportFilters —
  // was previously baked in at generation time and never updated, so this label stayed at the
  // unfiltered total even after the header count above it correctly reflected the filter.
  btn.textContent=open?('▶ Show all projects (' + btn.dataset.count + ')'):'▼ Hide all projects';
}
function renderPager(section) {
  // Only paginate rows not hidden by the region/type filter (class filter-hidden)
  const rows = Array.from(section.querySelectorAll('tbody tr')).filter(r => !r.classList.contains('filter-hidden'));
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
  const eligibleRows = Array.from(section.querySelectorAll('tbody tr')).filter(r => !r.classList.contains('filter-hidden'));
  const pages = Math.ceil(eligibleRows.length / (parseInt(section.dataset.pageSize)||5));
  section.dataset.page = Math.max(0, Math.min(pages-1, (parseInt(section.dataset.page)||0) + dir));
  renderPager(section);
}
function changePageSize(sel) {
  // NOT sel.closest('section').querySelector('.paginated-section') — "Over Budget Projects"
  // and "Project Health" share one enclosing <section>, so that always found the FIRST
  // .paginated-section in it (Over Budget's) regardless of which dropdown was changed.
  // Each select's own header div is immediately followed by its own .paginated-section.
  const section = sel.closest('div').nextElementSibling;
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
      if(row.classList.contains('filter-hidden')) show=false;
      row.style.display=show?'':'none';
      if(show) anyVisible=true;
    });
    // Hide the entire group div (parent of the table) when no rows are visible
    const groupDiv = tbody.closest('div[style*="margin-bottom"]');
    if(groupDiv) groupDiv.style.display=anyVisible?'':'none';
  });
}
// Generalizes what used to be applyRegionFilter — Region and (when present) Type now combine
// via one lookup keyed "region|type" (either half blank means "all" for that dimension), so
// changing either filter (or both) recomputes every stat number and hides/shows rows in the
// Over Budget/Health/Newly Added sections consistently. The rTypeFilter select only exists in
// the report when it was generated with "Both" project types — a single-type report has
// nothing left to filter by type, so this reads '' (all) when the element is absent.
function applyReportFilters() {
  const region = document.getElementById('rRegionFilter').value;
  const typeEl = document.getElementById('rTypeFilter');
  const type = typeEl ? typeEl.value : '';
  // Mark non-matching rows with filter-hidden class (not inline style) so
  // renderPager can distinguish this filtering from pagination hiding.
  document.querySelectorAll('tr[data-region]').forEach(row => {
    const matchesRegion = !region || row.dataset.region === region;
    const matchesType = !type || row.dataset.type === type;
    if (matchesRegion && matchesType) {
      row.classList.remove('filter-hidden');
    } else {
      row.classList.add('filter-hidden');
      row.style.display = 'none';
    }
  });
  // Update stat boxes
  const statsDiv = document.getElementById('rptStats');
  if (!statsDiv) return;
  let stats;
  try { stats = JSON.parse(statsDiv.dataset.combinedStats); } catch { return; }
  const s = (region || type) ? stats[region + '|' + type] : null;
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
    if (el('atRiskSectionCount')) el('atRiskSectionCount').textContent = s.atRisk;
    if (el('healthSectionCount')) el('healthSectionCount').textContent = s.healthAtRisk;
    if (el('newSectionCount')) el('newSectionCount').textContent = s.newCount;
    if (el('allProjectsSectionCount')) {
      const e = el('allProjectsSectionCount');
      const pc = s.allProjCount, tc = s.allTaskCount;
      e.textContent = pc + ' project' + (pc === 1 ? '' : 's') + (tc ? (' · ' + tc + ' task' + (tc === 1 ? '' : 's')) : '');
    }
  } else {
    // restore original values from data attributes
    ['rptTotal','rptMrr','rptNrr','rptHGreen','rptHYellow','rptHRed','rptAtRisk','rptNewCount','rptNewMrr','rptNewNrr',
     'atRiskSectionCount','healthSectionCount','newSectionCount'].forEach(id => {
      const e = el(id);
      if (e && e.dataset.orig !== undefined) e.textContent = e.dataset.orig;
    });
    const allEl = el('allProjectsSectionCount');
    if (allEl && allEl.dataset.origProj !== undefined) {
      const pc = Number(allEl.dataset.origProj), tc = Number(allEl.dataset.origTask);
      allEl.textContent = pc + ' project' + (pc === 1 ? '' : 's') + (tc ? (' · ' + tc + ' task' + (tc === 1 ? '' : 's')) : '');
    }
  }
  // Keep the "Show all projects (N)" toggle button's count in sync with the same
  // project-only count the header above it just used — this button previously kept whatever
  // count was baked in at report-generation time regardless of the Region/Type filter.
  const showAllBtn = el('showAllProjectsBtn');
  if (showAllBtn) {
    const showAllProjCount = s ? s.allProjCount : Number(el('allProjectsSectionCount')?.dataset.origProj ?? showAllBtn.dataset.count);
    showAllBtn.dataset.count = showAllProjCount;
    // Only rewrite the visible label while collapsed (▶) — leave it alone while expanded (▼
    // Hide all projects), since that label carries no count to begin with.
    if (showAllBtn.textContent.charAt(0) === '▶') {
      showAllBtn.textContent = '▶ Show all projects (' + showAllProjCount + ')';
    }
  }
  // Reset pagination so page windows respect the new filter, then re-apply
  // PM/health/progress filters on top of the region/type selection.
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

async function checkActionPassword(action) {
  const result = await openAppDialog({
    title: `Enter password to ${action}`,
    eyebrow: 'Password required',
    isPassword: true,
    confirmLabel: 'OK',
    validate: (value) => (value === '1271' ? null : 'Incorrect password.'),
  });
  return result !== null;
}

exportBtn.addEventListener('click', async () => {
  if (!(await checkActionPassword('export report'))) return;
  exportChoiceModal.classList.remove('hidden');
  exportChoiceModal.setAttribute('aria-hidden', 'false');
});
exportChoiceModal.addEventListener('click', (e) => {
  if (e.target === exportChoiceModal) {
    exportChoiceModal.classList.add('hidden');
    exportChoiceModal.setAttribute('aria-hidden', 'true');
  }
});
function getReportAccountTypeChoice() {
  const checked = document.querySelector('input[name="reportAccountType"]:checked');
  return checked ? checked.value : 'Both';
}
exportOnlyBtn.addEventListener('click', () => {
  exportChoiceModal.classList.add('hidden');
  exportChoiceModal.setAttribute('aria-hidden', 'true');
  generateHTMLReport(getReportAccountTypeChoice());
});
exportAndBackupBtn.addEventListener('click', () => {
  exportChoiceModal.classList.add('hidden');
  exportChoiceModal.setAttribute('aria-hidden', 'true');
  generateHTMLReport(getReportAccountTypeChoice());
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
  setButtonBusy(btn, true, 'Syncing...');
  let updated = 0;
  for (const user of users) {
    if (user.jiraAccountId) continue;
    const displayName = getUserDisplayName(user);
    const accountId = await getOrFetchJiraAccountId(displayName);
    if (accountId) updated++;
  }
  await fetchAndStoreAvatars();
  await saveUsers();
  setButtonBusy(btn, false);
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
    saveProjects('user-rename-propagation');
    renderAll();
    renderUsersModal();
  }
});

createBackupBtn.addEventListener('click', async () => {
  if (!(await checkActionPassword('create a backup'))) return;
  await createBackup(createBackupBtn);
});
backupsPanelBtn.addEventListener('click', openBackupsModal);
closeBackupsModalBtn.addEventListener('click', closeBackupsModal);
backupsModal.addEventListener('click', (e) => { if (e.target === backupsModal) closeBackupsModal(); });

closedProjectsBtn.addEventListener('click', openClosedProjectsModal);
closeClosedProjectsModalBtn.addEventListener('click', closeClosedProjectsModal);
closedProjectsModal.addEventListener('click', (e) => { if (e.target === closedProjectsModal) closeClosedProjectsModal(); });

closedSearchInput.addEventListener('input', renderClosedProjectsPanel);
closedPmFilter.addEventListener('change', renderClosedProjectsPanel);
closedRegionFilter.addEventListener('change', renderClosedProjectsPanel);
closedMonthFilter.addEventListener('change', renderClosedProjectsPanel);
closedQuarterFilter.addEventListener('change', renderClosedProjectsPanel);

resetClosedFiltersBtn.addEventListener('click', () => {
  closedSearchInput.value = '';
  closedPmFilter.value = 'All';
  closedRegionFilter.value = '';
  closedMonthFilter.value = '';
  closedQuarterFilter.value = '';
  renderClosedProjectsPanel();
});

refreshClosedProjectsBtn.addEventListener('click', async () => {
  const orig = refreshClosedProjectsBtn.textContent;
  refreshClosedProjectsBtn.textContent = '↻ Syncing...';
  refreshClosedProjectsBtn.disabled = true;
  try {
    const fresh = await kvGet(CLOSED_PROJECTS_KEY);
    if (fresh) {
      closedProjects = fresh;
      _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(fresh));
      try { localStorage.setItem(CLOSED_PROJECTS_KEY, JSON.stringify(closedProjects)); } catch {}
    }
    renderClosedProjectsPanel();
  } finally {
    refreshClosedProjectsBtn.textContent = orig;
    refreshClosedProjectsBtn.disabled = false;
  }
});

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
  setButtonBusy(deleteProjectBtn, true, 'Deleting...');
  const itemType = deleteProjectModal.dataset.itemType || 'project';
  if (itemType === 'task') {
    const deletedId = tasks[deleteProjectIndex]?.id;
    tasks.splice(deleteProjectIndex, 1);
    if (deletedId) {
      addPendingDelete(deletedId, TASKS_KEY);
      await addKvTombstone(deletedId, TASKS_KEY);
    }
    await saveTasks('manual-delete');
  } else {
    const deletedKey = getItemDeleteKey(projects[deleteProjectIndex] || {});
    projects.splice(deleteProjectIndex, 1);
    if (deletedKey) {
      addPendingDelete(deletedKey, STORAGE_KEY);
      await addKvTombstone(deletedKey, STORAGE_KEY);
    }
    await saveProjects('manual-delete');
  }
  setButtonBusy(deleteProjectBtn, false);
  renderAll();
  closeDeleteProjectModal();
});

backupAndDeleteProjectBtn.addEventListener('click', async () => {
  if (deleteProjectIndex < 0) return;
  if (!backups.length) {
    alert('No backup exists yet. Please create a backup first before deleting.');
    return;
  }
  setButtonBusy(backupAndDeleteProjectBtn, true, 'Deleting...');
  const itemType = deleteProjectModal.dataset.itemType || 'project';
  const item = itemType === 'task' ? tasks[deleteProjectIndex] : projects[deleteProjectIndex];
  const latestBackup = backups[0];
  // Match by type + a stable key (task id / project jira) — matching by name alone would
  // wrongly match a task against its own parent project's backup entry (same name), and
  // silently overwrite the project's snapshot with the task's data.
  const existingIndex = latestBackup.projects.findIndex(p =>
    itemType === 'task' ? (p.type === 'task' && p.id === item.id) : (p.type !== 'task' && p.jira === item.jira)
  );
  if (existingIndex >= 0) {
    latestBackup.projects[existingIndex] = JSON.parse(JSON.stringify(item));
  } else {
    latestBackup.projects.push(JSON.parse(JSON.stringify(item)));
  }
  await saveBackups('backup-and-delete');
  if (itemType === 'task') {
    const deletedId = tasks[deleteProjectIndex]?.id;
    tasks.splice(deleteProjectIndex, 1);
    if (deletedId) {
      addPendingDelete(deletedId, TASKS_KEY);
      await addKvTombstone(deletedId, TASKS_KEY);
    }
    await saveTasks('backup-and-delete');
  } else {
    const deletedKey = getItemDeleteKey(projects[deleteProjectIndex] || {});
    const closedCopy = JSON.parse(JSON.stringify(projects[deleteProjectIndex]));
    const resolutionDate = await getJiraResolutionDate(getJiraIssueKey(closedCopy.jira));
    closedCopy.closedAt = resolutionDate || new Date().toISOString();
    // Refresh from KV right before mutating — a long-lived tab's in-memory copy can be
    // stale (missing closures added by other sessions since page load), and saving it
    // wholesale would silently wipe those out.
    const freshClosed = await kvGet(CLOSED_PROJECTS_KEY);
    if (Array.isArray(freshClosed)) {
      closedProjects = freshClosed;
      _saveBaseline[CLOSED_PROJECTS_KEY] = JSON.parse(JSON.stringify(freshClosed));
    }
    closedProjects = closedProjects.filter(p => (p.jira || '') !== (closedCopy.jira || ''));
    closedProjects.push(closedCopy);
    await saveClosedProjects('backup-and-delete');
    projects.splice(deleteProjectIndex, 1);
    if (deletedKey) {
      addPendingDelete(deletedKey, STORAGE_KEY);
      await addKvTombstone(deletedKey, STORAGE_KEY);
    }
    await saveProjects('backup-and-delete');
  }
  setButtonBusy(backupAndDeleteProjectBtn, false);
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

async function openImportModal() {
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
  // Refresh from KV so "already imported" detection (getExistingJiraKeys) reflects the
  // true current state, not a possibly-stale in-memory copy from earlier in this tab's session.
  await refreshProjectsAndTasksFromKv();
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
  if (!cachedAccountNameFieldId || !cachedVMForecastFieldId || !cachedNrrFieldId || !cachedMrrFieldId || !cachedEstHoursFieldId || !cachedRiskReasonFieldId || !cachedRiskRateFieldId || !cachedVerticalFieldId || !cachedRegionFieldId) await resolveJiraFieldIds();

  const jql = `issuetype = Initiative AND assignee = "${pm.accountId}" AND (status = Open OR status = "in progress") ORDER BY created ASC`;
  // cachedRegionFieldId was missing here — Region was correctly picked up by the ongoing Jira
  // sync (syncProjectProgressFromJiraInner) but never requested at import time, so every
  // newly imported project started with an empty Region despite Jira having a real value.
  const extraFields = [cachedAccountNameFieldId, cachedMrrFieldId, cachedNrrFieldId, cachedEstHoursFieldId, cachedVMForecastFieldId, cachedRiskReasonFieldId, cachedRiskRateFieldId, cachedAccountOwnerFieldId, cachedOppUrlFieldId, cachedAccountUrlFieldId, cachedAccountCsmFieldId, cachedVerticalFieldId, cachedRegionFieldId].filter(Boolean).join(',');
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
      vertical: cachedVerticalFieldId ? (typeof i.fields[cachedVerticalFieldId] === 'string' ? i.fields[cachedVerticalFieldId] : (i.fields[cachedVerticalFieldId]?.value || '')) : '',
      region: cachedRegionFieldId ? (typeof i.fields[cachedRegionFieldId] === 'string' ? i.fields[cachedRegionFieldId] : (i.fields[cachedRegionFieldId]?.value || '')) : '',
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

  setButtonBusy(importConfirmBtn, true, 'Importing...');
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
    // Clear any lingering tombstone for this jira key — otherwise saveProjects would strip
    // this deliberate re-import right back out, since it still matches a prior deletion.
    if (project.jira) {
      removePendingDelete(project.jira, STORAGE_KEY);
      await removeKvTombstone(project.jira, STORAGE_KEY);
    }
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

  await Promise.all([saveUsers(), saveCustomers(), saveProjects('import-from-jira')]);
  // Wait briefly to ensure KV write completes before reloading
  await new Promise(resolve => setTimeout(resolve, 1500));
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
  const matchingProject = projects.find(p => p.jira === jira);
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
    accountUrl: matchingProject?.accountUrl || '',
    oppLink: matchingProject?.oppLink || '',
    comments: matchingProject?.manager ? `PM - ${matchingProject.manager}` : '',
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
  await saveTasks('add-task');
  renderAll();
  closeTaskModal();
  // The accountUrl/oppLink copied above from a "matching project" almost never actually
  // matches (a task's issue is normally a different ticket than any project's) — this pulls
  // this task's own real fields from Jira right away instead of leaving them blank until the
  // next background sync.
  syncProjectProgressFromJira();
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
  restoreFilters();
  renderAll();
  startKvPoll();
  startAutoProjectPoll();
  // Run sequentially, not concurrently — both start with refreshProjectsAndTasksFromKv(),
  // which reassigns the shared `projects` variable to a fresh array of new objects. If they
  // overlap, one's batched loop (100+ projects, 10 at a time — can take a while) keeps
  // mutating objects from an old snapshot after the other has already swapped `projects` out
  // from under it, silently discarding whatever it just pulled from Jira. Wrapped in an IIFE
  // so init() itself still doesn't block on either (matching the previous fire-and-forget
  // behavior) — only these two are ordered relative to each other.
  (async () => {
    await syncStatusFromJira();
    await syncProjectProgressFromJira();
  })();
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
