#!/usr/bin/env node
// Renders assets/story.svg: a terminal plays `anjali --rewind`. A VHS playhead backtracks my career
// from where I am to where I started, one animated scene per chapter, then fast-forwards back to now.
// Also renders assets/scenes/*.svg, one paused still per scene, for the README's scene selection:
// GitHub shows README images through <img>, so the tape itself can't be paused or clicked.
// Pure CSS animation: no scripts, no network, no dependencies. Edit SCENES and re-run:
//   node scripts/render-story.mjs
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Newest first: the order the tape rewinds in. Career facts are from my public LinkedIn profile.
// From me directly: the agentic mentor's two sides, and the AI teacher (a separate project from the
// LinkedIn AI Mentors) running from my lead role to now. Stage dialogue and drawings are illustrative jokes.
export const SCENES = [
  {
    years: '2026–now', company: 'Great Learning', role: 'principal software engineer', title: 'the agentic mentor',
    chip: 'mentor', station: 'now', tone: 'yellow', art: 'mentor',
    lines: ['Building an agentic mentor with two sides: an academic', 'side for doubts, a program-office side for deadlines', 'and admin. One mentor, two hats.'],
    pills: ['agentic AI', 'academic', 'program office'],
  },
  {
    // TODO(anjali): replace these lines with what the AI teacher does, in your words.
    years: '2024–now', company: 'Great Learning', role: 'lead → principal software engineer', title: 'the AI teacher',
    chip: 'AI teacher', station: 'now', tone: 'yellow', art: 'teacher',
    lines: ['The AI teacher, built across my lead and principal years.', 'Its board work is better than mine ever was.'],
    pills: ['AI teacher', 'lead → principal'],
  },
  {
    years: '2024–26', company: 'Great Learning', role: 'lead software engineer', title: 'the course-aware mentor',
    chip: 'AI mentors', station: '2024', tone: 'green', art: 'coursementor',
    lines: ['Spearheaded course-level, context-aware AI mentors that', 'read the course, video subtitles and assignment metadata.', 'Negative learner feedback: −36% across 100K+ interactions.'],
    pills: ['AI mentors', 'context-aware', 'personalized learning'],
  },
  {
    years: '2024–26', company: 'Great Learning', role: 'lead software engineer', title: 'the prompt exam hall',
    chip: 'prompt lab', station: '2024', tone: 'green', art: 'promptlab',
    lines: ['Built a prompt evaluation system, so prompts get tested', 'safely and iteratively, like code. And a video pipeline:', 'subtitles → structured JSON summaries, via Elasticsearch.'],
    pills: ['prompt evaluation system', 'video summarization', 'Elasticsearch'],
  },
  {
    years: '2021–24', company: 'Great Learning', role: 'senior software development engineer', title: 'coding labs in the cloud',
    chip: 'coding labs', station: '2021', tone: 'green', art: 'labs',
    lines: ['Put coding labs in the cloud: Jupyter and PySpark on', 'AWS ECS, Fargate and EFS, for 5K+ learners at once.', 'Boot time −40%. The labs even clean up after themselves.'],
    pills: ['5K+ concurrent', '90%+ 3rd-party assessment tools replaced'],
  },
  {
    years: '2021–24', company: 'Great Learning', role: 'senior software development engineer', title: 'the MCQ-o-matic',
    chip: 'MCQ bot', station: '2021', tone: 'green', art: 'mcq',
    lines: ['Built an AI MCQ generator: 4.6K+ questions, over half', 'accepted, and mentors serving 200+ cohorts. Plus live AI', 'code feedback in Python, JavaScript, SQL and Java.'],
    pills: ['assignment + content mentors', 'assessment pipelines modernized'],
  },
  {
    years: '2020–21', company: 'Great Learning', role: 'software development engineer', title: 'the LMS speed run',
    chip: 'speed run', station: '2020', tone: 'green', art: 'speed',
    lines: ['Got the LMS loading in 1.89s instead of 3.1s: JS and', 'CSS now arrive only when they are actually needed.', 'Also: video quizzes and a secure code runner.'],
    pills: ['auth + API security', 'DB caching', 'auto-scaling code execution'],
  },
  {
    years: '2019–20', company: 'Applied AI Course', role: 'software development engineer', title: 'the great migration',
    chip: 'migration', station: '2019', tone: 'green', art: 'migration',
    lines: ['Core backend dev, requirements to deploy: Django REST,', 'Postgres, Nginx, AWS Fargate. Migrated data for 1000s of', 'users from Google Classroom. Evaluation response: −75%.'],
    pills: ['Docker', 'RDS + load balancer'],
  },
  {
    years: '2018–19', company: 'Goomo', role: 'software development engineer', title: 'vehicles, tolls & texts',
    chip: 'vehicles', station: '2018', tone: 'green', art: 'vehicles',
    lines: ['Full-stack Java + Angular, B2B vehicle marketplace. Popular', 'trip prices pre-computed in Redis: APIs ~50% faster. Toll', 'data automated. SMS + email between vendor, driver, buyer.'],
    pills: ['Java', 'Angular', 'Redis'],
  },
  {
    years: '2017', company: 'Goomo', role: 'software engineer intern', title: 'bug hunt, level 1',
    chip: 'bug hunt', station: '2017', tone: 'green', art: 'bughunt',
    lines: ['Rails intern. Built a flights dashboard, back and front,', 'and an API debugging tool that streamlined API debugging.', 'Level 1: cleared.'],
    pills: ['Ruby on Rails', 'flights dashboard', 'API debugger'],
  },
];

export const FINALE = {
  years: 'now', company: '', role: 'rewind complete', title: 'thanks for watching',
  chip: 'end', tone: 'blue', art: 'cassette',
  lines: ['7 roles · 3 companies · 2017 → now, all on one tape.', 'Be kind, rewind. Or say hi on LinkedIn.'],
  pills: ['linkedin.com/in/anjali-chaudhary'],
};

const COMMAND = 'anjali --rewind';
export const FF_TEXT = '▶▶ fast-forwarding back to now…';

const C = {
  bg: '#0D1117', card: '#161B22', border: '#30363D', fg: '#E6EDF3', muted: '#8D96A0', dim: '#484F58',
  prompt: '#3FB950', green: '#3FB950', yellow: '#D29922', blue: '#58A6FF', red: '#F85149',
};

// Layout, in px. Character widths are for a 0.6em monospace font at each size.
export const W = 860, TEXT_X = 340, CARD_RIGHT = 816;
export const CHAR = { cmd: 7.83, year: 13.24, company: 7.22, role: 9.03, line: 7.83, pill: 6.62 };
const H = 336, X = 24, CARD_Y = 80, CARD_H = 172, TRACK_Y = 292;
const STAGE = { x: 36, y: 92, w: 288, h: 152 };
const PROMPT = 'anjali@profile:~$ ';
// The command is placed at a fixed x, so the typing cover lines up whatever the font's width.
const CMD_X = X + PROMPT.length * CHAR.cmd;

// Timing, in seconds. Each scene stays up long enough to watch the stage and read the text.
const TYPE_AT = 0.3, TYPE_S = 0.07, SCENE_S = 8, MOVE_S = 0.6, FF_S = 2.2, FINALE_S = 8, FADE_S = 0.6;

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const r2 = (n) => Math.round(n * 100) / 100;

export function timeline(scenes = SCENES) {
  const rewindAt = r2(TYPE_AT + COMMAND.length * TYPE_S + 0.5);
  const sceneAt = scenes.map((_, k) => r2(rewindAt + k * SCENE_S));
  const ffAt = r2(rewindAt + scenes.length * SCENE_S);
  const finaleAt = r2(ffAt + FF_S);
  return { rewindAt, sceneAt, ffAt, finaleAt, finaleEnd: r2(finaleAt + FINALE_S), duration: r2(finaleAt + FINALE_S + FADE_S) };
}

// Stations run left to right in time, oldest first; scenes from the same era share one.
function stations(scenes) {
  const labels = [...new Set([...scenes].reverse().map((s) => s.station))];
  if (labels.length === 1) return [{ label: labels[0], x: 430 }];
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

// Choreography for one scene's stage. Times are seconds from the scene's start, run on the tape's
// clock, so the player can pause and scrub them. With no css (the stills) every helper returns no
// animation and elements keep their drawn, final state; `flash` elements that only appear briefly
// are hidden in a still unless `still` is set.
function motion(css, D, name, start) {
  let n = 0;
  const b = (points, origin) => {
    if (!css) return '';
    const id = `${name}_${n++}`;
    css.push(keyframes(id, D, [[0, points[0][1]], ...points.map(([s, d, e]) => [start + s, d, e]), [D, points.at(-1)[1]]]));
    return ` class="a" style="animation-name:${id}${origin ? `;transform-box:fill-box;transform-origin:${origin}` : ''}"`;
  };
  const O = (v) => `opacity:${v}`;
  const at = (dx, dy) => `transform:translate(${dx}px,${dy}px)`;
  return {
    raw: b,
    show: (a, d = 0.35) => b([[0, O(0)], [a, O(0)], [a + d, O(1)]]),
    flash: (a, z, still = false) => `${b([[0, O(0)], [a, O(0)], [a + 0.3, O(1)], [z, O(1)], [z + 0.3, O(0)]])} opacity="${still ? 1 : 0}"`,
    pop: (a) => b([[0, `${O(0)};transform:scale(.3)`], [a, `${O(0)};transform:scale(.3)`, 'cubic-bezier(.3,1.7,.5,1)'], [a + 0.45, `${O(1)};transform:scale(1)`]], 'center'),
    // Solid within 0.2s, then travels the rest of the way.
    enter: (a, d, dx, dy, ease = 'ease-out') => {
      const f = Math.min(0.2, d / 3), k = 1 - f / d;
      return b([[0, `${O(0)};${at(dx, dy)}`], [a, `${O(0)};${at(dx, dy)}`], [a + f, `${O(1)};${at(r2(dx * k), r2(dy * k))}`, ease], [a + d, `${O(1)};${at(0, 0)}`]]);
    },
    leave: (a, d, dx, dy) => b([[0, `${O(1)};${at(0, 0)}`], [a, `${O(1)};${at(0, 0)}`, 'ease-in'], [a + d, `${O(0)};${at(dx, dy)}`]]),
    hop: (a, d, dx, dy) => `${b([[0, `${O(0)};${at(dx, dy)}`], [a, `${O(0)};${at(dx, dy)}`], [a + 0.08, `${O(1)};${at(dx, dy)}`, 'ease-in-out'], [a + d, `${O(1)};${at(0, 0)}`], [a + d + 0.12, `${O(0)};${at(0, 0)}`]])} opacity="0"`,
    shrink: (a, d, from) => b([[0, `transform:scaleX(${from})`], [a, `transform:scaleX(${from})`, 'ease-in-out'], [a + d, 'transform:scaleX(1)']], '0% 50%'),
    lift: (a, z, deg) => b([[0, 'transform:rotate(0)'], [a, 'transform:rotate(0)', 'ease-out'], [a + 0.4, `transform:rotate(${deg}deg)`], [z, `transform:rotate(${deg}deg)`, 'ease-in'], [z + 0.4, 'transform:rotate(0)']], '0% 50%'),
    spin: (a, d, deg) => b([[0, 'transform:rotate(0)'], [a, 'transform:rotate(0)', 'ease-out'], [a + d, `transform:rotate(${deg}deg)`]], '50% 100%'),
  };
}

const T = (x, y, s, { size = 10, fill = C.fg, anchor, weight, a = '' } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}px" fill="${fill}"${anchor ? ` text-anchor="${anchor}"` : ''}${weight ? ` font-weight="${weight}"` : ''}${a}>${esc(s)}</text>`;

const bubble = (x, y, s, { fill = C.fg, color = C.bg, size = 9.5, a = '' } = {}) => {
  const w = r2([...s].length * size * 0.6 + 12), h = r2(size + 9);
  return `<g${a}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r2(h / 2)}" fill="${fill}"/>${T(r2(x + w / 2), r2(y + h - 5.5), s, { size, fill: color, anchor: 'middle', weight: 700 })}</g>`;
};

const person = (x, y) =>
  `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${C.fg}" stroke-width="2.5"/><path d="M${x - 12} ${y + 26}a12 12 0 0 1 24 0" fill="none" stroke="${C.fg}" stroke-width="2.5"/>`;

const reel = (cx, cy, r, color) =>
  `<g class="i spin"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="2.5"/>${[0, 120, 240]
    .map((a) => `<line x1="${cx}" y1="${cy}" x2="${r2(cx + (r - 2) * Math.cos((a * Math.PI) / 180))}" y2="${r2(cy + (r - 2) * Math.sin((a * Math.PI) / 180))}" stroke="${color}" stroke-width="2.5"/>`)
    .join('')}</g>`;

// One little world per chapter, drawn in a 288×152 stage. `t` is the scene's tone, `m` its motion.
const STAGES = {
  // One mentor, two sides: the side that fits the question lights up and answers.
  mentor: (t, m) => `
${person(24, 82)}${T(24, 124, 'learner', { size: 9, fill: C.muted, anchor: 'middle' })}
${T(197, 56, 'one AI mentor', { size: 9, fill: C.muted, anchor: 'middle' })}
<rect x="112" y="62" width="170" height="34" rx="8" fill="${C.card}" stroke="${t}" stroke-width="2.5"/>
<path d="M188 66v26" stroke="${C.dim}" stroke-width="1.5"/>
<rect x="114" y="64" width="72" height="30" rx="6" fill="${t}" fill-opacity=".25"${m.flash(1.8, 4.2, true)}/>
<rect x="190" y="64" width="90" height="30" rx="6" fill="${t}" fill-opacity=".25"${m.flash(5.4, 7.6)}/>
${T(150, 83, 'academic', { size: 10, anchor: 'middle', weight: 700 })}${T(235, 83, 'program office', { size: 9.5, anchor: 'middle', weight: 700 })}
<path d="M40 90H108" fill="none" stroke="${C.dim}" stroke-width="2" stroke-dasharray="3 4"/>
<circle cx="108" cy="90" r="4" fill="${t}"${m.hop(1.1, 0.6, -68, 0)}/><circle cx="108" cy="90" r="4" fill="${t}"${m.hop(4.7, 0.6, -68, 0)}/>
${bubble(6, 28, "why won't my recursion end?", { a: m.flash(0.5, 4.2, true) })}
${bubble(112, 106, 'forgot the base case?', { fill: t, a: m.flash(2.3, 4.2, true) })}
${bubble(6, 28, "when's my deadline?", { a: m.flash(4.3, 7.6) })}
${bubble(128, 106, 'on it. no panic needed :)', { fill: t, a: m.flash(5.8, 7.6) })}`,

  // A robot teacher in a mortarboard works through recursion; a student asks for an encore.
  teacher: (t, m) => `
<rect x="8" y="24" width="176" height="76" rx="4" fill="#12261B" stroke="#8B5E34" stroke-width="3"/>
${T(18, 44, 'f(n) = n × f(n-1)', { size: 10, a: m.show(0.6) })}
${T(18, 63, 'f(0) = 1', { size: 10, a: m.show(1.5) })}${T(76, 63, "← don't skip this", { size: 9, fill: C.yellow, a: m.show(2.1) })}
${T(18, 86, '✓ recursion that ends', { size: 10, fill: C.green, a: m.show(2.9) })}
<g transform="translate(206 26)">
<path d="M22 0l22 7-22 7-22-7z" fill="${t}"/><path d="M40 8v10" stroke="${t}" stroke-width="2"/>
<rect x="6" y="14" width="32" height="26" rx="7" fill="${C.card}" stroke="${C.fg}" stroke-width="2.5"/>
<rect class="i blink" x="13" y="22" width="5" height="7" rx="2" fill="${t}"/><rect class="i blink" x="26" y="22" width="5" height="7" rx="2" fill="${t}"/>
<path d="M16 34q6 4 12 0" fill="none" stroke="${C.fg}" stroke-width="2" stroke-linecap="round"/>
<rect x="10" y="43" width="24" height="30" rx="5" fill="${C.card}" stroke="${C.fg}" stroke-width="2.5"/>
<path class="i point" d="M10 52L-16 36" stroke="${C.fg}" stroke-width="3" stroke-linecap="round"/>
<path d="M16 73v10M28 73v10" stroke="${C.fg}" stroke-width="2.5" stroke-linecap="round"/>
</g>
${person(30, 118)}
<path d="M38 122l8-16" stroke="${C.fg}" stroke-width="2.5" stroke-linecap="round"${m.flash(3.8, 7.6, true)}/>
${bubble(54, 102, 'can you explain it again?', { a: m.flash(4, 7.6, true) })}
${bubble(126, 128, 'sure, slower this time :)', { fill: t, a: m.flash(5.2, 7.6, true) })}`,

  // Lecture video, subtitles and assignment details stream into a mentor that answers in context.
  coursementor: (t, m) => `
${[['▶ lecture video', 26], ['CC subtitles', 54], ['assignment info', 82]].map(([label, y], i) =>
    `<g${m.enter(0.4 + i * 0.4, 0.4, -16, 0)}><rect x="8" y="${y}" width="96" height="20" rx="4" fill="${C.card}" stroke="${C.fg}" stroke-width="1.5"/>${T(56, y + 14, label, { size: 9, anchor: 'middle' })}</g>`).join('')}
${[36, 64, 92].map((y, i) => `<circle cx="146" cy="61" r="3.5" fill="${t}"${m.hop(1.7 + i * 0.25, 0.6, -42, y - 61)}/>`).join('')}
<rect x="146" y="34" width="134" height="54" rx="12" fill="${C.card}" stroke="${t}" stroke-width="2"/><path d="M262 88l6 10-16-10" fill="${t}"/>
${T(213, 50, 'AI mentor', { size: 9, fill: t, anchor: 'middle', weight: 800 })}
${[190, 204, 218].map((x) => `<circle cx="${x}" cy="66" r="3.5" fill="${t}"${m.flash(2.5, 3.4)}/>`).join('')}
${T(213, 70, 'an answer, in context', { size: 9, anchor: 'middle', weight: 700, a: m.show(3.5) })}
${T(8, 122, 'negative learner feedback', { size: 8.5, fill: C.muted })}
<rect x="8" y="128" width="190" height="10" rx="5" fill="${C.dim}"/>
<rect x="8" y="128" width="122" height="10" rx="5" fill="${C.red}"${m.shrink(4.2, 1.2, 1.56)}/>
${T(208, 138, '−36%', { size: 14, fill: C.green, weight: 800, a: m.pop(5.4) })}
${T(280, 122, '100K+ interactions', { size: 8.5, fill: C.muted, anchor: 'end', a: m.show(5.6) })}`,

  // Prompts get tested and re-tested; a lecture's subtitles become a structured summary.
  promptlab: (t, m) => [['FAIL', C.red], ['RETRY', C.yellow], ['PASS', C.green]].map(([label, col], i) => {
    const y = 24 + i * 30;
    return `<g${m.enter(0.5 + i * 0.9, 0.5, -24, 0)}><rect x="8" y="${y}" width="100" height="22" rx="4" fill="${C.card}" stroke="${C.fg}" stroke-width="1.5"/>${T(16, y + 15, `prompt v${i + 1}`, { size: 10 })}</g>
<g transform="rotate(-8 140 ${y + 11})"><g${m.pop(1 + i * 0.9)}><rect x="116" y="${y + 2}" width="48" height="18" rx="3" fill="${C.card}" stroke="${col}" stroke-width="2"/>${T(140, y + 15, label, { size: 9.5, fill: col, anchor: 'middle', weight: 800 })}</g></g>`;
  }).join('\n') + `
${T(8, 124, '→ test, tweak, repeat', { size: 9.5, fill: t, weight: 700, a: m.show(3.4) })}
${[['▶ lecture video', C.fg, 30], ['CC subtitles', C.fg, 66], ['{ JSON summary }', t, 102]].map(([label, col, y], i) => `
<g${m.enter(3.8 + i * 0.7, 0.4, 0, -8)}><rect x="184" y="${y}" width="96" height="20" rx="4" fill="${i === 2 ? t : 'none'}" fill-opacity="${i === 2 ? 0.2 : 1}" stroke="${col}" stroke-width="1.5"/>${T(232, y + 14, label, { size: 9, fill: col, anchor: 'middle', weight: i === 2 ? 800 : 400 })}</g>
${i < 2 ? T(232, y + 32, '↓', { size: 11, fill: t, anchor: 'middle', a: m.show(4.2 + i * 0.7) }) : ''}`).join('')}
${T(232, 140, 'via Elasticsearch', { size: 8.5, fill: C.muted, anchor: 'middle', a: m.show(5.6) })}`,

  // Labs rain down from the cloud; an idle one dozes off and gets swept away.
  labs: (t, m) => {
    const lab = (x) => `<rect x="${x}" y="70" width="80" height="42" rx="5" fill="${C.card}" stroke="${C.fg}" stroke-width="1.5"/><rect x="${x}" y="70" width="80" height="10" rx="5" fill="${C.dim}"/>${T(x + 6, 94, 'In [1]:', { size: 8.5, fill: t })}${T(x + 6, 106, 'print("hi")', { size: 8.5 })}`;
    return `
<g opacity=".28" fill="${t}"><circle cx="120" cy="47" r="12"/><circle cx="146" cy="40" r="16"/><circle cx="172" cy="47" r="12"/><rect x="106" y="46" width="80" height="14" rx="7"/></g>
${T(146, 57, 'ECS · Fargate · EFS', { size: 8.5, anchor: 'middle', weight: 700 })}
<path d="M52 69V62M144 69V62M236 69V62" stroke="${C.dim}" stroke-width="2" stroke-dasharray="2 3"/>
<g${m.enter(0.6, 0.6, 0, -30)}>${lab(12)}</g>
<g${m.enter(1.1, 0.6, 0, -30)}>${lab(104)}</g>
<g${m.raw([[0, 'opacity:0;transform:translate(0,-30px)'], [1.6, 'opacity:0;transform:translate(0,-30px)', 'ease-out'], [2.2, 'opacity:1;transform:translate(0,0)'], [5.3, 'opacity:1;transform:translate(0,0)', 'ease-in'], [5.9, 'opacity:0;transform:translate(24px,0)']])}>${lab(196)}</g>
${T(274, 66, 'zzz', { size: 9, fill: C.muted, anchor: 'end', a: m.flash(4.3, 5.3) })}
<path d="M270 72l-8 26M250 96h18l4 10h-26z" fill="${t}" stroke="${t}" stroke-width="2" stroke-linejoin="round"${m.hop(4.8, 0.9, -70, 0)}/>
${T(236, 96, 'tidied up ✓', { size: 9, fill: C.green, anchor: 'middle', a: m.flash(6, 7.8) })}
${T(12, 132, 'learners online: 5K+', { size: 9.5, weight: 700, a: m.show(2.4) })}
${T(12, 146, '3rd-party assessment tools: 90%+ replaced', { size: 8, fill: C.muted, a: m.show(3) })}
${T(196, 122, 'boot time', { size: 8.5, fill: C.muted })}
<rect x="196" y="127" width="84" height="7" rx="3.5" fill="${C.dim}"/>
<rect x="196" y="127" width="50" height="7" rx="3.5" fill="${t}"${m.shrink(3.4, 1, 1.68)}/>
${T(280, 122, '−40%', { size: 9.5, fill: C.green, anchor: 'end', weight: 800, a: m.pop(4.4) })}`;
  },

  // A question machine prints MCQs, a reviewer marks them, and a code editor gets a gentle AI nudge.
  mcq: (t, m) => {
    let tabX = 18;
    const tabs = ['py', 'js', 'sql', 'java'].map((name, i) => {
      const w = r2(name.length * 5.1 + 8);
      const svg = `<rect x="${tabX - 4}" y="112" width="${w}" height="12" rx="3" fill="${t}" fill-opacity=".3"${m.flash(4 + i * 0.8, 4.5 + i * 0.8, i === 0)}/>${T(tabX, 121, name, { size: 8.5, fill: C.muted })}`;
      tabX += w + 6;
      return svg;
    }).join('');
    const cards = [['✓', C.green], ['✓', C.green], ['✗', C.red], ['✓', C.green]].map(([mark, col], i) => {
      const x = 88 + i * 48;
      return `<g${m.enter(0.6 + i * 0.55, 0.5, 74 - x, 0)}><rect x="${x}" y="60" width="40" height="26" rx="3" fill="${C.fg}"/>${T(x + 20, 77, `Q${i + 1}`, { size: 10, fill: C.bg, anchor: 'middle', weight: 800 })}</g>${T(x + 20, 52, mark, { size: 13, fill: col, anchor: 'middle', weight: 800, a: m.pop(3 + i * 0.3) })}`;
    }).join('');
    return `
<rect x="10" y="26" width="62" height="66" rx="6" fill="${C.card}" stroke="${C.fg}" stroke-width="2"/>
<rect x="18" y="34" width="46" height="20" rx="3" fill="${t}" fill-opacity=".2" stroke="${t}"/>${T(41, 48, 'MCQ', { size: 10, fill: t, anchor: 'middle', weight: 800 })}
<circle class="i blink" cx="24" cy="66" r="3" fill="${C.yellow}"/><circle cx="34" cy="66" r="3" fill="${C.green}"/><circle cx="44" cy="66" r="3" fill="${C.red}"/>
<rect x="70" y="70" width="8" height="16" fill="${C.dim}"/>
${cards}
${T(88, 100, '4.6K+ printed · over half accepted', { size: 8.5, fill: C.muted, a: m.show(4.2) })}
<rect x="10" y="106" width="270" height="42" rx="5" fill="#0B0F14" stroke="${C.dim}"/>
${tabs}
${T(18, 140, 'for i in range(1, n):', { size: 9.5 })}
<path d="M103 143q2-3 4 0t4 0t4 0t4 0t4 0" fill="none" stroke="${C.red}" stroke-width="1.5"${m.show(4.6)}/>
${bubble(150, 125, 'off by one? :)', { fill: t, a: m.flash(5, 7.8, true) })}`;
  },

  // The stopwatch drops from 3.1s to 1.89s while JS and CSS wait behind a velvet rope.
  speed: (t, m) => `
<rect x="8" y="24" width="150" height="96" rx="6" fill="${C.card}" stroke="${C.fg}" stroke-width="1.5"/>
<path d="M8 38h150" stroke="${C.dim}"/><circle cx="17" cy="31" r="2.5" fill="${C.red}"/><circle cx="25" cy="31" r="2.5" fill="${C.yellow}"/><circle cx="33" cy="31" r="2.5" fill="${C.green}"/>
${T(44, 34, 'lms / my course', { size: 8, fill: C.muted })}
${[120, 88, 108, 64, 96].map((w, i) => `<rect x="18" y="${48 + i * 13}" width="${w}" height="7" rx="3.5" fill="${C.dim}"${m.show(0.5 + i * 0.3, 0.2)}/>`).join('')}
<circle cx="216" cy="56" r="26" fill="${C.card}" stroke="${C.fg}" stroke-width="2.5"/><rect x="210" y="24" width="12" height="6" rx="2" fill="${C.fg}"/>
<rect x="215" y="36" width="2" height="20" rx="1" fill="${t}"${m.spin(0.4, 2.2, 360)}/><circle cx="216" cy="56" r="3" fill="${C.fg}"/>
${T(216, 102, '3.1s', { size: 13, fill: C.red, anchor: 'middle', weight: 800, a: m.flash(0.4, 2.4) })}
${T(216, 102, '1.89s', { size: 13, fill: C.green, anchor: 'middle', weight: 800, a: m.pop(2.6) })}
<path d="M170 146v-22M200 146v-22" stroke="${C.yellow}" stroke-width="3" stroke-linecap="round"/><path d="M170 128q15 8 30 0" fill="none" stroke="${C.red}" stroke-width="2.5"/>
${['js', 'css', 'js'].map((c, i) => {
    const x = 210 + i * 26;
    return `<g${m.leave(3.2 + i * 0.8, 0.7, 120 - x, -60)}><rect x="${x}" y="130" width="22" height="16" rx="4" fill="${C.fg}"/>${T(x + 11, 141.5, c, { size: 8.5, fill: C.bg, anchor: 'middle', weight: 800 })}</g>`;
  }).join('')}
${T(206, 120, 'only when needed', { size: 8, fill: C.muted, anchor: 'middle' })}`,

  // Users march across a bridge from the old classroom to the new platform.
  migration: (t, m) => `
<path d="M10 64l34-24 34 24z" fill="none" stroke="${C.fg}" stroke-width="2" stroke-linejoin="round"/>
<rect x="16" y="64" width="56" height="42" fill="${C.card}" stroke="${C.fg}" stroke-width="2"/><rect x="38" y="84" width="12" height="22" fill="${C.dim}"/>
${T(44, 122, 'Google Classroom', { size: 8.5, fill: C.muted, anchor: 'middle' })}
${['Django REST', 'Postgres', 'AWS Fargate'].map((s, i) => `<rect x="206" y="${40 + i * 22}" width="76" height="18" rx="4" fill="${C.card}" stroke="${t}" stroke-width="1.5"/>${T(244, 53 + i * 22, s, { size: 8.5, anchor: 'middle' })}`).join('')}
${T(244, 122, 'new platform', { size: 8.5, fill: C.muted, anchor: 'middle' })}
<path d="M78 106h128" stroke="${C.dim}" stroke-width="3"/>
${Array.from({ length: 6 }, (_, i) => {
    const x = 150 + i * 9;
    return `<circle cx="${x}" cy="99" r="4" fill="${t}"${m.enter(0.6 + i * 0.35, 1.6, 78 - x, 0, 'ease-in-out')}/>`;
  }).join('')}
${T(142, 88, '1000s of users', { size: 9, anchor: 'middle', a: m.show(1.8) })}
${T(144, 142, 'eval response time: −75%', { size: 9.5, fill: C.green, anchor: 'middle', weight: 800, a: m.pop(4.4) })}`,

  // A vehicle rolls through a self-updating toll; prices are ready before it arrives; messages fly.
  vehicles: (t, m) => {
    const env = (x) => `<rect x="${x - 7}" y="22" width="14" height="10" rx="1.5" fill="${C.fg}"/><path d="M${x - 7} 23l7 5 7-5" fill="none" stroke="${C.bg}" stroke-width="1.2"/>`;
    return `
${[['vendor', 34], ['driver', 144], ['buyer', 254]].map(([n, x]) => `<circle cx="${x}" cy="44" r="5" fill="none" stroke="${C.fg}" stroke-width="2"/>${T(x, 60, n, { size: 8.5, fill: C.muted, anchor: 'middle' })}`).join('')}
<path d="M44 44h90M154 44h90" stroke="${C.dim}" stroke-dasharray="2 3"/>
<g${m.hop(2.4, 0.8, -110, 0)}>${env(144)}</g><g${m.hop(3.4, 0.8, -110, 0)}>${env(254)}</g><g${m.hop(4.4, 1.1, 220, 0)}>${env(34)}</g>
<rect x="0" y="110" width="288" height="26" fill="#21262D"/><path d="M0 123h288" stroke="${C.muted}" stroke-dasharray="10 8"/>
<g${m.pop(1)}><rect x="10" y="68" width="118" height="20" rx="4" fill="${t}"/>${T(69, 82, 'price: pre-computed', { size: 9, fill: C.bg, anchor: 'middle', weight: 800 })}</g>
${T(10, 102, 'APIs ~50% faster', { size: 9, fill: C.green, weight: 800, a: m.show(1.6) })}
<rect x="176" y="80" width="20" height="30" fill="${C.card}" stroke="${C.fg}" stroke-width="2"/>
${T(284, 76, 'tolls: auto-updated', { size: 8.5, fill: C.muted, anchor: 'end', a: m.show(1.4) })}
<rect x="196" y="98" width="26" height="4" rx="2" fill="${C.yellow}"${m.lift(2.6, 5.3, -75)}/>
<g${m.enter(0.4, 5, -250, 0, 'linear')}><path d="M230 114v-10l9-11h24l11 11h8v10z" fill="${C.card}" stroke="${C.fg}" stroke-width="2" stroke-linejoin="round"/><path d="M243 102l5-6h12l6 6z" fill="${C.dim}"/><circle cx="244" cy="116" r="5" fill="${C.card}" stroke="${t}" stroke-width="2.5"/><circle cx="270" cy="116" r="5" fill="${C.card}" stroke="${t}" stroke-width="2.5"/></g>`;
  },

  // A departures board, and a bug in the API pipe until a magnifying glass catches it.
  bughunt: (t, m) => `
<rect x="8" y="24" width="172" height="66" rx="4" fill="#0B0F14" stroke="${C.dim}"/>
${T(16, 37, 'DEPARTURES', { size: 8, fill: C.muted, weight: 800 })}
${[['BLR → DEL', 'ON TIME', C.green], ['BOM → GOI', 'BOARDING', C.yellow], ['DEL → CCU', 'DELAYED', C.red]].map(([route, status, col], i) =>
    `${T(16, 54 + i * 14, route, { size: 9, a: m.show(0.5 + i * 0.4) })}${T(172, 54 + i * 14, status, { size: 9, fill: col, anchor: 'end', weight: 700, a: m.show(0.7 + i * 0.4) })}`).join('')}
${T(190, 44, '← my flights', { size: 8.5, fill: C.muted })}${T(190, 56, '  dashboard', { size: 8.5, fill: C.muted })}
${T(12, 106, 'GET /flights', { size: 9 })}
<rect x="8" y="112" width="272" height="16" rx="8" fill="#21262D"/>
${T(280, 106, '500', { size: 9.5, fill: C.red, anchor: 'end', weight: 800, a: m.flash(1.8, 3.9) })}
${T(280, 106, '200 OK', { size: 9.5, fill: C.green, anchor: 'end', weight: 800, a: m.pop(4) })}
<g${m.raw([[0, 'opacity:0;transform:translate(-110px,0)'], [1.6, 'opacity:0;transform:translate(-110px,0)'], [1.8, 'opacity:1;transform:translate(-100px,0)', 'linear'], [3.2, 'opacity:1;transform:translate(0,0)'], [3.8, 'opacity:1;transform:translate(0,0)'], [4, 'opacity:0;transform:translate(0,0)']])} opacity="0"><ellipse cx="150" cy="120" rx="6" ry="4.5" fill="${C.red}"/><path d="M146 115l-3-3M154 115l3-3M146 125l-3 3M154 125l3 3" stroke="${C.red}" stroke-width="1.5"/></g>
<g${m.enter(2.9, 0.7, 90, -30)}><circle cx="150" cy="120" r="12" fill="${t}" fill-opacity=".15" stroke="${t}" stroke-width="3"/><path d="M159 129l9 9" stroke="${t}" stroke-width="4" stroke-linecap="round"/></g>
${T(150, 148, 'caught by my API debugger', { size: 8.5, fill: C.green, anchor: 'middle', a: m.show(4) })}`,

  cassette: (t) => `
<g transform="translate(88 18)">
<rect x="6" y="24" width="100" height="66" rx="8" fill="${C.card}" stroke="${C.fg}" stroke-width="3"/>
<rect x="12" y="32" width="88" height="16" rx="3" fill="${t}"/>${T(56, 43.5, 'BE KIND REWIND', { size: 8.5, fill: C.bg, anchor: 'middle', weight: 800 })}
<rect x="28" y="56" width="56" height="22" rx="11" fill="none" stroke="${C.muted}" stroke-width="2"/>
${reel(40, 67, 8, C.fg)}${reel(72, 67, 8, C.fg)}<path d="M30 90l6-8h40l6 8" fill="none" stroke="${C.fg}" stroke-width="2.5"/>
</g>
${T(144, 138, '7 roles · 3 companies · 1 tape', { size: 9.5, fill: t, anchor: 'middle', weight: 800 })}`,
};

// `name` null draws the card with no animation at all, for the stills.
function sceneCard(scene, name, D, span, isStatic, css) {
  const t = C[scene.tone];
  const live = Boolean(css && name);
  if (live) css.push(keyframes(name, D, windows(D, [span], { hide: 'opacity:0;transform:translateY(8px)', show: 'opacity:1;transform:translateY(0)' })));
  const m = motion(live ? css : null, D, name, span[0]);
  let pillX = TEXT_X;
  const pills = scene.pills.map((p) => {
    const w = r2([...p].length * CHAR.pill + 16);
    const svg = `<rect x="${r2(pillX)}" y="214" width="${w}" height="20" rx="10" fill="${t}" fill-opacity=".14" stroke="${t}" stroke-opacity=".5"/><text x="${r2(pillX + w / 2)}" y="228" text-anchor="middle" font-size="11px" fill="${t}">${esc(p)}</text>`;
    pillX += w + 6;
    return svg;
  });
  return `<g${live ? ` class="a" style="animation-name:${name}"` : ''} opacity="${isStatic ? 1 : 0}">
<rect x="${STAGE.x}" y="${STAGE.y}" width="${STAGE.w}" height="${STAGE.h}" rx="8" fill="${t}" fill-opacity=".06" stroke="${t}" stroke-opacity=".25"/>
<g transform="translate(${STAGE.x} ${STAGE.y})" clip-path="url(#stage)">
${T(10, 15, `▸ ${scene.title}`, { size: 9.5, fill: t, weight: 700 })}
${STAGES[scene.art](t, m)}
</g>
<text x="${TEXT_X}" y="112" font-size="22px" font-weight="800" fill="${t}">${esc(scene.years)}</text>
${scene.company ? `<text x="${r2(TEXT_X + [...scene.years].length * CHAR.year + 10)}" y="111" font-size="12px" fill="${C.muted}">${esc(`@ ${scene.company}`)}</text>` : ''}
<text x="${TEXT_X}" y="136" font-size="15px" font-weight="700" fill="${C.fg}">${esc(scene.role)}</text>
${scene.lines.map((l, j) => `<text x="${TEXT_X}" y="${162 + j * 20}" font-size="13px" fill="${C.fg}">${esc(l)}</text>`).join('\n')}
${pills.join('')}
</g>`;
}

const PLAYHEAD = `<path d="M-7 ${TRACK_Y - 20}h14l-7 9z" fill="${C.fg}"/><line x1="0" x2="0" y1="${TRACK_Y - 11}" y2="${TRACK_Y + 10}" stroke="${C.fg}" stroke-width="1.5" opacity=".7"/>`;

// Window frame and prompt line; leaves the screen clip group open for the caller to close.
function chrome(command) {
  return `<defs><clipPath id="screen"><rect x="1" y="36" width="${W - 2}" height="${H - 37}" rx="9"/></clipPath>
<clipPath id="cardclip"><rect x="${X}" y="${CARD_Y}" width="${W - 2 * X}" height="${CARD_H}" rx="10"/></clipPath>
<clipPath id="stage"><rect width="${STAGE.w}" height="${STAGE.h}" rx="8"/></clipPath></defs>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${C.bg}" stroke="${C.border}"/>
<path d="M0.5 36V10.5a10 10 0 0 1 10-10h${W - 21}a10 10 0 0 1 10 10V36z" fill="${C.card}"/>
<circle cx="20" cy="18" r="6" fill="#FF5F57"/><circle cx="40" cy="18" r="6" fill="#FEBC2E"/><circle cx="60" cy="18" r="6" fill="#28C840"/>
<text x="${W / 2}" y="22" text-anchor="middle" fill="${C.muted}" font-size="12px">anjali — career.vhs — zsh</text>
<g clip-path="url(#screen)">
<text x="${X}" y="62" font-size="13px" fill="${C.prompt}">${esc(PROMPT)}</text><text x="${r2(CMD_X)}" y="62" font-size="13px" fill="${C.fg}">${esc(command)}</text>`;
}

function track(st, lit) {
  return `<line x1="${st[0].x}" x2="${st.at(-1).x}" y1="${TRACK_Y}" y2="${TRACK_Y}" stroke="${C.border}" stroke-width="3"/>
${st.map(({ x }) => `<circle cx="${x}" cy="${TRACK_Y}" r="5" fill="${C.border}"/>`).join('')}
${lit}
${st.map(({ label, x }) => `<text x="${x}" y="${TRACK_Y + 26}" text-anchor="middle" font-size="11px" fill="${C.muted}">${esc(label)}</text>`).join('')}`;
}

// Stills: every scene paused, for readers who want to stop and read. Index SCENES.length is the finale.
export const STILL_COUNT = SCENES.length + 1;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const stillFile = (i, scenes = SCENES) => `assets/scenes/${String(i + 1).padStart(2, '0')}-${i < scenes.length ? slug(scenes[i].chip) : 'rewind-complete'}.svg`;

export function renderStill(i, scenes = SCENES) {
  const scene = i < scenes.length ? scenes[i] : FINALE;
  const st = stations(scenes);
  const at = i < scenes.length ? st.find((s) => s.label === scene.station) : st.at(-1);
  const lit = (i < scenes.length ? [at] : st)
    .map(({ label, x }) => `<circle cx="${x}" cy="${TRACK_Y}" r="7" fill="${C[scenes.find((s) => s.station === label).tone]}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
<title id="title">${esc(`${scene.years} · ${scene.title}. ${scene.lines.join(' ')}`)}</title>
<style>
text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}
</style>
${chrome(`${COMMAND} --scene ${i + 1}`)}
<text x="${W - X}" y="62" text-anchor="end" font-size="13px" font-weight="800" fill="${C.fg}" letter-spacing="1">❚❚ PAUSED · ${i + 1}/${scenes.length + 1}</text>
<rect x="${X}" y="${CARD_Y}" width="${W - 2 * X}" height="${CARD_H}" rx="10" fill="${C.card}" stroke="${C.border}"/>
<g clip-path="url(#cardclip)">${sceneCard(scene, null, 1, [0, 1], true, null)}</g>
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
    const who = `${s.role}${s.company ? ` @ ${s.company}` : ''}`;
    const alt = `${s.years} · ${s.title}. ${s.lines.join(' ')} ${s.pills.join(' · ')}`;
    return `<details>\n<summary><b>${esc(s.years)}</b> · ${esc(s.title)} · ${esc(who)}</summary>\n<br/>\n<img alt="${esc(alt)}" src="${stillFile(i, scenes)}" width="860">\n</details>`;
  }).join('\n');
}

// The story as plain text: the SVG's accessible description and the README's text version.
export function transcript(scenes = SCENES) {
  const block = (mark, s) => [
    `${mark} ${s.years} · ${s.title} · ${s.role}${s.company ? ` @ ${s.company}` : ''}`,
    ...s.lines.map((l) => `   ${l}`),
    `   ${s.pills.map((p) => `[${p}]`).join(' ')}`,
  ].join('\n');
  return [`$ ${COMMAND}`, ...scenes.map((s) => block('◀◀', s)), FF_TEXT, block('▶ ', FINALE)].join('\n');
}

// Reduced motion freezes the tape on its first scene. The player (docs/index.html) marks <html>
// with .js-player once its script has taken control, which lifts this rule there; in an <img> on
// GitHub, and in the player with JavaScript off, it always applies.
export const REDUCED_MOTION_CSS = '@media (prefers-reduced-motion:reduce){:root:not(.js-player) .a,:root:not(.js-player) .i,:root:not(.js-player) .vhs,:root:not(.js-player) .blinkosd{animation:none!important}:root:not(.js-player) .cover,:root:not(.js-player) .vhs-wrap{display:none}}';

export function renderStory(scenes = SCENES) {
  const tl = timeline(scenes);
  const D = tl.duration;
  const st = stations(scenes);
  const xOf = (label) => st.find((s) => s.label === label).x;
  const now = xOf(scenes[0].station);
  const css = [];

  const cards = scenes.map((scene, k) => sceneCard(scene, `s${k}`, D, [tl.sceneAt[k], tl.sceneAt[k] + SCENE_S], k === 0, css));
  cards.push(sceneCard(FINALE, 'fin', D, [tl.finaleAt, D], false, css));

  css.push(keyframes('ff', D, windows(D, [[tl.ffAt, tl.finaleAt]])));
  const ffCard = `<g class="a" style="animation-name:ff" opacity="0"><text x="${W / 2}" y="160" text-anchor="middle" font-size="22px" font-weight="700" fill="${C.fg}">${esc(FF_TEXT)}</text><text x="${W / 2}" y="188" text-anchor="middle" font-size="13px" fill="${C.muted}">2017 → 2026</text></g>`;

  // The playhead holds on each station, glides back when the era changes, then zips forward to now.
  const tx = (x) => `transform:translateX(${x}px)`;
  const ph = [[0, tx(now)]];
  scenes.forEach((scene, k) => {
    if (k > 0 && scene.station !== scenes[k - 1].station) {
      ph.push([tl.sceneAt[k] - MOVE_S, tx(xOf(scenes[k - 1].station)), 'ease-in-out'], [tl.sceneAt[k], tx(xOf(scene.station))]);
    }
  });
  ph.push([tl.ffAt, tx(xOf(scenes.at(-1).station)), 'cubic-bezier(.6,0,.2,1)'], [tl.finaleAt, tx(now)], [D, tx(now)]);
  css.push(keyframes('ph', D, ph));

  // Cassette reels spin backwards while rewinding and forwards on the fast-forward.
  css.push(keyframes('reels', D, [
    [0, 'transform:rotate(0)'], [tl.rewindAt, 'transform:rotate(0)'], [tl.ffAt, 'transform:rotate(-5760deg)'],
    [tl.finaleAt, 'transform:rotate(-3600deg)'], [D, 'transform:rotate(-3600deg)'],
  ]));

  // Each station lights while the playhead sits on it, then again, for good, on the fast-forward.
  // Drawn state (what reduced motion shows) matches the first scene: only its station is lit.
  const litUntil = D - FADE_S + 0.3;
  const lit = st.map(({ label, x }, c) => {
    const ks = scenes.flatMap((s, k) => (s.station === label ? [k] : []));
    const span = [tl.sceneAt[ks[0]], tl.sceneAt[ks.at(-1)] + SCENE_S];
    const litAgain = tl.ffAt + FF_S * (st.length > 1 ? c / (st.length - 1) : 1);
    const spans = litAgain <= span[1] + 0.3 ? [[span[0], litUntil]] : [span, [litAgain, litUntil]];
    css.push(keyframes(`st${c}`, D, windows(D, spans, { fade: 0.15 })));
    return `<circle class="a" style="animation-name:st${c}" cx="${x}" cy="${TRACK_Y}" r="7" fill="${C[scenes[ks[0]].tone]}" opacity="${label === scenes[0].station ? 1 : 0}"/>`;
  });

  const osd = [
    ['rw', [tl.rewindAt, tl.ffAt], '◀◀ REWIND', 'blinkosd'],
    ['fw', [tl.ffAt, tl.finaleAt], '▶▶ FF', ''],
    ['pl', [tl.finaleAt, litUntil], '▶ PLAY', ''],
  ].map(([name, span, label, extra]) => {
    css.push(keyframes(name, D, windows(D, [span])));
    return `<g class="a" style="animation-name:${name}" opacity="0"><text${extra ? ` class="${extra}"` : ''} x="${W - X}" y="62" text-anchor="end" font-size="13px" font-weight="800" fill="${C.fg}" letter-spacing="1">${label}</text></g>`;
  });
  css.push(keyframes('vw', D, windows(D, [[tl.rewindAt, tl.finaleAt]])));

  const coverW = r2(COMMAND.length * CHAR.cmd + 4);
  const typedAt = TYPE_AT + COMMAND.length * TYPE_S;
  css.push(keyframes('type', D, [
    [0, 'transform:translateX(0)'], [TYPE_AT, 'transform:translateX(0)', `steps(${COMMAND.length},end)`],
    [typedAt, `transform:translateX(${coverW}px)`], [D - FADE_S, `transform:translateX(${coverW}px)`], [D, 'transform:translateX(0)'],
  ]));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title" aria-describedby="desc">
<title id="title">anjali --rewind: my career, backtracked from now to where I started in 2017</title>
<desc id="desc">${esc(transcript(scenes))}</desc>
<style>
text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}
.a{animation-duration:${D}s;animation-iteration-count:infinite;animation-fill-mode:both;animation-timing-function:linear}
.i{transform-box:fill-box;transform-origin:center}
.blink{animation:blink 3.2s infinite}@keyframes blink{0%,90%,100%{transform:scaleY(1)}94%{transform:scaleY(.1)}}
.point{transform-origin:100% 100%;animation:point 1.8s ease-in-out infinite}@keyframes point{50%{transform:rotate(9deg)}}
.spin{animation:spin 2s linear infinite}@keyframes spin{to{transform:rotate(-360deg)}}
.blinkosd{animation:blinkosd 1s steps(1) infinite}@keyframes blinkosd{50%{opacity:0}}
.vhs{animation:vhs 1.1s linear infinite}@keyframes vhs{from{transform:translateY(0)}to{transform:translateY(${CARD_H - 8}px)}}
.reels .spin{animation:none}
${css.join('\n')}
${REDUCED_MOTION_CSS}
</style>
${chrome(COMMAND)}
<rect class="a cover" style="animation-name:type" x="${r2(CMD_X - 1)}" y="48" width="${coverW}" height="20" fill="${C.bg}"/>
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
  const stills = Array.from({ length: STILL_COUNT }, (_, i) => stillFile(i));
  for (const [i, file] of stills.entries()) await writeFile(file, renderStill(i));
  // Remove stills from renamed or deleted scenes, so none go stale.
  for (const f of await readdir('assets/scenes')) {
    if (f.endsWith('.svg') && !stills.includes(`assets/scenes/${f}`)) await unlink(`assets/scenes/${f}`);
  }
  console.log(`wrote assets/story.svg (${timeline().duration}s loop) and ${STILL_COUNT} stills in assets/scenes/`);
}
