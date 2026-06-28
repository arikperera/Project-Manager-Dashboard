# Filter Persistence, Region Field & Region Filter — Design Spec

**Date:** 2026-06-28

## Overview

Three related improvements shipped together:
1. Dashboard filters no longer reset when the edit modal is saved
2. A Region field is added to every project, synced from Jira, editable manually
3. Region filter added to dashboard and report (report filter scopes everything)

---

## Part 1: Filter Persistence Fix

### Problem
`renderSelect()` rebuilds `pmFilter.innerHTML` from scratch on every `renderAll()`, wiping the selected PM value. `healthFilter` and `progressFilter` are static HTML and already persist. `duemonthFilter` already has a save/restore pattern.

### Fix
In `renderSelect()`, save `pmFilter.value` before rebuilding and restore it after — identical to the existing `duemonthFilter` pattern:

```js
const currentPm = pmFilter.value;
pmFilter.innerHTML = [...];      // rebuild
pmFilter.value = currentPm;     // restore
```

When region filter is added (Part 3), apply the same save/restore pattern to it too.

---

## Part 2: Region Field

### Schema
Add `region: ''` to every project object. `migrateProjects()` adds the field to existing projects (same pattern as `actualHours`, `statusUpdatedAt`, etc.).

### Valid Values (fixed list)
```
APAC, EMEA, North America, LatAm, Internal, "ROW"
```
Stored and displayed exactly as shown. The value `"ROW"` includes the quotes as displayed (stored without quotes as `ROW`).

### Jira Field Name
`Region` — resolved in `applyFieldNames()` alongside `Risk Rate`, `Account Name`, etc. → `cachedRegionFieldId`. Used in the Jira sync that runs on every page load.

### Jira Sync (existing projects)
`syncProjectProgressFromJira()` already runs on page load for all existing projects. Extend it to also read `cachedRegionFieldId` and write to `project.region`. Since the sync runs on every load, all existing projects automatically get their region populated on first load after shipping.

### Edit Modal
Add a `Region` `<select>` dropdown to the existing edit modal with the fixed list plus a blank `— select —` option at the top. Reads from and writes to `project.region`.

### Add Project Modal
Add the same `Region` `<select>` dropdown to the Add Project modal.

### Import (`buildProjectFromEnrichment`)
Populate `region` from the Jira field value during import, same as `health`, `riskReason`, etc.

---

## Part 3: Region Filter

### Dashboard
A `Region` `<select>` dropdown added to the existing filter row (same style as PM/Health/Budget/Due Month filters). Default option: "All Regions". Filters `getFilteredProjects()` live. Uses save/restore pattern in `renderSelect()` to persist across re-renders.

Filter logic: if a region is selected, only show projects where `project.region === selectedRegion`.

### Report
A region `<select>` rendered inline in the report's top-nav area, immediately below the "Generated:" line, before the stats section. Default: "All Regions". Uses the same dark select styling as the existing report filters (`background:#0b1220`, `color:#eff6ff`, `border:1px solid #223249`).

When a region is selected, it scopes the entire report via a `filterByRegion(projects, region)` helper that is called at the top of the stats IIFE and the section builders. All 9 items are affected:

1. Total Projects count
2. Total MRR/NRR
3. Project Health breakdown (Green/Yellow/Red counts)
4. Over Budget Projects count (stat box)
5. Over Budget Projects table rows
6. Project Health table rows
7. Newly Added Projects count (stat box)
8. Newly Added Projects table rows
9. Added MRR/NRR (stat box)
10. All Projects table rows

**Implementation:** The report already computes `atRisk`, `healthAtRisk`, `newProjects`, and `projects` arrays at the top of the stats IIFE. Add a `filterByRegion` helper that filters an array by region value (passthrough when region is ""). Apply it to each array immediately after it is defined.

The region selector uses `onchange="applyRegionFilter()"` — a report-embedded JS function that reads the select value, re-filters all section tables by showing/hiding rows whose `data-region` attribute matches. All `<tr>` elements in the report tables get a `data-region="${p.region}"` attribute.

### Report Region Filter — Implementation Detail
Since the report is a static HTML file (no live JS state), the region filter works by:
1. All `<tr>` rows in Over Budget, Project Health, Newly Added, and All Projects tables get `data-region="${p.region}"`
2. The stat boxes get `data-counts` attributes for each region (pre-computed at generation time)
3. `applyRegionFilter()` reads the select, shows/hides rows, and updates stat box numbers from the pre-computed per-region counts embedded as `data-*` attributes

---

## Scope

**Files:** `app.js` only (HTML for modals is inline in `app.js`; report HTML is generated inside `generateHTMLReport()`).

**Out of scope:**
- No changes to report PDF/print layout
- No changes to Jira writeback
- No changes to backup/restore

---

## Region Values Reference

| Display | Stored as |
|---|---|
| APAC | `APAC` |
| EMEA | `EMEA` |
| North America | `North America` |
| LatAm | `LatAm` |
| Internal | `Internal` |
| "ROW" | `ROW` |
