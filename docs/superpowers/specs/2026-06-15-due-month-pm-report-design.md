# Due This Month PM Report — Design Spec

Date: 2026-06-15

## Summary

Add two action buttons to the "Due this month" stat card:
1. A clipboard icon — copies a tab-separated table of projects due this month to the clipboard
2. A mail icon — opens a pre-addressed `mailto:` draft in Outlook with the same table in the body

The table is intentionally minimal: Customer, Project, Jira URL, and two empty columns (PM Comments, Manager Comments) for the PMs and manager to fill in after receiving the email.

---

## Table Format

Tab-separated plain text. Header row + one row per project due this month.

```
Customer	Project	Jira URL	PM Comments	Manager Comments
Acme Corp	Client Portal	https://kaltura.atlassian.net/browse/CP		
Mobile Customer	Mobile Launch	https://jira.example.com/ML		
```

Columns:
1. `customer` — project.customer
2. `name` — project.name
3. `jira` — project.jira (raw URL)
4. `PM Comments` — empty string (column header only, filled by recipient)
5. `Manager Comments` — empty string (column header only, filled by recipient)

Each row ends with two trailing tabs to produce the empty columns.

---

## UI Changes

### Card buttons

Add two small icon buttons inside `dueThisMonthCard`, below the existing "View projects" trigger span. Both are always visible (not hidden behind the popup).

```html
<div id="dueThisMonthActions" style="display:flex;gap:8px;margin-top:6px;">
  <button id="copyDueMonthBtn" title="Copy table to clipboard" style="background:none;border:none;cursor:pointer;color:#a78bfa;font-size:1rem;padding:2px 4px;">⧉</button>
  <button id="mailDueMonthBtn" title="Open in Outlook" style="background:none;border:none;cursor:pointer;color:#a78bfa;font-size:1rem;padding:2px 4px;">✉</button>
</div>
```

Use Unicode characters (⧉ for copy, ✉ for mail) — no icon library needed.

After clicking copy, the clipboard button briefly changes to a ✓ checkmark for 1.5 seconds as feedback, then reverts.

---

## Clipboard Behaviour

`navigator.clipboard.writeText(tableText)` — modern clipboard API, works in all current browsers when the page is opened as a file (`file://`). No fallback needed for this use case.

---

## Email (mailto:) Behaviour

```
mailto:emea.pm@kaltura.com
  ?subject=Projects Due This Month – {Month} {Year}
  &body={tab-separated table}
```

- Subject: `Projects Due This Month – June 2026` (month/year from `new Date()`, same logic as the filter)
- Body: same tab-separated table string as clipboard
- All values URL-encoded via `encodeURIComponent()`
- Opens via `window.location.href = mailtoLink`

Note: `mailto:` bodies are plain text. Tab characters survive in Outlook — pasting the clipboard version into an Outlook table gives better formatting if needed.

---

## JS Changes

### New function: `buildDueMonthTable()`

Computes current month (`YYYY-MM`), filters projects by `dueDate.startsWith(currentMonth)`, builds and returns the tab-separated string.

```js
function buildDueMonthTable() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const due = projects.filter((p) => (p.dueDate || '').startsWith(currentMonth));
  const header = 'Customer\tProject\tJira URL\tPM Comments\tManager Comments';
  const rows = due.map((p) => `${p.customer || ''}\t${p.name || ''}\t${p.jira || ''}\t\t`);
  return [header, ...rows].join('\n');
}
```

### Copy button handler

```js
copyDueMonthBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(buildDueMonthTable()).then(() => {
    copyDueMonthBtn.textContent = '✓';
    setTimeout(() => { copyDueMonthBtn.textContent = '⧉'; }, 1500);
  });
});
```

### Mail button handler

```js
mailDueMonthBtn.addEventListener('click', () => {
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const subject = `Projects Due This Month – ${monthLabel}`;
  const body = buildDueMonthTable();
  window.location.href = `mailto:emea.pm@kaltura.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
```

---

## Files Affected

- `index.html` — add `dueThisMonthActions` div with two buttons inside `dueThisMonthCard`
- `app.js` — add `buildDueMonthTable()`, button constants, and two event listeners

## Out of Scope

- No changes to the existing HTML report export
- No changes to project schema or localStorage
- No recipient management (fixed address: emea.pm@kaltura.com)
