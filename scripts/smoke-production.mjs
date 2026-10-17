// Post-deploy check of the live site: every sitemap page answers 200, unknown
// paths answer 404, and every installer and certificate served matches the
// SHA-256 pinned in manifest.json. GitHub Pages may serve the previous build
// for a short while after a deploy, so the whole check is retried.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const base = (process.argv[2] ?? 'https://rusinternet.com').replace(/\/$/, '');
const attempts = Number(process.env.SMOKE_ATTEMPTS ?? 10);
const delayMs = Number(process.env.SMOKE_DELAY_MS ?? 30_000);

const manifest = JSON.parse(await readFile(resolve(root, 'public/downloads/manifest.json'), 'utf8'));
const sitemap = await readFile(resolve(root, 'public/sitemap.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>https:\/\/rusinternet\.com([^<]*)<\/loc>/g)].map((match) => match[1]);

const installerPaths = {
  windows: '/downloads/install-windows.cmd',
  macos: '/downloads/install-macos.sh',
  linux: '/downloads/install-linux.sh',
  iosProfile: '/downloads/profile/russiantrusted.mobileconfig'
};
const files = [
  ...Object.entries(installerPaths).map(([key, path]) => [path, manifest.installers[key]]),
  ...manifest.certificates.map((entry) => [`/downloads/certificates/${entry.filename}`, entry.sha256])
];

async function check() {
  const failures = [];
  for (const path of pages) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual' });
    if (response.status !== 200) failures.push(`${path}: HTTP ${response.status}`);
    else if (!response.headers.get('content-type')?.startsWith('text/html')) failures.push(`${path}: not HTML`);
  }
  const missing = await fetch(`${base}/this-page-does-not-exist/`, { redirect: 'manual' });
  if (missing.status !== 404) failures.push(`unknown path: HTTP ${missing.status}, expected 404`);
  for (const [path, expected] of files) {
    const response = await fetch(`${base}${path}`, { redirect: 'manual', cache: 'no-store' });
    if (response.status !== 200) {
      failures.push(`${path}: HTTP ${response.status}`);
      continue;
    }
    const actual = createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex').toUpperCase();
    if (actual !== expected) failures.push(`${path}: SHA-256 ${actual}, expected ${expected}`);
  }
  return failures;
}

for (let attempt = 1; ; attempt += 1) {
  const failures = await check();
  if (failures.length === 0) {
    console.log(`Production OK: ${pages.length} pages, ${files.length} pinned files, 404 page.`);
    break;
  }
  if (attempt >= attempts) {
    console.error(`Production check failed after ${attempt} attempts:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Attempt ${attempt}: ${failures.length} problem(s), retrying in ${delayMs / 1000}s.`);
  await new Promise((done) => setTimeout(done, delayMs));
}
