# Editor Color Picker & Default Color Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the editor's default text color to white and add a native color picker to the toolbar.

**Architecture:** Three files change — `app.js` (placeholder text + color picker event handler), `index.html` (toolbar HTML), and `styles.css` (remove incorrect rule, add hyperlink color). No new files.

**Tech Stack:** Vanilla JS, HTML, CSS. No dependencies. `document.execCommand('foreColor')` for color application.

## Global Constraints

- No build step — changes take effect by refreshing `index.html` in a browser.
- No frameworks, no npm. Pure vanilla JS/HTML/CSS.
- `--text` CSS variable = `#eff6ff` (near-white). Use it as the default color value.

---

### Task 1: Fix placeholder text and remove bad CSS rule

**Files:**
- Modify: `app.js:924`
- Modify: `styles.css:152`

**Interfaces:**
- Produces: `editStatusEditor.innerHTML` defaults to white italic placeholder text for new projects.

- [ ] **Step 1: Update placeholder text in app.js**

In [app.js](app.js) at line 924, change:
```js
editStatusEditor.innerHTML = project.statusText || '<span style="font-style:italic;opacity:0.5;">No Status Yet</span>';
```
to:
```js
editStatusEditor.innerHTML = project.statusText || '<span style="font-style:italic;opacity:0.5;">New Project. No Status Entered Yet</span>';
```

- [ ] **Step 2: Remove the incorrect CSS rule in styles.css**

In [styles.css](styles.css) at line 152, remove this entire line:
```css
.rich-editor span:not([style*="color"]), .rich-editor font:not([color]) { color: var(--text); }
```
This rule was incorrectly added and conflicts with intentionally-colored spans.

- [ ] **Step 3: Verify in browser**

Open `index.html`, create a new project, then open its editor. The placeholder should read "New Project. No Status Entered Yet" in white italic faded text (not orange).

- [ ] **Step 4: Commit**

```bash
git add app.js styles.css
git commit -m "fix: white placeholder text, remove bad CSS override in rich editor"
```

---

### Task 2: Add color picker to editor toolbar

**Files:**
- Modify: `index.html:164-167` (after the indent buttons, before closing `</div>` of `.editor-toolbar`)
- Modify: `styles.css` (add hyperlink rule)
- Modify: `app.js:1500-1506` (extend the existing toolbar click handler)

**Interfaces:**
- Consumes: `editStatusEditor` (existing DOM element, id `editStatusEditor`)
- Produces: `#editorColorPicker` input and `#editorColorSwatch` span — used by the event handler in app.js.

- [ ] **Step 1: Add color picker HTML to toolbar in index.html**

In [index.html](index.html), find the editor toolbar block (around line 164–167). After the indent buttons and before the closing `</div>` of `.editor-toolbar`, add:

```html
            <span class="toolbar-sep"></span>
            <label class="toolbar-color-label" title="Text color">
              A&nbsp;<span id="editorColorSwatch" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#eff6ff;border:1px solid rgba(255,255,255,0.2);vertical-align:middle;"></span>
              <input type="color" id="editorColorPicker" value="#eff6ff" style="width:0;height:0;opacity:0;position:absolute;pointer-events:none;">
            </label>
```

The full toolbar block should now look like:
```html
          <div class="editor-toolbar">
            <button type="button" class="ghost-btn small-btn" data-rich-command="bold" title="Bold"><b>B</b></button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="italic" title="Italic"><i>I</i></button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="underline" title="Underline"><u>U</u></button>
            <span class="toolbar-sep"></span>
            <button type="button" class="ghost-btn small-btn" data-rich-command="insertUnorderedList" title="Bullet list">• List</button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="insertOrderedList" title="Numbered list">1. List</button>
            <span class="toolbar-sep"></span>
            <button type="button" class="ghost-btn small-btn" data-rich-command="outdent" title="Decrease indent">⇤</button>
            <button type="button" class="ghost-btn small-btn" data-rich-command="indent" title="Increase indent">⇥</button>
            <span class="toolbar-sep"></span>
            <label class="toolbar-color-label" title="Text color">
              A&nbsp;<span id="editorColorSwatch" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#eff6ff;border:1px solid rgba(255,255,255,0.2);vertical-align:middle;"></span>
              <input type="color" id="editorColorPicker" value="#eff6ff" style="width:0;height:0;opacity:0;position:absolute;pointer-events:none;">
            </label>
          </div>
```

- [ ] **Step 2: Add hyperlink color rule to styles.css**

In [styles.css](styles.css), after the `.rich-editor:focus` line (line ~152), add:
```css
.rich-editor a { color: #38bdf8; }
```

- [ ] **Step 3: Wire up the color picker event handler in app.js**

In [app.js](app.js), find the `editProjectModal.addEventListener('click', ...)` block around line 1500. Replace it with:

```js
editProjectModal.addEventListener('click', (event) => {
  const toolbarButton = event.target.closest('[data-rich-command]');
  if (toolbarButton) {
    event.preventDefault();
    document.execCommand(toolbarButton.dataset.richCommand, false, null);
    editStatusEditor.focus();
    return;
  }
  const colorLabel = event.target.closest('.toolbar-color-label');
  if (colorLabel) {
    event.preventDefault();
    document.getElementById('editorColorPicker').click();
  }
});

document.getElementById('editorColorPicker').addEventListener('change', (event) => {
  const color = event.target.value;
  document.getElementById('editorColorSwatch').style.background = color;
  document.execCommand('foreColor', false, color);
  editStatusEditor.focus();
});
```

- [ ] **Step 4: Verify in browser**

1. Open `index.html`, open any project's editor.
2. The toolbar should show an "A" with a white swatch at the right end.
3. Click the "A" swatch — the native OS color picker should open.
4. Pick a color (e.g. red). The swatch updates to red. Type some text — it should be red.
5. Select existing white text, pick yellow — selected text turns yellow.
6. Open a new project's editor — typing should default to white.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css app.js
git commit -m "feat: add color picker to editor toolbar, fix default text color"
```
