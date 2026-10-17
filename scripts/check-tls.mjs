// Checks the live TLS certificates of the site. Caddy renews them about 30 days
// before expiry, so a certificate with fewer than MIN_DAYS left means renewal
// has been failing for a while. Exits non-zero so the scheduled workflow can
// open an issue. The default TLS checks also reject an untrusted chain or a
// certificate that does not match the host name.
import { connect } from 'node:tls';

const HOSTS = ['rusinternet.com', 'www.rusinternet.com'];
const MIN_DAYS = 21;
const DAY = 24 * 60 * 60 * 1000;

function peerCertificate(host) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port: 443, servername: host, timeout: 15000 }, () => {
      const certificate = socket.getPeerCertificate();
      socket.end();
      resolve(certificate);
    });
    socket.on('timeout', () => socket.destroy(new Error('connection timed out')));
    socket.on('error', reject);
  });
}

const problems = [];
for (const host of HOSTS) {
  try {
    const certificate = await peerCertificate(host);
    const expires = new Date(certificate.valid_to);
    const daysLeft = Math.floor((expires.getTime() - Date.now()) / DAY);
    const line = `${host}: issued by ${certificate.issuer?.O ?? 'unknown'} ${certificate.issuer?.CN ?? ''}, expires ${expires.toISOString().slice(0, 10)} (${daysLeft} days left)`;
    if (daysLeft < MIN_DAYS) problems.push(`${line}, renewal is overdue`);
    else console.log(line);
  } catch (error) {
    problems.push(`${host}: ${error.code ?? 'error'} ${error.message}`);
  }
}

if (problems.length > 0) {
  console.error(`TLS certificate problems (alert threshold ${MIN_DAYS} days):`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
