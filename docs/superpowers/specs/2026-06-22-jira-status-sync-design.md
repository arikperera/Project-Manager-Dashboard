# Jira Status Sync — Design Spec

**Date:** 2026-06-22

## Problem

Project Status in the dashboard and the Jira Initiative Description are maintained independently. PMs must update both places manually. This feature keeps them in sync automatically, with the most-recently-updated side winning.

## Goals

1. On page load: compare `statusUpdatedAt` (dashboard) vs Jira `updated` timestamp — pull from Jira if newer, push to Jira if dashboard is newer.
2. On save in edit modal: write dashboard status to Jira description immediately.
3. ADF → plain text with bullet/indent structure preserved on read.
4. Plain text → ADF on write, preserving bullet/indent structure.
5. `statusUpdatedAt` stored on each project, set on every edit-modal save.

## Out of Scope

- Rich text formatting (bold, colors, italic) round-tripped through ADF — plain text only.
- Conflict resolution UI — most-recent-wins is silent.
- Sync for projects without a Jira key.

---

## Section 1 — Schema: statusUpdatedAt

Add `statusUpdatedAt: ''` to schema migration in `migrateProjects()`.

Set `selectedProject.statusUpdatedAt = new Date().toISOString()` in `editProjectForm` submit handler, alongside `selectedProject.statusText`.

Default `''` means "no local timestamp" → treat Jira as source of truth on first sync.

---

## Section 2 — ADF → plain text: `adfToText(adf)`

```js
function adfToText(adf) {
  if (!adf || !adf.content) return '';
  return adf.content.map(node => blockToText(node, 0)).join('').trimEnd();
}

function blockToText(node, depth) {
  if (node.type === 'paragraph') {
    const text = (node.content || []).map(inlineToText).join('');
    return text + '\n';
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    return (node.content || []).map((item, idx) => {
      const prefix = '\t'.repeat(depth) + (node.type === 'orderedList' ? `${idx + 1}.` : '•') + ' ';
      const children = (item.content || []);
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

function inlineToText(node) {
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  return '';
}
```

---

## Section 3 — Plain text → ADF: `textToAdf(text)`

```js
function textToAdf(text) {
  if (!text) return { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  const lines = text.split('\n');
  const content = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const depth0 = /^[•\-] (.*)/.exec(line);
    const depth1 = /^\t[•\-] (.*)/.exec(line);
    if (depth0 || depth1) {
      // Collect all consecutive bullet lines into one bulletList
      const items = [];
      while (i < lines.length && (/^[•\-] /.test(lines[i]) || /^\t[•\-] /.test(lines[i]))) {
        const d0 = /^[•\-] (.*)/.exec(lines[i]);
        const d1 = /^\t[•\-] (.*)/.exec(lines[i]);
        if (d0) {
          items.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: d0[1] }] }] });
        } else if (d1) {
          // Nested item — attach to last item as a nested bulletList
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

---

## Section 4 — writeStatusToJira(issueKey, statusText)

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

Called in `editProjectForm` submit handler alongside `writeRiskReasonToJira`:
```js
writeStatusToJira(issueKey, selectedProject.statusText).catch(e => { console.error('[status→Jira]', e); showToast(`Jira status sync failed: ${e.message}`); });
```

---

## Section 5 — syncStatusFromJira()

```js
async function syncStatusFromJira() {
  const useProxy = settings.jiraEmail && settings.jiraToken;
  if (!useProxy) return; // proxy required for authenticated writes
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
        // Dashboard is newer — push to Jira
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

Called on page load after `syncProjectProgressFromJira()`.

---

## Data Flow Summary

```
Page load:
  syncStatusFromJira() runs for each project with Jira key
    → GET /jira/issue/{key}?fields=description,updated
    → Compare jiraUpdated vs statusUpdatedAt
    → Jira newer: adfToText(description) → statusText
    → Dashboard newer: textToAdf(statusText) → PUT description

Edit modal save:
  selectedProject.statusText = editor content
  selectedProject.statusUpdatedAt = new Date().toISOString()
  writeStatusToJira(issueKey, statusText) → PUT description
```

## Timestamp Comparison

ISO 8601 strings compare lexicographically correctly (`>` / `<` operators work on `"2026-06-22T10:00:00.000Z"` format). Jira's `updated` field is also ISO 8601.
