import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const configPath = require.resolve('../next.config.js');

function loadConfigWithEnv(urlValue) {
  if (urlValue === undefined) {
    delete process.env.BACKEND_API_URL;
  } else {
    process.env.BACKEND_API_URL = urlValue;
  }
  delete require.cache[configPath];
  return require('../next.config.js');
}

test('next.config rewrites використовує BACKEND_API_URL', async () => {
  const config = loadConfigWithEnv('https://api.example.com/');
  const rewrites = await config.rewrites();
  assert.equal(rewrites[0].destination, 'https://api.example.com/api/:path*');
});

test('next.config rewrites має дефолт localhost', async () => {
  const config = loadConfigWithEnv(undefined);
  const rewrites = await config.rewrites();
  assert.equal(rewrites[0].destination, 'http://localhost:3001/api/:path*');
});

