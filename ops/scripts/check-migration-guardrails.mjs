import fs from 'node:fs';
import path from 'node:path';

const workflowsDir = path.resolve('.github', 'workflows');

if (!fs.existsSync(workflowsDir)) {
  console.log('[migration-guardrails] .github/workflows not found, skipping');
  process.exit(0);
}

const workflowFiles = fs
  .readdirSync(workflowsDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.yml'))
  .map((entry) => path.join(workflowsDir, entry.name));

const releaseLike = workflowFiles.filter((filePath) => /(deploy|release|prod)/i.test(path.basename(filePath)));
const violations = [];

for (const filePath of releaseLike) {
  const content = fs.readFileSync(filePath, 'utf8');
  const normalized = content.toLowerCase();
  if (normalized.includes('db push') || normalized.includes('prisma db push') || normalized.includes('db:push')) {
    violations.push(`${path.relative(process.cwd(), filePath)} uses db push in release workflow`);
  }
  if (!normalized.includes('migrate deploy') && !normalized.includes('db:migrate:deploy')) {
    violations.push(`${path.relative(process.cwd(), filePath)} does not contain migrate deploy step`);
  }
}

if (violations.length > 0) {
  console.error('[migration-guardrails] violations found:');
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log('[migration-guardrails] ok');
