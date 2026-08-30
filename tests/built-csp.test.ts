import { describe, expect, it } from 'vitest';
import { validatePage } from '../scripts/verify-built-csp.mjs';

const validPolicy = [
  "default-src 'none'",
  "script-src 'self' 'sha256-SmqkxdEdVkkhDkLv+LJzRWHrMxUa6jwoNT6UR0FPloA='",
  "script-src-attr 'none'",
  "style-src 'self'",
  "style-src-attr 'none'",
  "object-src 'none'",
  "base-uri 'none'"
].join('; ');

describe('built CSP verification', () => {
  it('accepts external assets and correctly hashed JSON-LD', () => {
    const html = `<!doctype html><html><head>
      <meta http-equiv="Content-Security-Policy" content="${validPolicy}">
      <link rel="stylesheet" href="/assets/site.css">
      <script src="/scripts/site.js" defer></script>
    </head><body>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>
    </body></html>`;

    expect(validatePage(html, 'index.html')).toEqual([]);
  });

  it('rejects inline executable code, inline styles and unsafe policy sources', () => {
    const html = `<!doctype html><html><head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'">
      <script>alert('blocked')</script>
    </head><body style="display:none" onclick="alert('blocked')"></body></html>`;

    expect(validatePage(html, 'unsafe.html')).toEqual(expect.arrayContaining([
      'unsafe.html: CSP contains unsafe-inline',
      'unsafe.html: executable inline script is not allowed',
      'unsafe.html: inline style attributes are not allowed',
      'unsafe.html: inline event handlers are not allowed'
    ]));
  });
});
