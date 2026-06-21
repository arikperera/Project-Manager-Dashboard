# Editor Color Picker & Default Color Fix — Design Spec

**Date:** 2026-06-21

## Problem

When a new project is created, its `statusText` defaults to a placeholder with an orange/red color (`#f97316`). When the editor opens, that color becomes the active text color, so any new typing continues in orange. There is also no way to change text color in the editor.

## Goals

1. New projects show a white placeholder with updated wording.
2. Opening the editor on an empty project defaults text color to white.
3. A color picker in the toolbar lets users apply any color to selected text or set the active typing color from the cursor position onward.
4. Hyperlinks remain visually distinct (blue).

## Changes

### app.js — Placeholder text (line ~924)

Change the fallback `statusText` placeholder from:
```html
<span style="color:#f97316;font-style:italic;">No Status Yet</span>
```
to:
```html
<span style="font-style:italic;opacity:0.5;">New Project. No Status Entered Yet</span>
```

No inline color — inherits white from the `.rich-editor` container.

### index.html — Toolbar color picker (lines ~157–167)

Add after the indent buttons, separated by a `.toolbar-sep`:

```html
<span class="toolbar-sep"></span>
<label class="toolbar-color-label" title="Text color">
  A <input type="color" id="editorColorPicker" value="#eff6ff" style="width:0;height:0;opacity:0;position:absolute;">
  <span id="editorColorSwatch" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:#eff6ff;border:1px solid rgba(255,255,255,0.2);"></span>
</label>
```

- Default value `#eff6ff` matches `--text` (near-white).
- The swatch updates to show the currently selected color.

### app.js — Color picker event handler

On `change` of `#editorColorPicker`:
1. Call `document.execCommand('foreColor', false, color)` — applies to selection or sets active insertion color.
2. Update the `#editorColorSwatch` background to the new color.
3. Refocus the editor.

### styles.css — Cleanup & hyperlink color

- **Remove** the incorrect rule added earlier: `.rich-editor span:not([style*="color"]), .rich-editor font:not([color]) { color: var(--text); }`
- **Add** `.rich-editor a { color: #38bdf8; }` so hyperlinks stay blue regardless of the active text color.

## Behavior Summary

| Scenario | Result |
|---|---|
| New project, open editor | White placeholder text, cursor defaults to white |
| Type without picking a color | White text |
| Click color picker, choose red, type | Red text from cursor onward |
| Select existing text, choose yellow | Selected text turns yellow |
| Hyperlink in editor | Always blue (`#38bdf8`) |

## Out of Scope

- Persisting the last-used color between editor sessions.
- A reset-to-white button.
- Preset color swatches.
