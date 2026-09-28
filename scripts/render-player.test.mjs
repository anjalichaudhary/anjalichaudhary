import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { chapters, renderPlayer } from './render-player.mjs';
import { REDUCED_MOTION_CSS, SCENES } from './render-story.mjs';

const html = renderPlayer();

test('the CSP allows only this page\'s own script, pinned by its hash', () => {
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  const hash = createHash('sha256').update(script).digest('base64');
  assert.match(html, new RegExp(`script-src 'sha256-${hash.replace(/[+/=]/g, '\\$&')}'`));
  assert.match(html, /default-src 'none'/);
});

test('nothing loads from another origin', () => {
  assert.doesNotMatch(html, /<(script|img|link|iframe)[^>]+(src|href)="https?:/);
  assert.doesNotMatch(html, /@import|url\(http/);
});

test('there is a working remote: play/pause, skip, scrub, and a chip per chapter', () => {
  for (const id of ['prev', 'back', 'play', 'fwd', 'next', 'scrub']) assert.match(html, new RegExp(`id="${id}"`));
  assert.equal(chapters().length, SCENES.length + 1);
  assert.equal(html.match(/data-ch="\d+"/g).length, SCENES.length + 1);
});

test('reduced motion still applies with JavaScript off; the script lifts it only once it has control', () => {
  assert.ok(html.includes(REDUCED_MOTION_CSS));
  const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
  assert.ok(script.indexOf("classList.add('js-player')") < script.indexOf('getAnimations'));
  assert.match(script, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
});

test('chapter data cannot close the inline script', () => {
  const evil = [{ ...SCENES[0], title: '</script><script>alert(1)</script>' }];
  const page = renderPlayer(evil);
  assert.equal(page.match(/<\/script>/g).length, 1);
});
