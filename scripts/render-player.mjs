#!/usr/bin/env node
// Renders docs/index.html: the career tape with a real remote control (play/pause, scrub, skip,
// jump to a scene, keyboard). GitHub READMEs show SVGs through <img>, which can't be clicked,
// so the README links here. Served by GitHub Pages from /docs.
// One self-contained file: the SVG is inlined, nothing loads from anywhere else, and the CSP
// allows only this page's own script, pinned by hash.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { esc, FF_TEXT, FINALE, renderStory, SCENES, timeline } from './render-story.mjs';

export const PROFILE = 'https://github.com/anjalichaudhary';
export const LINKEDIN = 'https://www.linkedin.com/in/anjali-chaudhary';

// Chapters, in tape order: each scene while rewinding, then the finale. `end` is when it fades out.
export function chapters(scenes = SCENES) {
  const tl = timeline(scenes);
  const ends = [...tl.sceneAt.slice(1), tl.ffAt];
  return [
    ...scenes.map((s, k) => ({ at: tl.sceneAt[k], end: ends[k], label: s.chip, title: `${s.years} · ${s.title}` })),
    { at: tl.finaleAt, end: tl.finaleEnd, label: FINALE.chip, title: FINALE.role },
  ];
}

// JSON for an inline <script>: `<` is escaped so no string can close the script element.
const scriptJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

function playerScript(tl, chapterList) {
  const ms = (s) => Math.round(s * 1000);
  const CH = chapterList.map(({ at, end, title }) => ({ at: ms(at), end: ms(end), title }));
  return `
const D = ${ms(tl.duration)}, FF = [${ms(tl.ffAt)}, ${ms(tl.finaleAt)}], FF_TEXT = ${scriptJson(FF_TEXT)}, CH = ${scriptJson(CH)};
const svg = document.querySelector('#tape svg'), playBtn = document.getElementById('play');
const scrub = document.getElementById('scrub'), clock = document.getElementById('clock'), now = document.getElementById('now');
const chips = [...document.querySelectorAll('[data-ch]')];
let anims = [], tape = [], playing = true;
const t = () => (tape[0] ? tape[0].currentTime % D : 0);
const fmt = (ms) => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const chapterAt = (ms) => CH.reduce((c, ch, i) => (ms >= ch.at - 1 ? i : c), 0);
function seek(ms) {
  ms = ((ms % D) + D) % D;
  for (const a of tape) a.currentTime = ms;
  render();
}
function setPlaying(on) {
  playing = on;
  for (const a of anims) on ? a.play() : a.pause();
  playBtn.textContent = on ? '❚❚' : '▶';
  playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
  // Announce scene changes only when paused, not every few seconds during playback.
  now.setAttribute('aria-live', on ? 'off' : 'polite');
  if (on) requestAnimationFrame(loop);
}
// Playing: land at the start of the scene to watch it unfold. Paused: land where it is complete.
function jump(i) {
  const c = CH[(i + CH.length) % CH.length];
  seek(playing ? c.at + 400 : c.end - 700);
}
function render() {
  const ms = t(), i = chapterAt(ms);
  const title = ms >= FF[0] && ms < FF[1] ? FF_TEXT : CH[i].title;
  scrub.value = ms; clock.textContent = fmt(ms) + ' / ' + fmt(D);
  scrub.setAttribute('aria-valuetext', fmt(ms) + ', ' + title);
  if (now.textContent !== title) now.textContent = title;
  if (now.dataset.i !== String(i)) {
    now.dataset.i = i;
    chips.forEach((c, j) => c.setAttribute('aria-current', j === i ? 'true' : 'false'));
  }
}
function loop() { render(); if (playing) requestAnimationFrame(loop); }
// Playing and 2s into a scene: restart it. Otherwise (or paused, where jumps land at the end): go back one.
document.getElementById('prev').onclick = () => { const i = chapterAt(t()); jump(playing && t() - CH[i].at > 2000 ? i : i - 1); };
document.getElementById('next').onclick = () => jump(chapterAt(t()) + 1);
document.getElementById('back').onclick = () => seek(t() - 5000);
document.getElementById('fwd').onclick = () => seek(t() + 5000);
playBtn.onclick = () => setPlaying(!playing);
scrub.oninput = () => seek(Number(scrub.value));
chips.forEach((c) => (c.onclick = () => jump(Number(c.dataset.ch))));
document.addEventListener('keydown', (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const el = e.target instanceof Element ? e.target : null;
  const k = e.key.toLowerCase();
  if (el && el.closest('input')) return;
  if (k === ' ' && el && el.closest('button')) return;
  if (k === ' ' || k === 'k') { e.preventDefault(); setPlaying(!playing); }
  else if (k === 'arrowleft') document.getElementById('prev').click();
  else if (k === 'arrowright') document.getElementById('next').click();
  else if (k === 'j') seek(t() - 5000);
  else if (k === 'l') seek(t() + 5000);
});
// Take control: lift the tape's reduced-motion freeze, then respect the preference here instead.
document.documentElement.classList.add('js-player');
anims = svg.getAnimations({ subtree: true });
tape = anims.filter((a) => Math.abs(a.effect.getTiming().duration - D) < 1);
if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setPlaying(false); jump(0); }
render();
if (playing) requestAnimationFrame(loop);
`;
}

export function renderPlayer(scenes = SCENES) {
  const tl = timeline(scenes);
  const list = chapters(scenes);
  const script = playerScript(tl, list);
  const hash = createHash('sha256').update(script).digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<title>anjali --rewind</title>
<meta name="description" content="Anjali Chaudhary's career on a VHS tape: rewind from principal engineer to a 2017 internship, one scene per chapter.">
<style>
:root{color-scheme:dark;--bg:#010409;--panel:#0D1117;--line:#30363D;--fg:#E6EDF3;--muted:#8D96A0;--accent:#3FB950}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
main{max-width:900px;margin:0 auto;padding:24px 16px 40px}
h1{font-size:15px;font-weight:700;margin:0 0 14px;color:var(--muted)}h1 b{color:var(--fg)}
#tape svg{display:block;width:100%;height:auto}
.remote{margin-top:14px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
button{font:inherit;color:var(--fg);background:#161B22;border:1px solid var(--line);border-radius:8px;min-width:44px;height:40px;padding:0 12px;cursor:pointer}
button:hover{border-color:var(--muted)}button:focus-visible,input:focus-visible{outline:2px solid #58A6FF;outline-offset:2px}
#play{min-width:56px;background:var(--accent);color:#0D1117;border-color:var(--accent);font-weight:800}
#clock{color:var(--muted);margin-left:auto;font-variant-numeric:tabular-nums}
#scrub{width:100%;margin:12px 0 4px;accent-color:var(--accent)}
#now{color:var(--fg);min-height:1.5em}
.chips{margin-top:10px}.chips button{height:32px;font-size:12px;color:var(--muted)}
.chips button[aria-current=true]{color:var(--fg);border-color:var(--accent)}
.keys,footer{color:var(--muted);font-size:12px;margin-top:10px}
a{color:#58A6FF}
</style>
</head>
<body>
<main>
<h1><b>anjali --rewind</b> · my career on one tape, newest first</h1>
<div id="tape">${renderStory(scenes)}</div>
<section class="remote" aria-label="Tape controls">
<div class="row">
<button id="prev" aria-label="Previous scene">⏮</button>
<button id="back" aria-label="Back 5 seconds">◀◀</button>
<button id="play" aria-label="Pause">❚❚</button>
<button id="fwd" aria-label="Forward 5 seconds">▶▶</button>
<button id="next" aria-label="Next scene">⏭</button>
<span id="clock">0:00 / 0:00</span>
</div>
<input id="scrub" type="range" min="0" max="${Math.round(tl.duration * 1000)}" step="100" value="0" aria-label="Position on the tape">
<div id="now" aria-live="off"></div>
<div class="row chips" role="group" aria-label="Jump to a scene">
${list.map((c, i) => `<button data-ch="${i}" aria-current="false" title="${esc(c.title)}">${esc(c.label)}</button>`).join('\n')}
</div>
<p class="keys">Keys: <b>space</b> play/pause · <b>← →</b> previous/next scene · <b>J L</b> 5 seconds back/forward</p>
</section>
<footer><a href="${PROFILE}">GitHub profile</a> · <a href="${LINKEDIN}">LinkedIn</a> · no trackers, no third-party scripts</footer>
</main>
<script>${script}</script>
</body>
</html>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mkdir('docs', { recursive: true });
  await writeFile('docs/index.html', renderPlayer());
  // Serve docs/ as-is: no Jekyll processing that could alter the page (and its CSP hash).
  await writeFile('docs/.nojekyll', '');
  console.log('wrote docs/index.html and docs/.nojekyll');
}
