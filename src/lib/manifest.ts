import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { validateCertificateSet, type CertificateRole } from './certificate-plan';

export type CertificateManifestEntry = {
  id: string;
  filename: string;
  role: CertificateRole;
  sha256: string;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  sourceUrl: string;
};

export type CertificateManifest = {
  version: 1;
  upstreamCheckedAt: string;
  officialPage: string;
  certificates: CertificateManifestEntry[];
};

export function parseManifest(source: string): CertificateManifest {
  const data = JSON.parse(source) as Partial<CertificateManifest>;
  if (data.version !== 1 || !Array.isArray(data.certificates) || data.certificates.length !== 5) {
    throw new Error('Manifest must contain exactly 5 certificates');
  }

  for (const entry of data.certificates) {
    if (
      !entry.id ||
      !entry.filename ||
      basename(entry.filename) !== entry.filename ||
      !['root', 'intermediate'].includes(entry.role) ||
      !/^[A-F0-9]{64}$/.test(entry.sha256) ||
      !entry.notAfter
    ) {
      throw new Error(`Invalid manifest entry: ${entry.id ?? 'unknown'}`);
    }
  }

  validateCertificateSet(data.certificates, new Date());
  return data as CertificateManifest;
}

export async function verifyCertificateFiles(
  manifest: CertificateManifest,
  directory: string
): Promise<{ checked: number; mismatches: string[] }> {
  const mismatches: string[] = [];

  for (const entry of manifest.certificates) {
    const file = await readFile(resolve(directory, entry.filename));
    const actual = createHash('sha256').update(file).digest('hex').toUpperCase();
    if (actual !== entry.sha256) mismatches.push(entry.filename);
  }

  if (mismatches.length > 0) {
    throw new Error(`Certificate hash mismatch: ${mismatches.join(', ')}`);
  }

  return { checked: manifest.certificates.length, mismatches };
}

