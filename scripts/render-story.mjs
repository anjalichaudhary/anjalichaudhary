#!/usr/bin/env node
// Renders assets/story.svg: a terminal plays `anjali --rewind`. A VHS playhead backtracks my career
// from where I am to where I started, one scene per role, then fast-forwards back to now.
// Also renders assets/scenes/*.svg, one paused still per scene, for the README's scene selection:
// GitHub shows README images through <img>, so the tape itself can't be paused or clicked.
// Pure CSS animation: no scripts, no network, no dependencies. Edit SCENES and re-run:
//   node scripts/render-story.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Every fact is from my public LinkedIn profile. Newest first: the order the tape rewinds in.
export const SCENES = [
  {
    years: '2026–now', role: 'principal software engineer @ Great Learning', tone: 'yellow', icon: 'stairs', station: 'now',
    lines: ['Newest chapter. The LinkedIn description is still loading…', 'Six and a half years at Great Learning, and counting.'],
    pills: ['Apr 2026 – present', 'role 7 of 7'],
  },
  {
    years: '2024–26', role: 'lead software engineer @ Great Learning', tone: 'green', icon: 'mentor', station: '2024',
    lines: ['Built AI mentors that read the course, the subtitles and the assignment', 'before answering. Negative feedback: −36% across 100K+ interactions.'],
    pills: ['prompt evaluation system', 'video → structured JSON'],
  },
  {
    years: '2021–24', role: 'senior SDE @ Great Learning', tone: 'green', icon: 'mcq', station: '2021',
    lines: ['Coding labs for 5K+ learners at once. 90%+ of 3rd-party tools: retired.', 'An AI MCQ writer: 4.6K+ questions, over half accepted. Beats my drafts.'],
    pills: ['boot time −40%', 'AI code feedback × 4 languages', '200+ cohorts'],
  },
  {
    years: '2020–21', role: 'SDE @ Great Learning', tone: 'green', icon: 'speedo', station: '2020',
    lines: ['LMS load time 3.1s → 1.89s, just by loading JS and CSS on demand.', 'Plus a secure code runner, video quizzes, and a lock on internal APIs.'],
    pills: ['auto-scaling code execution', 'API security layer', 'DB caching'],
  },
  {
    years: '2019–20', role: 'SDE @ Applied AI Course', tone: 'green', icon: 'cloud', station: '2019',
    lines: ['Core backend dev, from requirements to deploy: Django, Nginx, Fargate.', 'Moved 1000s of users off Google Classroom. Evaluation: 75% faster.'],
    pills: ['Django REST', 'PostgreSQL', 'RDS + ELB'],
  },
  {
    years: '2018–19', role: 'SDE @ Goomo', tone: 'green', icon: 'truck', station: '2018',
    lines: ['Full-stack on a B2B vehicle marketplace. Redis-cached popular prices:', 'APIs ~50% faster. Vendors, drivers and buyers now talk by SMS and email.'],
    pills: ['Java', 'Angular', 'road-toll automation'],
  },
  {
    years: '2017', role: 'software engineer intern @ Goomo', tone: 'green', icon: 'bug', station: '2017',
    lines: ['Rails intern. Built a flights dashboard, then an API debugging tool,', 'so debugging APIs stopped being a manual sport.'],
    pills: ['Ruby on Rails', 'backend + frontend'],
  },
];

export const FINALE = {
  years: 'now', role: 'rewind complete', tone: 'blue', icon: 'cassette',
  lines: ['7 roles · 3 companies · 2017 → now, all on one tape.', 'Be kind, rewind. Or say hi on LinkedIn.'],
  pills: ['linkedin.com/in/anjali-chaudhary'],
};

const COMMAND = 'anjali --rewind';
const FF_TEXT = '▶▶ fast-forwarding back to now…';

const C = {
  bg: '#0D1117', card: '#161B22', border: '#30363D', fg: '#E6EDF3', muted: '#8D96A0', dim: '#484F58',
  prompt: '#3FB950', green: '#3FB950', yellow: '#D29922', blue: '#58A6FF', red: '#F85149',
};

// Layout, in px. Character widths are for a 0.6em monospace font at each size.
export const W = 860, TEXT_X = 200, CARD_RIGHT = 816;
export const CHAR = { cmd: 7.83, role: 9.63, line: 8.43, pill: 7.22, year: 16.86 };
const H = 332, X = 24, CARD_Y = 80, CARD_H = 168, TRACK_Y = 288;
const PROMPT = 'anjali@profile:~$ ';

// Timing, in seconds. Each scene stays up long enough to read both lines and the pills.
const TYPE_AT = 0.3, TYPE_S = 0.07, SCENE_S = 7, MOVE_S = 0.6, FF_S = 2.2, FINALE_S = 8, FADE_S = 0.6;

// The dot hops up one step per role, then rests at the top.
const CLIMB = `@keyframes climb{${Array.from({ length: 7 }, (_, i) => `${i * 12}%,${i * 12 + 6}%{transform:translate(${i * 14}px,${-i * 12}px)}`).join('')}100%{transform:translate(84px,-72px)}}`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const r2 = (n) => Math.round(n * 100) / 100;

export function timeline(scenes = SCENES) {
  const rewindAt = r2(TYPE_AT + COMMAND.length * TYPE_S + 0.5);
  const sceneAt = scenes.map((_, k) => r2(rewindAt + k * SCENE_S));
  const ffAt = r2(rewindAt + scenes.length * SCENE_S);
  const finaleAt = r2(ffAt + FF_S);
  return { rewindAt, sceneAt, ffAt, finaleAt, duration: r2(finaleAt + FINALE_S + FADE_S) };
}

// Stations run left to right in time, oldest first.
function stations(scenes) {
  const labels = [...scenes].reverse().map((s) => s.station);
  const step = 680 / (labels.length - 1);
  return labels.map((label, i) => ({ label, x: r2(90 + i * step) }));
}

function keyframes(name, D, points) {
  const byPct = new Map();
  for (const [s, decl, ease] of points) {
    byPct.set(r2(Math.min(100, Math.max(0, (s / D) * 100))), ease ? `${decl};animation-timing-function:${ease}` : decl);
  }
  return `@keyframes ${name}{${[...byPct].sort((a, b) => a[0] - b[0]).map(([p, d]) => `${p}%{${d}}`).join('')}}`;
}

// Visible during each [start, end] window, hidden otherwise.
function windows(D, spans, { hide = 'opacity:0', show = 'opacity:1', fade = 0.3 } = {}) {
  const pts = [[0, hide]];
  for (const [start, end] of spans) pts.push([start, hide], [start + fade, show], [end - fade, show], [end, hide]);
  pts.push([D, hide]);
  return pts;
}

const reel = (cx, cy, r, color) =>
  `<g class="i spin"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5"/>${[0, 120, 240]
    .map((a) => `<line x1="${cx}" y1="${cy}" x2="${r2(cx + (r - 2) * Math.cos((a * Math.PI) / 180))}" y2="${r2(cy + (r - 2) * Math.sin((a * Math.PI) / 180))}" stroke="${color}" stroke-width="2.5"/>`)
    .join('')}</g>`;

// Each icon draws in a 112×112 box.
const ICONS = {
  stairs: (t) => `
    <path d="M4 108${Array.from({ length: 7 }, () => 'h14v-12').join('')}" fill="none" stroke="${C.fg}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M102 24V2" stroke="${C.fg}" stroke-width="3"/><path class="i wave" d="M102 2h-20l6 6-6 6h20z" fill="${t}"/>
    <circle class="i climb" cx="11" cy="90" r="6" fill="${t}"/>`,
  mentor: (t) => `
    <rect x="2" y="14" width="32" height="22" rx="4" fill="none" stroke="${C.fg}" stroke-width="2.5"/><path d="M14 19v12l10-6z" fill="${t}"/>
    <rect x="2" y="45" width="32" height="22" rx="4" fill="none" stroke="${C.fg}" stroke-width="2.5"/><text x="18" y="60" text-anchor="middle" font-size="10px" font-weight="800" fill="${C.fg}">CC</text>
    <rect x="2" y="76" width="32" height="22" rx="4" fill="none" stroke="${C.fg}" stroke-width="2.5"/><path d="M9 83h18M9 88h18M9 93h10" stroke="${C.muted}" stroke-width="2"/>
    ${[25, 56, 87].map((y, i) => `<circle class="i flow d${i + 1}" cx="40" cy="${y}" r="3" fill="${t}"/>`).join('')}
    <rect x="62" y="38" width="48" height="34" rx="10" fill="none" stroke="${C.fg}" stroke-width="2.5"/><path d="M96 72l6 9-14-9" fill="${C.fg}"/>
    <circle class="i dot" cx="75" cy="55" r="3.5" fill="${t}"/><circle class="i dot d2" cx="86" cy="55" r="3.5" fill="${t}"/><circle class="i dot d3" cx="97" cy="55" r="3.5" fill="${t}"/>`,
  mcq: (t) => [18, 46, 74].map((y, i) => `
    <rect x="18" y="${y}" width="20" height="20" rx="4" fill="none" stroke="${C.fg}" stroke-width="2.5"/>
    <path d="M48 ${y + 7}h44M48 ${y + 15}h28" stroke="${C.muted}" stroke-width="3" stroke-linecap="round"/>
    ${i < 2
      ? `<path class="i draw d${i + 1}" d="M22 ${y + 10}l5 5 9-10" fill="none" stroke="${t}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path class="i draw d3" d="M23 ${y + 5}l10 10M33 ${y + 5}l-10 10" fill="none" stroke="${C.red}" stroke-width="3.5" stroke-linecap="round"/>`}`).join(''),
  speedo: (t) => `
    <path d="M16 80a40 40 0 0 1 80 0" fill="none" stroke="${C.dim}" stroke-width="8" stroke-linecap="round"/>
    <path d="M16 80a40 40 0 0 1 40-40" fill="none" stroke="${C.red}" stroke-width="8" stroke-linecap="round" opacity=".7"/>
    <path d="M56 40a40 40 0 0 1 40 40" fill="none" stroke="${t}" stroke-width="8" stroke-linecap="round"/>
    <rect class="i needle" x="54.5" y="46" width="3" height="34" rx="1.5" fill="${C.fg}"/><circle cx="56" cy="80" r="6" fill="${C.fg}"/>
    <text x="14" y="102" font-size="11px" fill="${C.muted}">3.1s</text><text x="98" y="102" font-size="11px" fill="${t}" text-anchor="end">1.89s</text>`,
  cloud: (t) => `
    <path d="M30 58a16 16 0 0 1 6-31 22 22 0 0 1 41 3 15 15 0 0 1 5 28z" fill="none" stroke="${C.fg}" stroke-width="3" stroke-linejoin="round"/>
    ${[36, 56, 76].map((x, i) => `<g class="i up d${i + 1}"><circle cx="${x}" cy="84" r="5" fill="${t}"/><path d="M${x - 7} 100a7 7 0 0 1 14 0" fill="${t}"/></g>`).join('')}`,
  truck: (t) => `
    <path class="i zap" d="M60 6l-12 22h10l-6 18 16-24H58z" fill="${C.yellow}"/>
    <g class="i drive"><rect x="14" y="50" width="56" height="34" rx="4" fill="none" stroke="${C.fg}" stroke-width="3"/>
    <path d="M70 60h16l12 12v12H70z" fill="none" stroke="${C.fg}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="32" cy="90" r="8" fill="${C.card}" stroke="${t}" stroke-width="3"/><circle cx="84" cy="90" r="8" fill="${C.card}" stroke="${t}" stroke-width="3"/>
    <text x="42" y="71" text-anchor="middle" font-size="10px" fill="${t}" font-weight="700">cached</text></g>
    <path class="i speed" d="M0 58h8M-4 68h8M0 78h8" stroke="${C.muted}" stroke-width="2.5" stroke-linecap="round"/>`,
  bug: (t) => `
    <g class="i wiggle"><path d="M38 52l-12-6M38 64H24M38 76l-12 6M74 52l12-6M74 64h14M74 76l12 6" stroke="${C.fg}" stroke-width="3" stroke-linecap="round"/></g>
    <ellipse cx="56" cy="66" rx="18" ry="24" fill="${C.card}" stroke="${C.fg}" stroke-width="3"/><path d="M56 44v46" stroke="${C.fg}" stroke-width="2"/>
    <circle cx="56" cy="38" r="9" fill="${C.card}" stroke="${C.fg}" stroke-width="3"/>
    <g class="i scan"><circle cx="78" cy="30" r="16" fill="${t}" fill-opacity=".15" stroke="${t}" stroke-width="3.5"/><path d="M90 42l14 14" stroke="${t}" stroke-width="5" stroke-linecap="round"/></g>`,
  cassette: (t) => `
    <rect x="6" y="24" width="100" height="66" rx="8" fill="${C.card}" stroke="${C.fg}" stroke-width="3"/>
    <rect x="12" y="32" width="88" height="16" rx="3" fill="${t}"/><text x="56" y="43.5" text-anchor="middle" font-size="8.5px" font-weight="800" fill="${C.bg}">BE KIND REWIND</text>
    <rect x="28" y="56" width="56" height="22" rx="11" fill="none" stroke="${C.muted}" stroke-width="2"/>
    ${reel(40, 67, 8, C.fg)}${reel(72, 67, 8, C.fg)}<path d="M30 90l6-8h40l6 8" fill="none" stroke="${C.fg}" stroke-width="2.5"/>`,
};

function sceneCard(scene, name, D, span, isStatic) {
  const t = C[scene.tone];
  let pillX = TEXT_X;
  const pills = scene.pills.map((p) => {
    const w = r2([...p].length * CHAR.pill + 20);
    const svg = `<rect x="${r2(pillX)}" y="200" width="${w}" height="22" rx="11" fill="${t}" fill-opacity=".14" stroke="${t}" stroke-opacity=".5"/><text x="${r2(pillX + w / 2)}" y="215" text-anchor="middle" font-size="12px" fill="${t}">${esc(p)}</text>`;
    pillX += w + 8;
    return svg;
  });
  // A null name draws the card without animation hooks, for the stills.
  const css = name && keyframes(name, D, windows(D, [span], { hide: 'opacity:0;transform:translateY(8px)', show: 'opacity:1;transform:translateY(0)' }));
  const svg = `<g${name ? ` class="a" style="animation-name:${name}"` : ''} opacity="${isStatic ? 1 : 0}">
<circle cx="108" cy="176" r="58" fill="${t}" fill-opacity=".1"/>
<g transform="translate(52 120)">${ICONS[scene.icon](t)}</g>
<text x="${TEXT_X}" y="122" font-size="16px" font-weight="700" fill="${C.fg}">${esc(scene.role)}</text>
<text x="${CARD_RIGHT}" y="124" text-anchor="end" font-size="28px" font-weight="800" fill="${t}">${esc(scene.years)}</text>
${scene.lines.map((l, j) => `<text x="${TEXT_X}" y="${156 + j * 22}" font-size="14px" fill="${C.fg}">${esc(l)}</text>`).join('\n')}
${pills.join('')}
</g>`;
  return { css, svg };
}

const PLAYHEAD = `<path d="M-7 ${TRACK_Y - 20}h14l-7 9z" fill="${C.fg}"/><line x1="0" x2="0" y1="${TRACK_Y - 11}" y2="${TRACK_Y + 10}" stroke="${C.fg}" stroke-width="1.5" opacity=".7"/>`;

// Window frame and prompt line; leaves the screen clip group open for the caller to close.
function chrome(command) {
  return `<defs><clipPath id="screen"><rect x="1" y="36" width="${W - 2}" height="${H - 37}" rx="9"/></clipPath>
<clipPath id="cardclip"><rect x="${X}" y="${CARD_Y}" width="${W - 2 * X}" height="${CARD_H}" rx="10"/></clipPath></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
<path d="M0.5 36V10.5a10 10 0 0 1 10-10h${W - 21}a10 10 0 0 1 10 10V36z" fill="${C.card}"/>
<circle cx="20" cy="18" r="6" fill="#FF5F57"/><circle cx="40" cy="18" r="6" fill="#FEBC2E"/><circle cx="60" cy="18" r="6" fill="#28C840"/>
<text x="${W / 2}" y="22" text-anchor="middle" fill="${C.muted}" font-size="12px">anjali — career.vhs — zsh</text>
<g clip-path="url(#screen)">
<text x="${X}" y="62" font-size="13px"><tspan fill="${C.prompt}">${esc(PROMPT)}</tspan><tspan fill="${C.fg}">${esc(command)}</tspan></text>`;
}

function track(st, lit) {
  return `<line x1="${st[0].x}" x2="${st.at(-1).x}" y1="${TRACK_Y}" y2="${TRACK_Y}" stroke="${C.border}" stroke-width="3"/>
${st.map(({ x }) => `<circle cx="${x}" cy="${TRACK_Y}" r="5" fill="${C.border}"/>`).join('')}
${lit}
${st.map(({ label, x }) => `<text x="${x}" y="${TRACK_Y + 26}" text-anchor="middle" font-size="11px" fill="${C.muted}">${esc(label)}</text>`).join('')}`;
}

// Stills: every scene paused, for readers who want to stop and read. Index SCENES.length is the finale.
export const STILL_COUNT = SCENES.length + 1;
export const stillFile = (i, scenes = SCENES) => `assets/scenes/${String(i + 1).padStart(2, '0')}-${i < scenes.length ? scenes[i].station : 'rewind-complete'}.svg`;

export function renderStill(i, scenes = SCENES) {
  const scene = i < scenes.length ? scenes[i] : FINALE;
  const st = stations(scenes);
  const at = i < scenes.length ? st.find((s) => s.label === scene.station) : st.at(-1);
  const lit = (i < scenes.length ? [at] : st)
    .map(({ label, x }) => `<circle cx="${x}" cy="${TRACK_Y}" r="7" fill="${C[scenes.find((s) => s.station === label).tone]}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
<title id="title">${esc(`${scene.years} · ${scene.role}. ${scene.lines.join(' ')}`)}</title>
<style>
text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}
.i{transform-box:fill-box;transform-origin:center}.needle{transform-origin:50% 100%;transform:rotate(55deg)}.climb{transform:translate(84px,-72px)}
</style>
${chrome(`${COMMAND} --scene ${i + 1}`)}
<text x="${W - X}" y="62" text-anchor="end" font-size="13px" font-weight="800" fill="${C.fg}" letter-spacing="1">❚❚ PAUSED · ${i + 1}/${scenes.length + 1}</text>
<rect x="${X}" y="${CARD_Y}" width="${W - 2 * X}" height="${CARD_H}" rx="10" fill="${C.card}" stroke="${C.border}"/>
<g clip-path="url(#cardclip)">${sceneCard(scene, null, 1, [0, 1], true).svg}</g>
${track(st, lit)}
<g transform="translate(${at.x} 0)">${PLAYHEAD}</g>
</g>
</svg>
`;
}

// The README's scene selection: one collapsible chapter per still.
export function sceneMenu(scenes = SCENES) {
  return Array.from({ length: scenes.length + 1 }, (_, i) => {
    const s = i < scenes.length ? scenes[i] : FINALE;
    const alt = `${s.years} · ${s.role}. ${s.lines.join(' ')} ${s.pills.join(' · ')}`;
    return `<details>\n<summary><b>${esc(s.years)}</b> · ${esc(s.role)}</summary>\n<br/>\n<img alt="${esc(alt)}" src="${stillFile(i, scenes)}" width="860">\n</details>`;
  }).join('\n');
}

// The story as plain text: the SVG's accessible description and the README's text version.
export function transcript(scenes = SCENES) {
  const block = (mark, s) => [`${mark} ${s.years} · ${s.role}`, ...s.lines.map((l) => `   ${l}`), `   ${s.pills.map((p) => `[${p}]`).join(' ')}`].join('\n');
  return [`$ ${COMMAND}`, ...scenes.map((s) => block('◀◀', s)), FF_TEXT, block('▶ ', FINALE)].join('\n');
}

export function renderStory(scenes = SCENES) {
  const tl = timeline(scenes);
  const D = tl.duration;
  const st = stations(scenes);
  const xOf = (label) => st.find((s) => s.label === label).x;
  const now = xOf(scenes[0].station);
  const css = [];
  const cards = [];

  scenes.forEach((scene, k) => {
    const { css: c, svg } = sceneCard(scene, `s${k}`, D, [tl.sceneAt[k], tl.sceneAt[k] + SCENE_S], k === 0);
    css.push(c);
    cards.push(svg);
  });
  const finale = sceneCard(FINALE, 'fin', D, [tl.finaleAt, D], false);
  css.push(finale.css);
  cards.push(finale.svg);

  css.push(keyframes('ff', D, windows(D, [[tl.ffAt, tl.finaleAt]])));
  const ffCard = `<g class="a" style="animation-name:ff" opacity="0"><text x="${W / 2}" y="170" text-anchor="middle" font-size="22px" font-weight="700" fill="${C.fg}">${esc(FF_TEXT)}</text><text x="${W / 2}" y="198" text-anchor="middle" font-size="13px" fill="${C.muted}">2017 → 2026</text></g>`;

  // The playhead holds on each station, glides back to the one before, then zips forward to now.
  const tx = (x) => `transform:translateX(${x}px)`;
  const ph = [[0, tx(now)]];
  scenes.forEach((scene, k) => {
    if (k > 0) ph.push([tl.sceneAt[k] - MOVE_S, tx(xOf(scenes[k - 1].station)), 'ease-in-out'], [tl.sceneAt[k], tx(xOf(scene.station))]);
  });
  ph.push([tl.ffAt, tx(xOf(scenes.at(-1).station)), 'cubic-bezier(.6,0,.2,1)'], [tl.finaleAt, tx(now)], [D, tx(now)]);
  css.push(keyframes('ph', D, ph));

  // Cassette reels spin backwards while rewinding and forwards on the fast-forward.
  css.push(keyframes('reels', D, [
    [0, 'transform:rotate(0)'], [tl.rewindAt, 'transform:rotate(0)'], [tl.ffAt, 'transform:rotate(-4320deg)'],
    [tl.finaleAt, 'transform:rotate(-2160deg)'], [D, 'transform:rotate(-2160deg)'],
  ]));

  // Each station lights while the playhead sits on it, then again, for good, on the fast-forward.
  const lit = st.map(({ label, x }, c) => {
    const k = scenes.findIndex((s) => s.station === label);
    const litAgain = tl.ffAt + FF_S * (c / (st.length - 1));
    css.push(keyframes(`st${c}`, D, windows(D, [[tl.sceneAt[k], tl.sceneAt[k] + SCENE_S], [litAgain, D - FADE_S + 0.3]], { fade: 0.15 })));
    return `<circle class="a" style="animation-name:st${c}" cx="${x}" cy="${TRACK_Y}" r="7" fill="${C[scenes[k].tone]}" opacity="1"/>`;
  });

  const osd = [
    ['rw', [tl.rewindAt, tl.ffAt], '◀◀ REWIND', 'blinkosd'],
    ['fw', [tl.ffAt, tl.finaleAt], '▶▶ FF', ''],
    ['pl', [tl.finaleAt, D - FADE_S + 0.3], '▶ PLAY', ''],
  ].map(([name, span, label, extra]) => {
    css.push(keyframes(name, D, windows(D, [span])));
    return `<g class="a" style="animation-name:${name}" opacity="0"><text class="${extra}" x="${W - X}" y="62" text-anchor="end" font-size="13px" font-weight="800" fill="${C.fg}" letter-spacing="1">${label}</text></g>`;
  });
  css.push(keyframes('vw', D, windows(D, [[tl.rewindAt, tl.finaleAt]])));

  const cmdX = X + PROMPT.length * CHAR.cmd;
  const coverW = r2(COMMAND.length * CHAR.cmd + 4);
  const typedAt = TYPE_AT + COMMAND.length * TYPE_S;
  css.push(keyframes('type', D, [
    [0, 'transform:translateX(0)'], [TYPE_AT, 'transform:translateX(0)', `steps(${COMMAND.length},end)`],
    [typedAt, `transform:translateX(${coverW}px)`], [D - FADE_S, `transform:translateX(${coverW}px)`], [D, 'transform:translateX(0)'],
  ]));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title desc">
<title id="title">anjali --rewind: my career, backtracked from now to where I started in 2017</title>
<desc id="desc">${esc(transcript(scenes))}</desc>
<style>
text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}
.a{animation-duration:${D}s;animation-iteration-count:infinite;animation-fill-mode:both;animation-timing-function:linear}
.i{transform-box:fill-box;transform-origin:center}
.d2{animation-delay:.2s!important}.d3{animation-delay:.4s!important}
.climb{animation:climb 2.9s ease-in-out infinite}
${CLIMB}
.flow{animation:flow 1.2s ease-in infinite}@keyframes flow{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(22px,0);opacity:0}}
.flow.d1{animation-delay:0s!important}.flow.d2{animation-delay:.4s!important}.flow.d3{animation-delay:.8s!important}
.wave{transform-origin:100% 50%;animation:wave 1.2s ease-in-out infinite}@keyframes wave{50%{transform:scaleX(.8)}}
.bob{animation:bob 1.6s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-3px)}}
.dot{animation:dot 1.2s infinite}@keyframes dot{0%,60%,100%{opacity:.25}30%{opacity:1}}
.draw{stroke-dasharray:26;animation:draw 2.4s ease-out infinite}@keyframes draw{0%,10%{stroke-dashoffset:26}40%,100%{stroke-dashoffset:0}}
.draw.d2{animation-delay:.5s!important}.draw.d3{animation-delay:.9s!important}
.needle{transform-origin:50% 100%;animation:needle 2.6s ease-in-out infinite}@keyframes needle{0%,15%{transform:rotate(-65deg)}55%,90%{transform:rotate(55deg)}100%{transform:rotate(-65deg)}}
.up{animation:up 1.8s ease-out infinite}.up.d2{animation-delay:.6s!important}.up.d3{animation-delay:1.2s!important}
@keyframes up{0%{transform:translateY(10px);opacity:0}30%{opacity:1}100%{transform:translateY(-34px);opacity:0}}
.drive{animation:drive 1.8s ease-in-out infinite}@keyframes drive{50%{transform:translateX(8px)}}
.speed{animation:speed .6s linear infinite}@keyframes speed{from{transform:translateX(6px);opacity:1}to{transform:translateX(-6px);opacity:0}}
.zap{animation:zap 1s steps(1) infinite}@keyframes zap{50%{opacity:.35}}
.wiggle{animation:wiggle .35s ease-in-out infinite alternate}@keyframes wiggle{to{transform:rotate(6deg)}}
.scan{animation:scan 3s ease-in-out infinite}@keyframes scan{25%{transform:translate(-20px,16px)}50%{transform:translate(-40px,6px)}75%{transform:translate(-18px,30px)}}
.spin{animation:spin 2s linear infinite}@keyframes spin{to{transform:rotate(-360deg)}}
.blinkosd{animation:blinkosd 1s steps(1) infinite}@keyframes blinkosd{50%{opacity:0}}
.vhs{animation:vhs 1.1s linear infinite}@keyframes vhs{from{transform:translateY(0)}to{transform:translateY(${CARD_H - 8}px)}}
.reels .spin{animation:none}
${css.join('\n')}
@media (prefers-reduced-motion:reduce){.a,.i,.vhs,.blinkosd{animation:none!important}.cover,.vhs-wrap{display:none}}
</style>
${chrome(COMMAND)}
<rect class="a cover" style="animation-name:type" x="${r2(cmdX - 1)}" y="48" width="${coverW}" height="20" fill="${C.bg}"/>
<g class="reels">${[690, 714].map((cx) => `<g class="a" style="animation-name:reels;transform-box:fill-box;transform-origin:center">${reel(cx, 57, 8, C.muted)}</g>`).join('')}</g>
${osd.join('\n')}
<rect x="${X}" y="${CARD_Y}" width="${W - 2 * X}" height="${CARD_H}" rx="10" fill="${C.card}" stroke="${C.border}"/>
<g clip-path="url(#cardclip)">
${cards.join('\n')}
${ffCard}
<g class="a vhs-wrap" style="animation-name:vw" opacity="0"><rect class="vhs" x="${X}" y="${CARD_Y}" width="${W - 2 * X}" height="6" fill="${C.fg}" opacity=".045"/></g>
</g>
${track(st, lit.join('\n'))}
<g class="a" style="animation-name:ph" transform="translate(${now} 0)">${PLAYHEAD}</g>
</g>
</svg>
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await mkdir('assets/scenes', { recursive: true });
  await writeFile('assets/story.svg', renderStory());
  for (let i = 0; i < STILL_COUNT; i++) await writeFile(stillFile(i), renderStill(i));
  console.log(`wrote assets/story.svg (${timeline().duration}s loop) and ${STILL_COUNT} stills in assets/scenes/`);
}
