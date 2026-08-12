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
 *   KV_SECRET          — Shared secret for KV read/write routes (set in kvibe dashboard)
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

const KV_ALLOWED_KEYS = new Set([
  'project-dashboard-projects-v1',
  'project-dashboard-users-v1',
  'project-dashboard-settings-v1',
  'project-dashboard-customers-v1',
  'project-dashboard-backups-v1',
  'project-dashboard-tasks-v1',
  'project-dashboard-tombstones-v1',
  'project-dashboard-closed-projects-v1',
  'project-dashboard-activity-log-v1',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, X-KV-Secret',
};

// Credentialed CORS (reflects the exact origin + allows cookies) — needed only for /me,
// since browsers reject `Access-Control-Allow-Origin: *` on requests sent with
// credentials:'include'. Kept separate from the generic CORS_HEADERS above (used by every
// other route, none of which rely on cookies) so this doesn't change behavior elsewhere.
function credentialedCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-KV-Secret',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
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
  // 204/205/304 are null-body statuses — the Response constructor throws if given
  // a non-null body (even an empty string) alongside one of these, as happens with
  // Jira's DELETE /comment/:id, which returns 204 with an empty body.
  const isNullBodyStatus = res.status === 204 || res.status === 205 || res.status === 304;
  return new Response(isNullBodyStatus ? null : body, {
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

    // CORS preflight — reflect the exact origin (rather than wildcard) so a credentialed
    // request (e.g. to /me) can also pass its preflight; harmless for every other route.
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: credentialedCorsHeaders(request) });
    }

    // GET /kv/:key — read from KV
    if (method === 'GET' && path.startsWith('/kv/')) {
      if (env.KV_SECRET && request.headers.get('X-KV-Secret') !== env.KV_SECRET) return json({ error: 'Unauthorized' }, 401);
      const key = path.substring(4);
      if (!KV_ALLOWED_KEYS.has(key)) return json({ error: 'Invalid key' }, 400);
      // cacheTtl: 60 is the lowest Cloudflare KV allows — without it, a GET can be served
      // from this edge location's own cache for much longer, which is how two fetches from
      // the same browser seconds apart returned different item counts (one hit a fresher
      // read, one hit a stale cached one). Cache-Control: no-store (in json()) covers the
      // HTTP layer; this covers KV's own internal edge cache.
      const value = await env.DASHBOARD_KV.get(key, { cacheTtl: 60 });
      if (!value) return json(null);
      let parsed;
      try { parsed = JSON.parse(value); } catch { return json({ error: 'Corrupt KV value' }, 500); }
      return json(parsed);
    }

    // PUT /kv/:key — write to KV
    if (method === 'PUT' && path.startsWith('/kv/')) {
      if (env.KV_SECRET && request.headers.get('X-KV-Secret') !== env.KV_SECRET) return json({ error: 'Unauthorized' }, 401);
      const key = path.substring(4);
      if (!KV_ALLOWED_KEYS.has(key)) return json({ error: 'Invalid key' }, 400);
      const body = await request.text();
      try { JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
      await env.DASHBOARD_KV.put(key, body);
      return json({ ok: true });
    }

    // POST /activity-log — append one entry under its own KV key so concurrent writers
    // from different browsers never collide (unlike a single shared JSON array, which
    // needs read-modify-write and loses entries under concurrent writes). Cloudflare KV's
    // native TTL handles pruning automatically — no separate cleanup needed.
    if (method === 'POST' && path === '/activity-log') {
      if (env.KV_SECRET && request.headers.get('X-KV-Secret') !== env.KV_SECRET) return json({ error: 'Unauthorized' }, 401);
      const body = await request.text();
      let entry;
      try { entry = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
      const ts = entry.ts || Date.now();
      const key = `activity-log:${String(ts).padStart(14, '0')}:${Math.random().toString(36).slice(2, 8)}`;
      await env.DASHBOARD_KV.put(key, JSON.stringify({ ...entry, ts }), { expirationTtl: 7 * 24 * 60 * 60 });
      return json({ ok: true });
    }

    // GET /activity-log — aggregate every entry under the prefix, newest first
    if (method === 'GET' && path === '/activity-log') {
      if (env.KV_SECRET && request.headers.get('X-KV-Secret') !== env.KV_SECRET) return json({ error: 'Unauthorized' }, 401);
      const entries = [];
      let cursor;
      do {
        const page = await env.DASHBOARD_KV.list({ prefix: 'activity-log:', cursor, limit: 1000 });
        for (const k of page.keys) {
          const val = await env.DASHBOARD_KV.get(k.name, { cacheTtl: 60 });
          if (val) { try { entries.push(JSON.parse(val)); } catch {} }
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      entries.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return json(entries);
    }

    // POST /tombstone — body {id, storeKey} — records one deletion as its own KV key
    // (`tombstone:{storeKey}:{id}`), so concurrent add/remove calls from different sessions
    // are independent atomic KV operations instead of a shared-array read-modify-write that
    // can silently lose or resurrect entries under concurrent writes. 180-day native TTL
    // handles pruning automatically.
    if (method === 'POST' && path === '/tombstone') {
      if (env.KV_SECRET && request.headers.get('X-KV-Secret') !== env.KV_SECRET) return json({ error: 'Unauthorized' }, 401);
      const body = await request.text();
      let entry;
      try { entry = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!entry.id || !entry.storeKey) return json({ error: 'id and storeKey required' }, 400);
      const ts = entry.ts || Date.now();
      const key = `tombstone:${entry.storeKey}:${entry.id}`;
      await env.DASHBOARD_KV.put(key, JSON.stringify({ id: entry.id, storeKey: entry.storeKey, ts }), { expirationTtl: 180 * 24 * 60 * 60 });
      return json({ ok: true });
    }

    // DELETE /tombstone — body {id, storeKey} — must be called before deliberately
    // re-adding a previously-deleted item, otherwise the next save would strip it right
    // back out.
    if (method === 'DELETE' && path === '/tombstone') {
      if (env.KV_SECRET && request.headers.get('X-KV-Secret') !== env.KV_SECRET) return json({ error: 'Unauthorized' }, 401);
      const body = await request.text();
      let entry;
      try { entry = JSON.parse(body); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!entry.id || !entry.storeKey) return json({ error: 'id and storeKey required' }, 400);
      const key = `tombstone:${entry.storeKey}:${entry.id}`;
      await env.DASHBOARD_KV.delete(key);
      return json({ ok: true });
    }

    // GET /tombstones?storeKey=X — list every tombstoned id for one store
    if (method === 'GET' && path === '/tombstones') {
      if (env.KV_SECRET && request.headers.get('X-KV-Secret') !== env.KV_SECRET) return json({ error: 'Unauthorized' }, 401);
      const storeKey = url.searchParams.get('storeKey');
      if (!storeKey) return json({ error: 'storeKey required' }, 400);
      const prefix = `tombstone:${storeKey}:`;
      const entries = [];
      let cursor;
      do {
        const page = await env.DASHBOARD_KV.list({ prefix, cursor, limit: 1000 });
        for (const k of page.keys) {
          const val = await env.DASHBOARD_KV.get(k.name, { cacheTtl: 60 });
          if (val) { try { entries.push(JSON.parse(val)); } catch {} }
        }
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return json(entries);
    }

    // Health check
    if (path === '/health') {
      return json({ ok: true });
    }

    // GET /me — return current user's email from Cloudflare Access JWT. Needs credentialed
    // CORS (reflected origin + Allow-Credentials) since the browser only attaches the
    // Access session cookie cross-origin when the request is sent with credentials:'include'.
    if (method === 'GET' && path === '/me') {
      const meCors = credentialedCorsHeaders(request);
      const meJson = (data, status = 200) => new Response(JSON.stringify(data), {
        status,
        headers: { ...meCors, 'Content-Type': 'application/json; charset=utf-8' },
      });
      const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
      if (!jwt) return meJson({ email: null });
      try {
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        return meJson({ email: payload.email || null });
      } catch {
        return meJson({ email: null });
      }
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

    // GET/PUT/POST/DELETE /jira/issue/:key  (and sub-paths like /jira/issue/:key/comment/:id)
    if (path.startsWith('/jira/issue/')) {
      const jiraPath = path.substring('/jira/'.length); // e.g. issue/PSVAMB-123
      const queryString = url.search; // includes ?fields=... etc
      if (method === 'GET') {
        return jiraFetch(env, `${jiraPath}${queryString}`);
      }
      if (method === 'PUT' || method === 'POST') {
        const body = await request.text();
        return jiraFetch(env, jiraPath, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      }
      if (method === 'DELETE') {
        return jiraFetch(env, jiraPath, { method });
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
