import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/deploy.yml';

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

  it('pins every referenced action to an immutable commit', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    const references = [...workflow.matchAll(/^\s*uses:\s*[^@]+@([^\s#]+)/gm)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    expect(references.every((reference) => /^[a-f0-9]{40}$/.test(reference))).toBe(true);
  });
});
