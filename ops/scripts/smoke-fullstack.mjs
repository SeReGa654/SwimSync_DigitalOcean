const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const DOCX_URL = process.env.DOCX_URL || 'http://localhost:3012';

const SAMPLE_COMPETITION = {
  name: 'Smoke Championship',
  categories_str: 'Juniors',
  location: 'Kyiv',
  venue: 'Pool',
  pool_length: 50,
  date_from: '2026-01-01',
  date_to: '2026-01-02',
};

const SAMPLE_EVENTS = [
  {
    distance_m: 50,
    style: 'Freestyle',
    gender: 'M',
    heats: [
      {
        number: 1,
        entries: [
          {
            lane: 4,
            full_name: 'Smoke Test Swimmer',
            age_group: '2010-2011',
            birth_year: 2010,
            entry_time_ms: 28500,
            coach: 'Smoke Coach',
          },
        ],
      },
    ],
  },
];

async function expectStatus(name, response, expectedStatus) {
  if (response.status !== expectedStatus) {
    const body = await response.text().catch(() => '');
    throw new Error(`${name} failed: expected ${expectedStatus}, got ${response.status}. ${body}`.trim());
  }
}

async function run() {
  const frontendRes = await fetch(`${FRONTEND_URL}/`);
  await expectStatus('frontend /', frontendRes, 200);
  const frontendHtml = await frontendRes.text();
  if (!frontendHtml.includes('<!DOCTYPE html>')) {
    throw new Error('frontend / returned unexpected payload');
  }

  const healthRes = await fetch(`${BACKEND_URL}/api/health`);
  await expectStatus('backend health', healthRes, 200);
  const health = await healthRes.json();
  if (health?.status !== 'ok') {
    throw new Error('backend health payload is invalid');
  }

  const competitionsRes = await fetch(`${BACKEND_URL}/api/competitions`);
  await expectStatus('backend competitions', competitionsRes, 200);
  const competitions = await competitionsRes.json();
  if (!Array.isArray(competitions)) {
    throw new Error('backend competitions payload is invalid');
  }

  const flagsUnauthorizedRes = await fetch(`${BACKEND_URL}/api/feature-flags`);
  if (![401, 403].includes(flagsUnauthorizedRes.status)) {
    const body = await flagsUnauthorizedRes.text().catch(() => '');
    throw new Error(`feature-flags auth guard failed: expected 401/403, got ${flagsUnauthorizedRes.status}. ${body}`.trim());
  }

  const docsRes = await fetch(`${DOCX_URL}/docs`);
  await expectStatus('docx /docs', docsRes, 200);

  const submitRes = await fetch(`${DOCX_URL}/jobs/start-protocol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      competition: SAMPLE_COMPETITION,
      events: SAMPLE_EVENTS,
      idempotency_key: `smoke-${Date.now()}`,
    }),
  });
  await expectStatus('docx submit', submitRes, 200);
  const submit = await submitRes.json();
  const jobId = submit?.job_id;
  if (!jobId) {
    throw new Error('docx submit did not return job_id');
  }

  let status = 'queued';
  for (let i = 0; i < 40; i += 1) {
    const statusRes = await fetch(`${DOCX_URL}/jobs/${jobId}`);
    await expectStatus('docx status', statusRes, 200);
    const payload = await statusRes.json();
    status = payload?.status;
    if (status === 'completed') break;
    if (status === 'failed') {
      throw new Error(`docx job failed: ${payload?.error || 'unknown error'}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  if (status !== 'completed') {
    throw new Error('docx job did not complete in time');
  }

  const downloadRes = await fetch(`${DOCX_URL}/jobs/${jobId}/download`);
  await expectStatus('docx download', downloadRes, 200);
  const contentType = downloadRes.headers.get('content-type') || '';
  if (!contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
    throw new Error(`docx download content-type mismatch: ${contentType}`);
  }

  console.log('Full-stack smoke check passed');
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
