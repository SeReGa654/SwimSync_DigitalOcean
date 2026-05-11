import { spawnSync } from 'node:child_process';

const ALLOWLISTED_ADVISORIES = new Set([
  'https://github.com/advisories/GHSA-4r6h-8v6p-xvw6',
  'https://github.com/advisories/GHSA-5pgg-2g8v-p4x9',
]);

const audit = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const rawJson = audit.stdout?.trim();
if (!rawJson) {
  console.error('npm audit did not return JSON output');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(rawJson);
} catch (error) {
  console.error('Failed to parse npm audit JSON report');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const blockingFindings = [];
const vulnerabilities = report?.vulnerabilities || {};

for (const [packageName, vuln] of Object.entries(vulnerabilities)) {
  const severity = String(vuln?.severity || '').toLowerCase();
  if (!['high', 'critical'].includes(severity)) {
    continue;
  }

  const advisoryObjects = Array.isArray(vuln?.via)
    ? vuln.via.filter((item) => typeof item === 'object' && item !== null)
    : [];

  const hasNonAllowlistedAdvisory = advisoryObjects.some((advisory) => {
    const url = typeof advisory.url === 'string' ? advisory.url : '';
    return !ALLOWLISTED_ADVISORIES.has(url);
  });

  if (hasNonAllowlistedAdvisory) {
    blockingFindings.push({ packageName, severity, advisories: advisoryObjects });
  }
}

if (blockingFindings.length > 0) {
  console.error('Blocking production dependency vulnerabilities detected:');
  for (const finding of blockingFindings) {
    const advisoryUrls = finding.advisories
      .map((advisory) => advisory.url)
      .filter((url) => typeof url === 'string');
    console.error(`- ${finding.packageName} (${finding.severity}): ${advisoryUrls.join(', ') || 'no advisory URL'}`);
  }
  process.exit(1);
}

const totalHigh = report?.metadata?.vulnerabilities?.high || 0;
const totalCritical = report?.metadata?.vulnerabilities?.critical || 0;
console.log(`Dependency audit passed (high=${totalHigh}, critical=${totalCritical}, allowlisted-only findings are tolerated).`);
