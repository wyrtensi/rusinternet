import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/deploy.yml';
const upstreamPath = '.github/workflows/upstream-certificates.yml';

describe('GitHub Pages deployment workflow', () => {
  it('tests and builds before deploying, from main only', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('needs: build');
    expect(workflow).toContain('actions/deploy-pages@');
    // build (tests) must run before the artifact is uploaded
    expect(workflow.indexOf('npm run build')).toBeLessThan(workflow.indexOf('upload-pages-artifact'));
  });

  it('uses least-privilege permissions for Pages with OIDC', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('pages: write');
    expect(workflow).toContain('id-token: write');
    expect(workflow).not.toContain('contents: write');
  });

  it('publishes the built site to the custom domain', async () => {
    const cname = (await readFile('public/CNAME', 'utf8')).trim();
    expect(cname).toBe('rusinternet.com');
  });

  it.each([workflowPath, upstreamPath])('pins every action referenced in %s to an immutable commit', async (path) => {
    const workflow = await readFile(path, 'utf8');
    const references = [...workflow.matchAll(/^\s*uses:\s*[^@]+@([^\s#]+)/gm)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((reference) => /^[a-f0-9]{40}$/.test(reference))).toBe(true);
  });

  it('checks the live site after deploying and only then notifies IndexNow', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toMatch(/smoke:[\s\S]*needs: deploy[\s\S]*scripts\/smoke-production\.mjs/);
    expect(workflow).toMatch(/indexnow:[\s\S]*needs: smoke[\s\S]*scripts\/indexnow\.mjs/);
  });

  it('publishes the IndexNow key the submission script uses', async () => {
    const script = await readFile('scripts/indexnow.mjs', 'utf8');
    const key = script.match(/INDEXNOW_KEY = '([a-f0-9]{32})'/)?.[1];
    expect(key).toBeDefined();
    expect((await readFile(`public/${key}.txt`, 'utf8')).trim()).toBe(key);
  });
});

describe('weekly official certificate check', () => {
  it('runs on a schedule, can only open issues and never publishes', async () => {
    const workflow = await readFile(upstreamPath, 'utf8');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('issues: write');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pages: write');
    expect(workflow).toContain('node scripts/check-upstream.mjs');
  });
});
