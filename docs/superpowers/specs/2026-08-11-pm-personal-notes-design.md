# PM Personal Notes — Design

## Purpose

The Edit Project modal's "Project Status" block is a rich-text editor that syncs to Jira's description field on save. PMs also want a place to jot personal notes, tasks, or reminders about a project that should **never** leave the dashboard — not synced to Jira, not included in the Export Report, but persisted for the project's entire lifetime, including through Backup & Delete / Closed Projects / Restore.

## Scope

- **Projects only.** The Edit Project modal is shared between projects and tasks; PM Personal Notes only appears when editing a project (`itemType !== 'task'`), not a task.
- **No @mention autocomplete.** Project Status and the Comments composer both support typing `@` to search and insert a real Jira mention. Since this field never touches Jira, a mention here would be purely cosmetic (no notification fires) — out of scope. Plain rich-text formatting only.
- **Always visible**, positioned directly below Project Status in the modal — not a collapsible/accordion section.

## Data model

One new field on the project object: `pmNotes` (string, HTML — same shape as `statusText`). No new KV store, no migration: existing projects simply don't have the field until first edited, the same way `pmStatus` was added previously without a migration step.

## Persistence — no new code required

`saveProjects`, `saveBackups`, and the Backup & Delete → Closed Projects flow already deep-clone the *entire* project object (`JSON.parse(JSON.stringify(item))`) wherever a project is snapshotted or moved. A new field rides along automatically, exactly as `statusText`/`pmStatus`/`riskReason` already do. Restoring from Closed Projects or a Backup brings `pmNotes` back with it, with zero additional wiring.

## Export Report

Excluded by construction: `generateHTMLReport()` in app-modals.js never references `pmNotes`. There is nothing to explicitly "turn off" — simply never adding a reference to the field is sufficient, and keeps the report generator untouched.

## UI

Clone the Project Status block's structure in `index.html`, inside `editProjectModal`, directly after the existing Project Status block:

- A new `<div class="rich-editor-block" id="pmNotesEditorBlock">` containing its own toolbar (bold/italic/underline/insertUnorderedList/insertOrderedList/outdent/indent/color/font-size/insertLink — no mention-related markup), its own link-popup, and its own editor div `<div id="pmNotesEditor" class="rich-editor" contenteditable="true">`.
- Every toolbar control uses `data-role="..."` attributes (matching the pattern already used for Project Status and the Comments composer), scoped to `pmNotesEditorBlock` via `setupRichEditorToolbar`, so there is no id collision or event-listener cross-talk between the three independent rich editors that will now exist on the page (Project Status, Comments composer, PM Notes).
- Wrap the whole block so it's only rendered/relevant when editing a project — reuse whatever existing show/hide mechanism the modal already uses to toggle project-only vs. task-only fields for `itemType`.

## Wiring

- **Setup (once, at module load)**: `setupRichEditorToolbar(pmNotesEditor, pmNotesEditorBlock, { placeholderHtml: '<span style="font-style:italic;opacity:0.5;">No notes yet</span>' });` — no `setupMentionAutocomplete` call, per scope above.
- **Open** (`openEditProjectModal`, project path only): `pmNotesEditor.innerHTML = project.pmNotes || '';` with the same empty/placeholder handling pattern already used for `editStatusEditor`.
- **Save** (form submit handler, project path only): read back into `selectedProject.pmNotes = pmNotesEditor.getAttribute('data-placeholder-active') ? '' : pmNotesEditor.innerHTML.trim();`, then rely on the existing `saveProjects('edit-save')` call already made for the rest of the form — no new save call, no Jira write function is ever invoked for this field.

## Verification

1. `node --check` on every touched `.js` file before deploy (standing convention this session).
2. Manual pass: open Edit Project on a project, type formatted notes (bold/color/link/list), save, reopen — confirm the notes round-trip correctly and Project Status editing/toolbar is unaffected (no cross-talk between the two editors' toolbars).
3. Confirm editing a **task** does not show the PM Notes block at all.
4. Confirm saving does *not* produce any Jira write for this field (no network call, no comment, no description change beyond whatever Project Status itself already does).
5. Backup & Delete a project with notes set → confirm the notes appear intact when viewing it in Closed Projects, and again after Restore back to active.
6. Create a manual Backup of a project with notes set → confirm notes are present in the backup snapshot, and after Restore from Backup.
7. Run Export Report → confirm `pmNotes` content never appears anywhere in the generated report.
