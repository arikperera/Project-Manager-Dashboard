# Jira Status Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync Project Status (dashboard) with Jira Initiative Description (Jira) bidirectionally on page load and on edit-modal save, with most-recent-wins conflict resolution.

**Architecture:** Three tasks — (1) conversion functions + schema migration, (2) write-to-Jira on save, (3) sync-on-load. Tasks are sequential: Task 2 depends on Task 1's `textToAdf`; Task 3 depends on both.

**Tech Stack:** Vanilla JS, Jira REST API v3, ADF (Atlassian Document Format JSON).

## Global Constraints

- No build step — changes take effect by refreshing `index.html`.
- No frameworks, no npm. Pure vanilla JS.
- `statusUpdatedAt` field: ISO 8601 string or `''`. Added to `migrateProjects()`.
- ADF → plain text: bullets preserved as `•`, nested bullets indented with `\t`.
- Plain text → ADF: lines starting with `•`/`-` become `bulletList` nodes; `\t•`/`\t-` become nested items; all other lines become `paragraph` nodes.
- Timestamp comparison: ISO 8601 strings compare correctly with `>` / `<`.
- Sync only runs when proxy is configured (`settings.jiraEmail && settings.jiraToken`).
- Errors per-issue are swallowed silently (`.catch(() => {})`), same as other Jira sync calls.
- `syncStatusFromJira()` called on page load after `syncProjectProgressFromJira()` at line ~2565 of `app.js`.

---

### Task 1: ADF conversion functions + statusUpdatedAt schema migration

**Files:**
- Modify: `app.js` — add `adfToText`, `blockToText`, `inlineToText`, `textToAdf` functions; add `statusUpdatedAt` to `migrateProjects()`

**Interfaces:**
- Produces:
  - `adfToText(adf: object): string` — converts Jira ADF JSON to plain text with bullet structure
  - `textToAdf(text: string): object` — converts plain text with bullets to ADF JSON
  - `project.statusUpdatedAt` — new string field, default `''`

- [ ] **Step 1: Add statusUpdatedAt to migrateProjects**

In [app.js](app.js), find `migrateProjects()` (around line 152). The current last line inside the loop is:
```js
    if (p.actualHours === undefined) { p.actualHours = null; changed = true; }
```

Add after it:
```js
    if (p.statusUpdatedAt === undefined) { p.statusUpdatedAt = ''; changed = true; }
```

- [ ] **Step 2: Add ADF conversion functions to app.js**

In [app.js](app.js), find `function getExistingJiraKeys()` (around line 611). Insert the following three functions BEFORE it:

```js
function inlineToText(node) {
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  return '';
}

function blockToText(node, depth) {
  if (node.type === 'paragraph') {
    const text = (node.content || []).map(inlineToText).join('');
    return text + '\n';
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content || []).map((item, idx) => {
      const prefix = '\t'.repeat(depth) + (node.type === 'orderedList' ? `${idx + 1}.` : '•') + ' ';
      const children = item.content || [];
      const textNodes = children.filter(c => c.type === 'paragraph');
      const listNodes = children.filter(c => c.type === 'bulletList' || c.type === 'orderedList');
      const itemText = textNodes.map(p => (p.content || []).map(inlineToText).join('')).join('');
      const nested = listNodes.map(l => blockToText(l, depth + 1)).join('');
      return prefix + itemText + '\n' + nested;
    }).join('');
  }
  if (node.type === 'hardBreak') return '\n';
  return '';
}

function adfToText(adf) {
  if (!adf || !adf.content) return '';
  return adf.content.map(node => blockToText(node, 0)).join('').trimEnd();
}

function textToAdf(text) {
  if (!text) return { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  const lines = text.split('\n');
  const content = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^[•\-] /.test(line) || /^\t[•\-] /.test(line)) {
      const items = [];
      while (i < lines.length && (/^[•\-] /.test(lines[i]) || /^\t[•\-] /.test(lines[i]))) {
        const d0 = /^[•\-] (.*)/.exec(lines[i]);
        const d1 = /^\t[•\-] (.*)/.exec(lines[i]);
        if (d0) {
          items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: d0[1] }] }] });
        } else if (d1) {
          const nested = { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: d1[1] }] }] }] };
          if (items.length > 0) {
            items[items.length - 1].content.push(nested);
          } else {
            items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: d1[1] }] }, nested] });
          }
        }
        i++;
      }
      content.push({ type: 'bulletList', content: items });
    } else {
      content.push({ type: 'paragraph', content: line.trim() ? [{ type: 'text', text: line }] : [] });
      i++;
    }
  }
  return { version: 1, type: 'doc', content };
}
```

- [ ] **Step 3: Verify in browser console**

Open `index.html`, open DevTools console, run:
```js
// Test ADF→text
const adf = {version:1,type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Hello'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Item 1'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Item 2'}]}]}]}]};
console.log(adfToText(adf));
// Expected: "Hello\n• Item 1\n• Item 2"

// Test text→ADF round-trip
const text = 'Hello\n• Item 1\n\t• Nested\n• Item 2';
const result = textToAdf(text);
console.log(JSON.stringify(result, null, 2));
// Expected: doc with paragraph "Hello", bulletList with 2 items, second with nested bulletList

// Test statusUpdatedAt migration
console.log(projects[0].statusUpdatedAt !== undefined); // true
```

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add ADF conversion functions and statusUpdatedAt schema migration"
```

---

### Task 2: writeStatusToJira + set statusUpdatedAt on save

**Files:**
- Modify: `app.js` — add `writeStatusToJira()` function; update `editProjectForm` submit handler

**Interfaces:**
- Consumes: `textToAdf(text)` from Task 1, `getJiraIssueKey(jira)` (existing)
- Produces: `writeStatusToJira(issueKey: string, statusText: string): Promise<void>`

- [ ] **Step 1: Add writeStatusToJira function**

In [app.js](app.js), find `async function writeRiskRateToJira(issueKey, health)` (around line 750). Insert the following function BEFORE it:

```js
async function writeStatusToJira(issueKey, statusText) {
  const useProxy = settings.jiraEmail && settings.jiraToken;
  const url = useProxy
    ? `http://localhost:8081/jira/issue/${issueKey}`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}`;
  const adf = textToAdf(statusText || '');
  const res = await fetch(url, {
    method: 'PUT',
    ...(useProxy ? {} : { credentials: 'include' }),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fields: { description: adf } }),
  });
  if (!res.ok) throw new Error(`Jira description write failed: ${res.status}`);
}
```

- [ ] **Step 2: Set statusUpdatedAt on save and call writeStatusToJira**

In [app.js](app.js), find the `editProjectForm` submit handler. Find these lines (around line 1354):
```js
  const rawStatus = editStatusEditor.getAttribute('data-placeholder-active') ? '' : editStatusEditor.innerHTML.trim();
  selectedProject.statusText = isEmptyStatus(rawStatus) ? '' : rawStatus;
```

Replace with:
```js
  const rawStatus = editStatusEditor.getAttribute('data-placeholder-active') ? '' : editStatusEditor.innerHTML.trim();
  selectedProject.statusText = isEmptyStatus(rawStatus) ? '' : rawStatus;
  selectedProject.statusUpdatedAt = new Date().toISOString();
```

Then find the block that calls Jira write functions (around line 1362):
```js
  const issueKey = getJiraIssueKey(selectedProject.jira);
  if (issueKey) {
    writeRiskReasonToJira(issueKey, riskOptionId || null).catch(e => { console.error('[riskReason→Jira]', e); showToast(`Jira risk reason sync failed: ${e.message}`); });
    writeRiskRateToJira(issueKey, selectedProject.health).catch(e => { console.error('[riskRate→Jira]', e); showToast(`Jira risk rate sync failed: ${e.message}`); });
    if (newDueDate) writeDueDateToJira(issueKey, newDueDate).catch(e => { console.error('[dueDate→Jira]', e); showToast(`Jira due date sync failed: ${e.message}`); });
  }
```

Replace with:
```js
  const issueKey = getJiraIssueKey(selectedProject.jira);
  if (issueKey) {
    writeRiskReasonToJira(issueKey, riskOptionId || null).catch(e => { console.error('[riskReason→Jira]', e); showToast(`Jira risk reason sync failed: ${e.message}`); });
    writeRiskRateToJira(issueKey, selectedProject.health).catch(e => { console.error('[riskRate→Jira]', e); showToast(`Jira risk rate sync failed: ${e.message}`); });
    if (newDueDate) writeDueDateToJira(issueKey, newDueDate).catch(e => { console.error('[dueDate→Jira]', e); showToast(`Jira due date sync failed: ${e.message}`); });
    writeStatusToJira(issueKey, selectedProject.statusText).catch(e => { console.error('[status→Jira]', e); showToast(`Jira status sync failed: ${e.message}`); });
  }
```

- [ ] **Step 3: Verify in browser**

1. Open `index.html`, edit any project that has a Jira key (e.g. PSVAMB-145930).
2. Update the Project Status field with some text and save.
3. Check DevTools console — no `[status→Jira]` error should appear.
4. Check the proxy terminal — should show `OK issue/PSVAMB-145930` for a PUT request.
5. Open the Jira issue in browser — description should reflect the saved text.
6. Check `projects[0].statusUpdatedAt` in console — should be a recent ISO timestamp.

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: write project status to Jira description on save, track statusUpdatedAt"
```

---

### Task 3: syncStatusFromJira on page load

**Files:**
- Modify: `app.js` — add `syncStatusFromJira()` function; call it on page load after `syncProjectProgressFromJira()`

**Interfaces:**
- Consumes: `adfToText(adf)` from Task 1, `writeStatusToJira(issueKey, text)` from Task 2, `getJiraIssueKey(jira)` (existing), `saveProjects()` (existing), `renderAll()` (existing)
- Produces: `syncStatusFromJira(): Promise<void>`

- [ ] **Step 1: Add syncStatusFromJira function**

In [app.js](app.js), find `async function syncProjectProgressFromJira()` (around line 543). Insert the following function AFTER the closing `}` of `syncProjectProgressFromJira` (after the `saveProjects(); renderAll();` and closing brace):

```js
async function syncStatusFromJira() {
  const useProxy = settings.jiraEmail && settings.jiraToken;
  if (!useProxy) return;
  let changed = false;

  for (const project of projects) {
    const issueKey = getJiraIssueKey(project.jira);
    if (!issueKey) continue;
    try {
      const url = `http://localhost:8081/jira/issue/${issueKey}?fields=description,updated`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) continue;
      const data = await res.json();
      const jiraUpdated = data.fields?.updated || '';
      const localUpdated = project.statusUpdatedAt || '';

      if (!localUpdated || jiraUpdated > localUpdated) {
        // Jira is newer (or no local timestamp) — pull from Jira
        const adf = data.fields?.description;
        const text = adf ? adfToText(adf) : '';
        if (text !== project.statusText) {
          project.statusText = text;
          project.statusUpdatedAt = jiraUpdated;
          changed = true;
        }
      } else if (localUpdated > jiraUpdated) {
        // Dashboard is newer — push to Jira silently
        writeStatusToJira(issueKey, project.statusText).catch(() => {});
      }
    } catch {}
  }

  if (changed) {
    saveProjects();
    renderAll();
  }
}
```

- [ ] **Step 2: Call syncStatusFromJira on page load**

In [app.js](app.js), find the page-load calls at the bottom (around line 2565):
```js
syncProjectProgressFromJira();
startAutoProjectPoll();
```

Replace with:
```js
syncProjectProgressFromJira();
syncStatusFromJira();
startAutoProjectPoll();
```

- [ ] **Step 3: Verify in browser**

1. Open `index.html` with the proxy running.
2. Open DevTools → Network tab, filter by `jira/issue`.
3. Reload the page — you should see GET requests for `issue/{key}?fields=description,updated` for each project with a Jira key.
4. Find a project whose Jira description has content — after reload, its Project Status column should show that content (plain text with bullets if applicable).
5. Edit a project's status in the dashboard, save it, then check the proxy terminal for `OK issue/{key}` PUT. Reload the page — the status should persist (dashboard was newer so it won't be overwritten by Jira).

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: sync project status from Jira description on page load (most-recent-wins)"
```
