#!/usr/bin/env node
// Fails if any link or image in the README is broken, so the profile can't rot silently.
// Images must also come back as images. Commented-out HTML is ignored.
// LinkedIn answers every automated request with HTTP 999, so links to it can't be checked.
//
//   node scripts/check-readme.mjs [README.md]
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function extractRefs(markdown) {
  const live = markdown.replace(/<!--[\s\S]*?-->/g, '').replace(/```[\s\S]*?```/g, '');
  const refs = new Map();
  const add = (url, isImage) => refs.set(url, (refs.get(url) ?? false) || isImage);
  for (const [, bang, url] of live.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)\)/g)) add(url, bang === '!');
  for (const [, attr, url] of live.matchAll(/\b(src|srcset|href)="([^"]+)"/g)) add(url, attr !== 'href');
  return [...refs].map(([url, isImage]) => ({ url, isImage }));
}

const UNCHECKABLE_LINKS = /^https:\/\/(www\.)?linkedin\.com\//;

// Wait before each retry, so a brief outage or rate limit on a badge host doesn't fail the run.
// Only failures that can recover are retried; a 404 or a wrong content type fails at once.
const RETRY_WAITS_MS = [2000, 6000];
export const isRetryable = (status) => status === 408 || status === 429 || status >= 500;

class LinkError extends Error {
  constructor(message, retry) {
    super(message);
    this.retry = retry;
  }
}

async function checkRemote({ url, isImage }) {
  if (!isImage && UNCHECKABLE_LINKS.test(url)) return null;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'check-readme' }, signal: AbortSignal.timeout(20_000) });
      await res.body?.cancel();
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok) throw new LinkError(`HTTP ${res.status}`, isRetryable(res.status));
      if (isImage && !type.startsWith('image/')) throw new LinkError(`expected an image, got ${type || 'no content-type'}`, false);
      return null;
    } catch (err) {
      // Network errors and timeouts aren't LinkErrors, and are worth another try.
      const retry = err instanceof LinkError ? err.retry : true;
      if (!retry || attempt === RETRY_WAITS_MS.length) return `${url} → ${err.cause?.message ?? err.message}`;
      await new Promise((resolve) => setTimeout(resolve, RETRY_WAITS_MS[attempt]));
    }
  }
}

// A few requests at a time, results in README order.
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

async function checkLocal({ url }, baseDir) {
  if (url.startsWith('#')) return null;
  try {
    await access(resolve(baseDir, url.split('#')[0]));
    return null;
  } catch {
    return `${url} → missing file`;
  }
}

async function main() {
  const file = process.argv[2] ?? 'README.md';
  const refs = extractRefs(await readFile(file, 'utf8'));
  const results = await mapLimit(refs, 6, (ref) => (/^https?:\/\//.test(ref.url) ? checkRemote(ref) : checkLocal(ref, dirname(file))));
  const failures = results.filter(Boolean);
  console.log(`${refs.length - failures.length}/${refs.length} links and images OK in ${file}`);
  if (failures.length) {
    console.error(failures.map((f) => `  ✗ ${f}`).join('\n'));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
