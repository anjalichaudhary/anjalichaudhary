import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractRefs, isRetryable } from './check-readme.mjs';

test('extractRefs finds markdown and HTML refs, marks images, and skips comments and code', () => {
  const md = [
    '[site](https://example.com) ![badge](https://img.example/b.svg)',
    '<a href="https://example.com/a"><img src="assets/x.svg"></a>',
    '<source srcset="assets/x-dark.svg">',
    '<!-- <img src="https://hidden.example/y.svg"> -->',
    '```ts\nconst u = "[x](https://in-code.example)";\n```',
  ].join('\n');
  assert.deepEqual(extractRefs(md), [
    { url: 'https://example.com', isImage: false },
    { url: 'https://img.example/b.svg', isImage: true },
    { url: 'https://example.com/a', isImage: false },
    { url: 'assets/x.svg', isImage: true },
    { url: 'assets/x-dark.svg', isImage: true },
  ]);
});

test('only failures that can recover are retried', () => {
  for (const status of [408, 429, 500, 502, 503]) assert.equal(isRetryable(status), true, String(status));
  for (const status of [400, 403, 404, 410]) assert.equal(isRetryable(status), false, String(status));
});
