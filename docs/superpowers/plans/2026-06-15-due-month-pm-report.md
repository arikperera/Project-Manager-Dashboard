# Due This Month PM Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a clipboard copy button and a mailto button to the "Due this month" card that let the user send a minimal tab-separated project table to emea.pm@kaltura.com with one click.

**Architecture:** Two small HTML buttons added inside the existing `dueThisMonthCard`. A new `buildDueMonthTable()` function in `app.js` produces the tab-separated string. Two event listeners wire up clipboard and mailto behaviours. No new files, no CSS changes, no schema changes.

**Tech Stack:** Vanilla JS, HTML — no build step, open `index.html` in browser to test.

---

## Files

- Modify: `index.html` lines 51–56 (inside `dueThisMonthCard`)
- Modify: `app.js` — add after line 1694 (after the due-this-month popup event listeners)

---

### Task 1: Add the two action buttons to the HTML card

**Files:**
- Modify: `index.html` lines 51–56

- [ ] **Step 1: Add `dueThisMonthActions` div inside the card**

In `index.html`, find:

```html
          <article class="stat-card accent-purple" id="dueThisMonthCard" style="position:relative;cursor:default;">
            <p>Due this month</p>
            <h3 id="dueThisMonthCount">0</h3>
            <span id="dueThisMonthTrigger" style="color:#a78bfa;cursor:pointer;">View projects</span>
            <div id="dueThisMonthPopup" class="atrisk-popup hidden"></div>
          </article>
```

Replace with:

```html
          <article class="stat-card accent-purple" id="dueThisMonthCard" style="position:relative;cursor:default;">
            <p>Due this month</p>
            <h3 id="dueThisMonthCount">0</h3>
            <span id="dueThisMonthTrigger" style="color:#a78bfa;cursor:pointer;">View projects</span>
            <div id="dueThisMonthActions" style="display:flex;gap:8px;margin-top:6px;">
              <button id="copyDueMonthBtn" title="Copy table to clipboard" style="background:none;border:none;cursor:pointer;color:#a78bfa;font-size:1rem;padding:2px 4px;">⧉</button>
              <button id="mailDueMonthBtn" title="Open in Outlook" style="background:none;border:none;cursor:pointer;color:#a78bfa;font-size:1rem;padding:2px 4px;">✉</button>
            </div>
            <div id="dueThisMonthPopup" class="atrisk-popup hidden"></div>
          </article>
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. The "Due this month" card should now show two small icon buttons (⧉ and ✉) below the "View projects" link. They should be purple/violet coloured and clickable-looking. No JS wired yet so clicking does nothing.

---

### Task 2: Add `buildDueMonthTable()` and button event listeners in app.js

**Files:**
- Modify: `app.js` — insert after line 1694 (after `dueThisMonthPopup.addEventListener('mouseleave', hideDueThisMonthPopup);`)

- [ ] **Step 1: Add the three new JS blocks after the popup event listeners**

In `app.js`, find:

```js
dueThisMonthTrigger.addEventListener('mouseenter', showDueThisMonthPopup);
dueThisMonthTrigger.addEventListener('mouseleave', hideDueThisMonthPopup);
dueThisMonthPopup.addEventListener('mouseenter', () => clearTimeout(dueThisMonthHideTimer));
dueThisMonthPopup.addEventListener('mouseleave', hideDueThisMonthPopup);
```

Replace with:

```js
dueThisMonthTrigger.addEventListener('mouseenter', showDueThisMonthPopup);
dueThisMonthTrigger.addEventListener('mouseleave', hideDueThisMonthPopup);
dueThisMonthPopup.addEventListener('mouseenter', () => clearTimeout(dueThisMonthHideTimer));
dueThisMonthPopup.addEventListener('mouseleave', hideDueThisMonthPopup);

function buildDueMonthTable() {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const due = projects.filter((p) => (p.dueDate || '').startsWith(currentMonth));
  const header = 'Customer\tProject\tJira URL\tPM Comments\tManager Comments';
  const rows = due.map((p) => `${p.customer || ''}\t${p.name || ''}\t${p.jira || ''}\t\t`);
  return [header, ...rows].join('\n');
}

const copyDueMonthBtn = document.getElementById('copyDueMonthBtn');
const mailDueMonthBtn = document.getElementById('mailDueMonthBtn');

copyDueMonthBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(buildDueMonthTable()).then(() => {
    copyDueMonthBtn.textContent = '✓';
    setTimeout(() => { copyDueMonthBtn.textContent = '⧉'; }, 1500);
  });
});

mailDueMonthBtn.addEventListener('click', () => {
  const now = new Date();
  const monthLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const subject = `Projects Due This Month – ${monthLabel}`;
  const body = buildDueMonthTable();
  window.location.href = `mailto:emea.pm@kaltura.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
```

- [ ] **Step 2: Verify clipboard button**

Open `index.html`. Click the ⧉ button on the "Due this month" card. The icon should briefly change to ✓ then revert to ⧉ after 1.5 seconds. Open a text editor or Outlook and paste — you should see a tab-separated table with headers: `Customer`, `Project`, `Jira URL`, `PM Comments`, `Manager Comments`, followed by one row per project due this month.

- [ ] **Step 3: Verify mail button**

Click the ✉ button. Your default mail client (Outlook) should open a new draft pre-addressed to `emea.pm@kaltura.com`, with subject `Projects Due This Month – June 2026` and the tab-separated table in the body.

---

### Task 3: Commit

**Files:**
- `index.html`
- `app.js`

- [ ] **Step 1: Stage and commit**

```bash
git add index.html app.js
git commit -m "feat: add copy and mailto buttons to due-this-month card for PM report"
```

- [ ] **Step 2: Final smoke test**

Open `index.html`, verify:
1. ⧉ and ✉ buttons visible on the "Due this month" card
2. Copy button produces correct tab-separated table in clipboard (paste into Notepad to confirm)
3. Mail button opens Outlook draft with correct recipient, subject, and body
4. "View projects" hover popup still works normally
5. No JS errors in DevTools console
