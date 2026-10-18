import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('header GitHub link', () => {
  it('links to the repository, opens safely and sits before the language switch', async () => {
    const layout = await readFile(resolve(root, 'src/layouts/BaseLayout.astro'), 'utf8');
    const link = layout.match(/<a class="github-link"[^>]*>/)?.[0] ?? '';

    expect(link).toContain('href="https://github.com/wyrtensi/rusinternet"');
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener"');
    expect(link).toContain("'Исходный код на GitHub'");
    expect(link).toContain("'Source code on GitHub'");
    expect(link).not.toContain('style=');
    expect(layout.indexOf('class="github-link"')).toBeLessThan(layout.indexOf('class="language"'));
  });
});
