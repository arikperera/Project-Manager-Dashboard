# Budget Hours Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show actual/planned hours alongside the percentage in the Project Budget column, always visible, in both the dashboard and the exported HTML report.

**Architecture:** Two targeted edits in `app.js` — one in the `renderTable()` dashboard row template (live DOM), one in the `progressBar()` helper inside `generateHTMLReport()` (static HTML). A shared helper function `buildHoursLabel(actualHours, estimatedHours, nrr)` is extracted first to keep the logic DRY.

**Tech Stack:** Vanilla JS, no build step, no dependencies.

## Global Constraints

- No changes to tooltip content, colour thresholds, or blink trigger logic
- `actualHours ?? 0` — null treated as zero
- Planned hours: `estimatedHours` if not null, else `nrr`, else no denominator
- Layout: bar on line 1; `{percent}% · {actual} / {planned}h ⚠` on line 2
- Separator between percentage and hours: ` · ` (space-middot-space)
- Hours text uses same colour class/style as the existing percentage label

---

### Task 1: Extract `buildHoursLabel` helper and update dashboard

**Files:**
- Modify: `app.js` — add `buildHoursLabel()` near `getProgressTone()` (~line 660), update dashboard row template (~line 1408–1410)

**Interfaces:**
- Produces: `buildHoursLabel(actualHours, estimatedHours, nrr)` → string e.g. `"0 / 10h"`, `"5h actual"`, `""`

- [ ] **Step 1: Open `app.js` and locate `getProgressFillTone` (around line 651). Add the new helper immediately after it (~line 660).**

Insert this function:

```js
function buildHoursLabel(actualHours, estimatedHours, nrr) {
  const actual = actualHours ?? 0;
  const planned = estimatedHours != null ? estimatedHours : (nrr != null ? nrr : null);
  if (planned != null) return `${actual} / ${planned}h`;
  return `${actual}h actual`;
}
```

- [ ] **Step 2: Locate the dashboard progress cell in `renderTable()` (around line 1408–1410). The current code is:**

```js
<div class="progress-bar"><div class="progress-fill ${progressFillTone}" style="width:${Math.min(progressValue, 100)}%"></div></div>
<small class="progress-label ${progressTone}">${progressValue}%</small>
```

Replace those two lines with:

```js
<div class="progress-bar"><div class="progress-fill ${progressFillTone}" style="width:${Math.min(progressValue, 100)}%"></div></div>
<small class="progress-label ${progressTone}">${progressValue}% &middot; ${buildHoursLabel(project.actualHours, project.estimatedHours, project.nrr)}</small>
```

- [ ] **Step 3: The blink icon currently sits outside `progress-wrap` on line 1410, after the closing `</div>`. It must stay there — do not move it. Verify the blink markup is still on the same line after your edit and has not been accidentally removed or duplicated.**

Expected result after edit (conceptually):
```
[bar]
690% · 0 / 10h   ⚠ (blink, outside progress-wrap)
```

- [ ] **Step 4: Open `index.html` in a browser. Find a project with a high progress value (or temporarily set one to 150 in localStorage). Verify:**
  - Bar renders on line 1
  - `{percent}% · {actual} / {planned}h` appears on line 2 in the same colour as the percentage
  - ⚠ blink icon still appears for projects with progress > 90 and no riskReason
  - Hover tooltip still works (unchanged)
  - For a project with `actualHours: null` and `nrr: 10`, line 2 shows `0 / 10h`
  - For a project with `estimatedHours: 20` and `actualHours: null`, line 2 shows `0 / 20h`

- [ ] **Step 5: Commit**

```
git add app.js
git commit -m "feat: show actual/planned hours on budget bar in dashboard"
```

---

### Task 2: Update report `progressBar()` helper

**Files:**
- Modify: `app.js` — update `progressBar()` inside `generateHTMLReport()` (~line 2223–2242)

**Interfaces:**
- Consumes: `buildHoursLabel(actualHours, estimatedHours, nrr)` from Task 1
- Note: `progressBar()` is a closure inside `generateHTMLReport()` and does not have access to `project.nrr` directly — it receives `estimatedHours` as a parameter. The `nrr` value must be passed as a new parameter.

- [ ] **Step 1: Update the `progressBar` function signature (~line 2223). Change:**

```js
function progressBar(val, estimatedHours, remainingHours, actualHours, health, riskReason) {
```

to:

```js
function progressBar(val, estimatedHours, remainingHours, actualHours, health, riskReason, nrr) {
```

- [ ] **Step 2: Find the `bar` const inside `progressBar` (~line 2240). The current code is:**

```js
const bar = `<div style="width:100%;background:#142033;border-radius:999px;overflow:hidden;height:8px;margin-bottom:4px"><div style="height:100%;border-radius:999px;width:${Math.min(v,100)}%;background:${fill}"></div></div><small style="color:${color};font-weight:700">${v}%</small>`;
```

Replace it with:

```js
const hoursLabel = buildHoursLabel(actualHours, estimatedHours, nrr);
const bar = `<div style="width:100%;background:#142033;border-radius:999px;overflow:hidden;height:8px;margin-bottom:4px"><div style="height:100%;border-radius:999px;width:${Math.min(v,100)}%;background:${fill}"></div></div><small style="color:${color};font-weight:700">${v}% &middot; ${hoursLabel}</small>`;
```

- [ ] **Step 3: Find every call to `progressBar()` inside `generateHTMLReport()`. There is one in `atRiskRows` (~line 2253) and one in `allProjectsRows` (search for `progressBar(p.progress`). Update each call to pass `p.nrr` as the last argument.**

The `atRiskRows` call (~line 2253):
```js
// Before:
${progressBar(p.progress, p.estimatedHours, p.remainingHours, p.actualHours, p.health, p.riskReason)}
// After:
${progressBar(p.progress, p.estimatedHours, p.remainingHours, p.actualHours, p.health, p.riskReason, p.nrr)}
```

Search for all other `progressBar(` calls in the same function and apply the same `p.nrr` addition.

- [ ] **Step 4: Generate the HTML report (click Export in the app). Open the downloaded file and verify:**
  - Over Budget section: each project shows `{percent}% · {actual} / {planned}h` on line 2
  - All Projects table: same
  - ⚠ blink still appears for projects > 90% with no riskReason
  - Hover tooltip still works

- [ ] **Step 5: Commit**

```
git add app.js
git commit -m "feat: show actual/planned hours on budget bar in report"
```
