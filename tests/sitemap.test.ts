import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLATFORMS } from '../src/lib/platform';

const root = resolve(import.meta.dirname, '..');
const site = 'https://rusinternet.com';
const pairs: Array<[string, string]> = [
  ['/', '/en/'],
  ['/manual/', '/en/manual/'],
  ...PLATFORMS.map((platform): [string, string] => [`/install/${platform}/`, `/en/install/${platform}/`])
];

describe('sitemap', () => {
  it('lists every page of both languages with ru, en and x-default alternates', async () => {
    const xml = await readFile(resolve(root, 'public/sitemap.xml'), 'utf8');
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => match[1]);
    expect(entries).toHaveLength(pairs.length * 2);

    for (const [ru, en] of pairs) {
      for (const loc of [ru, en]) {
        const entry = entries.find((body) => body.includes(`<loc>${site}${loc}</loc>`));
        expect(entry, loc).toBeDefined();
        expect(entry).toContain(`hreflang="ru" href="${site}${ru}"`);
        expect(entry).toContain(`hreflang="en" href="${site}${en}"`);
        expect(entry).toContain(`hreflang="x-default" href="${site}${ru}"`);
      }
    }
  });

  it('is announced in robots.txt', async () => {
    const robots = await readFile(resolve(root, 'public/robots.txt'), 'utf8');
    expect(robots).toContain(`Sitemap: ${site}/sitemap.xml`);
  });
});
