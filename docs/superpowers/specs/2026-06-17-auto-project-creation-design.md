# Auto-Project Creation — Design Spec

**Date:** 2026-06-17  
**Status:** Approved

## Overview

When a new Jira issue is assigned to a watched PM (Arik or Srinivas), it is automatically detected, enriched with Salesforce data, and added to the dashboard panel. A non-intrusive banner notifies the user. No manual data entry required.

---

## 1. Polling Architecture

- `app.js` runs a poll on page load and then on a configurable interval (default: 15 minutes).
- Poll interval is stored in `jira-settings.json` under `pollIntervalMinutes`.
- On each tick, the app queries the proxy for Jira issues assigned to any watched email that are not already in the `projects` array (matched by Jira issue key extracted from the `jira` field).
- Watched assignees are stored in `jira-settings.json` under `watchedAssignees` (array of email strings).
- Default watched assignees: `["arik.perera@kaltura.com", "Srinivas.Duddu@kaltura.com"]`

---

## 2. Proxy — Jira Polling Endpoint

New proxy route: `GET /jira/new-assignments`

- Proxy reads `watchedAssignees` from `jira-settings.json`.
- For each watched assignee, queries Jira:  
  `GET /rest/api/3/search?jql=assignee=<email> AND project=PSVAMB AND created>=-30d&fields=summary,assignee,created,status`
- Returns array of `{ key, summary, assigneeEmail, created, jiraUrl }`.
- App filters out keys already present in `projects`.

---

## 3. SF Authentication

- SF credentials stored in `sf-settings.json`:
  - `sfUsername`
  - `sfPasswordWithToken` (password + security token concatenated)
  - `sfClientId` (Connected App Consumer Key)
  - `sfClientSecret` (Connected App Consumer Secret)
- Proxy obtains SF OAuth access token on first SF request using **username-password flow**:  
  `POST https://login.salesforce.com/services/oauth2/token`
- Token cached in proxy memory. Re-fetched automatically on 401 response.
- New proxy settings endpoint: `POST /settings/sf` — saves `sf-settings.json`.

---

## 4. Proxy — SF Enrichment Endpoint

New proxy route: `GET /sf/enrich?jiraKey=PSVAMB-XXXXX`

Performs three chained calls server-side:

1. **Jira issue fetch** → extracts SF Opportunity ID from the Jira-SF connector link field.
2. **SF Opportunity fetch** → `GET /services/data/v59.0/sobjects/Opportunity/<id>?fields=Name,Total_PS_Hours__c,Amount,NRR__c,AccountId,StageName`  
   *(Custom field API names `Total_PS_Hours__c` and `NRR__c` must be verified against the Kaltura SF org before implementation)*
3. **SF Account fetch** → `GET /services/data/v59.0/sobjects/Account/<AccountId>?fields=Name,OwnerId,Customer_Success_Manager__c`  
   *(Custom field API name `Customer_Success_Manager__c` must be verified)*
   Then resolves Owner name via `GET /services/data/v59.0/sobjects/User/<OwnerId>?fields=Name`

Returns single JSON:
```json
{
  "customer": "Account Name",
  "name": "Opportunity Name",
  "nrrHours": 120,
  "mrr": 5000,
  "nrr": 60000,
  "oppUrl": "https://kaltura.lightning.force.com/...",
  "salesName": "Sales Owner Name",
  "csmName": "CSM Name"
}
```

If SF credentials are not configured, returns `{ "sfSkipped": true }` and project is added with SF fields blank.

---

## 5. Project Schema Mapping

| Dashboard field | Source |
|---|---|
| `customer` | SF Account `Name` |
| `name` | SF Opportunity `Name` |
| `manager` | Jira assignee email → PM display name (see PM Mapping) |
| `jira` | Jira issue URL (`https://kaltura.atlassian.net/browse/<key>`) |
| `nrr` | SF `Total_PS_Hours__c` |
| `comments` | Built string: `NRR: <nrr>, MRR: <mrr>, CSM: <csmName>, Sales: <salesName>` |
| `startDate` | Jira issue `created` date |
| `dueDate` | Blank (filled in edit modal) |
| `health` | `"Green"` |
| `status` | `"In Progress"` |
| `progress` | `0` |
| `statusText` | `""` |
| `atLink` | `""` |
| `riskReason` | `""` |

---

## 6. PM Mapping

Jira assignee email is mapped to an existing PM display name using a lookup table in `jira-settings.json`:

```json
"pmMapping": {
  "arik.perera@kaltura.com": "Arik",
  "Srinivas.Duddu@kaltura.com": "Srini"
}
```

The PM display names must match existing manager names already in the `projects` array. If no mapping is found, `manager` defaults to the Jira assignee's display name.

---

## 7. Settings UI

The existing Settings modal gets two new sections:

### Salesforce Credentials
- SF Username (text input)
- SF Password + Security Token (password input, combined)
- Connected App Client ID (text input)
- Connected App Client Secret (password input)
- Save button → `POST /settings/sf`

### Auto-Poll Settings (added to existing Jira settings section)
- Poll Interval (minutes) — number input, default `15`
- Watched Assignees — comma-separated email list, pre-filled with default two assignees
- Saved alongside existing Jira credentials via existing `POST /settings`

---

## 8. Notification Banner

- Slides in from the top of the screen when new projects are auto-added.
- Content: **"X new project(s) added — KEY-1, KEY-2 · Dismiss"**
- Jira keys are clickable: scrolls to and briefly highlights the corresponding project row.
- Auto-dismisses after 10 seconds.
- If a second poll fires before dismissal, the existing banner updates in place (count + keys), no stacking.
- Dismiss button closes immediately.

---

## 9. Error Handling

- If Jira poll fails: silent retry on next interval, no banner shown.
- If SF enrichment fails: project is added with SF fields blank; banner note says "(SF data unavailable)".
- If PM mapping not found: `manager` set to Jira assignee display name as fallback.
- If proxy not running: poll silently skips (same as existing Jira sync behaviour).
