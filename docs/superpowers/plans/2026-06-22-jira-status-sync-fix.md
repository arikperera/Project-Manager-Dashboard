# Jira Status Sync — Fix Plan (HTML↔ADF conversion + bug fixes)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken plain-text conversion layer with full HTML↔ADF round-trip, fix timestamp comparison, fix push-path data loss, and add browser-credential fallback to sync.

**Architecture:** Single task — replaces `inlineToText`, `blockToText`, `adfToText`, `textToAdf` with `adfToHtml` and `htmlToAdf`; fixes `syncStatusFromJira` and `writeStatusToJira`. All changes in `app.js` only.

**Tech Stack:** Vanilla JS. ADF (Atlassian Document Format). Browser DOM APIs for HTML parsing.

## Global Constraints

- No build step — changes take effect by refreshing `index.html`.
- `statusText` is stored as HTML from `contenteditable` editor — must stay HTML throughout.
- `adfToHtml(adf)` replaces `adfToText` — returns HTML string, not plain text.
- `htmlToAdf(html)` replaces `textToAdf` — parses HTML DOM, returns ADF JSON.
- Timestamp comparison MUST use `new Date(x).getTime()` — ISO strings with timezone offsets are not lexicographically comparable.
- `syncStatusFromJira` must support both proxy and browser-credential (`credentials: 'include'`) modes.
- Push-to-Jira path in `syncStatusFromJira` must update `project.statusUpdatedAt` and call `saveProjects()`.
- Empty ADF text nodes (`text: ''`) must be skipped — Jira rejects them.
- Old functions `inlineToText`, `blockToText`, `adfToText`, `textToAdf` are deleted and replaced.

---

### Task 1: Replace conversion layer and fix all sync bugs

**Files:**
- Modify: `app.js` — replace 4 old conversion functions with `adfToHtml` + `htmlToAdf`; fix `syncStatusFromJira`; fix `writeStatusToJira` call in `syncStatusFromJira`

**Interfaces:**
- Replaces: `inlineToText`, `blockToText`, `adfToText`, `textToAdf` (deleted)
- Produces: `adfToHtml(adf: object): string`, `htmlToAdf(html: string): object`

- [ ] **Step 1: Replace the 4 old conversion functions with adfToHtml + htmlToAdf**

In [app.js](app.js), find and DELETE these four functions entirely (lines ~651–730):
- `function inlineToText(node) { ... }`
- `function blockToText(node, depth) { ... }`
- `function adfToText(adf) { ... }`
- `function textToAdf(text) { ... }`

Replace them with the following two functions:

```js
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
  if (node.type === 'hardBreak') return '<br>';
  // fallback: render content if present
  return (node.content || []).map(adfBlockToHtml).join('');
}

function adfInlineToHtml(node) {
  if (!node) return '';
  if (node.type === 'hardBreak') return '<br>';
  if (node.type !== 'text') return '';
  let text = escapeHtml(node.text || '');
  if (!text) return '';
  const marks = node.marks || [];
  for (const mark of marks) {
    if (mark.type === 'strong') text = `<strong>${text}</strong>`;
    else if (mark.type === 'em') text = `<em>${text}</em>`;
    else if (mark.type === 'underline') text = `<u>${text}</u>`;
    else if (mark.type === 'textColor') text = `<span style="color:${escapeHtml(mark.attrs?.color || '')}">${text}</span>`;
    else if (mark.type === 'link') text = `<a href="${escapeHtml(mark.attrs?.href || '')}">${text}</a>`;
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
        const items = [...node.children].map(li => ({
          type: 'listItem',
          content: htmlNodesToAdf(li.childNodes).filter(n => n.type !== 'paragraph' || (n.content && n.content.length > 0))
            .map(n => n.type === 'paragraph' ? n : n),
        })).filter(item => item.content.length > 0);
        if (items.length) result.push({ type: listType, content: items });
      } else if (tag === 'li') {
        const inner = htmlNodesToAdf(node.childNodes);
        result.push({ type: 'listItem', content: inner.length ? inner : [{ type: 'paragraph', content: [] }] });
      } else if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1]);
        const content = htmlInlineToAdf(node);
        result.push({ type: 'heading', attrs: { level }, content });
      } else if (tag === 'div' || tag === 'p') {
        const content = htmlInlineToAdf(node);
        result.push({ type: 'paragraph', content });
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
```

- [ ] **Step 2: Update writeStatusToJira to use htmlToAdf**

In [app.js](app.js), find `writeStatusToJira` (around line 850). Find this line inside it:
```js
  const adf = textToAdf(statusText || '');
```
Replace with:
```js
  const adf = htmlToAdf(statusText || '');
```

- [ ] **Step 3: Fix syncStatusFromJira — HTML pull, timestamp comparison, push path, credentials**

In [app.js](app.js), replace the entire `syncStatusFromJira` function body with:

```js
async function syncStatusFromJira() {
  const useProxy = settings.jiraEmail && settings.jiraToken;
  let changed = false;

  for (const project of projects) {
    const issueKey = getJiraIssueKey(project.jira);
    if (!issueKey) continue;
    try {
      const url = useProxy
        ? `http://localhost:8081/jira/issue/${issueKey}?fields=description,updated`
        : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}?fields=description,updated`;
      const opts = useProxy
        ? { headers: { Accept: 'application/json' } }
        : { credentials: 'include', headers: { Accept: 'application/json' } };
      const res = await fetch(url, opts);
      if (!res.ok) continue;
      const data = await res.json();
      const jiraUpdated = data.fields?.updated || '';
      const localUpdated = project.statusUpdatedAt || '';
      const jiraTime = jiraUpdated ? new Date(jiraUpdated).getTime() : 0;
      const localTime = localUpdated ? new Date(localUpdated).getTime() : 0;

      if (!localTime || jiraTime > localTime) {
        // Jira is newer (or no local timestamp) — pull from Jira
        const adf = data.fields?.description;
        const html = adf ? adfToHtml(adf) : '';
        if (html !== project.statusText) {
          project.statusText = html;
          project.statusUpdatedAt = jiraUpdated;
          changed = true;
        }
      } else if (localTime > jiraTime) {
        // Dashboard is newer — push to Jira silently
        await writeStatusToJira(issueKey, project.statusText).catch(() => {});
        project.statusUpdatedAt = new Date().toISOString();
        changed = true;
      }
    } catch {}
  }

  if (changed) {
    saveProjects();
    renderAll();
  }
}
```

- [ ] **Step 4: Verify in browser console**

Open `index.html`, open DevTools console, run:
```js
// Test adfToHtml
const adf = {version:1,type:'doc',content:[
  {type:'paragraph',content:[{type:'text',text:'Hello ',marks:[{type:'strong'}]},{type:'text',text:'world'}]},
  {type:'bulletList',content:[
    {type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Item 1'}]}]},
    {type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Item 2'}]}]}
  ]}
]};
console.log(adfToHtml(adf));
// Expected: <div><strong>Hello </strong>world</div><ul><li><div>Item 1</div></li><li><div>Item 2</div></li></ul>

// Test htmlToAdf round-trip
const html = '<div><strong>Hello</strong> world</div><ul><li>Item 1</li><li>Item 2</li></ul>';
const result = htmlToAdf(html);
console.log(JSON.stringify(result.content[0])); // paragraph with strong mark
console.log(JSON.stringify(result.content[1])); // bulletList with 2 items

// Test timestamp comparison
console.log(new Date('2026-06-22T10:15:30.123+0300').getTime()); // should work
console.log(new Date('2026-06-22T07:15:30.123Z').getTime()); // same instant, equal value
```

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "fix: replace plain-text ADF conversion with HTML↔ADF, fix timestamp comparison and sync bugs"
```
