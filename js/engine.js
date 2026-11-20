/* N.H.W — Second Brain : 그래프 데이터 가공 + 캔버스 엔진 (인트로 · Shell Graph · 월드)
   전역: SG(js/data.js), SCRIPT_FONTS·buildLetters(js/glyphs.js) */
'use strict';
// ───────── Shell Graph 데이터 (볼트 → _system/shell_graph 레이아웃 그대로) ─────────
// 노드 좌표 = 플러그인 computeLayout 결과(구면 방향) × 껍데기 반지름 / 215 (프로젝트 껍데기 = 1)
const SHELLS = {
  core:  { axis: [0, 1, 0],        spin:  0.060, label: 'Core' },
  know:  { axis: [0.25, 1, 0.10],  spin:  0.022, label: 'Concepts' },
  tools: { axis: [-0.35, 1, 0.25], spin: -0.016, label: 'Tools & Courses' },
  proj:  { axis: [0.15, 1, -0.30], spin:  0.012, label: 'Projects' }
};
const SHELL_RANK = { core: 0, know: 1, tools: 2, proj: 3 };
const GROUP_KIND = { home: 'home', concepts: 'concept', tools: 'tool', courses: 'course' };
const P_EN = { f1t: 'F1TENTH', hy: 'HY-step', gft: 'GreenFlow-T', cae: 'CAE', 'proj:2026_Techno': 'Techno' };
const P_CODE = { f1t: 'F1T', hy: '세정기', gft: 'GFT', cae: 'CAE', 'proj:2026_Techno': 'TEC' };
const G_EN = { home: 'Home', concepts: 'Concepts', tools: 'Tools', courses: 'Courses' };
// 제목 글꼴 (CSS --script). k = 크기 보정값 (필기체는 글자가 작아 크게, Alegreya는 보통 크기), it = 이탤릭
const SCRIPTS = {
  alegreya: { css: "'Alegreya', serif", k: 0.62, it: true },
  allura: { css: "'Allura', cursive", k: 1 },
  sacramento: { css: "'Sacramento', cursive", k: 1.04 },
  parisienne: { css: "'Parisienne', cursive", k: 0.8 },
  italianno: { css: "'Italianno', cursive", k: 1.16 }
};
function scriptOf(k) { return SCRIPTS[k] || SCRIPTS.alegreya; }
function rgbOf(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mkRng(seed) { let s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function eOut(t) { return 1 - Math.pow(1 - t, 3); }
function eIn(t) { return t * t * t; }
function eIO(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

function rotM(ax, a) {
  const k = norm3(ax), c = Math.cos(a), s = Math.sin(a), t = 1 - c, x = k[0], y = k[1], z = k[2];
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
function mix(hex, to, f) { const a = rgbOf(hex), b = rgbOf(to); return '#' + [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * f).toString(16).padStart(2, '0')).join(''); }
function fibDir(i, n) { const y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), ph = i * 2.399963; return [Math.cos(ph) * r, y, Math.sin(ph) * r]; }
function randDir(rr) { const z = rr() * 2 - 1, t = rr() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(t), r * Math.sin(t), z]; }
function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
// 점 집합 → 이웃끼리 삼각형(플렉서스 면). 각 점에서 가장 가까운 k개 중 서로 가까운 쌍으로 면을 만든다
function plexus(dirs, ids, k, maxA, out, tag) {
  const seen = {};
  ids.forEach((i) => {
    const nb = ids.filter((j) => j !== i).map((j) => [j, Math.acos(clamp(dot3(dirs[i], dirs[j]), -1, 1))]).filter((q) => q[1] < maxA).sort((a, b) => a[1] - b[1]).slice(0, k);
    for (let u = 0; u < nb.length; u++) for (let v = u + 1; v < nb.length; v++) {
      const a = nb[u][0], b = nb[v][0];
      if (Math.acos(clamp(dot3(dirs[a], dirs[b]), -1, 1)) > maxA) continue;
      const t = [i, a, b].sort((p, q) => p - q), key = t.join('-');
      if (seen[key]) continue; seen[key] = 1; out.push({ v: t, tag: tag });
    }
  });
}

function buildGraph() {
  const groups = SG.groups.map((g, gi) => ({ id: g.id, gi: gi, label: P_EN[g.id] || G_EN[g.id] || g.label, shell: g.shell, color: g.color, kind: GROUP_KIND[g.id] || 'project', code: P_CODE[g.id] || null, members: [] }));
  const nodes = SG.nodes.map((o, i) => {
    const g = groups[o.g]; g.members.push(i);
    return {
      i: i, name: o.n, g: o.g, grp: g, kind: g.kind, shell: g.shell, dir: o.d, rad: o.r, deg: o.k,
      size: Math.min(1.5 + 0.6 * Math.sqrt(o.k), 6.5), color: g.color, sec: o.s || null, type: o.type || '',
      title: o.title || '', status: o.status || '', period: o.period || '', role: o.role || '', summary: o.summary || '',
      domain: o.domain || '', created: o.created || '', updated: o.updated || '', stage: o.stage || '',
      problem: o.problem || '', approach: o.approach || '', result: o.result || '', retro: o.retro || '', cover: o.cover || '', coverNote: o.cover_note || '', todo: o.todo || '',
      verify: [].concat(o.verify || []), milestones: [].concat(o.milestones || []), used: Array.isArray(o.used_in) ? o.used_in : (o.used_in ? [o.used_in] : []), tools: Array.isArray(o.tools) ? o.tools : [],
      p: [0, 0, 0], ph: ((i * 0.6180339) % 1) * 6.2832
    };
  });
  const byName = {}; nodes.forEach((n) => { byName[n.name] = n; });
  const edges = [], adj = nodes.map(() => new Set()), adjE = nodes.map(() => []);
  for (let q = 0; q < SG.links.length; q += 2) {
    const a = SG.links[q], b = SG.links[q + 1];
    const A = nodes[a], B = nodes[b];
    const outer = SHELL_RANK[B.shell] > SHELL_RANK[A.shell] ? B : A;
    edges.push({ a: a, b: b, gi: outer.g, same: A.shell === B.shell });
    adj[a].add(b); adj[b].add(a); adjE[a].push(edges.length - 1); adjE[b].push(edges.length - 1);
  }
  const projects = groups.filter((g) => g.kind === 'project').map((g) => {
    const moc = g.members.find((i) => nodes[i].type === 'project-moc');
    const secs = {};
    g.members.forEach((i) => { const s = nodes[i].sec || '0_개요'; (secs[s] = secs[s] || []).push(i); });
    const sections = Object.keys(secs).sort().map((s) => ({ key: s, name: s === '0_개요' ? '개요' : s.replace(/^\d+_/, ''), no: s === '0_개요' ? '00' : s.replace(/_.*$/, '').padStart(2, '0'), ids: secs[s] }));
    return Object.assign(g, { moc: moc === undefined ? g.members[0] : moc, sections: sections });
  });
  const pByGi = {}; projects.forEach((p) => { pByGi[p.gi] = p; });
  const pByCode = {}; projects.forEach((p) => { pByCode[p.code] = p; });
  const rnd = mkRng(7);
  const dust = [];
  for (let i = 0; i < 420; i++) { const d = randDir(rnd), r = 1.1 + 0.4 * Math.pow(rnd(), 1.6); dust.push({ p: [d[0] * r, d[1] * r, d[2] * r], tw: rnd() * 6.28 }); }
  const shards = [];
  for (let i = 0; i < 42; i++) {
    const c = randDir(rnd), r = 1.06 + 0.26 * rnd(), a = norm3(cross3(c, randDir(rnd))), b = cross3(c, a), sz = 0.022 + 0.05 * rnd();
    const v = [0, 2.1, 4.2].map((t, k) => { const q = t + rnd() * 0.8, f = sz * (0.6 + 0.6 * rnd()); return [(c[0] + (a[0] * Math.cos(q) + b[0] * Math.sin(q)) * f) * r, (c[1] + (a[1] * Math.cos(q) + b[1] * Math.sin(q)) * f) * r, (c[2] + (a[2] * Math.cos(q) + b[2] * Math.sin(q)) * f) * r]; });
    shards.push({ v: v, hue: rnd() < 0.65 ? '#B46CFF' : '#E25BFF' });
  }
  const tris = [], dirs = nodes.map((n) => n.dir);
  groups.forEach((g) => { if (g.shell === 'proj') plexus(dirs, g.members, 3, 0.42, tris, g.gi); else if (g.shell === 'tools') plexus(dirs, g.members, 2, 0.42, tris, g.gi); });
  const fib = nodes.map((n, i) => { const r = mkRng(300 + i); const up = randDir(r); return { tw: norm3(cross3(n.dir, up)), amp: 0.1 + 0.22 * r(), ph: r() * 6.28 }; });
  return { groups: groups, nodes: nodes, byName: byName, edges: edges, adj: adj, adjE: adjE, projects: projects, pByGi: pByGi, pByCode: pByCode, dust: dust, shards: shards, tris: tris, fib: fib };
}
const GRAPH = buildGraph();

// 노드 i의 "세계": 프로젝트 노드면 그 프로젝트, 아니면 이 주제로 진행한 프로젝트들
function relatedProjects(i) {
  const G = GRAPH, n = G.nodes[i], score = {};
  G.projects.forEach((p) => { score[p.gi] = 0; });
  n.used.forEach((u) => { const p = G.pByCode[u]; if (p) score[p.gi] += 3; });
  G.adj[i].forEach((j) => { const m = G.nodes[j]; if (m.kind === 'project') score[m.g] += m.type === 'project-moc' ? 2 : 1; });
  let list = G.projects.filter((p) => score[p.gi] > 0).map((p) => ({ p: p, w: score[p.gi], indirect: false }));
  if (!list.length) {
    const s2 = {}; G.projects.forEach((p) => { s2[p.gi] = 0; });
    G.adj[i].forEach((j) => { const m = G.nodes[j]; m.used.forEach((u) => { const p = G.pByCode[u]; if (p) s2[p.gi] += 1; }); G.adj[j].forEach((k) => { const q = G.nodes[k]; if (q.kind === 'project') s2[q.g] += 0.25; }); });
    list = G.projects.filter((p) => s2[p.gi] >= 1).map((p) => ({ p: p, w: Math.round(s2[p.gi]), indirect: true }));
  }
  return list.sort((a, b) => b.w - a.w);
}
function worldOf(i) {
  const G = GRAPH, n = G.nodes[i];
  if (n.kind === 'project') {
    const p = G.pByGi[n.g];
    return { i: i, center: p.moc, project: p, color: p.color, focus: n.type === 'project-moc' ? null : (n.sec || '0_개요'),
      planets: p.sections.length > 1 ? p.sections.map((s) => ({ label: s.name, no: s.no, color: p.color, w: s.ids.length, act: { sec: s.key } }))
        : p.members.filter((j) => j !== p.moc).map((j, k) => ({ label: G.nodes[j].name.replace(/^[^-\s]+-/, ''), no: String(k + 1).padStart(2, '0'), color: p.color, w: G.adj[j].size, act: { note: j }, link: true })) };
  }
  if (n.kind === 'home') {
    return { i: i, center: i, project: null, color: '#DCE6FF', focus: null, home: true,
      planets: G.projects.map((p) => ({ label: p.label, no: '', color: p.color, w: p.members.length, act: { go: p.moc } })) };
  }
  const rel = relatedProjects(i);
  return { i: i, center: i, project: null, color: n.color, focus: null, rel: rel,
    planets: rel.map((r) => ({ label: r.p.label, no: '', color: r.p.color, w: r.w, act: { go: r.p.moc } })) };
}

function createEngine(cv, opt, cb) {
  const ctx = cv.getContext('2d');
  const G = GRAPH, N = G.nodes.length, D = G.dust.length, TOT = D + N;
  const sx = new Float32Array(TOT), sy = new Float32Array(TOT), sz = new Float32Array(TOT), ss = new Float32Array(TOT);
  let LT = buildLetters(opt.introFont), T = LT.T; const BASE = 7;
  let W = 1, H = 1, dpr = 1, R = 300, cx = null, cy = null, ls = 1, lox = 0, loy = 0, Cx = 0, Cy = 0;
  const st = { yaw: 0.55, pitch: -0.2, vy: 0, vp: 0, drag: false, lx: 0, ly: 0, moved: 0, mx: -9999, my: -9999, hover: -1, tYaw: null, tPitch: null, wyaw: 0, wpitch: 0 };
  let mode = opt.intro ? 'intro' : 'main';
  let t0 = performance.now(), mainT0 = t0, dustT0 = t0, parts = null, pulses = [], pulseAcc = 0, visible = true, raf = 0, last = t0;
  let rnd = mkRng(Date.now() & 0xffff);
  let orbitT = 0, dv = null, world = null, wT0 = 0, warp = null, wHover = -1, flash = null;
  const cam = { z: 0, fx: 0, fy: 0 };
  const spr = {};
  function sprite(hex) {
    if (spr[hex]) return spr[hex];
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const q = rgbOf(hex);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',0.9)'); gr.addColorStop(0.22, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',0.32)'); gr.addColorStop(1, 'rgba(' + q[0] + ',' + q[1] + ',' + q[2] + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); spr[hex] = c; return c;
  }
  function layout() {
    ls = Math.min(W * 0.66 / LT.b.w, H * 0.3 / LT.b.h);
    Cx = W / 2; Cy = H * 0.46;
    lox = Cx - LT.b.cx * ls; loy = Cy - LT.b.cy * ls;
  }
  function resize() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); layout();
  }
  const ro = new ResizeObserver(resize); ro.observe(cv); resize();
  const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; }); io.observe(cv);

  function target() {
    const mob = W < 760;
    R = mob ? Math.min(W * 0.36, H * 0.2) : Math.min(W * 0.26, H * 0.34);
    return [mob ? W / 2 : W * 0.6, mob ? H * 0.3 : H * 0.5];
  }
  let cyw = 1, syw = 0, cp = 1, sp = 0, RR = 300, px = 0, py = 0;
  const F = 3.2;
  function pj(x, y, z, out, k) {
    const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    const den = F - (z2 - cam.z);
    if (den < 0.06) { out[0] = -9999; out[1] = -9999; out[2] = z2; out[3] = 0; }
    else { const s = F / den; out[0] = cx + px + (x1 - cam.fx) * s * RR; out[1] = cy + py - (y2 - cam.fy) * s * RR; out[2] = z2; out[3] = s; }
    if (k !== undefined) { sx[k] = out[0]; sy[k] = out[1]; sz[k] = z2; ss[k] = out[3]; }
    return out;
  }
  function rotOnly(p) { const x1 = p[0] * cyw + p[2] * syw, z1 = -p[0] * syw + p[2] * cyw; return [x1, p[1] * cp - z1 * sp, p[1] * sp + z1 * cp]; }
  const tmp = [0, 0, 0, 0], tmp2 = [0, 0, 0, 0], SM = {};
  function placeNodes() {
    for (const k in SHELLS) SM[k] = rotM(SHELLS[k].axis, SHELLS[k].spin * orbitT * 2.4);
    for (let i = 0; i < N; i++) {
      const n = G.nodes[i], m = SM[n.shell], d = n.dir, r = n.rad;
      n.p[0] = (m[0] * d[0] + m[1] * d[1] + m[2] * d[2]) * r; n.p[1] = (m[3] * d[0] + m[4] * d[1] + m[5] * d[2]) * r; n.p[2] = (m[6] * d[0] + m[7] * d[1] + m[8] * d[2]) * r;
    }
  }
  function projectAll(now) {
    cyw = Math.cos(st.yaw); syw = Math.sin(st.yaw); cp = Math.cos(st.pitch); sp = Math.sin(st.pitch);
    RR = R * (1 + 0.01 * Math.sin(now / 1900));
    placeNodes();
    const da = orbitT * 0.03, dc = Math.cos(da), ds = Math.sin(da);
    for (let k = 0; k < D; k++) { const p = G.dust[k].p; pj(p[0] * dc + p[2] * ds, p[1], -p[0] * ds + p[2] * dc, tmp, k); }
    for (let i = 0; i < N; i++) { const p = G.nodes[i].p; pj(p[0], p[1], p[2], tmp, D + i); }
  }
  function dep(z) { return clamp((z + 1.15) / 2.3, 0, 1); }
  function nodeR(i) { return G.nodes[i].size * 0.62 * ss[D + i] * clamp(R / 330, 0.7, 1.3); }
  function hitTest(x, y) {
    let best = -1, bd = 1e9;
    for (let i = 0; i < N; i++) { const k = D + i; if (ss[k] <= 0 || sz[k] < -0.6) continue; const d = Math.hypot(sx[k] - x, sy[k] - y); const lim = nodeR(i) * (G.nodes[i].shell === 'proj' ? 2.2 : 1) + 8; if (d < lim && d - sz[k] * 5 < bd) { bd = d - sz[k] * 5; best = i; } }
    return best;
  }
  function alignTo(i) {
    const p = G.nodes[i].p; const yaw = Math.atan2(-p[0], p[2]); const z1 = -p[0] * Math.sin(yaw) + p[2] * Math.cos(yaw);
    return [yaw, clamp(Math.atan2(p[1], z1), -1.35, 1.35)];
  }
  function dive(i) {
    if (mode !== 'main' || i < 0) return;
    const a = alignTo(i); st.tYaw = a[0]; st.tPitch = a[1]; st.vy = 0; st.vp = 0;
    mode = 'dive'; dv = { i: i, t0: performance.now(), zmax: 0 }; st.hover = -1; cv.style.cursor = 'default';
    cb.onDive(i);
  }
  // pointer
  function pos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function onDown(e) { if (mode !== 'main' && mode !== 'world') return; st.drag = true; st.lx = e.clientX; st.ly = e.clientY; st.moved = 0; try { cv.setPointerCapture(e.pointerId); } catch (_) {} }
  function onMove(e) {
    const p = pos(e); st.mx = p[0]; st.my = p[1];
    if (!st.drag) return;
    const dx = e.clientX - st.lx, dy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY; st.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'world') { st.wyaw += dx * 0.005; st.wpitch = clamp(st.wpitch + dy * 0.004, -0.6, 0.6); return; }
    if (st.moved > 5) { st.tYaw = null; st.tPitch = null; }
    st.yaw += dx * 0.006; st.pitch = clamp(st.pitch + dy * 0.006, -1.25, 1.25); st.vy = dx * 0.0035; st.vp = dy * 0.0035;
  }
  function onUp(e) {
    if (!st.drag) return; st.drag = false;
    if (st.moved >= 6) return;
    const p = pos(e);
    if (mode === 'main') { const h = hitTest(p[0], p[1]); if (h >= 0) dive(h); }
    else if (mode === 'world' && !warp) { const h = planetHit(p[0], p[1]); if (h >= 0) planetAct(h); }
  }
  function onLeave() { st.mx = -9999; st.my = -9999; }
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp); cv.addEventListener('pointerleave', onLeave);

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function dustA(k, now) { const d = dep(sz[k]); return (0.06 + 0.5 * d * d) * (0.7 + 0.3 * Math.sin(now * 0.0021 + G.dust[k].tw)); }
  function dustS(k) { return (0.5 + 1.3 * dep(sz[k])) * ss[k]; }

  // ---------- intro ----------
  // 잉크 = 금속 골드: 획 방향과 가상 광원의 각도로 앤틱(어두운) ↔ 샴페인(밝은) 골드 사이를 고른다
  let INK = null;
  function inkBuild() {
    const q = rgbOf(opt.ink || '#D4AF6A'), mix = (a, b, f) => Math.round(a + (b - a) * f);
    const dark = q.map((v) => v * 0.55), light = q.map((v) => mix(v, 255, 0.55));
    const rgb = (c, f) => 'rgb(' + c.map((v) => Math.round(v * f)).join(',') + ')';
    // 깊이(알파) 대신 검정 쪽으로 어둡게 한 불투명 색을 쓴다 → 겹쳐도 알파가 쌓여 밝아지지 않는다
    // sd[lvl*16 + shade]: lvl 0~7 = 깊이 (lvl+0.5)/8, lvl 8 = 원색. gd/ld[lvl]: 글로우·점 색, lvl/8 배
    const sd = [], gd = [], ld = [];
    for (let l = 0; l <= 8; l++) {
      const f = l < 8 ? (l + 0.5) / 8 : 1;
      for (let i = 0; i < 16; i++) sd.push(rgb([0, 1, 2].map((k) => dark[k] + (light[k] - dark[k]) * i / 15), f));
      gd.push(rgb(q, l / 8)); ld.push(rgb(light, l / 8));
    }
    INK = { key: (opt.ink || '') + '|', sd: sd, gd: gd, ld: ld, glow: 'rgb(' + q.join(',') + ')', light: 'rgb(' + light.join(',') + ')', hot: '#' + light.map((v) => mix(v, 255, 0.4).toString(16).padStart(2, '0')).join(''), base: opt.ink || '#D4AF6A', w: opt.inkScale ?? 0.6 };
  }
  inkBuild();
  // 띠(band) 렌더러: 점 열 → 좌우 법선 오프셋 다각형. 선분마다 stroke하던 것을 획당 수 회의 fill로 줄인다
  const MAXP = 8192, BX = new Float32Array(MAXP), BY = new Float32Array(MAXP), BR = new Float32Array(MAXP), BA = new Float32Array(MAXP), NX = new Float32Array(MAXP), NY = new Float32Array(MAXP), BK = new Int16Array(MAXP);
  function inkIdx(ax, ay, bx, by) { const a = Math.atan2(by - ay, bx - ax); const f = 0.5 + 0.5 * Math.cos(2 * (a - 0.75)); return Math.min(15, Math.floor(Math.pow(f, 0.8) * 16)); }
  function fillBand(c, s0, e0, k) {
    c.beginPath();
    for (let i = s0; i <= e0; i++) { const r = BR[i] * k; if (i === s0) c.moveTo(BX[i] + NX[i] * r, BY[i] + NY[i] * r); else c.lineTo(BX[i] + NX[i] * r, BY[i] + NY[i] * r); }
    for (let i = e0; i >= s0; i--) { const r = BR[i] * k; c.lineTo(BX[i] - NX[i] * r, BY[i] - NY[i] * r); }
    c.closePath(); c.fill();
  }
  function disc(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  // 획 겹침 처리: 글로우와 잉크를 각각 오프스크린 레이어에 'lighten'(채널별 최댓값)으로 그린다.
  // 겹친 곳은 더 밝아지지 않고 둘 중 밝은 쪽만 남는다 → 마지막에 글로우(0.14) → 잉크 순서로 본 캔버스에 합성
  const GL = document.createElement('canvas'), gctx = GL.getContext('2d'), CL = document.createElement('canvas'), cctx = CL.getContext('2d');
  function layersBegin() {
    [[GL, gctx], [CL, cctx]].forEach((p) => {
      const c = p[0], g = p[1];
      if (c.width !== cv.width || c.height !== cv.height) { c.width = cv.width; c.height = cv.height; }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, c.width, c.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.globalCompositeOperation = 'lighten'; g.globalAlpha = 1;
    });
  }
  function layersEnd() {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.14; ctx.drawImage(GL, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(CL, 0, 0);
    ctx.restore();
  }
  const lvl = (a) => Math.min(7, Math.floor(a * 8));
  // n개 점(BX/BY = 위치, BR = 반폭, BA = 깊이 0~1). glowA = 글로우 세기 배율, depth = BA로 어둡게 (layersBegin/End 사이에서 호출)
  function drawBand(n, glowA, depth) {
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const i0 = i > 0 ? i - 1 : 0, i1 = i < n - 1 ? i + 1 : n - 1;
      const tx = BX[i1] - BX[i0], ty = BY[i1] - BY[i0], l = Math.hypot(tx, ty) || 1;
      NX[i] = -ty / l; NY[i] = tx / l; if (BR[i] < 0.3) BR[i] = 0.3;
    }
    let am = 1; if (depth) { am = 0; for (let i = 0; i < n; i++) am += BA[i]; am /= n; }
    gctx.fillStyle = INK.gd[Math.round(clamp(glowA * am, 0, 1) * 8)]; fillBand(gctx, 0, n - 1, 3.4);
    for (let i = 0; i < n - 1; i++) BK[i] = inkIdx(BX[i], BY[i], BX[i + 1], BY[i + 1]) + 16 * (depth ? lvl((BA[i] + BA[i + 1]) / 2) : 8);
    let s0 = 0;
    while (s0 < n - 1) {
      let e = s0; while (e + 1 < n - 1 && BK[e + 1] === BK[s0]) e++;
      cctx.fillStyle = INK.sd[BK[s0]]; fillBand(cctx, s0, e + 1, 1); s0 = e + 1;
    }
    cctx.fillStyle = INK.sd[(BK[0] & 15) + 16 * (depth ? lvl(BA[0]) : 8)]; disc(cctx, BX[0], BY[0], BR[0]);
    cctx.fillStyle = INK.sd[(BK[n - 2] & 15) + 16 * (depth ? lvl(BA[n - 1]) : 8)]; disc(cctx, BX[n - 1], BY[n - 1], BR[n - 1]);
  }
  const tips = [];
  function drawWriting(t) {
    layersBegin(); tips.length = 0;
    LT.strokes.forEach((s) => {
      const raw = clamp((t - s.t0) / (s.t1 - s.t0), 0, 1); if (raw <= 0) return;
      const p = 0.5 - 0.5 * Math.cos(Math.PI * raw);   // 획마다 펜이 가속했다 감속한다
      if (s.dot) {
        const x = s.dot.x * ls + lox, y = s.dot.y * ls + loy, r = s.dot.r * ls * INK.w * 1.15 * eOut(p);
        gctx.fillStyle = INK.gd[8]; disc(gctx, x, y, r * 2.4);
        cctx.fillStyle = INK.ld[8]; disc(cctx, x, y, r);
        return;
      }
      const lim = p * s.len, pts = s.pts, k = BASE * ls * INK.w * 0.5; let n = 0;
      for (let i = 0; i < pts.length && n < MAXP; i++) {
        const b = pts[i];
        if (i > 0 && b.c > lim) { const a = pts[i - 1], f = (lim - a.c) / ((b.c - a.c) || 1); BX[n] = (a.x + (b.x - a.x) * f) * ls + lox; BY[n] = (a.y + (b.y - a.y) * f) * ls + loy; BR[n] = (a.w + (b.w - a.w) * f) * k; n++; break; }
        BX[n] = b.x * ls + lox; BY[n] = b.y * ls + loy; BR[n] = b.w * k; n++;
      }
      drawBand(n, 1, false);
      if (raw < 1 && n > 0) tips.push([BX[n - 1], BY[n - 1], (40 + 26 * Math.sin(Math.PI * raw)) * ls]);
    });
    layersEnd();
    ctx.globalAlpha = 0.9; tips.forEach((q) => ctx.drawImage(sprite(INK.hot), q[0] - q[2] / 2, q[1] - q[2] / 2, q[2], q[2]));   // 펜 끝 불빛은 잉크 위에
    ctx.globalAlpha = 1;
  }

  // ---------- 획 → 접선 방향으로 출발 → 구형으로 휘감김 → 한 점 ----------
  // 각 획의 머리(쓰기가 끝난 끝점)가 그 지점의 접선 방향 그대로 출발하고, 몸통은 머리가 지나간 길을
  // 그대로 따라간다(길이 보존). 머리는 서서히 대원 궤도로 조향되며, 구 반지름이 0으로 줄어 한 점이 된다.
  const STEP = 1000 / 120, HS = STEP / 1000;
  let lines = null, simT = 0, r0 = 300;
  function n3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function rotAbout(v, k, a) { // Rodrigues
    const c = Math.cos(a), s0 = Math.sin(a), d = v[0] * k[0] + v[1] * k[1] + v[2] * k[2], x = cross3(k, v);
    return [v[0] * c + x[0] * s0 + k[0] * d * (1 - c), v[1] * c + x[1] * s0 + k[1] * d * (1 - c), v[2] * c + x[2] * s0 + k[2] * d * (1 - c)];
  }
  function buildLines() {
    lines = []; let md = 0;
    LT.strokes.forEach((st, si) => {
      const L = { tr: [], len: 0, dot: null, w: BASE * ls };
      if (st.dot) {
        const x = st.dot.x * ls + lox - Cx, y = st.dot.y * ls + loy - Cy;
        L.dot = st.dot.r * ls; L.tr.push([x, y, 0]);
        const rh = n3([x, y, 0]); L.dir = [-rh[1], rh[0], 0];
      } else {
        st.pts.forEach((p) => L.tr.push([p.x * ls + lox - Cx, p.y * ls + loy - Cy, 0]));
        L.len = st.len * ls;
        L.prof = []; for (let k = 0; k <= 24; k++) { const c = st.len * k / 24; let j = 0; while (j < st.pts.length - 2 && st.pts[j + 1].c < c) j++; const a = st.pts[j], b = st.pts[j + 1], f = clamp((c - a.c) / ((b.c - a.c) || 1), 0, 1); L.prof.push(a.w + (b.w - a.w) * f); }
        const a = L.tr[L.tr.length - 2], b = L.tr[L.tr.length - 1];
        L.dir = n3([b[0] - a[0], b[1] - a[1], 0]);           // 끝점 접선 = 출발 방향
      }
      L.L0 = L.len;
      const h = L.tr[L.tr.length - 1]; md = Math.max(md, Math.hypot(h[0], h[1]));
      L.delay = si * 22;
      lines.push(L);
    });
    r0 = Math.max(120, md * 0.8);
    lines.forEach((L, i) => {
      const p = L.tr[L.tr.length - 1], rh = n3(p);
      let n = cross3(p, L.dir); if (Math.hypot(n[0], n[1], n[2]) < 1e-3) n = [0, 0, 1];
      n = n3(n);
      // 궤도면을 반지름축으로 비틀어 화면 밖(z)으로 감기게 — 선마다 다른 각도
      L.n = n3(rotAbout(n, rh, (i % 2 ? 1 : -1) * (0.75 + 0.75 * ((i * 0.618) % 1))));
    });
    simT = T.writeEnd;
  }
  function radiusAt(t) { return r0 * (1 - eIO(clamp((t - T.go - 450) / (T.wrapDur - 450), 0, 1))); }
  function simStep(t, h) {
    const rr = radiusAt(t), age0 = t - T.go;
    const vmax = Math.min(W, H) * 0.72, wmax = 7.5;
    for (const L of lines) {
      const age = age0 - L.delay; if (age <= 0) continue;
      const p = L.tr[L.tr.length - 1];
      const d = Math.hypot(p[0], p[1], p[2]) || 1e-6, rh = [p[0] / d, p[1] / d, p[2] / d];
      let tg = cross3(L.n, p); const tl = Math.hypot(tg[0], tg[1], tg[2]);
      tg = tl > 1e-6 ? [tg[0] / tl, tg[1] / tl, tg[2] / tl] : L.dir;
      const rc = clamp((rr - d) / Math.max(rr, 25), -1.5, 1.5) * 1.6;
      const des = n3([tg[0] + rh[0] * rc, tg[1] + rh[1] * rc, tg[2] + rh[2] * rc]);
      const ks = 8.5 * Math.pow(clamp(age / 520, 0, 1), 1.6);            // 처음엔 순수 접선 직진, 점점 궤도로 조향
      const f = 1 - Math.exp(-ks * h);
      L.dir = n3([L.dir[0] + (des[0] - L.dir[0]) * f, L.dir[1] + (des[1] - L.dir[1]) * f, L.dir[2] + (des[2] - L.dir[2]) * f]);
      const sp = eOut(clamp(age / 350, 0, 1)) * Math.max(35, Math.min(vmax, wmax * Math.max(rr, d * 0.6)));
      let q = [p[0] + L.dir[0] * sp * h, p[1] + L.dir[1] * sp * h, p[2] + L.dir[2] * sp * h];
      const gEnd = clamp((t - T.go - T.wrapDur * 0.82) / (T.wrapDur * 0.18), 0, 1);
      if (gEnd > 0) { const k = Math.pow(1 - 0.12 * gEnd, h / HS); q = [q[0] * k, q[1] * k, q[2] * k]; }
      { const lp = L.tr[L.tr.length - 1], lq = L.tr.length > 1 ? L.tr[L.tr.length - 2] : null; if (lq && Math.hypot(lp[0] - lq[0], lp[1] - lq[1], lp[2] - lq[2]) < 1.5) L.tr[L.tr.length - 1] = q; else L.tr.push(q); }
      // 몸통 길이: 구가 줄면 같이 줄어든다 → 끝에는 점
      L.len = L.L0 * Math.pow(clamp(rr / r0, 0, 1), 0.8);
      let acc = 0, cutAt = 0;
      for (let i = L.tr.length - 1; i > 0; i--) { const a = L.tr[i], b = L.tr[i - 1]; acc += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (acc > L.len + 40) { cutAt = i - 1; break; } }
      if (cutAt > 64) L.tr.splice(0, cutAt);
    }
  }
  function projL(p, ca, sa, out) {
    const x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca, f = 3 * r0, s0 = f / (f - z);
    out[0] = Cx + x * s0; out[1] = Cy + p[1] * s0; out[2] = z; out[3] = s0; return out;
  }
  const pa = [0, 0, 0, 0], pb = [0, 0, 0, 0];
  function drawLines(t) {
    const rr = radiusAt(t), ph = Math.max(0, t - T.go) * 0.00038, ca = Math.cos(ph), sa = Math.sin(ph);
    const shrink = clamp(rr / r0, 0, 1);
    layersBegin();
    for (const L of lines) {
      const tr = L.tr, nT = tr.length;
      if (L.dot) {
        projL(tr[nT - 1], ca, sa, pa); const dep = clamp(0.35 + 0.65 * (pa[2] / Math.max(r0, 1) + 1) / 2, 0.3, 1);
        const r = L.dot * INK.w * 1.15 * pa[3] * (0.4 + 0.6 * shrink), dl = Math.round(dep * 8);
        gctx.fillStyle = INK.gd[dl]; disc(gctx, pa[0], pa[1], r * 2.4);
        cctx.fillStyle = INK.ld[dl]; disc(cctx, pa[0], pa[1], r);
        continue;
      }
      // 머리에서 뒤로 len만큼 걸어가며 점을 모은다 (u: 0=꼬리 .. 1=머리)
      let acc = 0, i = nT - 1, n = 0;
      const seg = L.seg || (L.seg = []); seg.length = 0; seg.push(i);
      while (i > 0 && acc < L.len) { const a = tr[i], b = tr[i - 1]; acc += Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); i--; seg.push(i); }
      const tot = Math.max(acc, 1e-3), kw = L.w * INK.w * (0.45 + 0.55 * shrink) * 0.5; let run = 0;
      for (let k = seg.length - 1; k >= 0 && n < MAXP; k--) {   // 꼬리 → 머리 순서로 채운다
        if (k < seg.length - 1) { const A = tr[seg[k + 1]], B = tr[seg[k]]; run += Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }
        projL(tr[seg[k]], ca, sa, pa);
        const u = clamp(run / tot, 0, 1), fk = u * 24, k0 = Math.min(23, Math.floor(fk)), w = L.prof[k0] + (L.prof[k0 + 1] - L.prof[k0]) * (fk - k0);
        BX[n] = pa[0]; BY[n] = pa[1]; BR[n] = w * kw * pa[3];
        BA[n] = clamp(0.3 + 0.7 * (pa[2] / Math.max(r0, 1) + 1) / 2, 0.25, 1); n++;
      }
      drawBand(n, 1, true);
    }
    layersEnd();
    // 점으로 모이는 코어
    const g = clamp((t - T.go - T.wrapDur * 0.55) / (T.wrapDur * 0.45), 0, 1);
    if (g > 0) {
      const pulse = t > T.pt ? 1 + 0.25 * Math.sin((t - T.pt) / 280 * Math.PI) : 1;
      const z = (30 + 120 * eIn(g)) * pulse; ctx.globalAlpha = eIn(g); ctx.drawImage(sprite(INK.hot), Cx - z / 2, Cy - z / 2, z, z);
      ctx.fillStyle = '#FFF6E0'; ctx.globalAlpha = eIn(g); ctx.beginPath(); ctx.arc(Cx, Cy, 1.5 + 2.5 * g, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function makeParticles() {
    parts = [];
    for (let j = 0; j < TOT; j++) {
      const ang = rnd() * Math.PI * 2, spd = (0.18 + 0.82 * Math.pow(rnd(), 0.8)) * Math.max(W, H) * 0.5;
      parts.push({ x0: Cx + (rnd() - 0.5) * 8, y0: Cy + (rnd() - 0.5) * 8, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dl: rnd() * 380 });
    }
  }
  function drawParticles(a, now, dt) {
    const bl = clamp((a - 1300) / 650, 0, 1), po = 1 - bl;   // 끝부분 650ms: 파티클 → 실제 그래프로 교차 페이드 (빈 프레임 없이)
    const M = Math.max(W, H);
    for (let r = 0; r < 2; r++) {
      const q = clamp((a - r * 140) / 950, 0, 1); if (q <= 0 || q >= 1) continue;
      ctx.globalAlpha = (1 - q) * (r ? 0.3 : 0.6); ctx.strokeStyle = INK.light; ctx.lineWidth = 2.2 * (1 - q) + 0.4;
      ctx.beginPath(); ctx.arc(Cx, Cy, eOut(q) * M * (r ? 0.38 : 0.6), 0, Math.PI * 2); ctx.stroke();
    }
    if (a < 600) { const z = 120 + 560 * eOut(a / 600); ctx.globalAlpha = 1 - a / 600; ctx.drawImage(sprite(INK.hot), Cx - z / 2, Cy - z / 2, z, z); }
    const k = 1 - Math.exp(-a / 240);
    ctx.fillStyle = INK.hot;
    for (let j = 0; j < TOT; j++) {
      const P = parts[j]; const bx = P.x0 + P.vx * k, by = P.y0 + P.vy * k;
      const h = eIO(clamp((a - 420 - P.dl) / 1150, 0, 1));
      const X = bx + (sx[j] - bx) * h, Y = by + (sy[j] - by) * h;
      if (j < D) { const ta = dustA(j, now), ts = dustS(j); ctx.globalAlpha = (0.9 + (ta - 0.9) * h) * po; const z = 1.8 + (ts - 1.8) * h; ctx.fillRect(X - z / 2, Y - z / 2, z, z); }
      else { const i = j - D; ctx.globalAlpha = 0.95 * po; ctx.fillStyle = h > 0.5 ? G.nodes[i].color : INK.hot; ctx.beginPath(); ctx.arc(X, Y, 1.2 + nodeR(i) * 0.6 * h, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = INK.hot; }
    }
    ctx.globalAlpha = 1;
    if (bl > 0) drawBrain(now, dt, bl, 1);
    if (a > 1950) { mode = 'main'; mainT0 = now - 900; dustT0 = now - 5000; cb.onMain(); }
  }
  // 로딩 표시 = 이니셜 뒤의 마법진(js/sigil.js)이 그려지는 정도. 터지는 순간 살짝 커지며 사라진다
  // SIG_A: 마법진 전체 세기 (낮을수록 배경처럼 은은하게, 시선은 이니셜에)
  const SIG = opt.intro && typeof createSigil === 'function' ? createSigil() : null, SIG_A = 0.55;
  function drawSigil(t) {
    const u = clamp((t - T.burst) / 1100, 0, 1); if (u >= 1) return;
    SIG.draw(ctx, { cx: Cx, cy: Cy, R: Math.min(W, H) * 0.44, p: clamp((t - 150) / (T.pt - 150), 0, 1), a: SIG_A * (1 - eIn(u)), s: 1 + 0.12 * eOut(u), tau: t, W: W, H: H, dpr: dpr });
  }


  // ---------- main : Shell Graph (Wires × Plexus) ----------
  const NG = G.groups.length, NE = G.edges.length;
  const order = Array.from({ length: N }, (_, i) => i), ep = [0, 0], tv = [0, 0, 0, 0];
  const ECX = new Float32Array(NE), ECY = new Float32Array(NE);
  function edgeCtrl(q) {
    const e = G.edges[q], a = G.nodes[e.a].p, b = G.nodes[e.b].p;
    const m0 = (a[0] + b[0]) / 2, m1 = (a[1] + b[1]) / 2, m2 = (a[2] + b[2]) / 2;
    let f = 0.74;
    if (e.same) { const l = Math.hypot(m0, m1, m2) || 1; f = Math.hypot(a[0], a[1], a[2]) * 1.04 / l; }
    pj(m0 * f, m1 * f, m2 * f, tmp2); ECX[q] = tmp2[0]; ECY[q] = tmp2[1];
  }
  function qpt(x0, y0, c0, c1, x1, y1, t, out) { const u = 1 - t; out[0] = u * u * x0 + 2 * u * t * c0 + t * t * x1; out[1] = u * u * y0 + 2 * u * t * c1 + t * t * y1; return out; }
  function sFont(px) { return (opt.fonts.it ? 'italic ' : '') + '400 ' + Math.round(px * opt.fonts.k) + 'px ' + opt.fonts.script; }
  function drawRings(now, fade) {
    const rings = [[1.42, 0.38, 0.00009], [1.6, -1.0, -0.00006]];
    ctx.setLineDash([1.2, 7]); ctx.lineWidth = 1;
    rings.forEach((R0, ri) => {
      const ct = Math.cos(R0[1]), st0 = Math.sin(R0[1]);
      ctx.globalAlpha = 0.16 * fade; ctx.strokeStyle = '#9FB4E8'; ctx.beginPath(); let on = false;
      for (let k = 0; k <= 120; k++) { const a = k / 120 * Math.PI * 2; const x = Math.cos(a) * R0[0], z0 = Math.sin(a) * R0[0]; pj(x, z0 * st0, z0 * ct, tmp); if (tmp[3] <= 0) { on = false; continue; } if (on) ctx.lineTo(tmp[0], tmp[1]); else { ctx.moveTo(tmp[0], tmp[1]); on = true; } }
      ctx.stroke();
      const a = now * R0[2] * 20 + ri * 2, x = Math.cos(a) * R0[0], z0 = Math.sin(a) * R0[0]; pj(x, z0 * st0, z0 * ct, tmp);
      if (tmp[3] > 0) { const z = 18 * tmp[3]; ctx.globalAlpha = (0.3 + 0.4 * dep(tmp[2])) * fade; ctx.drawImage(sprite('#DCE6FF'), tmp[0] - z / 2, tmp[1] - z / 2, z, z); }
    });
    ctx.setLineDash([]);
  }
  // 포커스/호버 강조(나머지 흐림·라벨 숨김)는 on/off 로 튀지 않도록 0~1 값으로 서서히 바꾼다.
  // 월드에서 돌아오는 'rise' 동안에는 시간에 맞춰 풀어서 마지막 프레임에 한꺼번에 밝아지는 끊김이 없게 한다.
  let actK = 0, actI = -1, lblK = 1;
  function drawBrain(now, dt, fB, fixN) {
    const focus = dv ? dv.i : -1, hov = st.hover, actNow = focus >= 0 ? focus : hov, rt = mode === 'rise' && dv ? now - dv.t0 : -1;
    if (actNow >= 0) actI = actNow;
    actK = rt >= 0 ? 1 - clamp((rt - 450) / 700, 0, 1) : actK + ((actNow >= 0 ? 1 : 0) - actK) * Math.min(1, dt * 0.008);
    lblK = rt >= 0 ? clamp((rt - 600) / 600, 0, 1) : lblK + ((focus < 0 ? 1 : 0) - lblK) * Math.min(1, dt * 0.006);
    if (actNow < 0 && actK < 0.005) { actK = 0; actI = -1; }
    const act = actI, actAdj = act >= 0 ? G.adj[act] : null;
    const fN = (fixN === undefined ? clamp((now - mainT0) / 900, 0, 1) : fixN) * fB, fD = clamp((now - dustT0) / 700, 0, 1) * fB;
    const dim = 1 - 0.55 * actK;
    // dust
    ctx.fillStyle = '#C9D4F2';
    for (let b = 0; b < 8; b++) {
      ctx.beginPath(); let any = false;
      for (let k = 0; k < D; k++) { if (ss[k] <= 0) continue; const a = dustA(k, now); if (Math.min(7, Math.floor(a * 12)) !== b) continue; const z = dustS(k); ctx.rect(sx[k] - z / 2, sy[k] - z / 2, z, z); any = true; }
      if (any) { ctx.globalAlpha = Math.min(1, (b + 0.5) / 12) * fD; ctx.fill(); }
    }
    drawRings(now, fN);
    // shards (ref: plexus 바깥 보랏빛 파편)
    const da = orbitT * 0.03, dc = Math.cos(da), ds = Math.sin(da);
    for (let s = 0; s < G.shards.length; s++) {
      const S = G.shards[s]; let zs = 0, ok = true;
      ctx.beginPath();
      for (let v = 0; v < 3; v++) { const p = S.v[v]; pj(p[0] * dc + p[2] * ds, p[1], -p[0] * ds + p[2] * dc, tmp); if (tmp[3] <= 0) { ok = false; break; } zs += tmp[2]; if (v) ctx.lineTo(tmp[0], tmp[1]); else ctx.moveTo(tmp[0], tmp[1]); }
      if (!ok) continue; ctx.closePath();
      const d = dep(zs / 3); ctx.fillStyle = S.hue; ctx.globalAlpha = (0.02 + 0.09 * d) * fN * dim; ctx.fill();
      ctx.strokeStyle = S.hue; ctx.lineWidth = 0.8; ctx.globalAlpha = (0.06 + 0.22 * d) * fN * dim; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    // core fibers (ref: Wires — 코어에서 모든 노드로 뻗는 실)
    const c0 = pj(0, 0, 0, tv), ox = c0[0], oy = c0[1];
    const FP = [new Path2D(), new Path2D(), new Path2D()];
    for (let i = 0; i < N; i++) {
      const k = D + i; if (ss[k] <= 0) continue;
      const n = G.nodes[i], f = G.fib[i], p = n.p, w = f.amp * n.rad * (1 + 0.18 * Math.sin(now * 0.0007 + f.ph));
      pj(p[0] * 0.5 + f.tw[0] * w, p[1] * 0.5 + f.tw[1] * w, p[2] * 0.5 + f.tw[2] * w, tmp);
      if (tmp[3] <= 0) continue;
      const P = FP[Math.min(2, Math.floor(dep(sz[k]) * 3))]; P.moveTo(ox, oy); P.quadraticCurveTo(tmp[0], tmp[1], sx[k], sy[k]);
    }
    ctx.lineWidth = 0.7; ctx.strokeStyle = '#A9BEFF';
    for (let b = 0; b < 3; b++) { ctx.globalAlpha = [0.04, 0.08, 0.15][b] * fN * dim; ctx.stroke(FP[b]); }
    // plexus faces on the outer shells
    const PF = [], PE = [];
    for (let g = 0; g < NG; g++) { PF.push([new Path2D(), new Path2D()]); PE.push([new Path2D(), new Path2D()]); }
    for (let t = 0; t < G.tris.length; t++) {
      const T3 = G.tris[t], a = D + T3.v[0], b = D + T3.v[1], c = D + T3.v[2];
      if (ss[a] <= 0 || ss[b] <= 0 || ss[c] <= 0) continue;
      const fr = (sz[a] + sz[b] + sz[c]) / 3 > 0 ? 1 : 0;
      const F3 = PF[T3.tag][fr]; F3.moveTo(sx[a], sy[a]); F3.lineTo(sx[b], sy[b]); F3.lineTo(sx[c], sy[c]); F3.closePath();
      const E3 = PE[T3.tag][fr]; E3.moveTo(sx[a], sy[a]); E3.lineTo(sx[b], sy[b]); E3.lineTo(sx[c], sy[c]); E3.closePath();
    }
    ctx.lineWidth = 0.7;
    for (let g = 0; g < NG; g++) {
      const gr = G.groups[g], pr = gr.shell === 'proj', col = gr.color;
      for (let fr = 0; fr < 2; fr++) {
        ctx.fillStyle = col; ctx.globalAlpha = (pr ? [0.035, 0.085] : [0.015, 0.035])[fr] * fN * dim; ctx.fill(PF[g][fr]);
        ctx.strokeStyle = col; ctx.globalAlpha = (pr ? [0.1, 0.26] : [0.05, 0.12])[fr] * fN * dim; ctx.stroke(PE[g][fr]);
      }
    }
    // link wires (볼트 링크 그대로) — 그룹색 × 깊이 3단 묶음
    const WP = []; for (let g = 0; g < NG; g++) WP.push([new Path2D(), new Path2D(), new Path2D()]);
    const HP = new Path2D(); let hpAny = false;
    for (let q = 0; q < NE; q++) {
      const e = G.edges[q], ia = D + e.a, ib = D + e.b; if (ss[ia] <= 0 || ss[ib] <= 0) { ECX[q] = -9999; continue; }
      edgeCtrl(q);
      if (act >= 0 && (e.a === act || e.b === act)) { HP.moveTo(sx[ia], sy[ia]); HP.quadraticCurveTo(ECX[q], ECY[q], sx[ib], sy[ib]); hpAny = true; }   // 강조선은 일반선 위에 덧그림 (강조가 풀려도 선이 사라지지 않게)
      const P = WP[e.gi][Math.min(2, Math.floor(dep((sz[ia] + sz[ib]) / 2) * 3))]; P.moveTo(sx[ia], sy[ia]); P.quadraticCurveTo(ECX[q], ECY[q], sx[ib], sy[ib]);
    }
    ctx.lineWidth = 0.8;
    for (let g = 0; g < NG; g++) { ctx.strokeStyle = G.groups[g].color; for (let b = 0; b < 3; b++) { ctx.globalAlpha = [0.035, 0.07, 0.13][b] * fN * dim; ctx.stroke(WP[g][b]); } }
    if (hpAny) { ctx.lineWidth = 1.2; ctx.strokeStyle = act >= 0 ? G.nodes[act].color : '#FFFFFF'; ctx.globalAlpha = 0.75 * fN * actK; ctx.stroke(HP); }
    // signal pulses
    pulseAcc += dt; const iv = act >= 0 ? 70 : 120;
    while (pulseAcc > iv) {
      pulseAcc -= iv; let q;
      if (act >= 0 && G.adjE[act].length && rnd() < 0.8) q = G.adjE[act][Math.floor(rnd() * G.adjE[act].length)]; else q = Math.floor(rnd() * NE);
      const e = G.edges[q]; pulses.push({ q: q, t: 0, fwd: act >= 0 ? e.a === act : rnd() < 0.5, sp: 1 / (650 + rnd() * 600) });
      if (pulses.length > 50) pulses.shift();
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const P = pulses[i]; P.t += dt * P.sp; if (P.t >= 1) { pulses.splice(i, 1); continue; }
      const e = G.edges[P.q], ia = D + e.a, ib = D + e.b; if (ECX[P.q] < -9000) continue;
      const col = G.nodes[P.fwd ? e.a : e.b].color, hl = act < 0 || e.a === act || e.b === act;
      for (let k = 0; k < 4; k++) {
        const tt = P.t - k * 0.03; if (tt < 0) break; const u = P.fwd ? tt : 1 - tt;
        qpt(sx[ia], sy[ia], ECX[P.q], ECY[P.q], sx[ib], sy[ib], u, ep);
        const a = (1 - k / 4) * Math.sin(Math.PI * P.t) * fN * (hl ? 1 : 1 - 0.75 * actK);
        if (k === 0) { ctx.globalAlpha = a * 0.9; ctx.drawImage(sprite(col), ep[0] - 7, ep[1] - 7, 14, 14); }
        ctx.globalAlpha = a; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(ep[0] - 0.9, ep[1] - 0.9, 1.8, 1.8);
      }
    }
    // core glow
    { const z = RR * 0.9 * c0[3]; ctx.globalAlpha = 0.55 * fN; ctx.drawImage(sprite('#9FB4FF'), ox - z / 2, oy - z / 2, z, z); const z2 = RR * 0.32 * c0[3]; ctx.globalAlpha = 0.9 * fN; ctx.drawImage(sprite('#FFFFFF'), ox - z2 / 2, oy - z2 / 2, z2, z2); }
    // nodes, back to front
    order.sort((a, b) => sz[D + a] - sz[D + b]);
    for (let o = 0; o < N; o++) {
      const i = order[o], n = G.nodes[i], k = D + i; if (ss[k] <= 0) continue;
      const x = sx[k], y = sy[k], d = dep(sz[k]), r = nodeR(i), s = ss[k];
      const on = act < 0 || i === act || actAdj.has(i);
      let a = (0.28 + 0.72 * d) * fN * (on ? 1 : 1 - 0.78 * actK);
      if (focus >= 0 && i !== focus && s > 2.4) a *= clamp((5.2 - s) / 2.8, 0, 1);
      if (a < 0.01) continue;
      const big = n.shell === 'proj';
      let gs = r * (big ? 7 : 5.5) * (i === hov ? 1.5 : 1); gs = i === focus ? Math.min(gs, 1400) : Math.min(gs, 240);
      ctx.globalAlpha = a * 0.85; ctx.drawImage(sprite(n.color), x - gs / 2, y - gs / 2, gs, gs);
      ctx.globalAlpha = a;
      if (n.kind === 'home') { const z = r * 7; ctx.drawImage(sprite('#FFFFFF'), x - z / 2, y - z / 2, z, z); ctx.fillStyle = '#FFF8E6'; ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, Math.PI * 2); ctx.fill(); }
      else if (big) {
        // 꽃봉오리(ref: Wires의 말단) — 코어에서 바깥 방향으로 눕힌 타원
        const ang = Math.atan2(y - oy, x - ox), L = r * (n.type === 'project-moc' ? 3 : 2.3), Wd = r * 1.05;
        ctx.fillStyle = mix(n.color, '#FFFFFF', 0.45); ctx.beginPath(); ctx.ellipse(x, y, L, Wd, ang, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * L * 0.55, y + Math.sin(ang) * L * 0.55, Math.max(0.8, r * 0.38), 0, Math.PI * 2); ctx.fill();
        if (n.type === 'project-moc') { ctx.strokeStyle = n.color; ctx.lineWidth = 1; ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.arc(x, y, r * (3.6 + 0.3 * Math.sin(now / 600 + i)), 0, Math.PI * 2); ctx.stroke(); }
      } else if (n.kind === 'tool') { ctx.fillStyle = n.color; ctx.beginPath(); ctx.moveTo(x, y - r * 1.3); ctx.lineTo(x + r * 1.3, y); ctx.lineTo(x, y + r * 1.3); ctx.lineTo(x - r * 1.3, y); ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle = n.color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.arc(x, y, r * 0.4, 0, Math.PI * 2); ctx.fill(); }
      if (i === hov && focus < 0) { const f = (now / 1400) % 1; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.1; ctx.globalAlpha = fN * 0.9; ctx.beginPath(); ctx.arc(x, y, r * 2.6 + 4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = fN * (1 - f) * 0.5; ctx.beginPath(); ctx.arc(x, y, r * (2.6 + f * 5) + 4, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    // project world labels (script)
    if (lblK > 0.01) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      G.projects.forEach((p) => {
        let c = [0, 0, 0]; p.members.forEach((i) => { const q = G.nodes[i].p; c[0] += q[0]; c[1] += q[1]; c[2] += q[2]; });
        c = norm3(c); pj(c[0] * 1.2, c[1] * 1.2, c[2] * 1.2, tmp); if (tmp[3] <= 0) return;
        const d = dep(tmp[2]); ctx.font = sFont(30 * clamp(tmp[3], 0.8, 1.2));
        ctx.globalAlpha = (0.25 + 0.75 * d) * fN * (1 - 0.65 * actK) * lblK; ctx.shadowColor = p.color; ctx.shadowBlur = 14; ctx.fillStyle = mix(p.color, '#FFFFFF', 0.35);
        ctx.fillText(p.label, tmp[0], tmp[1]); ctx.shadowBlur = 0;
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    // hover tooltip
    if (hov >= 0 && focus < 0) {
      const n = G.nodes[hov], k = D + hov;
      const sub = n.kind === 'project' ? n.grp.label + ' world' : n.kind === 'concept' ? 'Concept' : n.kind === 'tool' ? 'Tool' : n.kind === 'course' ? 'Course' : 'Home';
      ctx.font = '600 13px ' + opt.fonts.body; const w1 = ctx.measureText(n.name).width;
      ctx.font = sFont(19); const w2 = ctx.measureText(sub).width;
      const w = Math.max(w1, w2) + 28, h = 56; let x = sx[k] + nodeR(hov) * 2.6 + 14, y = sy[k] - h / 2; if (x + w > W - 8) x = sx[k] - w - nodeR(hov) * 2.6 - 14;
      ctx.globalAlpha = 0.94 * fN; ctx.fillStyle = 'rgba(8,10,18,0.92)'; rr(x, y, w, h, 12); ctx.fill();
      ctx.strokeStyle = n.color; ctx.globalAlpha = 0.55 * fN; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = fN; ctx.textBaseline = 'middle'; ctx.fillStyle = mix(n.color, '#FFFFFF', 0.3); ctx.font = sFont(19); ctx.fillText(sub, x + 14, y + 18);
      ctx.font = '600 13px ' + opt.fonts.body; ctx.fillStyle = '#F4F6FB'; ctx.fillText(n.name, x + 14, y + 38);
      ctx.textBaseline = 'alphabetic';
    }
    ctx.globalAlpha = 1;
  }

  // ---------- world : 노드 하나가 하나의 세계 ----------
  // 행성(섹션)에 들어가면 그 안의 노트들이 행성이 되는 하위 세계가 열린다
  function sectionWorld(base, s) {
    return { i: base.i, center: base.center, project: base.project, color: base.color, focus: null, sec: s.key, secInfo: s, parent: base,
      planets: s.ids.map((j, k) => ({ label: G.nodes[j].name.replace(/^[^-\s]+-/, ''), no: String(k + 1).padStart(2, '0'), color: base.color, w: G.adj[j].size, act: { note: j }, link: true })) };
  }
  function buildWorld(i, base) {
    const w = base || worldOf(i), r0 = mkRng(1000 + i * 13 + (w.sec ? w.secInfo.ids.length * 31 + 7 : 0));
    w.light = mix(w.color, '#FFFFFF', 0.55); w.deep = mix(w.color, '#000000', 0.6);
    const n = w.planets.length, maxW = Math.max(1, ...w.planets.map((p) => p.w));
    w.planets.forEach((p, k) => {
      p.a0 = (k / Math.max(1, n)) * Math.PI * 2 + 0.9; p.rad = 0.55 + 0.45 * Math.sqrt(p.w / maxW); p.spin = r0() * 6.28; p.sx = -9999; p.sy = -9999; p.sr = 0; p.z = 0;
      p.light = mix(p.color, '#FFFFFF', 0.55); p.rgb = rgbOf(p.color).join(','); p.ringC = mix(p.color, '#F4DEAA', 0.55);
      // 링 수 = 하위 노트 수(섹션) / 링크 수(노트), ponytail: 12개에서 자름 — 그 이상은 구가 링에 묻힌다
      const nr = clamp(Math.round(p.w), 1, 12);
      p.rings = Array.from({ length: nr }, (_, q) => {
        const f = fibDir(q, nr * 2), j = randDir(r0), nm = norm3([f[0] + j[0] * 0.15, f[1] + j[1] * 0.15, f[2] + j[2] * 0.15]);
        const u = norm3(cross3(nm, Math.abs(nm[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
        return { u: u, v: cross3(nm, u), r: nr > 1 ? 1.35 + 0.55 * q / (nr - 1) : 1.6, ph: r0() * 6.28, sp: (0.0004 + r0() * 0.0005) * (r0() < 0.5 ? -1 : 1) };
      });
    });
    st.wyaw = 0; st.wpitch = 0; wHover = -1;
    return w;
  }
  function wCenter() { const mob = W < 760; return mob ? [W / 2, H * 0.27, Math.min(W * 0.16, H * 0.11)] : [W * 0.65, H * 0.5, Math.min(W * 0.13, H * 0.2)]; }
  function planetHit(x, y) { if (!world) return -1; let b = -1, bd = 1e9; world.planets.forEach((p, k) => { const d = Math.hypot(p.sx - x, p.sy - y); if (d < p.sr + 16 && d < bd) { bd = d; b = k; } }); return b; }
  function planetAct(h) {
    const p = world.planets[h];
    if (p.act.sec) enterSection(p.act.sec);
    else if (p.act.note !== undefined) { if (world.pick !== p.act.note) pick(p.act.note); if (cb.onOpen) cb.onOpen(p.act.note); }   // 노트 행성: 짚고 본문 리더를 연다
    else travel(p.act.go);
  }
  // 노트 행성 선택(강조 링 + 패널 카드 강조)
  function pick(j) { if (mode !== 'world' || !world) return; world.pick = world.pick === j ? null : j; cb.onNote(world.pick); }
  // 섹션 행성 클릭 → 그 행성으로 줌인 → 행성 안의 세계(노트 행성들)
  let zm = null;
  // 포털 전환 상태: pz = 진입 중 정보, pE = 띠가 세로 동심원으로 일어선 정도(0~1), pS = 화면 배율, pSet = 다음 세계에서 띠가 다시 눕는 시작 시각
  let pz = null, pE = 0, pS = 1, pSet = 0;
  function enterSection(key) {
    if (mode !== 'world' || warp || !world || !world.project || world.sec) return;
    const k = world.planets.findIndex((p) => p.act.sec === key); if (k < 0) return;
    zm = { dir: 'in', k: k, key: key, t0: performance.now() }; mode = 'szoom'; wHover = -1; cv.style.cursor = 'default';
    if (cb.onZoom) cb.onZoom();
  }
  function exitSection() {
    const par = world.parent, k = par.planets.findIndex((p) => p.act.sec === world.sec);
    zm = { dir: 'out', k: Math.max(0, k), t0: performance.now(), par: par }; mode = 'szoom'; wHover = -1; pSet = 0; cv.style.cursor = 'default';
  }
  function travel(i) {
    if (mode !== 'world' || warp || !world || i < 0) return;
    const nw = worldOf(i);
    if (world.project && nw.project === world.project) { world.i = i; world.focus = nw.focus; cb.onWorld(i, nw.focus); return; }
    if (nw.center === world.center && !nw.project) return;
    warp = { to: i, t0: performance.now() };
  }
  function back() {
    if (!world || (mode !== 'world')) return;
    if (world.sec) { exitSection(); return; }
    warp = null;
    placeNodes(); const a = alignTo(world.i);
    st.yaw = a[0]; st.pitch = a[1]; st.tYaw = a[0]; st.tPitch = a[1];
    cyw = Math.cos(st.yaw); syw = Math.sin(st.yaw); cp = Math.cos(st.pitch); sp = Math.sin(st.pitch);
    const r3 = rotOnly(G.nodes[world.i].p); cam.fx = r3[0]; cam.fy = r3[1];
    dv = { i: world.i, t0: performance.now(), zmax: r3[2] + F - 0.2 }; cam.z = dv.zmax; mode = 'rise';
    cb.onRise();
  }
  let wcy_ = 0, wsy_ = 0, wcp_ = 1, wsp_ = 0;
  function wr(p, s0, C, out) {
    const x1 = p[0] * wcy_ + p[2] * wsy_, z1 = -p[0] * wsy_ + p[2] * wcy_, y2 = p[1] * wcp_ - z1 * wsp_, z2 = p[1] * wsp_ + z1 * wcp_, s = 3.4 / (3.4 - z2);
    out[0] = C[0] + x1 * s * C[2] * s0; out[1] = C[1] - y2 * s * C[2] * s0; out[2] = z2; out[3] = s; return out;
  }
  // ---------- 오러리 : 혼천의 코어 + 인장 행성 ----------
  const GOLD_L = '#F4DEAA', GOLD = '#D4AF6A', GOLD_D = '#7A5C32', TAU = Math.PI * 2;
  const RINGS = [   // u·v = 링 평면 기저, r = 반지름, spin = y축 자전(rad/ms) — 적도는 아래 금빛 띠(BAND)가 맡는다
    { u: [1, 0, 0], v: [0, 1, 0], r: 1, w: 0.9 },                      // 자오권
    { u: [1, 0, 0], v: [0, 0.4, 0.917], r: 0.84, w: 0.9, spin: 0.00018 },   // 황도권
    { u: [0.917, 0.4, 0], v: [0, 0, 1], r: 0.58, w: 0.8, spin: -0.0004 }    // 내부 링
  ], rv = [0, 0, 0];
  // ref: 금빛 고리(가는 동심 가닥 다발) + 금가루 + 수직 광선 + 떨어지는 불티
  const CR = mkRng(77);
  const BAND = Array.from({ length: 11 }, (_, k) => ({ rT: 0.34 + k * 0.125, r: 0.98 + k * 0.021 + (CR() - 0.5) * 0.008, a: 0.25 + 0.75 * Math.pow(CR(), 0.7) * (1 - Math.abs(k - 4) / 8), w: 0.5 + 0.5 * CR() }));
  const DUST = Array.from({ length: 260 }, () => { const g = (CR() + CR() + CR() - 1.5) / 1.5; return { r: 1.09 + g * 0.2, y: (CR() - 0.5) * 0.06 * (1 + Math.abs(g) * 2), a0: CR() * TAU, w: 0.00006 + 0.00008 * CR(), s: 0.7 + CR() * 1.1, ph: CR() * TAU }; });
  const SHELL = Array.from({ length: 220 }, (_, i) => fibDir(i, 220));
  const RAIN = Array.from({ length: 34 }, () => ({ x: (CR() - 0.5) * 0.26, z: (CR() - 0.5) * 0.26, off: CR(), v: 0.00005 + CR() * 0.00006, len: 0.04 + CR() * 0.09 }));
  function ringPt(R, t, sa, sc) {
    const c = Math.cos(t) * R.r * sc, s = Math.sin(t) * R.r * sc, x = R.u[0] * c + R.v[0] * s, z = R.u[2] * c + R.v[2] * s;
    rv[0] = x * Math.cos(sa) + z * Math.sin(sa); rv[1] = R.u[1] * c + R.v[1] * s; rv[2] = -x * Math.sin(sa) + z * Math.cos(sa); return rv;
  }
  // 뒤쪽 반(front=false)은 어두운 금, 앞쪽 반은 밝은 금 — 그 사이에 코어 구를 그려 깊이를 만든다
  function drawArmillary(now, el, a, C, front) {
    ctx.lineCap = 'round';
    RINGS.forEach((R, i) => {
      const g = eOut(clamp((el - 150 - i * 160) / 1500, 0, 1)); if (g <= 0.01) return;
      const sa = (R.spin || 0) * now, t0 = i * 1.7, N = Math.max(2, Math.ceil(96 * g)), P = new Path2D();
      let qx = 0, qy = 0, qz = 0;
      for (let k = 0; k <= N; k++) {
        wr(ringPt(R, t0 + (k / N) * g * TAU, sa, 1), 1, C, tmp);
        if (k && (qz + tmp[2] > 0) === front) { P.moveTo(qx, qy); P.lineTo(tmp[0], tmp[1]); }
        qx = tmp[0]; qy = tmp[1]; qz = tmp[2];
      }
      ctx.strokeStyle = front ? GOLD_L : GOLD_D; ctx.lineWidth = R.w * (front ? 1 : 0.8); ctx.globalAlpha = (front ? 0.6 : 0.45) * a * (1 - pE); ctx.stroke(P);
    });
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'lighter';
    if (!front) drawBeam(now, el, a, C);
    drawStrands(now, el, a, C, front);
    drawDust(now, el, a, C, front);
    if (front) { drawRain(now, el, a, C); drawGround(a, C); }
    ctx.globalCompositeOperation = 'source-over';
  }
  // 포털 변형: 수평 띠(xz 평면)의 점을 화면을 마주보는 동심원(반지름 rT)으로 일으켜 세운다
  function bandPt(t, r, y, rT, C, out) {
    rv[0] = Math.cos(t) * r; rv[1] = y; rv[2] = Math.sin(t) * r; wr(rv, 1, C, out);
    if (pE <= 0) return out;
    const cx_ = Math.cos(t) * wcy_ + Math.sin(t) * wsy_, cz_ = Math.sin(t) * wcy_ - Math.cos(t) * wsy_;   // 회전 후 같은 각도 자리를 유지해 비틀림 없이 일어선다
    out[0] += (C[0] + cx_ * rT * C[2] - out[0]) * pE; out[1] += (C[1] + cz_ * rT * C[2] - out[1]) * pE; out[2] = out[2] * (1 - pE) + pE * 0.6; return out;
  }
  // 광선이 닿는 바닥의 빛 고리(ref: 포털 아래 수평 원반)
  function drawGround(a, C) {
    if (pE <= 0.01) return;
    wr([0, -1.75, 0], 1, C, tmp); const rx = C[2] * 1.15 * pE, ry = rx * 0.13, g = pE * a;
    ctx.globalAlpha = 0.5 * g; ctx.drawImage(sprite(GOLD_L), tmp[0] - rx, tmp[1] - ry * 2.5, rx * 2, ry * 5);
    ctx.strokeStyle = GOLD_L; ctx.lineWidth = 0.8;
    [1, 0.72, 0.45].forEach((s, i) => { ctx.globalAlpha = (0.6 - i * 0.15) * g; ctx.beginPath(); ctx.ellipse(tmp[0], tmp[1], rx * s, ry * s, 0, 0, TAU); ctx.stroke(); });
    const z = C[2] * 0.45; ctx.globalAlpha = 0.9 * g; ctx.drawImage(sprite(GOLD_L), tmp[0] - z / 2, tmp[1] - z / 2, z, z);
  }
  // 수직 광선(극축): 중심이 가장 밝고 양끝으로 사라진다
  function drawBeam(now, el, a, C) {
    let g = eOut(clamp((el - 250) / 1400, 0, 1)) * a; if (g <= 0.01) return;
    const L = 2.6 * g + 3.5 * pE; g *= 1 + 0.8 * pE; wr([0, -L, 0], 1, C, tmp); wr([0, L, 0], 1, C, tmp2);
    const lg = ctx.createLinearGradient(tmp[0], tmp[1], tmp2[0], tmp2[1]);
    lg.addColorStop(0, 'rgba(244,222,170,0)'); lg.addColorStop(0.5, 'rgba(244,222,170,1)'); lg.addColorStop(1, 'rgba(244,222,170,0)');
    ctx.strokeStyle = lg; ctx.beginPath(); ctx.moveTo(tmp[0], tmp[1]); ctx.lineTo(tmp2[0], tmp2[1]);
    ctx.lineWidth = 6; ctx.globalAlpha = 0.07 * g; ctx.stroke();
    ctx.lineWidth = 1; ctx.globalAlpha = 0.75 * g; ctx.stroke();
  }
  // 적도 금빛 띠: 가는 동심 가닥 11개 + 바깥 눈금, 광선이 띠를 지나는 두 점에 플레어
  function drawStrands(now, el, a, C, front) {
    const g = eOut(clamp((el - 150) / 1600, 0, 1)); if (g <= 0.01) return;
    const N = Math.max(2, Math.ceil(120 * g)), t0 = -Math.PI / 2;
    BAND.forEach((B) => {
      const P = new Path2D(); let qx = 0, qy = 0, qz = 0;
      for (let k = 0; k <= N; k++) {
        bandPt(t0 + (k / N) * g * TAU, B.r, 0, B.rT, C, tmp);
        if (k && (qz + tmp[2] > 0) === front) { P.moveTo(qx, qy); P.lineTo(tmp[0], tmp[1]); }
        qx = tmp[0]; qy = tmp[1]; qz = tmp[2];
      }
      ctx.strokeStyle = front ? GOLD : GOLD_D; ctx.lineWidth = B.w; ctx.globalAlpha = B.a * (front ? 0.75 : 0.55) * a; ctx.stroke(P);
    });
    const T = new Path2D();
    for (let k = 0; k < 72; k++) {
      const t = k / 72 * TAU; if ((((t - t0) % TAU) + TAU) % TAU > g * TAU) continue;
      bandPt(t, 1.22, 0, 1.76, C, tmp); if ((tmp[2] > 0) !== front) continue;
      const r2 = k % 6 ? 1.25 : 1.3; bandPt(t, r2, 0, r2 + 0.54, C, tmp2); T.moveTo(tmp[0], tmp[1]); T.lineTo(tmp2[0], tmp2[1]);
    }
    ctx.strokeStyle = GOLD; ctx.lineWidth = 0.7; ctx.globalAlpha = (front ? 0.5 : 0.3) * a; ctx.stroke(T);
    // 화면상 광선과 띠가 겹치는 점(회전 후 x = 0)
    const fa = clamp((el - 1300) / 800, 0, 1) * a * (1 - pE); if (fa <= 0.01) return;
    const t1 = Math.atan2(-wcy_, wsy_);
    [t1, t1 + Math.PI].forEach((t) => {
      rv[0] = Math.cos(t) * 1.08; rv[1] = 0; rv[2] = Math.sin(t) * 1.08; wr(rv, 1, C, tmp); if ((tmp[2] > 0) !== front) return;
      const z = C[2] * (front ? 0.5 : 0.32) * (1 + 0.08 * Math.sin(now / 900 + t)); ctx.globalAlpha = (front ? 0.9 : 0.5) * fa;
      ctx.drawImage(sprite(GOLD_L), tmp[0] - z / 2, tmp[1] - z / 2, z, z);
    });
  }
  // 띠를 따라 천천히 도는 금가루(반짝임)
  function drawDust(now, el, a, C, front) {
    const g = clamp((el - 700) / 1200, 0, 1) * a; if (g <= 0.01) return;
    ctx.fillStyle = front ? GOLD_L : GOLD;
    DUST.forEach((d) => {
      bandPt(d.a0 + now * d.w, d.r, d.y, clamp(0.3 + (d.r - 0.85) * 2.8, 0.25, 1.8), C, tmp);
      if ((tmp[2] > 0) !== front) return;
      const tw = 0.5 + 0.5 * Math.sin(now * 0.0021 + d.ph), s = d.s * tmp[3];
      ctx.globalAlpha = (0.2 + 0.8 * tw * tw) * (front ? 0.9 : 0.4) * g; ctx.fillRect(tmp[0] - s / 2, tmp[1] - s / 2, s, s);
    });
  }
  // 코어 아래로 광선을 따라 떨어지는 불티
  function drawRain(now, el, a, C) {
    const g = clamp((el - 1500) / 1200, 0, 1) * a; if (g <= 0.01) return;
    ctx.strokeStyle = GOLD_L; ctx.lineWidth = 0.9;
    RAIN.forEach((d) => {
      const u = (d.off + now * d.v) % 1, y = -0.32 - u * 1.7;
      rv[0] = d.x; rv[1] = y; rv[2] = d.z; wr(rv, 1, C, tmp); rv[1] = y + d.len; wr(rv, 1, C, tmp2);
      ctx.globalAlpha = Math.sin(Math.PI * u) * (1 - u) * 0.8 * g; ctx.beginPath(); ctx.moveTo(tmp[0], tmp[1]); ctx.lineTo(tmp2[0], tmp2[1]); ctx.stroke();
    });
  }
  // 코어: 반짝이는 입자 껍질 + 프로젝트 색 플라스마 + 뜨거운 중심점
  function drawCore(now, el, a, C) {
    const g = eOut(clamp((el - 100) / 900, 0, 1)) * a; if (g <= 0.01) return;
    ctx.globalCompositeOperation = 'lighter';
    const halo = C[2] * 3; ctx.globalAlpha = 0.2 * g; ctx.drawImage(sprite(world.color), C[0] - halo / 2, C[1] - halo / 2, halo, halo);
    const gl = C[2] * 0.95 * (1 + 0.04 * Math.sin(now / 700)); ctx.globalAlpha = 0.55 * g; ctx.drawImage(sprite(world.color), C[0] - gl / 2, C[1] - gl / 2, gl, gl);
    // 광신호 도착: 코어가 한 번 크게 타오른다
    const fl = pz ? Math.sin(Math.PI * clamp((pz.u - 550) / 800, 0, 1)) : 0;
    if (fl > 0.01) { const z = C[2] * (0.5 + 1.8 * fl); ctx.globalAlpha = fl; ctx.drawImage(sprite(GOLD_L), C[0] - z / 2, C[1] - z / 2, z, z); }
    const sa = now * 0.00025, cs = Math.cos(sa), sn = Math.sin(sa), R = 0.3 * g * (1 - 0.5 * pE), BK = new Path2D(), FR = new Path2D();
    SHELL.forEach((v) => {
      rv[0] = (v[0] * cs + v[2] * sn) * R; rv[1] = v[1] * R; rv[2] = (-v[0] * sn + v[2] * cs) * R; wr(rv, 1, C, tmp);
      const s = 1.3 * tmp[3]; (tmp[2] > 0 ? FR : BK).rect(tmp[0] - s / 2, tmp[1] - s / 2, s, s);
    });
    ctx.fillStyle = world.color; ctx.globalAlpha = 0.45 * g; ctx.fill(BK);
    ctx.fillStyle = world.light; ctx.globalAlpha = 0.9 * g; ctx.fill(FR);
    const hz = C[2] * 0.42; ctx.globalAlpha = 0.85 * g; ctx.drawImage(sprite(GOLD_L), C[0] - hz / 2, C[1] - hz / 2, hz, hz);
    ctx.globalAlpha = g; ctx.fillStyle = '#FFF8E6'; ctx.beginPath(); ctx.arc(C[0], C[1], 2.4, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // 행성: 프로젝트 색 구 + 하위 노트 수만큼의 링(자이로처럼 서로 다른 기울기), 링마다 도는 구슬 하나
  const pq = [0, 0, 0];
  function orbPt(R, t, sc, cy, sy, out) {
    const c = Math.cos(t) * R.r, s = Math.sin(t) * R.r, x = R.u[0] * c + R.v[0] * s, y = R.u[1] * c + R.v[1] * s, z = R.u[2] * c + R.v[2] * s;
    const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    out[0] = x1 * sc; out[1] = -(y * 0.94 - z1 * 0.34) * sc; out[2] = y * 0.34 + z1 * 0.94; return out;
  }
  function drawOrb(p, x, y, r, a, now, hl) {
    const rs = r * 0.48, ya = now * 0.00022 + p.spin, cy = Math.cos(ya), sy = Math.sin(ya), BK = new Path2D(), FR = new Path2D();
    const beads = [];
    p.rings.forEach((R) => {
      let qx = 0, qy = 0, qz = 0;
      for (let k = 0; k <= 40; k++) {
        orbPt(R, k / 40 * TAU, rs, cy, sy, pq);
        if (k) { const P = qz + pq[2] > 0 ? FR : BK; P.moveTo(x + qx, y + qy); P.lineTo(x + pq[0], y + pq[1]); }
        qx = pq[0]; qy = pq[1]; qz = pq[2];
      }
      orbPt(R, R.ph + now * R.sp, rs, cy, sy, pq); beads.push([x + pq[0], y + pq[1], pq[2]]);
    });
    const bead = (front) => { ctx.fillStyle = front ? '#FFF8E6' : p.ringC; beads.forEach((b) => { if ((b[2] > 0) !== front) return; ctx.globalAlpha = (front ? 0.95 : 0.4) * a; ctx.beginPath(); ctx.arc(b[0], b[1], front ? 1.5 : 1.1, 0, TAU); ctx.fill(); }); };
    ctx.strokeStyle = p.ringC; ctx.lineWidth = 0.7; ctx.globalAlpha = (hl ? 0.5 : 0.3) * a; ctx.stroke(BK); bead(false);
    // 광원: 흰 중심 → 프로젝트 색 → 투명한 코로나 (가산 합성이라 뒤 링이 빛 속으로 녹아든다)
    ctx.globalCompositeOperation = 'lighter';
    const fl = 1 + 0.06 * Math.sin(now / 520 + p.spin * 3), cz = rs * 5 * fl;
    ctx.globalAlpha = (hl ? 0.75 : 0.55) * a; ctx.drawImage(sprite(p.color), x - cz / 2, y - cz / 2, cz, cz);
    const R2 = rs * 1.15 * fl, gr = ctx.createRadialGradient(x, y, 0, x, y, R2);
    gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(0.28, p.light); gr.addColorStop(0.62, 'rgba(' + p.rgb + ',0.75)'); gr.addColorStop(1, 'rgba(' + p.rgb + ',0)');
    ctx.globalAlpha = a; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x, y, Math.max(1, rs * 0.22), 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = p.ringC; ctx.lineWidth = hl ? 1 : 0.8; ctx.globalAlpha = (hl ? 1 : 0.8) * a; ctx.stroke(FR); bead(true);
  }
  function drawWorld(now, dt, aW, gW) {
    if (!world || aW <= 0.002) return;
    const C = wCenter(), mob = W < 760, el = now - wT0;
    wcy_ = Math.cos(now * 0.00008 + st.wyaw); wsy_ = Math.sin(now * 0.00008 + st.wyaw); wcp_ = Math.cos(0.3 + st.wpitch); wsp_ = Math.sin(0.3 + st.wpitch);
    // planets on a tilted orbit
    const Ro = mob ? 2.1 : 2.05, tilt = 0.42 + st.wpitch * 0.5, tS = Math.sin(tilt), tC = Math.cos(tilt);
    world.planets.forEach((p, k) => {
      const th = p.a0 + el * 0.00005 + st.wyaw * 0.35, X = Math.cos(th) * Ro, Z = Math.sin(th) * Ro, z = Z * tC, s = 6 / (6 - z);
      p.sx = C[0] + X * s * C[2]; p.sy = C[1] + Z * tS * s * C[2] * 0.95; p.z = z; p.s = s;
      p.pa = eOut(clamp((el - 450 - k * 110) / 900, 0, 1)) * aW;
      p.sr = C[2] * (mob ? 0.26 : 0.22) * p.rad * s * (0.6 + 0.4 * p.pa);
    });
    // 줌인/아웃: 선택한 행성이 화면 중심(세계 중심)으로 이동하며 확대된다. 라벨은 확대되는 동안 숨긴다
    if (pS !== 1) { ctx.save(); ctx.translate(C[0], C[1]); ctx.scale(pS, pS); ctx.translate(-C[0], -C[1]); }   // 포털 통과
    const lbl = pz ? clamp(1 - pz.u / 250, 0, 1) : 1 - pE;
    const drawP = (front) => {
      world.planets.forEach((p, k) => {
        if ((p.z >= 0) !== front || p.pa <= 0.01) return;
        let a = p.pa * (0.55 + 0.45 * clamp((p.z + Ro) / (2 * Ro), 0, 1));
        if (pz) a *= k === pz.k ? 1 - 0.9 * clamp((pz.u - 550) / 500, 0, 1) : 1 - eIO(clamp((pz.u - 150) / 750, 0, 1));   // 포털: 누른 행성만 남고 나머지는 물러난다
        if (a <= 0.01) return;
        const focus = (world.focus && p.act.sec === world.focus) || (p.act.note !== undefined && world.pick === p.act.note), hv = k === wHover;
        // 오러리 암: 코어 가장자리에서 행성까지 곧은 금선
        const dx = p.sx - C[0], dy = p.sy - C[1], dd = Math.hypot(dx, dy), r0 = C[2] * 1.12;
        if (dd > r0 + p.sr) { ctx.strokeStyle = GOLD_D; ctx.lineWidth = 0.8; ctx.globalAlpha = (focus || hv ? 0.9 : 0.5) * a; ctx.beginPath(); ctx.moveTo(C[0] + dx / dd * r0, C[1] + dy / dd * r0); ctx.lineTo(p.sx - dx / dd * p.sr, p.sy - dy / dd * p.sr); ctx.stroke(); }
        ctx.globalCompositeOperation = 'lighter';
        const gz = p.sr * 3; ctx.globalAlpha = (0.22 + (focus || hv ? 0.25 : 0)) * a; ctx.drawImage(sprite(p.color), p.sx - gz / 2, p.sy - gz / 2, gz, gz);
        ctx.globalCompositeOperation = 'source-over';
        drawOrb(p, p.sx, p.sy, p.sr, a, now, focus || hv);
        if (focus || hv) { const f = (now / 1300) % 1; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1; ctx.globalAlpha = 0.85 * a; ctx.beginPath(); ctx.arc(p.sx, p.sy, p.sr + 7, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = (1 - f) * 0.5 * a; ctx.beginPath(); ctx.arc(p.sx, p.sy, p.sr + 7 + f * 16, 0, Math.PI * 2); ctx.stroke(); }
        if (lbl <= 0.01) { ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; return; }
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = a * lbl;
        const kor = /[가-힣]/.test(p.label);
        const up = !front, ly = up ? p.sy - p.sr - (kor ? 40 : 50) : p.sy + p.sr + (kor ? 18 : 22);
        if (p.no) { ctx.font = sFont(20); ctx.fillStyle = mix(p.color, '#FFFFFF', 0.4); ctx.fillText(p.no, p.sx, up ? ly - 22 : p.sy - p.sr - 16); }
        ctx.font = kor ? '500 13px ' + opt.fonts.body : sFont(mob ? 24 : 30); ctx.fillStyle = '#F4F6FB';
        ctx.fillText(p.label, p.sx, ly);
        ctx.font = '400 11px ' + opt.fonts.body; ctx.fillStyle = '#8D97AE'; ctx.fillText((p.link ? '링크 ' : p.act.sec ? '노트 ' : '연결 ') + p.w, p.sx, ly + (kor ? 18 : 22));
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      });
    };
    // 궤도(점선) + 순서 호(01→02→…) — 앞/뒤로 나눠 코어 앞뒤에 그린다
    const orb = (th, o) => { const X = Math.cos(th) * Ro, Z = Math.sin(th) * Ro, s = 6 / (6 - Z * tC); o[0] = C[0] + X * s * C[2]; o[1] = C[1] + Z * tS * s * C[2] * 0.95; return Z >= 0; };
    const OD = [new Path2D(), new Path2D()], OA = [new Path2D(), new Path2D()], np = world.planets.length, ord = np > 1 && !!world.planets[0].no;
    const th0 = ord ? world.planets[0].a0 + el * 0.00005 + st.wyaw * 0.35 : 0, step = TAU / Math.max(1, np), arcEnd = (np - 1) * step;
    for (let k = 0; k < 140; k++) {
      const ta = k / 140 * TAU, tb = (k + 1) / 140 * TAU, f = orb((ta + tb) / 2, ep) ? 1 : 0;
      orb(ta, ep); OD[f].moveTo(ep[0], ep[1]); orb(tb, ep); OD[f].lineTo(ep[0], ep[1]);
      if (ord) { const ua = (((ta - th0) % TAU) + TAU) % TAU; if (ua + TAU / 140 <= arcEnd + 1e-6) { orb(ta, ep); OA[f].moveTo(ep[0], ep[1]); orb(tb, ep); OA[f].lineTo(ep[0], ep[1]); } }
    }
    const oA = aW * clamp((el - 300) / 800, 0, 1) * (1 - pE), aA = aW * clamp((el - 900) / 900, 0, 1) * (1 - pE);
    const drawOrbit = (f) => {
      ctx.setLineDash([1.2, 7]); ctx.strokeStyle = world.light; ctx.lineWidth = 1; ctx.globalAlpha = 0.22 * oA; ctx.stroke(OD[f]); ctx.setLineDash([]);
      if (ord) { ctx.strokeStyle = GOLD_L; ctx.lineWidth = 1; ctx.globalAlpha = (f ? 0.45 : 0.25) * aA; ctx.stroke(OA[f]); }
    };
    drawOrbit(0);
    drawP(false);
    // 혼천의 코어: 뒤쪽 링 → 코어 구 → 앞쪽 링
    drawArmillary(now, el, aW * gW, C, false);
    drawCore(now, el, aW * gW, C);
    drawArmillary(now, el, aW * gW, C, true);
    drawOrbit(1);
    // 순서 호를 따라 흐르는 빛(01 → 마지막)
    if (ord && aA > 0.01) { const u = (now * 0.00012) % 1; orb(th0 + u * arcEnd, ep); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(Math.PI * u) * aA; ctx.drawImage(sprite(world.color), ep[0] - 7, ep[1] - 7, 14, 14); ctx.globalCompositeOperation = 'source-over'; }
    drawP(true);
    // 광신호: 누른 행성에서 암을 따라 코어로 빨려 들어가는 빛(가속)
    if (pz && pz.sig < 1) {
      const P = world.planets[pz.k], hx = P.sx + (C[0] - P.sx) * pz.sig, hy = P.sy + (C[1] - P.sy) * pz.sig;
      ctx.globalCompositeOperation = 'lighter';
      const df = 1 - clamp(pz.u / 500, 0, 1), dz = P.sr * (3 + 5 * (1 - df)); ctx.globalAlpha = 0.9 * df; ctx.drawImage(sprite(P.color), P.sx - dz / 2, P.sy - dz / 2, dz, dz);
      ctx.strokeStyle = GOLD_L; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(P.sx, P.sy); ctx.lineTo(hx, hy); ctx.stroke();
      for (let j = 0; j < 10; j++) {
        const q = pz.rev ? pz.sig + j * 0.03 : pz.sig - j * 0.03; if (q < 0 || q > 1) break;   // 꼬리는 진행 방향 뒤쪽
        const x = P.sx + (C[0] - P.sx) * q, y = P.sy + (C[1] - P.sy) * q, z = (j ? 18 : 32) * (1 - j / 12);
        ctx.globalAlpha = 0.9 * (1 - j / 10); ctx.drawImage(sprite(j ? world.color : GOLD_L), x - z / 2, y - z / 2, z, z);
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (pS !== 1) ctx.restore();
    ctx.globalAlpha = 1;
  }
  function drawFlash(now) {
    if (!flash) return;
    const t = now - flash.t0, a = flash.in ? clamp(t / flash.dur, 0, 1) : 1 - clamp(t / flash.dur, 0, 1);
    if (!flash.in && t > flash.dur) { flash = null; return; }
    const C = flash.c || [W / 2, H / 2], g = ctx.createRadialGradient(C[0], C[1], 0, C[0], C[1], Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,255,255,' + (0.95 * a) + ')'); const q = rgbOf(flash.color); g.addColorStop(0.35, 'rgba(' + q.join(',') + ',' + (0.45 * a) + ')'); g.addColorStop(1, 'rgba(1,1,2,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(50, now - last); last = now;
    if (!visible) return;
    if (mode === 'main' && opt.orbit) orbitT += dt / 1000;
    if (!(st.drag && mode === 'main')) {
      if (st.tYaw !== null) { const k = Math.min(1, dt * (mode === 'dive' ? 0.0068 : 0.005)); st.yaw += angDiff(st.tYaw, st.yaw) * k; st.pitch += (st.tPitch - st.pitch) * k; }
      else if (mode === 'main' || mode === 'intro') { st.yaw += (opt.autoRotate ? 0.00009 * dt : 0) + st.vy; st.pitch = clamp(st.pitch + st.vp, -1.25, 1.25); st.vy *= 0.95; st.vp *= 0.95; st.pitch += (-0.2 - st.pitch) * 0.002; }
    }
    const tg = target(); if (cx === null) { cx = tg[0]; cy = tg[1]; }
    const lk = Math.min(1, dt * 0.004); cx += (tg[0] - cx) * lk; cy += (tg[1] - cy) * lk;
    const par = mode === 'main' && st.mx > -999 && !st.drag;
    px += ((par ? (st.mx - W / 2) * -0.012 : 0) - px) * 0.05; py += ((par ? (st.my - H / 2) * -0.012 : 0) - py) * 0.05;
    let fB = 1, aW = 0, gW = 1;
    if (mode !== 'szoom') {   // 다음 세계: 세로 동심원으로 선 채 들어와 다시 수평 띠로 눕는다
      pz = null; pE = 0; pS = 1;
      if (pSet) { const v = clamp((now - pSet) / 1300, 0, 1); pE = 1 - eIO(v); pS = 1 + 0.5 * (1 - eOut(v)); if (v >= 1) pSet = 0; }
    }
    if (mode === 'dive') {
      const t = now - dv.t0;
      cyw = Math.cos(st.yaw); syw = Math.sin(st.yaw); cp = Math.cos(st.pitch); sp = Math.sin(st.pitch);
      const r3 = rotOnly(G.nodes[dv.i].p), kf = Math.min(1, dt * 0.007);
      cam.fx += (r3[0] - cam.fx) * kf; cam.fy += (r3[1] - cam.fy) * kf;
      dv.zmax = r3[2] + F - 0.2; cam.z = eIn(clamp((t - 420) / 950, 0, 1)) * dv.zmax;
      fB = 1 - clamp((t - 1080) / 260, 0, 1);
      if (t > 1100 && !flash) flash = { t0: now, in: true, dur: 260, color: G.nodes[dv.i].color, c: [sx[D + dv.i], sy[D + dv.i]] };
      if (t > 1360) { world = buildWorld(dv.i); wT0 = now; mode = 'world'; const C = wCenter(); flash = { t0: now, in: false, dur: 700, color: world.color, c: [C[0], C[1]] }; cb.onWorld(dv.i, world.focus); }
    } else if (mode === 'rise') {
      const t = now - dv.t0;
      cam.z = (1 - eOut(clamp((t - 180) / 1050, 0, 1))) * dv.zmax;
      fB = clamp((t - 120) / 650, 0, 1); aW = 1 - clamp(t / 380, 0, 1); gW = 1 - clamp(t / 380, 0, 1);
      if (t > 1260) { mode = 'main'; cam.z = 0; cam.fx = 0; cam.fy = 0; dv = null; world = null; st.tYaw = null; st.tPitch = null; mainT0 = now - 900; cb.onBack(); }
    } else if (mode === 'szoom') {
      const u = now - zm.t0, Cc = wCenter(); fB = 0;
      if (zm.dir === 'in') {
        // 포털: 행성 → 광신호 → 코어 점화 → 띠가 세로 동심원으로 일어섬(ref: 수직 광선 + 동심원 포털) → 통과
        pz = { k: zm.k, u: u, sig: eIn(clamp(u / 650, 0, 1)) };
        pE = eIO(clamp((u - 600) / 950, 0, 1)); pS = 1 + 5 * eIn(clamp((u - 1450) / 550, 0, 1)); pSet = 0;
        aW = 1 - clamp((u - 1780) / 220, 0, 1); gW = aW;
        if (u > 1700 && !flash) flash = { t0: now, in: true, dur: 300, color: world.color, c: [Cc[0], Cc[1]] };
        if (u > 2010) {
          const par = world, s = par.project.sections.find((x) => x.key === zm.key); par.wT0 = wT0;
          world = buildWorld(par.i, sectionWorld(par, s)); wT0 = now; zm = null; aW = 1; gW = 1; mode = 'world';
          pz = null; pE = 1; pS = 1.5; pSet = now;
          flash = { t0: now, in: false, dur: 700, color: world.color, c: [Cc[0], Cc[1]] }; cb.onSec(world.sec);
        }
      } else {
        // 역재생: ① 이 세계의 띠가 포털로 일어서며 물러남(정착의 반대) → ② 상위 세계에서 진입 연출을 거꾸로(포털이 눕고 광신호가 행성으로 돌아감)
        if (u < 1300) {
          const w = u / 1300; pz = null; pE = eIO(w); pS = 1 + 0.5 * eIn(w);
          aW = 1 - clamp((u - 1100) / 200, 0, 1); gW = aW;
          if (u > 1050 && !flash) flash = { t0: now, in: true, dur: 250, color: world.color, c: [Cc[0], Cc[1]] };
        } else {
          if (world !== zm.par) { world = zm.par; wT0 = world.wT0; st.wyaw = 0; st.wpitch = 0; flash = { t0: now, in: false, dur: 700, color: world.color, c: [Cc[0], Cc[1]] }; cb.onSec(null); }
          const f = 2010 - (u - 1300);
          pz = { k: zm.k, u: f, sig: eIn(clamp(f / 650, 0, 1)), rev: true };
          pE = eIO(clamp((f - 600) / 950, 0, 1)); pS = 1 + 5 * eIn(clamp((f - 1450) / 550, 0, 1));
          aW = 1 - clamp((f - 1780) / 220, 0, 1); gW = aW;
          if (f <= 0) { zm = null; pz = null; pE = 0; pS = 1; aW = 1; gW = 1; mode = 'world'; }
        }
      }
    } else if (mode === 'world') {
      fB = 0; aW = 1;
      if (warp) {
        const u = (now - warp.t0) / 440; aW = 1 - eIn(clamp(u, 0, 1)); gW = 1 - clamp(u, 0, 1);
        if (u >= 1) { const C = wCenter(); world = buildWorld(warp.to); wT0 = now; warp = null; aW = 1; gW = 1; flash = { t0: now, in: false, dur: 650, color: world.color, c: [C[0], C[1]] }; cb.onWorld(world.i, world.focus); }
      }
    }
    if (mode !== 'world' && mode !== 'szoom') projectAll(now);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const gb = mode === 'intro' && parts ? eIO(clamp((now - t0 - T.burst) / 1950, 0, 1)) : mode === 'intro' ? 0 : 1;   // 글로우 중심도 순간이동 없이 그래프 쪽으로 이동
    const gx = Cx + (cx - Cx) * gb, gy = Cy + (cy - Cy) * gb;
    const bg = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W, H) * 0.62);
    bg.addColorStop(0, 'rgba(24,27,38,' + (0.22 * Math.max(fB, mode === 'intro' ? 1 : 0)) + ')'); bg.addColorStop(1, 'rgba(1,1,2,0)'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (world && aW > 0) { const C = wCenter(), q = rgbOf(world.color), wb = ctx.createRadialGradient(C[0], C[1], 0, C[0], C[1], Math.max(W, H) * 0.6); wb.addColorStop(0, 'rgba(' + q.join(',') + ',' + (0.16 * aW) + ')'); wb.addColorStop(1, 'rgba(1,1,2,0)'); ctx.fillStyle = wb; ctx.fillRect(0, 0, W, H); }
    if (mode === 'intro') {
      const t = now - t0;
      if (SIG) drawSigil(t);
      if (t < T.writeEnd) drawWriting(t);
      else if (t < T.burst) { if (!lines) buildLines(); const span = Math.min(t - simT, 100), nsub = Math.max(1, Math.ceil(span / STEP)); if (t - simT > 100) simT = t - 100; for (let k = 0; k < nsub; k++) { const h = (t - simT) / (nsub - k); simT += h; if (h > 0) simStep(simT, h / 1000); } drawLines(t); }
      else { if (!parts) { makeParticles(); if (cb.onBurst) cb.onBurst(); } drawParticles(t - T.burst, now, dt); }
    } else {
      if (mode === 'main') {
        if (!st.drag && st.mx > -999) { const h = hitTest(st.mx, st.my); if (h !== st.hover) { st.hover = h; cv.style.cursor = h >= 0 ? 'pointer' : 'grab'; cb.onHover(h); } }
        else if (st.drag) cv.style.cursor = 'grabbing';
        else if (st.hover !== -1) { st.hover = -1; cb.onHover(-1); }
      } else if (mode === 'world') {
        const h = st.mx > -999 && !st.drag && !warp ? planetHit(st.mx, st.my) : -1;
        if (h !== wHover) { wHover = h; cv.style.cursor = h >= 0 ? 'pointer' : 'grab'; }
      }
      if (fB > 0.002) drawBrain(now, dt, fB);
      drawWorld(now, dt, aW, gW);
      drawFlash(now);
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    dive: dive, travel: travel, back: back,
    mode: function () { return mode; },
    enterSection: enterSection, pick: pick,
    skip: function () { if (mode === 'intro') { const n = performance.now(); mode = 'main'; mainT0 = n; dustT0 = n; cb.onMain(); } },
    setOpts: function (o) { Object.assign(opt, o); inkBuild(); },
    destroy: function () { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp); cv.removeEventListener('pointerleave', onLeave); }
  };
}
