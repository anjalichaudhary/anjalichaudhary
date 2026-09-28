import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CARD_RIGHT, CHAR, FINALE, REDUCED_MOTION_CSS, renderStill, renderStory, sceneMenu, SCENES, STILL_COUNT, stillFile, TEXT_X, timeline, transcript } from './render-story.mjs';

const all = [...SCENES, FINALE];

test('the tape rewinds newest first, back to where I started', () => {
  const starts = SCENES.map((s) => Number(s.years.slice(0, 4)));
  assert.deepEqual(starts, [...starts].sort((a, b) => b - a));
  assert.equal(SCENES.at(-1).years, '2017');
});

test('every heading, line and row of pills fits in the text column', () => {
  const fits = (x, what) => assert.ok(x <= CARD_RIGHT, `too wide: ${what}`);
  for (const s of all) {
    fits(TEXT_X + [...s.years].length * CHAR.year + 10 + [...(s.company ? `@ ${s.company}` : '')].length * CHAR.company, `${s.years} @ ${s.company}`);
    fits(TEXT_X + [...s.role].length * CHAR.role, s.role);
    assert.ok(s.lines.length <= 3, `too many lines: ${s.title}`);
    for (const l of s.lines) fits(TEXT_X + [...l].length * CHAR.line, l);
    fits(TEXT_X + s.pills.reduce((w, p) => w + [...p].length * CHAR.pill + 22, -6), s.pills.join(', '));
  }
});

test('every scene has its own stage and a unique chapter name', () => {
  assert.equal(new Set(all.map((s) => s.art)).size, all.length);
  assert.equal(new Set(all.map((s) => s.chip)).size, all.length);
  assert.doesNotThrow(() => renderStory());
});

test('each scene gets its own window, in order, inside the loop', () => {
  const tl = timeline();
  assert.deepEqual(tl.sceneAt, [...tl.sceneAt].sort((a, b) => a - b));
  assert.ok(tl.ffAt > tl.sceneAt.at(-1) && tl.finaleAt > tl.ffAt && tl.duration > tl.finaleAt);
  const svg = renderStory();
  for (let k = 0; k < SCENES.length; k++) assert.match(svg, new RegExp(`@keyframes s${k}\\{`));
  for (const pct of svg.matchAll(/(\d+(?:\.\d+)?)%\{/g)) assert.ok(Number(pct[1]) <= 100, `keyframe past 100%: ${pct[1]}`);
});

test('reduced motion stops every animation and shows the first scene, with only its station lit', () => {
  const svg = renderStory();
  assert.ok(svg.includes(REDUCED_MOTION_CSS));
  assert.match(REDUCED_MOTION_CSS, /:root:not\(\.js-player\) \.a,.*\{animation:none!important\}/);
  assert.match(svg, /animation-name:s0" opacity="1"/);
  assert.equal(svg.match(/animation-name:s\d+" opacity="1"/g).length, 1);
  assert.equal(svg.match(/animation-name:st\d+"[^>]*opacity="1"/g).length, 1);
});

test('the README carries the same story as plain text', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(readme.includes(`\`\`\`text\n${transcript()}\n\`\`\``), 'README text version is out of date; paste transcript() into it');
});

test('story text is escaped and the output is deterministic', () => {
  const evil = [{ ...SCENES[0], role: '<script>alert(1)</script>', lines: ['"&"'] }];
  const svg = renderStory(evil);
  assert.doesNotMatch(svg, /<script>/);
  assert.doesNotMatch(svg, /NaN|Infinity/, 'a one-era tape must still have real positions');
  assert.match(svg, /&#60;script&#62;/);
  assert.equal(renderStory(), renderStory());
});

test('every scene has a paused still with no animation, numbered for navigation', () => {
  assert.equal(STILL_COUNT, SCENES.length + 1);
  for (let i = 0; i < STILL_COUNT; i++) {
    const svg = renderStill(i);
    assert.doesNotMatch(svg, /@keyframes|animation/);
    assert.match(svg, new RegExp(`PAUSED · ${i + 1}/${STILL_COUNT}`));
    assert.match(svg, new RegExp(`${(i < SCENES.length ? SCENES[i] : FINALE).years}`));
  }
  assert.equal(new Set(Array.from({ length: STILL_COUNT }, (_, i) => stillFile(i))).size, STILL_COUNT);
});

test('the README has the scene selection for every still', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.ok(readme.includes(sceneMenu()), 'README scene selection is out of date; paste sceneMenu() into it');
});

test('assets/scenes holds exactly the stills the script makes, so none go stale', () => {
  const onDisk = readdirSync(new URL('../assets/scenes/', import.meta.url)).filter((f) => f.endsWith('.svg')).sort();
  const expected = Array.from({ length: STILL_COUNT }, (_, i) => stillFile(i).split('/').pop()).sort();
  assert.deepEqual(onDisk, expected);
});
