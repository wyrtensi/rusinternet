import { describe, expect, it } from 'vitest';
import { validateCertificateSet, type CertificateRecord } from '../src/lib/certificate-plan';

const validSet: CertificateRecord[] = [
  { id: 'root-rsa', role: 'root', sha256: 'A1', notAfter: '2032-02-28' },
  { id: 'root-gost-2025', role: 'root', sha256: 'A2', notAfter: '2040-05-24' },
  { id: 'sub-rsa-2022', role: 'intermediate', sha256: 'B1', notAfter: '2027-03-06' },
  { id: 'sub-rsa-2024', role: 'intermediate', sha256: 'B2', notAfter: '2029-07-19' },
  { id: 'sub-gost-2025', role: 'intermediate', sha256: 'B3', notAfter: '2030-05-27' }
];

describe('validateCertificateSet', () => {
  it('accepts exactly two roots and three intermediates', () => {
    const plan = validateCertificateSet(validSet, new Date('2026-08-27T00:00:00Z'));
    expect(plan.map((entry) => entry.id)).toEqual([
      'root-gost-2025',
      'root-rsa',
      'sub-gost-2025',
      'sub-rsa-2022',
      'sub-rsa-2024'
    ]);
  });

  it('deduplicates an identical certificate repeated in a source bundle', () => {
    const plan = validateCertificateSet([...validSet, { ...validSet[0] }], new Date('2026-08-27T00:00:00Z'));
    expect(plan).toHaveLength(5);
  });

  it('rejects a duplicate identifier with a different fingerprint', () => {
    expect(() => validateCertificateSet([
      ...validSet,
      { ...validSet[0], sha256: 'CHANGED' }
    ], new Date('2026-08-27T00:00:00Z'))).toThrow('Conflicting certificate: root-rsa');
  });

  it('rejects a missing certificate instead of partially installing trust', () => {
    expect(() => validateCertificateSet(validSet.slice(0, 4), new Date('2026-08-27T00:00:00Z')))
      .toThrow('Expected 5 unique certificates, received 4');
  });

  it('rejects an expired certificate', () => {
    expect(() => validateCertificateSet(validSet, new Date('2027-03-07T00:00:00Z')))
      .toThrow('Expired certificate: sub-rsa-2022');
  });
});

