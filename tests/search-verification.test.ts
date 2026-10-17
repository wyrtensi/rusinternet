import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('search engine ownership proofs', () => {
  it('keeps the Google and Yandex verification meta tags on every page', async () => {
    const layout = await readFile(resolve(root, 'src/layouts/BaseLayout.astro'), 'utf8');
    expect(layout).toContain('<meta name="google-site-verification" content="_mRXue0pgJeVvSu01B6hHvdWtdfppyRtmwUcRKtwvB8" />');
    expect(layout).toContain('<meta name="yandex-verification" content="348519ab6ce4ce38" />');
  });
});
