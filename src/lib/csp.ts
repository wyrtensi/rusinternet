import { createHash } from 'node:crypto';

export function sha256Source(source: string): string {
  const digest = createHash('sha256').update(source, 'utf8').digest('base64');
  return `'sha256-${digest}'`;
}

export function buildContentSecurityPolicy(scriptHashes: string[] = []): string {
  const scriptSources = ["'self'", ...scriptHashes].join(' ');

  return [
    "default-src 'none'",
    `script-src ${scriptSources}`,
    "script-src-attr 'none'",
    "style-src 'self'",
    "style-src-attr 'none'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "media-src 'none'",
    "worker-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    'upgrade-insecure-requests'
  ].join('; ');
}
