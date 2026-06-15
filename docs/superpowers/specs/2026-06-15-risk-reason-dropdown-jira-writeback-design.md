# Risk Reason Dropdown & Jira Write-back — Design Spec

Date: 2026-06-15

## Summary

Two changes:
1. Replace the free-text Risk Reason textarea in the edit modal with a dropdown of 6 predefined values matching Jira's "Risk Reason" field options
2. When PM saves a project with Yellow/Red health, write the selected risk reason back to the Jira issue via the API (same proxy/auth pattern as progress reads). On failure, save locally and show a non-blocking warning.

---

## Change 1: Risk Reason Dropdown

### Location
`index.html` — edit modal, `id="editRiskReason"`
`app.js` — anywhere `editRiskReason.value` is read or written

### HTML Change
Replace:
```html
<textarea id="editRiskReason" rows="2" placeholder="Explain the risk reason..."></textarea>
```

With:
```html
<select id="editRiskReason">
  <option value="">-- Select Risk Reason --</option>
  <option value="Non-responsive and/or demanding customer">Non-responsive and/or demanding customer</option>
  <option value="Delayed support from Dev/Core/R&D">Delayed support from Dev/Core/R&D</option>
  <option value="Churn Risk/Task force customer">Churn Risk/Task force customer</option>
  <option value="Dev work exceeded estimation">Dev work exceeded estimation</option>
  <option value="Hours not received from sales as promised">Hours not received from sales as promised</option>
  <option value="Solution changes after the initial estimation">Solution changes after the initial estimation</option>
</select>
```

### JS Changes
- `editRiskReason.value = project.riskReason || ''` — unchanged, works for both textarea and select
- `editRiskReason.value.trim()` on submit — unchanged
- `closeEditProjectModal()` resets via `editProjectForm.reset()` — unchanged, works for select too
- No other JS changes needed for the dropdown itself

---

## Change 2: Jira Write-back

### New function: `writeRiskReasonToJira(issueKey, riskReason)`

```js
async function writeRiskReasonToJira(issueKey, riskReason) {
  const useProxy = settings.jiraEmail && settings.jiraToken;
  // Step 1: resolve field ID from names map (same pattern as progress sync)
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

  // Step 2: write back
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
```

### Edit form submit handler changes

After saving locally (existing logic), add:

```js
const issueKey = getJiraIssueKey(selectedProject.jira);
const riskReason = selectedProject.riskReason;
if (issueKey && (selectedProject.health === 'Yellow' || selectedProject.health === 'Red') && riskReason) {
  writeRiskReasonToJira(issueKey, riskReason).catch(() => {
    showEditModalWarning('Project saved. Jira update failed — please update Risk Reason manually.');
  });
}
```

### Warning banner: `showEditModalWarning(message)`

Injects a yellow banner at the top of `.modal-card` in the edit modal, auto-dismisses after 4 seconds:

```js
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

Note: the modal closes immediately after save, so the banner only shows if the modal is re-opened or if we keep the modal open briefly after save. Since the write-back is async and the modal closes synchronously, the warning is shown by re-opening the modal is NOT the pattern — instead, we show the warning BEFORE closing the modal. Implementation: keep the modal open, show the banner, close after 4 seconds on failure. On success (or no Jira key), close immediately as today.

### Revised submit flow

1. Validate and save locally (existing logic)
2. If no Jira key or Green health → `closeEditProjectModal()` immediately (no change)
3. If Yellow/Red + risk reason + Jira key → attempt write-back:
   - Show a neutral "Saving to Jira..." indicator (optional, can skip for simplicity)
   - On success → `closeEditProjectModal()`
   - On failure → show warning banner, close modal after 4 seconds

---

## Files Affected

- `index.html` — replace `<textarea id="editRiskReason">` with `<select>`
- `app.js` — add `writeRiskReasonToJira()`, add `showEditModalWarning()`, update edit form submit handler

## Out of Scope

- Reading Risk Reason from Jira on page load (not needed — PM sets it here)
- Writing Risk Reason when health is set back to Green (field cleared locally, not written to Jira)
- Any changes to the add project modal
