/**
 * Cloudflare Worker — PM Dashboard Proxy
 *
 * Replaces proxy.ps1 for deployment on kvibe (Cloudflare Workers).
 *
 * Environment variables required (set in kvibe dashboard):
 *   JIRA_EMAIL         — Jira account email (e.g. arik.perera@kaltura.com)
 *   JIRA_TOKEN         — Jira API token
 *   SF_USERNAME        — Salesforce username
 *   SF_PASSWORD_TOKEN  — Salesforce password + security token concatenated
 *   SF_CLIENT_ID       — Salesforce connected app client ID
 *   SF_CLIENT_SECRET   — Salesforce connected app client secret
 *
 * Routes (mirrors proxy.ps1):
 *   GET  /health
 *   GET  /kv/:key                   (read from KV — DASHBOARD_KV binding required)
 *   PUT  /kv/:key                   (write to KV)
 *   GET  /jira/field
 *   GET  /jira/user/search?query=
 *   GET  /jira/new-assignments
 *   GET  /jira/issue/:key?fields=
 *   GET  /jira/search/jql?jql=&fields=&maxResults=
 *   PUT  /jira/issue/:key           (update fields)
 *   GET  /sf/enrich?jiraKey=
 *   POST /settings                  (no-op — credentials are env vars)
 *   POST /settings/sf               (no-op — credentials are env vars)
 */

const JIRA_BASE = 'https://kaltura.atlassian.net/rest/api/3';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function jiraAuth(env) {
  return 'Basic ' + btoa(`${env.JIRA_EMAIL}:${env.JIRA_TOKEN}`);
}

async function jiraFetch(env, path, options = {}) {
  const url = path.startsWith('http') ? path : `${JIRA_BASE}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: jiraAuth(env),
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Salesforce token cache (lives for worker instance lifetime)
let sfTokenCache = null;

async function getSFToken(env) {
  if (sfTokenCache && sfTokenCache.expiresAt > Date.now()) {
    return sfTokenCache;
  }
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: env.SF_CLIENT_ID,
    client_secret: env.SF_CLIENT_SECRET,
    username: env.SF_USERNAME,
    password: env.SF_PASSWORD_TOKEN,
  });
  const res = await fetch('https://login.salesforce.com/services/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`SF auth failed: ${res.status}`);
  const data = await res.json();
  sfTokenCache = {
    accessToken: data.access_token,
    instanceUrl: data.instance_url,
    expiresAt: Date.now() + 110 * 60 * 1000,
  };
  return sfTokenCache;
}

async function sfFetch(token, path) {
  const res = await fetch(`${token.instanceUrl}${path}`, {
    headers: { Authorization: `Bearer ${token.accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`SF fetch failed: ${res.status} ${path}`);
  return res.json();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // GET /kv/:key — read from KV
    if (method === 'GET' && path.startsWith('/kv/')) {
      const key = path.substring(4);
      const ALLOWED_KEYS = new Set([
        'project-dashboard-projects-v1',
        'project-dashboard-users-v1',
        'project-dashboard-settings-v1',
        'project-dashboard-customers-v1',
        'project-dashboard-backups-v1',
      ]);
      if (!ALLOWED_KEYS.has(key)) return json({ error: 'Invalid key' }, 400);
      const value = await env.DASHBOARD_KV.get(key);
      if (!value) return json(null);
      let parsed;
      try { parsed = JSON.parse(value); } catch { return json({ error: 'Corrupt KV value' }, 500); }
      return json(parsed);
    }

    // PUT /kv/:key — write to KV
    if (method === 'PUT' && path.startsWith('/kv/')) {
      const key = path.substring(4);
      const ALLOWED_KEYS = new Set([
        'project-dashboard-projects-v1',
        'project-dashboard-users-v1',
        'project-dashboard-settings-v1',
        'project-dashboard-customers-v1',
        'project-dashboard-backups-v1',
      ]);
      if (!ALLOWED_KEYS.has(key)) return json({ error: 'Invalid key' }, 400);
      const body = await request.text();
      try { JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
      await env.DASHBOARD_KV.put(key, body);
      return json({ ok: true });
    }

    // Health check
    if (path === '/health') {
      return json({ ok: true });
    }

    // Settings endpoints — no-op (credentials are env vars)
    if (method === 'POST' && (path === '/settings' || path === '/settings/sf')) {
      return json({ ok: true });
    }

    // GET /jira/field
    if (method === 'GET' && path === '/jira/field') {
      return jiraFetch(env, 'field');
    }

    // GET /jira/user/search?query=
    if (method === 'GET' && path === '/jira/user/search') {
      const query = url.searchParams.get('query') || '';
      return jiraFetch(env, `user/search?query=${encodeURIComponent(query)}&maxResults=10`);
    }

    // GET /jira/new-assignments
    if (method === 'GET' && path === '/jira/new-assignments') {
      const watched = env.WATCHED_ASSIGNEES ? env.WATCHED_ASSIGNEES.split(',').map(s => s.trim()).filter(Boolean) : [];
      if (!watched.length) return json([]);
      const allIssues = [];
      for (const email of watched) {
        const jql = encodeURIComponent(`issuetype = Initiative AND assignee="${email}" AND project=PSVAMB AND status = Open AND created>=-30d ORDER BY created DESC`);
        const res = await fetch(`${JIRA_BASE}/search/jql?jql=${jql}&fields=summary,assignee,created,status&maxResults=50`, {
          headers: { Authorization: jiraAuth(env), Accept: 'application/json' },
        });
        if (!res.ok) continue;
        const data = await res.json();
        for (const issue of (data.issues || [])) {
          allIssues.push({
            key: issue.key,
            summary: issue.fields.summary,
            assigneeEmail: issue.fields.assignee?.emailAddress || '',
            assigneeDisplayName: issue.fields.assignee?.displayName || '',
            created: issue.fields.created,
            jiraUrl: `https://kaltura.atlassian.net/browse/${issue.key}`,
          });
        }
      }
      return json(allIssues);
    }

    // GET/PUT /jira/issue/:key  (and sub-paths like /jira/issue/:key/editmeta)
    if (path.startsWith('/jira/issue/')) {
      const jiraPath = path.substring('/jira/'.length); // e.g. issue/PSVAMB-123
      const queryString = url.search; // includes ?fields=... etc
      if (method === 'GET') {
        return jiraFetch(env, `${jiraPath}${queryString}`);
      }
      if (method === 'PUT') {
        const body = await request.text();
        return jiraFetch(env, jiraPath, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      }
    }

    // GET /jira/search/jql
    if (method === 'GET' && path === '/jira/search/jql') {
      return jiraFetch(env, `search/jql${url.search}`);
    }

    // Generic GET /jira/* fallback
    if (method === 'GET' && path.startsWith('/jira/')) {
      const jiraPath = path.substring('/jira/'.length);
      return jiraFetch(env, `${jiraPath}${url.search}`);
    }

    // GET /sf/enrich?jiraKey=
    if (method === 'GET' && path === '/sf/enrich') {
      if (!env.SF_USERNAME) return json({ sfSkipped: true });
      const jiraKey = url.searchParams.get('jiraKey');
      if (!jiraKey) return json({ error: 'jiraKey required' }, 400);
      try {
        // Step 1: Get remote links from Jira
        const linksRes = await fetch(`${JIRA_BASE}/issue/${jiraKey}/remotelink`, {
          headers: { Authorization: jiraAuth(env), Accept: 'application/json' },
        });
        if (!linksRes.ok) return json({ sfError: `Jira remotelink failed: ${linksRes.status}` });
        const links = await linksRes.json();
        const sfLink = links.find(l => l.object?.url?.includes('lightning.force.com'));
        if (!sfLink) return json({ sfError: 'No SF link found on Jira issue' });

        const sfUrl = sfLink.object.url;
        const oppId = sfUrl.split('/Opportunity/')[1]?.split('/')[0];
        if (!oppId) return json({ sfError: 'Could not extract Opportunity ID from SF link' });

        // Step 2: Get SF token
        const token = await getSFToken(env);

        // Step 3: Fetch Opportunity
        const opp = await sfFetch(token, `/services/data/v59.0/sobjects/Opportunity/${oppId}?fields=Name,Total_PS_Hours__c,Amount,Kaltura_NRR__c,AccountId`);

        // Step 4: Fetch Account
        const acct = await sfFetch(token, `/services/data/v59.0/sobjects/Account/${opp.AccountId}?fields=Name,OwnerId,Customer_Success_Manager__c`);

        // Step 5: Resolve Sales owner name
        let salesName = '';
        if (acct.OwnerId) {
          try {
            const owner = await sfFetch(token, `/services/data/v59.0/sobjects/User/${acct.OwnerId}?fields=Name`);
            salesName = owner.Name || '';
          } catch {}
        }

        // Step 6: Resolve CSM name
        let csmName = '';
        if (acct.Customer_Success_Manager__c) {
          const raw = acct.Customer_Success_Manager__c;
          if (/^[0-9a-zA-Z]{15,18}$/.test(raw)) {
            try {
              const csm = await sfFetch(token, `/services/data/v59.0/sobjects/User/${raw}?fields=Name`);
              csmName = csm.Name || raw;
            } catch { csmName = raw; }
          } else {
            csmName = raw;
          }
        }

        return json({
          customer: acct.Name,
          name: opp.Name,
          nrrHours: opp.Total_PS_Hours__c,
          mrr: opp.Amount,
          nrr: opp.Kaltura_NRR__c,
          oppUrl: `https://kaltura.lightning.force.com/lightning/r/Opportunity/${oppId}/view`,
          salesName,
          csmName,
        });
      } catch (e) {
        sfTokenCache = null;
        return json({ sfError: e.message });
      }
    }

    return json({ error: 'Not found' }, 404);
  },
};
