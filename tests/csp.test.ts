import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy, sha256Source } from '../src/lib/csp';

describe('Content Security Policy', () => {
  it('allows only same-origin resources and explicitly hashed structured data', () => {
    const structuredData = '{"@context":"https://schema.org","@type":"WebSite"}';
    const hash = sha256Source(structuredData);
    const policy = buildContentSecurityPolicy([hash]);

    expect(hash).toBe("'sha256-SmqkxdEdVkkhDkLv+LJzRWHrMxUa6jwoNT6UR0FPloA='");
    expect(policy).toContain(`script-src 'self' ${hash}`);
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("style-src 'self'");
    expect(policy).toContain("style-src-attr 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'none'");
    expect(policy).toContain("form-action 'none'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain('https:');
    expect(policy).not.toContain('data:');
  });

  it('does not create an empty script hash allowance', () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("script-src 'self';");
    expect(policy).not.toContain('sha256-');
  });
});
