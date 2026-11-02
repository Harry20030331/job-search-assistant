import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const contract = JSON.parse(await readFile(new URL('docs/ui-contract-v56.json', root), 'utf8'));
for (const [path, expected] of Object.entries(contract.files)) {
  const actual = createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
  if (actual !== expected) throw new Error(`UI contract v${contract.version} changed: ${path}. Routine data updates must not change UI. Obtain explicit design direction and review a new version; do not automatically refresh this baseline.`);
}
console.log(`PASS UI contract v${contract.version}: fixed rendering, interactions and status projection`);
