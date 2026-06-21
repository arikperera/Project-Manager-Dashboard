# PM Status Field — Design Spec

**Date:** 2026-06-21

## Problem

When a PM sets a project to Yellow or Red health, there is no free-text field to explain why. The existing tooltip on "Project Health" shows the Risk Reason (a dropdown value), but that's being replaced with a richer PM-written explanation.

## Goals

1. Add a "PM Status" textarea to the edit modal, visible only when health is Yellow or Red, positioned between Health and Risk Reason.
2. Store the text as `pmStatus` on the project object.
3. Show the PM Status text as a hover tooltip on "Project Health" in the main panel, backup view, and exported report.
4. If `pmStatus` is empty, tooltip shows `"No info was set by PM"`.
5. Clear `pmStatus` when health is set back to Green.

## Changes

### index.html — New PM Status field in edit modal

Between the Health `<select>` label and the `riskReasonLabel`, add:

```html
<label id="pmStatusLabel">
  PM Status
  <textarea id="editPmStatus" rows="3" placeholder="Explain why this project is at risk…"></textarea>
</label>
```

### app.js — Modal open (`openEditProjectModal`)

After setting `editHealth.value`, add:
```js
editPmStatus.value = project.pmStatus || '';
const isAtRisk = ['Yellow', 'Red'].includes(project.health);
pmStatusLabel.style.display = isAtRisk ? '' : 'none';
```

The existing `riskReasonLabel` show/hide logic stays unchanged.

### app.js — Health change handler (`editHealth.addEventListener('change', ...)`)

Add alongside the existing `riskReasonLabel` toggle:
```js
pmStatusLabel.style.display = ['Yellow', 'Red'].includes(editHealth.value) ? '' : 'none';
```

### app.js — Modal save (`editProjectForm.addEventListener('submit', ...)`)

Add:
```js
selectedProject.pmStatus = ['Yellow', 'Red'].includes(selectedProject.health)
  ? (editPmStatus.value.trim())
  : '';
```

### app.js — Modal close (`closeEditProjectModal`)

Add:
```js
editPmStatus.value = '';
```

### app.js — Tooltip in main table (line ~800)

Replace:
```js
${project.riskReason ? `<div class="health-tooltip">${escapeHtml(project.riskReason)}</div>` : ''}
```
With:
```js
<div class="health-tooltip">${escapeHtml(project.pmStatus || 'No info was set by PM')}</div>
```

### app.js — Tooltip in backup view (line ~1008)

Same replacement as main table.

### app.js — `healthPill()` in exported report (line ~1542)

Replace the `riskReason` parameter with `pmStatus`. Show `pmStatus || 'No info was set by PM'` as the tooltip tip.

### app.js — DOM cache

Add near top with other `const` element refs:
```js
const editPmStatus = document.getElementById('editPmStatus');
const pmStatusLabel = document.getElementById('pmStatusLabel');
```

## Data Schema

Add `pmStatus: ''` to new projects created via `modalProjectForm`. Existing projects without the field default to `''` via the `|| ''` fallback — no migration needed.

## Behaviour Summary

| Scenario | PM Status field | Tooltip |
|---|---|---|
| Health = Green | Hidden | "No info was set by PM" |
| Health = Yellow/Red, no text entered | Visible, empty | "No info was set by PM" |
| Health = Yellow/Red, text entered | Visible, filled | PM's text |
| Health changed Green → Yellow/Red | Field appears | — |
| Health changed Yellow/Red → Green | Field hidden, value cleared on save | "No info was set by PM" |

## Out of Scope

- Showing PM Status in the PM report table (only tooltip on Project Health column).
- Character limit on the textarea.
- History/audit trail of PM Status changes.
