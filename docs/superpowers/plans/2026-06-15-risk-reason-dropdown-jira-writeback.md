# Risk Reason Dropdown & Jira Write-back Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text Risk Reason textarea with a predefined dropdown and write the selected value back to Jira when a PM saves a Yellow/Red project.

**Architecture:** Two independent changes in `index.html` and `app.js`. The dropdown is a straight HTML swap — no JS logic changes needed. The Jira write-back is a new async function `writeRiskReasonToJira()` that resolves the custom field ID dynamically (same pattern as progress sync), then PUTs the value. The edit form submit handler becomes async and keeps the modal open during the Jira call, closing on success or showing a warning banner and closing after 4 seconds on failure.

**Tech Stack:** Vanilla JS, Jira REST API v3, existing proxy pattern (`http://localhost:8081/jira/...` with API token, or direct with `credentials: include`).

---

## Files

- Modify: `index.html` lines 130–133 (textarea → select)
- Modify: `app.js` — add `writeRiskReasonToJira()` and `showEditModalWarning()` after `syncProjectProgressFromJira()`, update `editProjectForm` submit handler (lines 970–991)

---

### Task 1: Replace textarea with dropdown in index.html

**Files:**
- Modify: `index.html` lines 130–133

- [ ] **Step 1: Replace the textarea with a select**

In `index.html`, find:

```html
          <label id="riskReasonLabel" style="display:none;">
            Risk Reason
            <textarea id="editRiskReason" rows="2" placeholder="Explain the risk reason..."></textarea>
          </label>
```

Replace with:

```html
          <label id="riskReasonLabel" style="display:none;">
            Risk Reason
            <select id="editRiskReason">
              <option value="">-- Select Risk Reason --</option>
              <option value="Non-responsive and/or demanding customer">Non-responsive and/or demanding customer</option>
              <option value="Delayed support from Dev/Core/R&D">Delayed support from Dev/Core/R&D</option>
              <option value="Churn Risk/Task force customer">Churn Risk/Task force customer</option>
              <option value="Dev work exceeded estimation">Dev work exceeded estimation</option>
              <option value="Hours not received from sales as promised">Hours not received from sales as promised</option>
              <option value="Solution changes after the initial estimation">Solution changes after the initial estimation</option>
            </select>
          </label>
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Edit a project with Yellow or Red health. The Risk Reason field should now be a dropdown with 6 options instead of a free-text box. Existing `project.riskReason` values that match an option should pre-select correctly (because `editRiskReason.value = project.riskReason` still works for `<select>`).

---

### Task 2: Add `writeRiskReasonToJira()` and `showEditModalWarning()` to app.js

**Files:**
- Modify: `app.js` — add after `syncProjectProgressFromJira()` closing brace (after line ~510)

- [ ] **Step 1: Add both functions after `syncProjectProgressFromJira()`**

In `app.js`, find the closing of `syncProjectProgressFromJira`:

```js
    } catch (error) {
      console.warn(`Jira progress fetch failed for ${key}`, error);
    }
  }
}
```

Add the following immediately after that closing `}`:

```js
async function writeRiskReasonToJira(issueKey, riskReason) {
  const useProxy = settings.jiraEmail && settings.jiraToken;
  const readUrl = useProxy
    ? `http://localhost:8081/jira/issue/${issueKey}?fields=*all&expand=names`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}?fields=*all&expand=names`;
  const readOpts = useProxy
    ? { headers: { Accept: 'application/json' } }
    : { credentials: 'include', headers: { Accept: 'application/json' } };

  const readResponse = await fetch(readUrl, readOpts);
  if (!readResponse.ok) throw new Error(`Failed to read issue: ${readResponse.status}`);
  const data = await readResponse.json();

  const fieldEntry = data.names
    ? Object.entries(data.names).find(([, name]) => name === 'Risk Reason')
    : null;
  if (!fieldEntry) throw new Error('Risk Reason field not found in Jira');
  const [fieldId] = fieldEntry;

  const writeUrl = useProxy
    ? `http://localhost:8081/jira/issue/${issueKey}`
    : `https://kaltura.atlassian.net/rest/api/3/issue/${issueKey}`;
  const writeOpts = useProxy
    ? {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ fields: { [fieldId]: { value: riskReason } } }),
      }
    : {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ fields: { [fieldId]: { value: riskReason } } }),
      };

  const writeResponse = await fetch(writeUrl, writeOpts);
  if (!writeResponse.ok) throw new Error(`Jira write failed: ${writeResponse.status}`);
}

function showEditModalWarning(message) {
  const card = editProjectModal.querySelector('.modal-card');
  const existing = card.querySelector('.edit-warning-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.className = 'edit-warning-banner';
  banner.textContent = message;
  banner.style.cssText = 'background:#854d0e;color:#fef9c3;padding:10px 14px;border-radius:10px;margin-bottom:12px;font-size:0.88rem;';
  card.insertBefore(banner, card.firstChild);
  setTimeout(() => banner.remove(), 4000);
}
```

- [ ] **Step 2: Verify no JS errors**

Open `index.html` in browser, open DevTools console. No errors about undefined functions.

---

### Task 3: Update the edit form submit handler to be async and call write-back

**Files:**
- Modify: `app.js` lines 970–991

- [ ] **Step 1: Replace the submit handler**

In `app.js`, find:

```js
editProjectForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const selectedIndex = Number(editProjectForm.dataset.projectIndex ?? -1);
  const selectedProject = projects[selectedIndex];
  if (!selectedProject) return;

  const newCustomer = editCustomerName.value.trim();
  const newName = editProjectName.value.trim();
  if (newCustomer) selectedProject.customer = newCustomer;
  if (newName) selectedProject.name = newName;
  selectedProject.health = editHealth.value;
  selectedProject.riskReason = (editHealth.value === 'Yellow' || editHealth.value === 'Red') ? editRiskReason.value.trim() : '';
  selectedProject.atLink = document.getElementById('editAtLink').value.trim();
  const newDueDate = parseDateInput(document.getElementById('editDueDateText').value);
  if (newDueDate) selectedProject.dueDate = newDueDate;
  selectedProject.statusText = editStatusEditor.innerHTML.trim();

  saveProjects();
  renderAll();
  closeEditProjectModal();
});
```

Replace with:

```js
editProjectForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const selectedIndex = Number(editProjectForm.dataset.projectIndex ?? -1);
  const selectedProject = projects[selectedIndex];
  if (!selectedProject) return;

  const newCustomer = editCustomerName.value.trim();
  const newName = editProjectName.value.trim();
  if (newCustomer) selectedProject.customer = newCustomer;
  if (newName) selectedProject.name = newName;
  selectedProject.health = editHealth.value;
  selectedProject.riskReason = (editHealth.value === 'Yellow' || editHealth.value === 'Red') ? editRiskReason.value.trim() : '';
  selectedProject.atLink = document.getElementById('editAtLink').value.trim();
  const newDueDate = parseDateInput(document.getElementById('editDueDateText').value);
  if (newDueDate) selectedProject.dueDate = newDueDate;
  selectedProject.statusText = editStatusEditor.innerHTML.trim();

  saveProjects();
  renderAll();

  const issueKey = getJiraIssueKey(selectedProject.jira);
  const riskReason = selectedProject.riskReason;
  if (issueKey && (selectedProject.health === 'Yellow' || selectedProject.health === 'Red') && riskReason) {
    try {
      await writeRiskReasonToJira(issueKey, riskReason);
      closeEditProjectModal();
    } catch {
      showEditModalWarning('Project saved. Jira update failed — please update Risk Reason manually.');
      setTimeout(() => closeEditProjectModal(), 4000);
    }
  } else {
    closeEditProjectModal();
  }
});
```

- [ ] **Step 2: Verify happy path (no Jira configured)**

Open `index.html`. Edit a project, set health to Yellow, pick a risk reason, save. Modal should close immediately (no Jira token configured = `issueKey` found but `useProxy` false and CORS will block → catch fires → warning shows → closes after 4s). OR if no `project.jira` set, modal closes immediately.

- [ ] **Step 3: Verify Green health path**

Edit a project, set health to Green, save. Modal closes immediately — no Jira write attempted.

---

### Task 4: Commit

- [ ] **Step 1: Stage and commit**

```bash
git add index.html app.js
git commit -m "feat: risk reason dropdown with Jira write-back on Yellow/Red health save"
```

- [ ] **Step 2: Final smoke test**

Open `index.html`, verify:
1. Edit modal shows dropdown for Risk Reason when health is Yellow or Red
2. Existing `riskReason` values pre-select correctly in the dropdown
3. Saving with Green health closes modal immediately, no Jira call
4. Saving with Yellow/Red + risk reason + no Jira key → closes immediately
5. No JS errors in DevTools console
