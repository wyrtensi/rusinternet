// Compares the official Gosuslugi certificate archives with manifest.json.
// Exits non-zero when a certificate was added, changed or removed upstream, so
// the scheduled workflow can open an issue. It never updates the manifest:
// a new root must be reviewed by a person before it is published.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const manifest = JSON.parse(await readFile(resolve(import.meta.dirname, '../public/downloads/manifest.json'), 'utf8'));
const sources = [...new Set(manifest.certificates.map((entry) => entry.sourceUrl))];
const problems = [];

for (const url of sources) {
  const response = await fetch(url);
  if (!response.ok) {
    problems.push(`${url}: HTTP ${response.status}`);
    continue;
  }
  const dir = await mkdtemp(join(tmpdir(), 'rusinternet-upstream-'));
  const archive = join(dir, 'archive.zip');
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync('unzip', ['-q', '-o', archive, '-d', join(dir, 'files')]);

  const upstream = new Map();
  for (const entry of await readdir(join(dir, 'files'), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const bytes = await readFile(join(entry.parentPath, entry.name));
    upstream.set(entry.name, createHash('sha256').update(bytes).digest('hex').toUpperCase());
  }

  const expected = manifest.certificates.filter((entry) => entry.sourceUrl === url);
  for (const entry of expected) {
    const actual = upstream.get(entry.filename);
    if (!actual) problems.push(`${url}: ${entry.filename} is no longer published`);
    else if (actual !== entry.sha256) problems.push(`${url}: ${entry.filename} changed, SHA-256 ${actual}`);
  }
  for (const [name, sha256] of upstream) {
    if (!expected.some((entry) => entry.filename === name)) problems.push(`${url}: new file ${name}, SHA-256 ${sha256}`);
  }
}

if (problems.length > 0) {
  console.error('The official certificate set differs from manifest.json:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log(`Official archives match manifest.json (${manifest.certificates.length} certificates, ${sources.length} archives).`);
