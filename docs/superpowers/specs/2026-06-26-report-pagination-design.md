# Report Pagination — Design Spec

**Date:** 2026-06-26

## Problem

Sections in the exported HTML report (Over Budget Projects, Project Health, Newly Added Projects) can have 20+ rows, making the report very long and hard to read.

## Goals

1. Each affected section shows N rows at a time (default 5, switchable to 10).
2. A page-size selector (5 / 10) appears at the top-right of the section header.
3. A footer pager shows `← Prev | Page X of Y | Next →`.
4. Sections with ≤ page size rows show all rows with no pager.
5. Each section's pager is independent.
6. Implemented as inline JavaScript in the exported HTML — no server, no dependencies.

## Affected Sections

- Over Budget Projects
- Project Health  
- Newly Added Projects

## Implementation

### HTML structure per section

Each paginated section wraps its `<table>` in a `<div class="paginated-section">` with a `data-page-size="5"` attribute. The section header row includes a page-size selector. A pager `<div>` follows the table.

### JavaScript (inline in report)

A single `initPaginators()` function runs on load. For each `.paginated-section`:
1. Reads `data-page-size` (default 5)
2. Hides all `<tbody> tr` beyond the first page
3. Renders the pager footer
4. Wires Prev/Next buttons and page-size selector

### Page size selector

```html
<select onchange="changePageSize(this)" style="...">
  <option value="5">Show 5</option>
  <option value="10">Show 10</option>
</select>
```

### Pager footer

```html
<div class="pager">
  <button onclick="prevPage(this)">← Prev</button>
  <span>Page 1 of N</span>
  <button onclick="nextPage(this)">Next →</button>
</div>
```

## Out of Scope

- "All Projects" table (already has its own show/hide toggle)
- Print mode (paginator hidden via `@media print`)
