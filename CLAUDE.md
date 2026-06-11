# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

https://github.com/arikperera/Project-Manager-Dashboard

## Running the app

No build step. Open `index.html` directly in a browser (double-click or `File > Open`). There are no dependencies to install, no server required, and no package manager.

## Architecture

This is a single-page vanilla JS/HTML/CSS dashboard with no framework or build tooling.

**State** — all project data lives in a single `projects` array (declared in [app.js](app.js)). It is loaded from `localStorage` under the key `project-dashboard-projects-v1` on startup, falling back to `defaultProjects`. Every mutation calls `saveProjects()` to persist.

**Project schema** — each project object has: `customer`, `name`, `manager`, `jira`, `nrr`, `startDate`, `dueDate`, `status`, `health`, `progress`, `statusText`, `csm`, `sales`, `comments`. The `comments` field is a pre-formatted string (`NRR: X, MRR: Y, CSM: Z, Sales: W`) built at creation time and displayed as "Manager Notes" in the table.

**Rendering** — `renderAll()` in [app.js](app.js) is the single re-render entry point; it calls `renderTable()`, `renderSelect()`, `renderSummary()`, and `renderRiskList()`. `renderTable()` groups filtered projects by `manager`, then builds DOM tables per group. All filters (search, PM, health, progress range, status) are client-side via `getFilteredProjects()`.

**Jira sync** — `syncProjectProgressFromJira()` runs on page load. It calls `https://kaltura.atlassian.net/rest/api/3/` with `credentials: 'include'`, so it only works in a browser where the user has an active Jira session. It first resolves the custom field ID for "Project Progress Percentage", then fetches each unique issue key extracted from project Jira URLs.

**Progress color logic** — the progress bar uses an inverted scale: <50% = green, 50–75% = yellow, >75% = red. This represents hours/effort consumed, not completion percentage.

**Modals** — two modals in [index.html](index.html): the "Add project" modal (`projectModal`) collects the full project fields; the "Edit project" modal (`editProjectModal`) only updates `statusText` via a `contenteditable` rich-text editor (using `document.execCommand`).

**Styles** — [styles.css](styles.css) uses CSS custom properties on `:root` for the dark color palette. All layout is CSS Grid/Flexbox; the table uses `table-layout: fixed` with explicit column widths to handle the wide 12-column layout.
