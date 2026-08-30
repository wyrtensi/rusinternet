import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, relative, resolve } from 'node:path';

function sha256Source(source) {
  return `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`;
}

export function validatePage(html, pagePath) {
  const errors = [];
  const cspMeta = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=(?:"(?<double>[^\"]+)"|'(?<single>[^']+)')[^>]*>/i);

  const policy = cspMeta?.groups?.double ?? cspMeta?.groups?.single;
  if (!policy) {
    return [`${pagePath}: Content-Security-Policy meta tag is missing`];
  }

  const firstProtectedResource = html.search(/<(?:script|style|link)\b/i);
  if (firstProtectedResource >= 0 && (cspMeta.index ?? Infinity) > firstProtectedResource) {
    errors.push(`${pagePath}: CSP meta tag must precede protected resources`);
  }

  if (policy.includes("'unsafe-inline'")) errors.push(`${pagePath}: CSP contains unsafe-inline`);
  if (policy.includes("'unsafe-eval'")) errors.push(`${pagePath}: CSP contains unsafe-eval`);
  if (/\b(?:https|data|blob):/.test(policy)) errors.push(`${pagePath}: CSP contains a broad URL source`);

  const scripts = html.matchAll(/<script(?<attrs>[^>]*)>(?<body>[\s\S]*?)<\/script>/gi);
  for (const script of scripts) {
    const attrs = script.groups?.attrs ?? '';
    const body = script.groups?.body ?? '';
    const source = attrs.match(/\bsrc=["'](?<url>[^"']+)["']/i)?.groups?.url;

    if (source) {
      if (!source.startsWith('/')) errors.push(`${pagePath}: script source must be same-origin`);
      continue;
    }

    if (!/\btype=["']application\/ld\+json["']/i.test(attrs)) {
      errors.push(`${pagePath}: executable inline script is not allowed`);
      continue;
    }

    if (!policy.includes(sha256Source(body))) {
      errors.push(`${pagePath}: JSON-LD hash is missing from CSP`);
    }
  }

  if (/<style\b/i.test(html)) errors.push(`${pagePath}: inline style elements are not allowed`);
  if (/\sstyle\s*=/i.test(html)) errors.push(`${pagePath}: inline style attributes are not allowed`);
  if (/\son[a-z]+\s*=/i.test(html)) errors.push(`${pagePath}: inline event handlers are not allowed`);

  return errors;
}

async function findHtmlFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findHtmlFiles(path));
    if (entry.isFile() && extname(entry.name) === '.html') files.push(path);
  }

  return files;
}

async function main() {
  const distDirectory = resolve('dist');
  const pages = await findHtmlFiles(distDirectory);
  const errors = [];

  for (const page of pages) {
    const html = await readFile(page, 'utf8');
    errors.push(...validatePage(html, relative(distDirectory, page)));
  }

  if (errors.length > 0) {
    throw new Error(`Built CSP verification failed:\n${errors.join('\n')}`);
  }

  console.log(`Verified strict CSP for ${pages.length} built pages.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
