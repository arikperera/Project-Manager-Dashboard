# Budget Hours Display — Design Spec

**Date:** 2026-06-28
**Jira:** PSVAMB-144523, PSVAMB-92327

## Problem

The Project Budget column shows only a percentage (e.g. 690%). Without knowing the planned hours, the number is meaningless — a 690% overrun on a 10h project is 63h; on a 100h project it is 690h. Users must open Jira or hover over the bar to find the actual numbers.

## Solution

Show both the percentage and the raw hours on the same second line, always visible — in both the dashboard table and the exported HTML report.

## Layout

```
[████████░░]          ← progress bar (line 1, unchanged)
690%  ·  0 / 10h  ⚠  ← percentage · actual/planned + blink (line 2)
```

- Line 1: progress bar (unchanged)
- Line 2: `{percent}%  ·  {actual} / {planned}h` — plus the existing ⚠ blink icon when applicable

## Data Logic

### Planned hours
Use `estimatedHours` if not null (Jira-synced value); otherwise fall back to `nrr` (always set at project creation). If neither is set, omit the denominator.

### Actual hours
Use `actualHours ?? 0` — null is treated as zero.

### Hours label formats
| Condition | Format |
|---|---|
| Both planned and actual available | `0 / 10h` |
| Only planned available | `0 / 10h` (actual = 0) |
| No planned hours at all | `0h actual` |

## Styling

- Hours text: same `<small>` element as the percentage label, same colour (inherits the progress tone — red/yellow/green/neutral)
- Separator: ` · ` (space-middot-space)
- Blink icon ⚠ stays at the end of line 2, unchanged behaviour

## Scope

Two locations, identical change:

1. **Dashboard** — `renderTable()` in `app.js` (around line 1408–1410)
2. **Report** — `progressBar()` helper inside `generateHTMLReport()` in `app.js` (around line 2223–2242)

Both share the same logic; only the HTML/CSS wrapper differs slightly between live DOM and static report.

## Out of Scope

- No changes to tooltip content
- No changes to colour logic or thresholds
- No changes to the blink warning trigger (still fires when progress > 90 and no riskReason)
