#!/usr/bin/env node
/**
 * Fail when a tracked file references a hostname that isn't a reserved
 * documentation domain (RFC 2606: .example/.invalid/.test) or an explicitly
 * allowed real service this project legitimately talks to (GitHub,
 * standards bodies, localhost).
 *
 * Why this exists: a real stage deployment hostname and a maintainer's own
 * real domain both ended up committed in a sibling repository (bsystem-code
 * QA) during a Stage 1 SSO round. This is the same check, ported here since
 * the HUB is the OIDC relying party for the same authentik deployment and is
 * just as likely a place a real stage URL gets pasted "to see if it works".
 *
 * Usage: node scripts/check-no-real-hostnames.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// RFC 2606 / RFC 6761 reserve these for documentation and examples.
const RESERVED_HOST = /(?:^|\.)(?:example|invalid|test|localhost|internal)(?:\.[a-z]{2,})?$/i;

// Real services this project legitimately references (comments, links to
// specs, actual third-party APIs it calls) -- not stage/deployment hostnames.
const ALLOWED_HOSTS = new Set([
  '127.0.0.1', '0.0.0.0', '::1',
  'github.com', 'www.w3.org',
  'localhost',
]);

const HOST_RE = /\bhttps?:\/\/([a-zA-Z0-9][a-zA-Z0-9.-]*)/g;

// A bare hostname with no URL scheme -- e.g. a real stage domain typed into
// a doc or comment without "https://" in front, which HOST_RE above cannot
// see at all. Restricted to a curated list of real public TLDs rather than
// "any dotted alphabetic label": the latter matches overwhelmingly more
// dotted code identifiers (`json.load`, `event.action`) than real domains.
// A few otherwise-real ccTLDs are deliberately left out because they collide
// with common English words in identifiers (`.me`, `.in`, `.online`).
const REAL_TLDS = new Set([
  'com', 'org', 'net', 'io', 'dev', 'app', 'co', 'ai', 'biz',
  'uk', 'de', 'pl', 'ua', 'fr', 'es', 'it', 'nl', 'ru', 'cn', 'jp',
  'us', 'ca', 'au', 'br', 'xyz', 'cloud', 'tech', 'site',
  'store', 'pro', 'tv', 'cc', 'gg',
]);
const BARE_HOST_RE = /\b((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.){1,}[a-zA-Z]{2,24})\b/g;

// Binary/generated content and this script's own known-good matches would
// otherwise flag themselves or produce noise no one can act on.
const EXCLUDE_PATH = /^(node_modules\/|dist\/|build\/|coverage\/)|package-lock\.json$/;

function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' });
  return out.split('\n').filter((f) => f && !EXCLUDE_PATH.test(f));
}

function isBinary(buf) {
  return buf.subarray(0, 8000).includes(0);
}

function check(file) {
  const findings = [];
  let raw;
  try {
    raw = readFileSync(new URL(file, `file://${ROOT}/`));
  } catch {
    return findings;
  }
  if (isBinary(raw)) return findings;

  const text = raw.toString('utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const hostsOnLine = new Set();

    for (const match of line.matchAll(HOST_RE)) {
      const hostname = match[1].split(':')[0].toLowerCase();
      if (hostname.includes('.')) hostsOnLine.add(hostname);
    }

    for (const match of line.matchAll(BARE_HOST_RE)) {
      const hostname = match[1].toLowerCase();
      const tld = hostname.slice(hostname.lastIndexOf('.') + 1);
      if (REAL_TLDS.has(tld)) hostsOnLine.add(hostname);
    }

    for (const hostname of hostsOnLine) {
      if (ALLOWED_HOSTS.has(hostname) || RESERVED_HOST.test(hostname)) continue;
      findings.push(`${file}:${i + 1}: host '${hostname}' is not a reserved documentation domain (.example/.invalid/.test) or an allowed real service`);
    }
  });
  return findings;
}

function main() {
  const files = trackedFiles();
  const findings = files.flatMap(check);

  if (findings.length) {
    console.log('Found real-looking hostnames committed to the repo:\n');
    for (const f of findings) console.log(`  ${f}`);
    console.log(`\n${findings.length} finding(s). Use a reserved documentation domain instead (e.g. hub.example.com), or add the host to ALLOWED_HOSTS in scripts/check-no-real-hostnames.mjs if it's a real third-party service this project legitimately calls.`);
    process.exit(1);
  }

  console.log(`checked ${files.length} tracked file(s): no committed real-looking hostname`);
}

main();
