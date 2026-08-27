import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseManifest, verifyCertificateFiles } from '../src/lib/manifest';
import { INSTALLER_HASHES } from '../src/lib/release';

const manifestPath = resolve('public/downloads/manifest.json');
const certificateDirectory = resolve('public/downloads/certificates');

describe('public certificate manifest', () => {
  it('publishes the same installer hashes used by the website', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    expect(manifest.installers).toEqual(INSTALLER_HASHES);
  });

  it('describes five unique certificates with the required role split', async () => {
    const manifest = parseManifest(await readFile(manifestPath, 'utf8'));
    expect(new Set(manifest.certificates.map((entry) => entry.sha256)).size).toBe(5);
    expect(manifest.certificates.filter((entry) => entry.role === 'root')).toHaveLength(2);
    expect(manifest.certificates.filter((entry) => entry.role === 'intermediate')).toHaveLength(3);
  });

  it('matches every unpacked certificate served to installers', async () => {
    const manifest = parseManifest(await readFile(manifestPath, 'utf8'));
    await expect(verifyCertificateFiles(manifest, certificateDirectory)).resolves.toEqual({
      checked: 5,
      mismatches: []
    });
  });

  it('rejects malformed manifest data', () => {
    expect(() => parseManifest('{"version":1,"certificates":[]}'))
      .toThrow('Manifest must contain exactly 5 certificates');
  });
});
