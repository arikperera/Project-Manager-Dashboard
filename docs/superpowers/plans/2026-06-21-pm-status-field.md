# PM Status Field — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free-text "PM Status" textarea to the edit modal (visible for Yellow/Red health) and show its content as a hover tooltip on the Project Health column in all views.

**Architecture:** Two tasks — (1) modal field wiring in `index.html` + `app.js`, (2) tooltip replacement in all three render paths. No new files.

**Tech Stack:** Vanilla JS, HTML, CSS. No dependencies.

## Global Constraints

- No build step — changes take effect by refreshing `index.html` in a browser.
- No frameworks, no npm. Pure vanilla JS/HTML/CSS.
- New field name on project objects: `pmStatus` (string, default `''`).
- Tooltip fallback text (verbatim): `"No info was set by PM"`.

---

### Task 1: Add PM Status field to edit modal

**Files:**
- Modify: `index.html:129-130` (between Health select and riskReasonLabel)
- Modify: `app.js:143-145` (DOM cache block)
- Modify: `app.js:884-887` (openEditProjectModal)
- Modify: `app.js:905-913` (closeEditProjectModal)
- Modify: `app.js:1206-1209` (editProjectForm submit handler)
- Modify: `app.js:1517-1519` (editHealth change handler)

**Interfaces:**
- Produces: `editPmStatus` (textarea DOM element), `pmStatusLabel` (label DOM element), `project.pmStatus` (string field on project objects)

- [ ] **Step 1: Add HTML for PM Status field in index.html**

In [index.html](index.html), find the closing `</label>` after the Health `</select>` (line ~129) and the `<label id="riskReasonLabel">` that follows it. Insert between them:

```html
          <label id="pmStatusLabel">
            PM Status
            <textarea id="editPmStatus" rows="3" placeholder="Explain why this project is at risk…" style="resize:vertical;"></textarea>
          </label>
```

The block should look like:
```html
          <label>
            Health
            <select id="editHealth">
              <option value="Green">Green</option>
              <option value="Yellow">Yellow</option>
              <option value="Red">Red</option>
            </select>
          </label>
          <label id="pmStatusLabel">
            PM Status
            <textarea id="editPmStatus" rows="3" placeholder="Explain why this project is at risk…" style="resize:vertical;"></textarea>
          </label>
          <label id="riskReasonLabel">
            Risk Reason
```

- [ ] **Step 2: Add DOM cache entries in app.js**

In [app.js](app.js), find the block at lines ~143-145:
```js
const editHealth = document.getElementById('editHealth');
const editRiskReason = document.getElementById('editRiskReason');
const riskReasonLabel = document.getElementById('riskReasonLabel');
```

Replace with:
```js
const editHealth = document.getElementById('editHealth');
const editPmStatus = document.getElementById('editPmStatus');
const pmStatusLabel = document.getElementById('pmStatusLabel');
const editRiskReason = document.getElementById('editRiskReason');
const riskReasonLabel = document.getElementById('riskReasonLabel');
```

- [ ] **Step 3: Populate and show/hide PM Status on modal open**

In [app.js](app.js), find `openEditProjectModal` around line 884:
```js
  editHealth.value = project.health || 'Green';
  const matchingOption = Array.from(editRiskReason.options).find(o => o.text === project.riskReason);
  editRiskReason.value = matchingOption ? matchingOption.value : '';
  riskReasonLabel.style.display = '';
```

Replace with:
```js
  editHealth.value = project.health || 'Green';
  editPmStatus.value = project.pmStatus || '';
  const isAtRisk = ['Yellow', 'Red'].includes(project.health);
  pmStatusLabel.style.display = isAtRisk ? '' : 'none';
  const matchingOption = Array.from(editRiskReason.options).find(o => o.text === project.riskReason);
  editRiskReason.value = matchingOption ? matchingOption.value : '';
  riskReasonLabel.style.display = '';
```

- [ ] **Step 4: Reset PM Status on modal close**

In [app.js](app.js), find `closeEditProjectModal` around line 905:
```js
  editProjectForm.reset();
  editStatusEditor.innerHTML = '';
  editStatusEditor.removeAttribute('data-placeholder-active');
  editRiskReason.value = '';
  riskReasonLabel.style.display = '';
```

Replace with:
```js
  editProjectForm.reset();
  editStatusEditor.innerHTML = '';
  editStatusEditor.removeAttribute('data-placeholder-active');
  editPmStatus.value = '';
  pmStatusLabel.style.display = 'none';
  editRiskReason.value = '';
  riskReasonLabel.style.display = '';
```

- [ ] **Step 5: Save PM Status on form submit**

In [app.js](app.js), find the submit handler around line 1206:
```js
  selectedProject.health = editHealth.value;
  const riskOptionId = editRiskReason.value;
  const riskOptionLabel = riskOptionId ? editRiskReason.options[editRiskReason.selectedIndex].text : '';
  selectedProject.riskReason = riskOptionLabel;
```

Replace with:
```js
  selectedProject.health = editHealth.value;
  selectedProject.pmStatus = ['Yellow', 'Red'].includes(selectedProject.health)
    ? editPmStatus.value.trim()
    : '';
  const riskOptionId = editRiskReason.value;
  const riskOptionLabel = riskOptionId ? editRiskReason.options[editRiskReason.selectedIndex].text : '';
  selectedProject.riskReason = riskOptionLabel;
```

- [ ] **Step 6: Show/hide PM Status field on health change**

In [app.js](app.js), find the `editHealth` change handler around line 1517:
```js
editHealth.addEventListener('change', () => {
  riskReasonLabel.style.display = '';
});
```

Replace with:
```js
editHealth.addEventListener('change', () => {
  pmStatusLabel.style.display = ['Yellow', 'Red'].includes(editHealth.value) ? '' : 'none';
  riskReasonLabel.style.display = '';
});
```

- [ ] **Step 7: Verify in browser**

1. Open `index.html`, open any Green project for editing.
2. PM Status field should NOT be visible.
3. Change health to Yellow → PM Status field appears.
4. Type "Customer is delayed on approvals." → Save.
5. Re-open the project → PM Status shows "Customer is delayed on approvals." and health is Yellow.
6. Change health back to Green → PM Status field hides.
7. Save → Re-open → PM Status is empty (cleared on save when Green).

- [ ] **Step 8: Commit**

```bash
git add index.html app.js
git commit -m "feat: add PM Status textarea to edit modal, shown for Yellow/Red health"
```

---

### Task 2: Replace health tooltip with PM Status in all render paths

**Files:**
- Modify: `app.js:~800` (main table health cell)
- Modify: `app.js:~1008` (backup view health cell)
- Modify: `app.js:~1542` (healthPill function in exported report)
- Modify: `app.js:~1622` (exported report allProjectsRows healthPill call)

**Interfaces:**
- Consumes: `project.pmStatus` (string, from Task 1)
- Produces: tooltip on Project Health cell showing pmStatus or "No info was set by PM"

- [ ] **Step 1: Update main table health tooltip**

In [app.js](app.js), find around line 800 in `renderTable`:
```js
              <div class="health-wrap">
                <span class="health-pill health-${(project.health || 'green').toLowerCase()}">${project.health || 'Green'}</span>
                ${project.riskReason ? `<div class="health-tooltip">${escapeHtml(project.riskReason)}</div>` : ''}
              </div>
```

Replace with:
```js
              <div class="health-wrap">
                <span class="health-pill health-${(project.health || 'green').toLowerCase()}">${project.health || 'Green'}</span>
                <div class="health-tooltip">${escapeHtml(project.pmStatus || 'No info was set by PM')}</div>
              </div>
```

- [ ] **Step 2: Update backup view health tooltip**

In [app.js](app.js), find around line 1008 in the backup render function (same pattern as main table):
```js
${p.riskReason ? `<div class="health-tooltip">${escapeHtml(p.riskReason)}</div>` : ''}
```

Replace with:
```js
<div class="health-tooltip">${escapeHtml(p.pmStatus || 'No info was set by PM')}</div>
```

- [ ] **Step 3: Update healthPill function in exported report**

In [app.js](app.js), find `healthPill` around line 1542:
```js
  function healthPill(health, riskReason) {
    const colors = {
      Green: 'background:rgba(74,222,128,0.16);color:#bbf7d0',
      Yellow: 'background:rgba(251,191,36,0.15);color:#fde68a',
      Red: 'background:rgba(220,38,38,0.22);color:#ef4444;border:1px solid rgba(220,38,38,0.4)',
    };
    const h = health || 'Green';
    const pill = `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:0.82rem;font-weight:700;${colors[h]||colors.Green}">${h}</span>`;
    if (riskReason) {
      const tip = esc(riskReason);
      return `<span class="rpt-health-wrap">${pill}<span class="rpt-tooltip" style="color:#fde68a">${tip}</span></span>`;
    }
    return pill;
  }
```

Replace with:
```js
  function healthPill(health, pmStatus) {
    const colors = {
      Green: 'background:rgba(74,222,128,0.16);color:#bbf7d0',
      Yellow: 'background:rgba(251,191,36,0.15);color:#fde68a',
      Red: 'background:rgba(220,38,38,0.22);color:#ef4444;border:1px solid rgba(220,38,38,0.4)',
    };
    const h = health || 'Green';
    const pill = `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:0.82rem;font-weight:700;${colors[h]||colors.Green}">${h}</span>`;
    const tip = esc(pmStatus || 'No info was set by PM');
    return `<span class="rpt-health-wrap">${pill}<span class="rpt-tooltip" style="color:#fde68a">${tip}</span></span>`;
  }
```

- [ ] **Step 4: Update all healthPill call sites in exported report**

In [app.js](app.js), find all calls to `healthPill` inside `generateHTMLReport`. There are three — update each to pass `p.pmStatus` instead of `p.riskReason`:

Find (around line 1583 — at-risk summary section):
```js
        <td>${healthPill(p.health)}</td>
```
Replace with:
```js
        <td>${healthPill(p.health, p.pmStatus)}</td>
```

Find (around line 1596 — PM group rows):
```js
        <td>${healthPill(p.health, p.riskReason)}</td>
```
Replace with:
```js
        <td>${healthPill(p.health, p.pmStatus)}</td>
```

Find (around line 1622 — allProjectsRows):
```js
      <td>${healthPill(p.health, p.riskReason)}</td>
```
Replace with:
```js
      <td>${healthPill(p.health, p.pmStatus)}</td>
```

- [ ] **Step 5: Verify in browser**

1. Open `index.html`. Hover over the Project Health cell of a Green project → tooltip shows "No info was set by PM".
2. Edit that project, set health to Yellow, type "Waiting on customer sign-off." → Save.
3. Hover over Project Health → tooltip shows "Waiting on customer sign-off."
4. Open the backup view → same tooltip on Project Health column.
5. Export the HTML report → hover over Project Health → same tooltip behaviour.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: show PM Status as hover tooltip on Project Health in all views"
```
