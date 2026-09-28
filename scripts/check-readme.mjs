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

async function checkRemote({ url, isImage }) {
  if (!isImage && UNCHECKABLE_LINKS.test(url)) return null;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'check-readme' }, signal: AbortSignal.timeout(20_000) });
      await res.body?.cancel();
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (isImage && !type.startsWith('image/')) throw new Error(`expected an image, got ${type || 'no content-type'}`);
      return null;
    } catch (err) {
      if (attempt === 2) return `${url} → ${err.cause?.message ?? err.message}`;
    }
  }
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
  const failures = [];
  for (const ref of refs) {
    const failure = /^https?:\/\//.test(ref.url) ? await checkRemote(ref) : await checkLocal(ref, dirname(file));
    if (failure) failures.push(failure);
  }
  console.log(`${refs.length - failures.length}/${refs.length} links and images OK in ${file}`);
  if (failures.length) {
    console.error(failures.map((f) => `  ✗ ${f}`).join('\n'));
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
