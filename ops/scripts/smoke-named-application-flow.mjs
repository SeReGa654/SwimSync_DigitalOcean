const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const ADMIN_USERNAME = process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME || process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || 'dev-admin-token-32-chars-long-12345';

function parseSetCookie(setCookieHeaders) {
  const cookies = new Map();
  for (const raw of setCookieHeaders) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    cookies.set(key, value);
  }
  return cookies;
}

async function readErrorBody(response) {
  const text = await response.text().catch(() => '');
  return text || `<empty ${response.status}>`;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD }),
  });
  if (![200, 201].includes(loginResponse.status)) {
    throw new Error(`Login failed: ${loginResponse.status} ${await readErrorBody(loginResponse)}`);
  }

  const setCookieHeaders = typeof loginResponse.headers.getSetCookie === 'function'
    ? loginResponse.headers.getSetCookie()
    : (loginResponse.headers.get('set-cookie') ? [loginResponse.headers.get('set-cookie')] : []);
  const cookies = parseSetCookie(setCookieHeaders);
  const cookieHeader = Array.from(cookies.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
  const csrfToken = cookies.get('csrf_token');

  const authFetch = (path, init = {}) => fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Cookie: cookieHeader,
      ...(csrfToken && ['POST', 'PATCH', 'PUT', 'DELETE'].includes((init.method || 'GET').toUpperCase())
        ? { 'X-CSRF-Token': decodeURIComponent(csrfToken) }
        : {}),
    },
  });

  const compName = `Smoke Named Application ${Date.now()}`;
  const createCompetitionRes = await authFetch('/api/competitions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: compName,
      categoriesStr: 'Juniors',
      location: 'Kyiv',
      venue: 'Pool',
      poolLength: 50,
      lanes: 8,
      dateFrom: '2026-05-01',
      dateTo: '2026-05-02',
    }),
  });
  if (createCompetitionRes.status !== 201) {
    throw new Error(`Competition create failed: ${createCompetitionRes.status} ${await readErrorBody(createCompetitionRes)}`);
  }
  const competition = await createCompetitionRes.json();
  const competitionId = competition.id;

  try {
    const importPayload = {
      athletes: [
        {
          lastName: 'Смоук',
          firstName: 'Тест',
          birthYear: 2010,
          gender: 'M',
          currentRank: 'R1',
          coach: 'Coach Smoke',
          club: 'Smoke Club',
          region: 'Kyiv',
          doctorApproved: true,
        },
      ],
      entries: [
        {
          athlete_index: 0,
          distance_m: 50,
          style: 'Freestyle',
          gender: 'M',
          entry_time_ms: 28750,
        },
      ],
    };

    const confirmImportRes = await authFetch(`/api/athletes/confirm-import?competitionId=${competitionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(importPayload),
    });
    if (confirmImportRes.status !== 201) {
      throw new Error(`Confirm import failed: ${confirmImportRes.status} ${await readErrorBody(confirmImportRes)}`);
    }

    const treeRes = await authFetch('/api/athletes/database/tree?search=%D0%A1%D0%BC%D0%BE%D1%83%D0%BA');
    if (treeRes.status !== 200) {
      throw new Error(`DB tree failed: ${treeRes.status} ${await readErrorBody(treeRes)}`);
    }
    const tree = await treeRes.json();
    const athletes = tree.regions?.flatMap((r) => r.schools?.flatMap((s) => s.athletes || []) || []) || [];
    const athlete = athletes.find((item) => item.lastName === 'Смоук' && item.firstName === 'Тест');
    assert(athlete, 'Imported athlete not found in database tree');

    const historyRes = await authFetch(`/api/athletes/database/athletes/${athlete.id}/applications`);
    if (historyRes.status !== 200) {
      throw new Error(`Athlete history failed: ${historyRes.status} ${await readErrorBody(historyRes)}`);
    }
    const history = await historyRes.json();
    assert(Array.isArray(history) && history.length > 0, 'Athlete application history is empty');

    const latest = history[0];
    const events = (latest.items || []).map((item) => ({
      distanceM: item.distanceM,
      style: item.style,
      entryTimeMs: item.entryTimeMs,
    }));
    assert(events.length > 0, 'Athlete application has no event rows');

    const namedDocxRes = await authFetch('/api/athletes/database/named-application-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Smoke Named Application',
        organization: latest.club || 'Smoke Club',
        region: latest.region || 'Kyiv',
        generatedAt: new Date().toISOString().slice(0, 10),
        athletes: [
          {
            fullName: `${athlete.lastName} ${athlete.firstName}`,
            birthYear: athlete.birthYear,
            gender: athlete.gender,
            rank: athlete.currentRank,
            coach: athlete.coach || '',
            club: athlete.club || '',
            region: athlete.region || '',
            events,
          },
        ],
      }),
    });
    if (![200, 201].includes(namedDocxRes.status)) {
      throw new Error(`Named DOCX failed: ${namedDocxRes.status} ${await readErrorBody(namedDocxRes)}`);
    }
    const contentType = namedDocxRes.headers.get('content-type') || '';
    assert(
      contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      `Unexpected named DOCX content-type: ${contentType}`,
    );

    console.log('Named application smoke flow passed');
  } finally {
    await authFetch(`/api/competitions/${competitionId}`, { method: 'DELETE' }).catch(() => undefined);
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
