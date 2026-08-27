import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, copyFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTALLER_HASHES } from '../src/lib/release';

const root = resolve(import.meta.dirname, '..');
const certSource = resolve(root, 'public/downloads/certificates');
const windowsBash = 'C:/Program Files/Git/bin/bash.exe';
const bash = process.platform === 'win32' ? windowsBash : '/usr/bin/bash';

function corruptedCertSource(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rusinternet-tamper-'));
  for (const name of readdirSync(certSource)) {
    copyFileSync(join(certSource, name), join(dir, name));
  }
  const victim = join(dir, 'russian_trusted_root_ca.cer');
  const bytes = readFileSync(victim);
  bytes[bytes.length - 1] ^= 0xff;
  writeFileSync(victim, bytes);
  return dir;
}

describe('platform installers', () => {
  it.each([
    ['windows', 'public/downloads/install-windows.cmd'],
    ['macos', 'public/downloads/install-macos.sh'],
    ['linux', 'public/downloads/install-linux.sh'],
    ['iosProfile', 'public/downloads/profile/russiantrusted.mobileconfig']
  ] as const)('publishes the current %s SHA-256', (name, path) => {
    const actual = createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex').toUpperCase();
    expect(actual).toBe(INSTALLER_HASHES[name]);
  });

  it.skipIf(process.platform !== 'win32')('validates all certificates in Windows dry-run mode', () => {
    const output = execFileSync(
      'cmd.exe',
      ['/d', '/s', '/c', 'public\\downloads\\install-windows.cmd --dry-run'],
      {
        cwd: root,
        env: { ...process.env, RUSINTERNET_CERT_SOURCE: certSource },
        encoding: 'utf8'
      }
    );

    expect(output).toContain('CERTIFICATES_VERIFIED=5');
  }, 15_000);

  it.skipIf(!existsSync(bash))(
    'validates all certificates in Linux dry-run mode',
    () => {
      const output = execFileSync(
        bash,
        ['public/downloads/install-linux.sh', '--dry-run'],
        {
          cwd: root,
          env: { ...process.env, RUSINTERNET_CERT_SOURCE: certSource.replaceAll('\\', '/') },
          encoding: 'utf8'
        }
      );

      expect(output).toContain('CERTIFICATES_VERIFIED=5');
      expect(output).toContain('ROOT_CERTIFICATES_CONVERTED=2');
    },
    15_000
  );

  it.skipIf(!existsSync(bash))(
    'validates all certificates in macOS dry-run mode',
    () => {
      const output = execFileSync(
        bash,
        ['public/downloads/install-macos.sh', '--dry-run'],
        {
          cwd: root,
          env: { ...process.env, RUSINTERNET_CERT_SOURCE: certSource.replaceAll('\\', '/') },
          encoding: 'utf8'
        }
      );

      expect(output).toContain('CERTIFICATES_VERIFIED=5');
    },
    15_000
  );

  it.skipIf(!existsSync(bash))(
    'aborts before verification when a certificate is tampered with',
    () => {
      const tampered = corruptedCertSource();
      let status = 0;
      let stdout = '';
      try {
        stdout = execFileSync(bash, ['public/downloads/install-linux.sh', '--dry-run'], {
          cwd: root,
          env: { ...process.env, RUSINTERNET_CERT_SOURCE: tampered.replaceAll('\\', '/') },
          encoding: 'utf8'
        });
      } catch (error) {
        const failure = error as { status?: number; stdout?: string };
        status = failure.status ?? 1;
        stdout = failure.stdout ?? '';
      }

      expect(status).not.toBe(0);
      expect(stdout).not.toContain('CERTIFICATES_VERIFIED=5');
    },
    15_000
  );

  it('emits an explicit error when the downloaded installer fails verification', async () => {
    const { getInstallAction } = await import('../src/lib/platform');
    const command = getInstallAction('linux', 'ru', {
      macos: 'A'.repeat(64),
      linux: 'B'.repeat(64)
    });
    if (command.kind !== 'command') throw new Error('expected a command action');
    expect(command.command).toContain('Установка прервана');
    expect(command.command).toContain("--proto '=https'");
  });

  it('uses explicit Windows system utility paths after elevation', () => {
    const source = readFileSync(resolve(root, 'public/downloads/install-windows.cmd'), 'utf8');
    expect(source).toContain('%SystemRoot%\\System32\\certutil.exe');
    expect(source).toContain('%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    expect(source).not.toMatch(/^certutil\.exe/m);
    expect(source).not.toMatch(/^powershell\.exe/m);
  });
});
