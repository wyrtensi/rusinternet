import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/deploy.yml';
const upstreamPath = '.github/workflows/upstream-certificates.yml';
const tlsPath = '.github/workflows/tls-certificate.yml';

describe('server deployment workflow', () => {
  it('tests and builds before deploying, from main only', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('branches: [main]');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('needs: build');
    // build (tests) must run before the artifact is uploaded
    expect(workflow.indexOf('npm run build')).toBeLessThan(workflow.indexOf('actions/upload-artifact@'));
  });

  it('only reads the repository and needs no Pages or OIDC rights', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('pages: write');
    expect(workflow).not.toContain('id-token: write');
  });

  it('deploys through the production environment to a pinned host key', async () => {
    const workflow = await readFile(workflowPath, 'utf8');
    expect(workflow).toMatch(/environment:\s*\n\s*name: production\s*\n\s*url: https:\/\/rusinternet\.com\//);
    expect(workflow).toContain('secrets.RUSINTERNET_DEPLOY_KEY');
    expect(workflow).toMatch(/DEPLOY_HOST_KEY: 192\.144\.58\.198 ssh-ed25519 AAAA\S+/);
    expect(workflow).toContain('StrictHostKeyChecking=yes');
    // upload first, switch "current" only after the whole release arrived
    expect(workflow.indexOf('rsync -rlt')).toBeLessThan(workflow.indexOf('"activate $release"'));
  });

  it.each([workflowPath, upstreamPath, tlsPath])('pins every action referenced in %s to an immutable commit', async (path) => {
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

describe('server forced command for the deploy key', () => {
  const sh = process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : '/bin/sh';
  const run = (command: string) => {
    try {
      execFileSync(sh, ['deploy/server/rusinternet-deploy.sh'], {
        env: { ...process.env, SSH_ORIGINAL_COMMAND: command },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      return { status: 0, stderr: '' };
    } catch (error) {
      const failure = error as { status?: number; stderr?: string };
      return { status: failure.status ?? 1, stderr: failure.stderr ?? '' };
    }
  };

  it.skipIf(!existsSync(sh)).each(['id', 'sh -c id', 'rsync --sender', ''])('refuses %j', (command) => {
    const result = run(command);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('command not allowed');
  });

  it.skipIf(!existsSync(sh)).each(['activate ../../etc', 'activate a/b', 'activate ', 'activate A1'])('rejects the release name in %j', (command) => {
    const result = run(command);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('invalid release name');
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

describe('weekly TLS certificate check', () => {
  it('runs on a schedule, can only open issues and never publishes', async () => {
    const workflow = await readFile(tlsPath, 'utf8');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('issues: write');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).toContain('node scripts/check-tls.mjs');
    expect(workflow).toContain('if: failure()');
  });

  it('alerts only after Caddy should already have renewed, with time left to fix it', async () => {
    const script = await readFile('scripts/check-tls.mjs', 'utf8');
    const minDays = Number(script.match(/MIN_DAYS = (\d+)/)?.[1]);
    // Caddy renews about 30 days before expiry; a weekly run must still alert well before the end.
    expect(minDays).toBeLessThan(30);
    expect(minDays).toBeGreaterThanOrEqual(14);
    expect(script).toContain("'rusinternet.com', 'www.rusinternet.com'");
  });
});
