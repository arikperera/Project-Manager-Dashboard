# Due Month Filter & Summary Card — Design Spec

Date: 2026-06-15

## Summary

Two changes to the main dashboard:
1. Replace the "All Statuses" filter with a dynamic "Project due month" filter
2. Replace the "Completion rate / Average progress" summary card with a "Due this month" card that shows a hover popup listing affected projects

---

## Change 1: Due Month Filter

### Location
`index.html` filter bar (rightmost filter), `app.js` filter logic and event listeners.

### HTML Change
Replace `<select id="statusFilter">` with `<select id="duemonthFilter">`. Options are rendered dynamically on page load — not hardcoded — so they always reflect the current date:

- Option 1: "All months" (value: `""`)
- Option 2: Current month, e.g. "June 2026" (value: `"2026-06"`)
- Option 3: Next month, e.g. "July 2026" (value: `"2026-07"`)
- Option 4: Month after next, e.g. "August 2026" (value: `"2026-08"`)

### JS Changes
- Remove `statusFilter` constant and its event listener
- Add `duemonthFilter` constant and `change` event listener → `renderTable()`
- In `getFilteredProjects()`: remove `matchesStatus` logic; add `matchesDueMonth` — parse `project.dueDate` (format: `YYYY-MM-DD`), extract `YYYY-MM`, compare to selected value. Empty value = show all.
- `renderSelect()` gains a call to populate `duemonthFilter` options dynamically on each render (to keep months current across long sessions)

---

## Change 2: "Due This Month" Summary Card

### Location
`index.html` stats grid (4th card), `app.js` `renderSummary()`.

### HTML Change
Replace the purple `stat-card` (Completion rate):

```html
<article class="stat-card accent-purple" id="dueThisMonthCard" style="position:relative;cursor:default;">
  <p>Due this month</p>
  <h3 id="dueThisMonthCount">0</h3>
  <span id="dueThisMonthTrigger" style="color:#a78bfa;cursor:pointer;">View projects</span>
  <div id="dueThisMonthPopup" class="atrisk-popup hidden"></div>
</article>
```

Reuses the existing `.atrisk-popup` styles — no new CSS needed.

### JS Changes
In `renderSummary()`:
- Compute current month string (`YYYY-MM`)
- Filter projects where `dueDate.startsWith(currentMonth)`
- Set `dueThisMonthCount` text to count
- Build popup HTML: list of `Customer – Project name (due: YYYY-MM-DD)`, or "None" if empty
- Wire hover/click toggle on `dueThisMonthTrigger` — same pattern as `atRiskTrigger` / `atRiskPopup`
- Remove `completionRate` computation and DOM update

---

## Files Affected

- `index.html` — filter bar, stats grid card
- `app.js` — `getFilteredProjects()`, `renderSummary()`, `renderSelect()`, constants, event listeners

## Out of Scope

- Exported HTML report filter (separate concern, not changed here)
- Any changes to project schema or localStorage
