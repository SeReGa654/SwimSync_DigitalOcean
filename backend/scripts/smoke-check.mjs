const baseUrl = process.env.BACKEND_URL || 'http://localhost:3001';
const apiBase = `${baseUrl}/api`;

async function check(name, url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${name} failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function run() {
  const health = await check('health', `${apiBase}/health`);
  if (health.status !== 'ok') {
    throw new Error('health payload is invalid');
  }

  await check('competitions list', `${apiBase}/competitions`);
  console.log('Smoke check passed');
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
