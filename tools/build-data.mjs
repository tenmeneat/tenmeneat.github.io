// 볼트 → js/data.js · vault/ 재생성
//   node tools/build-data.mjs [볼트 경로]   (생략하면 옆 폴더 ../SecondBrain)
// 볼트의 Shell Graph 플러그인 소스(_system/shell_graph/src)의 config.js·layout.js를 그대로 불러
// 플러그인과 같은 좌표를 만든다. _system · _templates · .obsidian · Claude outputs 는 제외.
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = process.argv[2] || path.resolve(SITE, '..', 'SecondBrain');
const SRC = path.join(VAULT, '_system', 'shell_graph', 'src');
const OUT = path.join(SITE, 'js', 'data.js');
const PUB = path.join(SITE, 'vault');   // 노트 본문(notes.json)과 그림·뷰어(assets/) — 매번 새로 만든다
const { SHELLS, GroupRegistry, subOf } = await import(pathToFileURL(path.join(SRC, 'config.js')).href);
const { computeLayout } = await import(pathToFileURL(path.join(SRC, 'layout.js')).href);

// 실명 가리기 목록 — 실명 자체가 들어 있으므로 Git에 올리지 않는 tools/redact.local.json에 둔다 (형식: redact.example.json)
//   phrases: 문구 단위로 먼저 바꾸고, names: 남은 실명을 이름 단위로 바꾼다. 빌드 끝에 names의 실명이 남아 있으면 실패한다
const REDACT_FILE = path.join(SITE, 'tools', 'redact.local.json');
if (!fs.existsSync(REDACT_FILE)) throw new Error('tools/redact.local.json이 없습니다 — 실명을 가리지 못한 채 빌드하지 않습니다. redact.example.json을 복사해 채우세요.');
const { phrases: REDACT, names: NAMES } = JSON.parse(fs.readFileSync(REDACT_FILE, 'utf8').replace(/^﻿/, ''));
// 노트 안 ```언어 블록 → 사이트에 iframe으로 넣을 단일 파일 뷰어
const VIEWERS = {
  'gft-turbine': '10_Projects/2026_GreenFlow-T/assets/GFT_turbine_viewer.html',
  'hystep-cleaner': '10_Projects/2026_HY-step/assets/세정기_3D_뷰어.html',
  'f1t-pipeline': '_system/pipeline_map/F1TENTH/F1T-pipeline-map.html'
};
const SKIP = new Set(['_system', '_templates', 'Claude outputs']);

const files = [];
(function walk(dir, rel) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.obsidian') || e.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!rel && SKIP.has(e.name)) continue; walk(path.join(dir, e.name), r); }
    else if (e.name.endsWith('.md')) files.push(r);
  }
})(VAULT, '');
files.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const base = (p) => p.split('/').pop().replace(/\.md$/, '');
const byName = new Map(); files.forEach((p) => { if (!byName.has(base(p))) byName.set(base(p), p); });
const idx = new Map(files.map((p, i) => [p, i]));

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/); const d = {};
  if (!m) return [d, text];
  let last = null;
  for (const line of m[1].split(/\r?\n/)) {
    const li = line.match(/^\s+-\s+(.*)$/);   // 블록 목록 (옵시디언 Properties가 쓰는 형식)  key:\n  - a\n  - b
    if (li && last) { if (!Array.isArray(d[last])) d[last] = []; d[last].push(li[1].trim().replace(/^"(.*)"$/, '$1')); continue; }
    const mm = line.match(/^(\w+):\s*(.*)$/); if (!mm) continue;
    let v = mm[2].trim(); last = mm[1];
    if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean);
    else v = v.replace(/^"|"$/g, '');
    d[mm[1]] = v;
  }
  return [d, text.slice(m[0].length)];
}
// 프로젝트 개요(00 개요)의 사이트용 속성: problem · approach · result · retro(다시 한다면) · verify(검증 노트 목록)
// cover(표지 그림 파일명 또는 VIEWERS 키) · cover_note(표지를 누르면 열 노트) · milestones("YYYY-MM-DD 제목 — 설명" 목록)
const KEEP = ['type', 'title', 'status', 'period', 'role', 'summary', 'domain', 'used_in', 'tools', 'problem', 'approach', 'result', 'retro', 'verify', 'cover', 'cover_note', 'milestones'];
const meta = [], links = [], seen = new Set(), bodies = [];
files.forEach((p, i) => {
  const t = fs.readFileSync(path.join(VAULT, p), 'utf8'); const [d, body] = frontmatter(t);
  const o = {}; for (const k of KEEP) if (d[k] !== undefined && d[k] !== '' && !(Array.isArray(d[k]) && !d[k].length)) o[k] = d[k];
  if (d.publish === 'false') delete o.summary;
  // 날짜: 생성 = created, 수정 = created · updated · 파일 수정 시각 중 가장 늦은 날
  const day = (v) => (/^\d{4}-\d{2}-\d{2}/.exec(String(v || '')) || [''])[0];
  const mtime = fs.statSync(path.join(VAULT, p)).mtime, local = new Date(mtime - mtime.getTimezoneOffset() * 60000).toISOString();
  if (day(d.created)) o.created = day(d.created);
  o.updated = [day(d.created), day(d.updated), day(local)].sort().pop();
  // 성숙도: frontmatter stage(seedling | budding | evergreen)가 우선. 없으면 '짧고(400자 미만) 소제목(##)도 3개 미만'인 메모만 '씨앗'
  // — 정의·식·쓰인 곳을 다 갖춘 짧은 개념 노트는 씨앗으로 찍히지 않는다
  const stub = body.trim().length < 400 && (body.match(/^## /gm) || []).length < 3;
  const st = ['seedling', 'budding', 'evergreen'].includes(d.stage) ? d.stage : stub ? 'seedling' : '';
  if (st) o.stage = st;
  if (d.type === 'project-moc') { const td = /^\s*- \[ \] (.+)$/m.exec(body); if (td) o.todo = td[1].trim(); }   // 'Right now'용: 개요의 첫 미완료 체크박스
  meta.push(o);
  bodies.push(d.publish === 'false' ? null : red(body.trim()));   // 비공개 노트는 그래프에 제목만 남고 본문은 나가지 않는다
  for (const m of t.matchAll(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const tgt = base(m[1].trim()); const q = byName.get(tgt); if (!q) continue;
    const j = idx.get(q); if (j === i) continue;
    const k = Math.min(i, j) + '|' + Math.max(i, j); if (seen.has(k)) continue; seen.add(k); links.push([Math.min(i, j), Math.max(i, j)]);
  }
});

const reg = new GroupRegistry();
const nodes = files.map((p) => { const g = reg.classify(p); return { id: p, group: g.id, g, shell: g.shell, sub: subOf(p), anchor: g.anchor, deg: 0 }; });
for (const [a, b] of links) { nodes[a].deg++; nodes[b].deg++; }
const dirs = computeLayout(nodes, links);
const jr = (s) => { let h = 2166136261; for (let k = 0; k < s.length; k++) { h ^= s.charCodeAt(k); h = Math.imul(h, 16777619); } return ((h >>> 0) / 4294967296 - 0.5) * 0.05; };
let colors = {};
try { colors = JSON.parse(fs.readFileSync(path.join(VAULT, '.obsidian', 'plugins', 'shell-graph', 'data.json'), 'utf8')).colors || {}; } catch (_) {}
const groups = reg.all().filter((g) => nodes.some((n) => n.group === g.id));
const gi = new Map(groups.map((g, i) => [g.id, i]));
const r4 = (v) => Math.round(v * 10000) / 10000;
function red(v) {
  if (Array.isArray(v)) return v.map(red);
  if (typeof v !== 'string') return v;
  for (const [a, b] of REDACT) v = v.split(a).join(b);
  for (const [a, b] of Object.entries(NAMES)) v = v.split(a).join(b);
  return v;
}
const SG = {
  groups: groups.map((g) => ({ id: g.id, label: g.label, shell: g.shell, color: (colors[g.id] || g.color).toUpperCase() })),
  nodes: nodes.map((n, i) => {
    const o = { n: base(n.id), g: gi.get(n.group), d: dirs[i].map(r4), r: r4(SHELLS[n.shell].radius * (1 + jr(n.id)) / 215), k: n.deg };
    const pp = n.id.split('/'); if (pp[0] === '10_Projects' && pp.length > 3) o.s = pp[2];
    for (const [k, v] of Object.entries(meta[i])) o[k] = red(v);
    return o;
  }),
  links: links.flat()
};
fs.writeFileSync(OUT, '// 자동 생성 — node tools/build-data.mjs <볼트 경로>\n// ' + new Date().toISOString() + ' · 노트 ' + files.length + ' · 링크 ' + links.length + '\nconst SG = ' + JSON.stringify(SG).replace(/<\//g, '<\\/') + ';\n');
console.log('노트', files.length, '링크', links.length, '→', OUT);

// ---- 본문과 첨부 ----
fs.rmSync(PUB, { recursive: true, force: true }); fs.mkdirSync(path.join(PUB, 'assets'), { recursive: true });
const assetByName = new Map();
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f); else if (!e.name.endsWith('.md') && !assetByName.has(e.name)) assetByName.set(e.name, f);
  }
})(VAULT);
const used = new Set(), missing = new Set();
for (const b of bodies) {
  if (!b) continue;
  for (const m of b.matchAll(/!\[\[([^\]|#]+)/g)) { const n = m[1].trim(); if (/\.\w+$/.test(n) && !n.endsWith('.md')) (assetByName.has(n) ? used : missing).add(n); }
  for (const lang of Object.keys(VIEWERS)) if (b.includes('```' + lang)) used.add(lang);
}
meta.forEach((o, i) => { if (bodies[i] && o.cover) (VIEWERS[o.cover] || assetByName.has(o.cover) ? used : missing).add(o.cover); });   // 프로젝트 카드 표지
// PNG·JPG는 WebP로 줄여 내보낸다(이름은 확장자만 .webp, 사이트가 같은 규칙으로 바꿔 부른다). 파이썬·Pillow가 없으면 원본 그대로 복사
const RASTER = /\.(png|jpe?g)$/i, toWebp = [];
for (const n of used) {
  if (VIEWERS[n]) fs.copyFileSync(path.join(VAULT, VIEWERS[n]), path.join(PUB, 'assets', n + '.html'));
  else if (RASTER.test(n)) toWebp.push([assetByName.get(n), path.join(PUB, 'assets', n.replace(RASTER, '.webp')), n]);
  else fs.copyFileSync(assetByName.get(n), path.join(PUB, 'assets', n));
}
if (toWebp.length) {
  const r = spawnSync('python', [path.join(SITE, 'tools', 'webp.py')], { input: JSON.stringify(toWebp.map((x) => x.slice(0, 2))), encoding: 'utf8' });
  if (r.status !== 0) {
    console.warn('WebP 변환 실패 — 원본을 그대로 씁니다:', (r.stderr || r.error || '').toString().trim().split('\n').pop());
    for (const [src, dst] of toWebp) fs.copyFileSync(src, dst);   // 확장자만 .webp — 브라우저는 내용으로 형식을 판별한다
  }
  const before = toWebp.reduce((s, x) => s + fs.statSync(x[0]).size, 0), after = toWebp.reduce((s, x) => s + fs.statSync(x[1]).size, 0);
  console.log('그림', toWebp.length + '장', (before / 1e6).toFixed(1) + ' MB →', (after / 1e6).toFixed(1) + ' MB');
}
const json = JSON.stringify(bodies);
const leaked = Object.keys(NAMES).filter((n) => json.includes(n) || fs.readFileSync(OUT, 'utf8').includes(n));
if (leaked.length) { fs.rmSync(PUB, { recursive: true, force: true }); throw new Error('실명이 남았습니다: ' + leaked.join(', ')); }
fs.writeFileSync(path.join(PUB, 'notes.json'), json);
console.log('본문', bodies.filter(Boolean).length + '/' + files.length, '첨부', used.size, missing.size ? '· 못 찾은 첨부: ' + [...missing].join(', ') : '');
console.log(groups.map((g) => g.id + ':' + nodes.filter((n) => n.group === g.id).length).join(' '));
