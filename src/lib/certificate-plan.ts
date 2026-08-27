export type CertificateRole = 'root' | 'intermediate';

export type CertificateRecord = {
  id: string;
  role: CertificateRole;
  sha256: string;
  notAfter: string;
};

export function validateCertificateSet(
  entries: CertificateRecord[],
  now: Date = new Date()
): CertificateRecord[] {
  const unique = new Map<string, CertificateRecord>();

  for (const entry of entries) {
    const existing = unique.get(entry.id);
    if (existing) {
      if (existing.sha256 !== entry.sha256 || existing.role !== entry.role) {
        throw new Error(`Conflicting certificate: ${entry.id}`);
      }
      continue;
    }

    const expiresAt = new Date(`${entry.notAfter}T23:59:59Z`);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt < now) {
      throw new Error(`Expired certificate: ${entry.id}`);
    }

    unique.set(entry.id, entry);
  }

  if (unique.size !== 5) {
    throw new Error(`Expected 5 unique certificates, received ${unique.size}`);
  }

  const result = [...unique.values()];
  const rootCount = result.filter((entry) => entry.role === 'root').length;
  const intermediateCount = result.filter((entry) => entry.role === 'intermediate').length;
  if (rootCount !== 2 || intermediateCount !== 3) {
    throw new Error(`Expected 2 roots and 3 intermediates, received ${rootCount} roots and ${intermediateCount} intermediates`);
  }

  return result.sort((left, right) => left.id.localeCompare(right.id));
}

