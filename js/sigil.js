/* N.H.W — 인트로 마법진 (로딩 표시를 대신한다)
   ref1: 신성기하 — 세로축을 따라 겹친 원, 축 위의 금빛 노드, 길게 뻗은 작도선
   ref2: 공학 마법진 — 동심 링·눈금·각도 숫자·기호 띠 + 링에 걸친 맞물린 기어
   인트로 동안 새까만 화면 위에서 획들이 무작위 순서·무작위 지점부터 그려져 p(0→1)에 맞춰 완성된다.
   다 그려진 정적 획은 오프스크린 캔버스에 한 번만 구워 두고, 그리는 중인 획·도는 기어·노드만 매 프레임 그린다.
   createSigil() → { draw(ctx, o) }   o = { cx, cy, R, p, a, s, tau, W, H, dpr } */
'use strict';
function createSigil() {
  const TAU = Math.PI * 2, rnd = Math.random;   // 그려지는 순서·시작점은 방문마다 달라진다
  const LINE = [226, 220, 204], GOLD = [212, 175, 106], GOLD_L = [250, 232, 190];
  const MFONT = "'Cambria Math','STIX Two Math','Noto Sans Math','Segoe UI Symbol','Times New Roman',serif";
  const MSYM = Array.from('ΣΔΩωλμρστφψθε∇∂∫∮∞≈≡∝±√∈⊗⊕ℏπξηζκνχ');
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const eIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), eOut = (x) => 1 - Math.pow(1 - x, 3);

  // ---------- 획 정의 (단위 좌표: 큰 원 반지름 = 1) ----------
  const ST = [], TX = [], ND = [];   // 획 · 글자 · 금빛 노드
  function stroke(segs, a, opt) {   // segs: [[x0,y0,x1,y1,...], ...] — 순서대로 이어 그린다
    opt = opt || {};
    const cl = segs.map((P) => { const c = new Float32Array(P.length / 2); for (let j = 1; j < c.length; j++) c[j] = c[j - 1] + Math.hypot(P[2 * j] - P[2 * j - 2], P[2 * j + 1] - P[2 * j - 1]); return c; });
    const s = { segs: segs, cl: cl, len: cl.reduce((t, c) => t + c[c.length - 1], 0), a: a, gear: opt.gear ?? -1, dur: opt.dur, tie: opt.tie, w: opt.w || 1, anc: opt.anc, baked: false };   // anc: 화면 비율 좌표에 붙는 획(칠판)
    ST.push(s); return s;
  }
  function circlePts(x, y, r, a0, dir) {
    const n = Math.max(48, Math.round(r * 260)), P = [];
    for (let i = 0; i <= n; i++) { const an = a0 + dir * TAU * i / n; P.push(x + Math.cos(an) * r, y + Math.sin(an) * r); }
    return P;
  }
  const circle = (x, y, r, a, opt) => stroke([circlePts(x, y, r, rnd() * TAU, rnd() < 0.5 ? 1 : -1)], a, opt);
  function line(x0, y0, x1, y1, a) {   // 선 위의 무작위 지점에서 양쪽으로 자라난다
    const f = 0.2 + 0.6 * rnd(), mx = x0 + (x1 - x0) * f, my = y0 + (y1 - y0) * f;
    const s = stroke([[mx, my, x0, y0]], a); stroke([[mx, my, x1, y1]], a, { tie: s });
  }
  function poly(pts, a) {   // 닫힌 다각형: 무작위 꼭짓점에서 시작
    const k = Math.floor(rnd() * pts.length), P = [];
    for (let i = 0; i <= pts.length; i++) { const q = pts[(k + i) % pts.length]; P.push(q[0], q[1]); }
    stroke([P], a);
  }
  function sweep(n, fn, a, dur) {   // 짧은 조각 n개(눈금·점선)를 무작위 각도부터 한 바퀴 훑으며 그린다
    const k = Math.floor(rnd() * n), dir = rnd() < 0.5 ? 1 : -1, segs = [];
    for (let i = 0; i < n; i++) { const P = fn(((k + dir * i) % n + n) % n); if (P) segs.push(P); }
    stroke(segs, a, { dur: dur });
  }
  const rad = (r0, r1, an) => [Math.cos(an) * r0, Math.sin(an) * r0, Math.cos(an) * r1, Math.sin(an) * r1];

  // 1) 바깥 테두리 (ref2): 이중 링 + 눈금 + 각도 숫자
  circle(0, 0, 1, 0.55); circle(0, 0, 0.985, 0.4);
  sweep(180, (i) => rad(0.985, 0.985 - (i % 5 ? 0.012 : 0.028), TAU * i / 180), 0.5, 0.24);
  circle(0, 0, 0.915, 0.4);
  for (let i = 0; i < 12; i++) TX.push({ x: 0, y: -0.95, rot: TAU * i / 12, s: String(i * 30).padStart(3, '0'), size: 0.03, a: 0.5 });
  // 2) 기호 띠
  circle(0, 0, 0.88, 0.45); circle(0, 0, 0.8, 0.45);
  sweep(36, (i) => rad(0.8, 0.88, TAU * i / 36), 0.35, 0.18);
  for (let i = 0; i < 36; i++) TX.push({ x: 0, y: -0.84, rot: TAU * (i + 0.5) / 36, s: MSYM[(i * 7 + 3) % MSYM.length], size: 0.046, a: 0.42 });
  // 3) 안쪽 링 + 안쪽 눈금 · 점선 궤도
  circle(0, 0, 0.72, 0.35);
  sweep(72, (i) => rad(0.72, 0.72 - (i % 6 ? 0.012 : 0.03), TAU * i / 72), 0.35, 0.16);
  sweep(96, (i) => { const a0 = TAU * i / 96; return circlePts(0, 0, 1.2, a0, 1).slice(0, 6); }, 0.26, 0.22);   // r=1.2 점선 궤도
  // 4) 별 다각형: 육각성(헥사그램) + 겹친 정사각형(팔각성)
  const vtx = (n, r, off) => Array.from({ length: n }, (_, i) => { const an = off + TAU * i / n; return [Math.cos(an) * r, Math.sin(an) * r]; });
  circle(0, 0, 0.66, 0.3);
  poly(vtx(3, 0.66, -Math.PI / 2), 0.32); poly(vtx(3, 0.66, Math.PI / 2), 0.32);
  vtx(6, 0.66, -Math.PI / 2).forEach((q) => circle(q[0], q[1], 0.022, 0.4));
  poly(vtx(4, 0.72, 0), 0.18); poly(vtx(4, 0.72, Math.PI / 4), 0.18);
  // 5) 신성기하 (ref1): 생명의 씨앗 + 세로축 원 기둥 + 베시카
  circle(0, 0, 0.25, 0.22); vtx(6, 0.25, -Math.PI / 2).forEach((q) => circle(q[0], q[1], 0.25, 0.2));
  [-0.75, -0.5, 0.5, 0.75].forEach((y) => circle(0, y, 0.25, 0.2));
  circle(0, -0.5, 0.5, 0.2); circle(0, 0.5, 0.5, 0.2);
  // 6) 작도선: 세로축 · 가로축 · 보조선 (화면 밖까지 길게)
  line(0, -1.55, 0, 1.55, 0.3); line(-1.65, 0, 1.65, 0, 0.22);
  line(-1.2, -0.5, 1.2, -0.5, 0.16); line(-1.2, 0.5, 1.2, 0.5, 0.16);
  [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]].forEach((q) => circle(q[0], q[1], 0.018, 0.35));
  // 7) 궤도 위 작은 인장 3개
  [-2.1, 0.35, 2.75].forEach((an) => { const x = Math.cos(an) * 1.2, y = Math.sin(an) * 1.2; circle(x, y, 0.06, 0.4); circle(x, y, 0.036, 0.35); poly(vtx(3, 0.05, an).map((q) => [q[0] + x, q[1] + y]), 0.3); ND.push({ x: x, y: y, r: 0.7 }); });
  // 8) 밀도 (ref: 빼곡한 비전 도해) — 바깥 수식 링 2겹 + 크기가 제각각인 작은 인장들 + 빈 곳의 수식 블록
  const FORM = ['∇·E = ρ/ε₀', '∇×B = μ₀J + μ₀ε₀∂E/∂t', 'ρ(∂u/∂t + u·∇u) = −∇p + μ∇²u', 'F(ω) = ∫f(t)e^(−iωt)dt', 'e^(iπ) + 1 = 0', 'σ = Eε', 'Re = ρuL/μ',
    'H(s) = ωₙ²/(s² + 2ζωₙs + ωₙ²)', 'ẋ = Ax + Bu', 'Mẍ + Cẋ + Kx = F(t)', '∂²u/∂t² = c²∇²u', 'det(A − λI) = 0', '∮B·dl = μ₀I', 'ΣF = ma', 'Q = ṁcₚΔT', 'τ = Iα',
    'L = T − V', 'δ∫L dt = 0', 'K = PS⁻¹ (Riccati)', 'J = ∫(xᵀQx + uᵀRu)dt', 'D = Σ nᵢ/Nᵢ', 'σₐ/σf + σₘ/σu = 1', 'Nu = hL/k', 'ε = ΔL/L₀', 'P = ½ρAv³Cp',
    'ζ = c/2√(km)', 'ωₙ = √(k/m)', 'G(jω) = |G|∠φ', 'ΔS ≥ ∫δQ/T', 'pV = nRT', 'ẏ = f(y,t)', 'x(k+1) = Φx(k) + Γu(k)', 'Ma = v/a', 'Cd = 2F/(ρv²A)', '∂ρ/∂t + ∇·(ρu) = 0'];
  const TR = [], TB = [];
  const fill = (n) => { let s = ''; for (let k = Math.floor(rnd() * FORM.length); s.length < n; k++) s += FORM[k % FORM.length] + '  ·  '; return Array.from(s).slice(0, n); };
  function textRing(ox, oy, r, size, a) { TR.push({ ox: ox, oy: oy, r: r, size: size, a: a, a0: rnd() * TAU, ch: fill(Math.max(8, Math.floor(TAU * r / (size * 0.62)))) }); }
  circle(0, 0, 0.745, 0.22); textRing(0, 0, 0.765, 0.022, 0.3);   // 안쪽 수식 띠 (0.72 ~ 0.8 사이)
  circle(0, 0, 1.32, 0.3); circle(0, 0, 1.45, 0.3); textRing(0, 0, 1.385, 0.034, 0.32);   // 가장 바깥 수식 링
  sweep(240, (i) => rad(1.32, 1.32 - (i % 10 ? 0.01 : 0.025), TAU * i / 240), 0.28, 0.24);
  const keep = (x, y, r) => Math.hypot(x / 1.15, y / 0.42) > 1 + r * 2;   // 가운데 이니셜 자리는 비운다
  for (let n = 0, tries = 0; n < 16 && tries < 600; tries++) {   // 작은 인장: 테두리 + 수식 띠 + (별·눈금·동심원 중 하나). 화면이 가로로 넓어 좌우로 더 멀리 퍼뜨린다
    const an = rnd() * TAU, d = 0.5 + rnd() * 1.5, x = Math.cos(an) * d * 1.25, y = Math.sin(an) * d * 0.72, r = 0.07 + Math.pow(rnd(), 1.6) * 0.26;
    if (!keep(x, y, r)) continue; n++;
    const a = 0.22 + rnd() * 0.14;
    circle(x, y, r, a + 0.08); circle(x, y, r * 0.8, a); textRing(x, y, r * 0.9, Math.max(0.014, r * 0.085), a + 0.06);
    const kind = Math.floor(rnd() * 3);
    if (kind === 0) { const m = [5, 6, 7, 8, 9][Math.floor(rnd() * 5)], kk = m === 6 ? 2 : Math.floor(m / 2) - (m % 2 ? 0 : 1); poly(vtx(m, r * 0.7, rnd() * TAU).map((q, i, arr) => arr[(i * kk) % m]).map((q) => [q[0] + x, q[1] + y]), a); }
    else if (kind === 1) { const m = 24 + Math.floor(r * 120); sweep(m, (i) => { const t = TAU * i / m; return [x + Math.cos(t) * r * 0.78, y + Math.sin(t) * r * 0.78, x + Math.cos(t) * r * (i % 4 ? 0.72 : 0.66), y + Math.sin(t) * r * (i % 4 ? 0.72 : 0.66)]; }, a, 0.14); circle(x, y, r * 0.35, a); }
    else { circle(x, y, r * 0.6, a); circle(x, y, r * 0.42, a); circle(x, y, r * 0.24, a); TX.push({ x: x, y: y, rot: 0, s: MSYM[Math.floor(rnd() * MSYM.length)], size: r * 0.3, a: a + 0.1 }); }
    if (r > 0.16 && rnd() < 0.6) textRing(x, y, r * 0.5, Math.max(0.012, r * 0.06), a);
  }
  // 9) 수식 칠판 (ref: 화면 끝까지 빼곡한 수식·그래프·도해 — 마법진은 그 칠판 위의 한 요소)
  // 화면 비율 좌표(u,v)에 붙어 화면 전체를 덮는다. 로딩이 진행될수록 칠판이 채워진다. 이니셜 자리는 옅게.
  const blockAt = (u, v, x, y, lines, size, a, rot) => TB.push({ anc: [u, v], x: x, y: y, rot: rot, lines: lines, size: size, a: a * (Math.hypot((u - 0.5) / 0.36, (v - 0.46) / 0.2) < 1 ? 0.35 : 1), n: lines.join('').length });
  const ell = (x, y, rx, ry, a0) => { const P = []; for (let i = 0; i <= 64; i++) { const t = a0 + TAU * i / 64; P.push(x + Math.cos(t) * rx, y + Math.sin(t) * ry); } return P; };
  const DIAG = [
    (s) => { const P = []; for (let i = 0; i <= 70; i++) { const x = i / 70; P.push(-s + x * 2 * s, -Math.exp(-2.4 * x) * Math.sin(x * 15) * s * 0.65); } return { g: [[-s, s * 0.75, -s, -s * 0.8], [-s, 0, s * 1.1, 0], P], l: [['x(t)', -s * 0.75, -s * 0.85], ['t', s * 1.15, s * 0.12]] }; },   // 감쇠 진동 응답
    (s) => ({ g: [ell(0, 0, s, s, 0), ell(0, 0, s, s * 0.3, 0), ell(0, 0, s * 0.36, s, 0), ell(0, -s * 0.55, s * 0.83, s * 0.22, 0)], l: [['r = R', s * 1.1, -s * 0.9]] }),   // 와이어 구
    (s) => ({ g: [ell(0, s * 0.75, s * 0.8, s * 0.22, 0), [-s * 0.8, s * 0.75, 0, -s * 0.95, s * 0.8, s * 0.75], [0, -s * 0.95, 0, s * 0.75], [0, s * 0.75, s * 0.8, s * 0.75]], l: [['h', s * 0.12, 0], ['r', s * 0.4, s * 0.95]] }),   // 원뿔
    (s) => ({ g: [[-s, s * 0.6, s, s * 0.6, s, -s * 0.7, -s, s * 0.6], ell(-s, s * 0.6, s * 0.3, s * 0.3, -0.6).slice(0, 14), [s * 0.82, s * 0.6, s * 0.82, s * 0.42, s, s * 0.42]], l: [['θ', -s * 0.55, s * 0.4], ['a', 0, s * 0.85], ['b', s * 1.18, 0], ['c', -s * 0.1, -s * 0.2]] }),   // 직각삼각형
    (s) => { const Z = [-s, 0]; for (let i = 1; i <= 9; i++) Z.push(-s + i * s * 0.11, i % 2 ? -s * 0.18 : s * 0.18); Z.push(0, 0); return { g: [[-s, -s * 0.5, -s, s * 0.5], Z, [0, -s * 0.35, s * 0.7, -s * 0.35, s * 0.7, s * 0.35, 0, s * 0.35, 0, -s * 0.35], [s * 0.7, 0, s * 1.15, 0, s * 1.05, -s * 0.07, s * 1.15, 0, s * 1.05, s * 0.07]], l: [['k', -s * 0.55, -s * 0.38], ['m', s * 0.35, 0], ['F', s * 1.2, -s * 0.15]] }; },   // 스프링–질량
    (s) => ({ g: [ell(0, 0, s, s * 0.62, 0), ell(0, 0, s * 0.5, s * 0.31, 0), [0, 0, s, 0], [0, 0, -s * 0.3, -s * 0.52]], l: [['O', -s * 0.08, s * 0.1], ['R', s * 0.5, -s * 0.1], ['2R', s * 0.75, s * 0.4]] }),   // 동심 타원
    (s) => { const P = []; for (let i = 0; i <= 140; i++) { const t = i / 140 * 5 * TAU; P.push(-s + (t / (5 * TAU)) * 2 * s - Math.sin(t) * s * 0.1, -Math.cos(t) * s * 0.18 + s * 0.05); } return { g: [P], l: [['y′ = −a³/x', -s * 0.2, -s * 0.45]] }; },   // 코일(트로코이드)
    (s) => { const P = []; for (let i = 0; i <= 50; i++) { const x = i / 50; P.push(-s + x * 2 * s, s * 0.45 - Math.min(1, x * 3) * s * 0.9 + Math.max(0, x - 0.33) * s * 0.55); } return { g: [[-s, -s * 0.7, -s, s * 0.7, s * 1.1, s * 0.7], P, [-s, -s * 0.45, s, -s * 0.45]], l: [['|G(jω)|', -s * 0.7, -s * 0.85], ['ω', s * 1.15, s * 0.6]] }; }   // 보드 선도
  ];
  const COLS = 10, ROWS = 7;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
    const u = (c + 0.5 + (rnd() - 0.5) * 0.6) / COLS, v = (r + 0.5 + (rnd() - 0.5) * 0.6) / ROWS, a = 0.32 + rnd() * 0.16;
    if (rnd() < 0.36) {   // 도해 + 라벨
      const s = 0.1 + rnd() * 0.08, D = DIAG[Math.floor(rnd() * DIAG.length)](s), aa = a * (Math.hypot((u - 0.5) / 0.36, (v - 0.46) / 0.2) < 1 ? 0.35 : 1);
      D.g.forEach((P) => stroke([P], aa, { anc: [u, v] }));
      D.l.forEach((L) => blockAt(u, v, L[1], L[2], [L[0]], 0.026, a, 0));
    } else {   // 수식 블록 2~4줄
      const L = 2 + Math.floor(rnd() * 3), lines = [], k0 = Math.floor(rnd() * FORM.length);
      for (let i = 0; i < L; i++) lines.push(FORM[(k0 + i * 5) % FORM.length]);
      blockAt(u, v, 0, 0, lines, 0.026 + rnd() * 0.016, a, (rnd() - 0.5) * 0.12);
    }
  }
  for (let i = 0; i < 60; i++) { const u = rnd(), v = rnd(); blockAt(u, v, 0, 0, [FORM[Math.floor(rnd() * FORM.length)]], 0.02 + rnd() * 0.012, 0.24 + rnd() * 0.14, (rnd() - 0.5) * 0.1); }   // 틈새를 메우는 한 줄 수식
  // 금빛 노드: 세로축 위 + 씨앗의 교점 + 육각성 꼭짓점
  for (let k = 1; k <= 6; k++) { ND.push({ x: 0, y: -k * 0.25, r: k === 2 || k === 4 ? 1.2 : 0.9 }, { x: 0, y: k * 0.25, r: k === 2 || k === 4 ? 1.2 : 0.9 }); }
  vtx(6, 0.433, -Math.PI / 3).forEach((q) => ND.push({ x: q[0], y: q[1], r: 0.7 }));
  vtx(6, 0.66, -Math.PI / 2).forEach((q) => ND.push({ x: q[0], y: q[1], r: 0.8 }));

  // ---------- 기어: 링에 걸쳐 맞물리는 기어열 (잇수 비로 회전, 위상 정렬) ----------
  // at: [각도, 거리] = 루트 기어 위치 / p: 맞물릴 부모, th: 부모에서 본 방향
  const GDEF = [
    { at: [-0.75, 0.86], z: 30, m: 0.012, ns: 6, w0: 0.00016 }, { p: 0, th: 0.55, z: 16, ns: 5 }, { p: 0, th: -2.15, z: 22, ns: 5 },
    { at: [2.45, 0.86], z: 36, m: 0.011, ns: 6, w0: -0.00012 }, { p: 3, th: 3.85, z: 14, ns: 4 }, { p: 3, th: 1.15, z: 20, ns: 5 },
    { at: [-2.55, 0.86], z: 24, m: 0.009, ns: 5, w0: 0.0002 }, { p: 6, th: -3.75, z: 12, ns: 4 },
    { at: [0.95, 0.86], z: 26, m: 0.01, ns: 5, w0: -0.00018 }, { p: 8, th: -0.45, z: 14, ns: 4 },
    { at: [0, 0], z: 64, m: 0.0156, ns: 0, w0: -0.00004, ring: 1 }   // 중심을 감싸는 톱니 링
  ];
  const GEARS = [];
  GDEF.forEach((d) => {
    const P = d.p !== undefined ? GEARS[d.p] : null, m = P ? P.m : d.m, rp = m * d.z / 2, G = { z: d.z, m: m, rp: rp };
    if (!P) { G.x = Math.cos(d.at[0]) * d.at[1]; G.y = Math.sin(d.at[0]) * d.at[1]; G.phi = rnd() * TAU; G.w = d.w0; }
    else {
      const dist = P.rp + rp, uA = (d.th - P.phi) * P.z / TAU;
      G.x = P.x + Math.cos(d.th) * dist; G.y = P.y + Math.sin(d.th) * dist;
      G.phi = d.th + Math.PI - (TAU / d.z) * (0.5 - uA); G.w = -P.w * P.z / d.z;
    }
    const gi = GEARS.length; GEARS.push(G);
    const ra = rp + m * 0.9, rd = rp - m, hw = Math.PI / d.z, k0 = Math.floor(rnd() * d.z), O = [];
    for (let i = 0; i <= d.z; i++) {
      const an = TAU * ((k0 + i) % d.z) / d.z;
      [[an - hw, rd], [an - hw * 0.55, ra], [an + hw * 0.55, ra], [an + hw, rd]].forEach((q, j) => { if (i < d.z || j === 0) O.push(Math.cos(q[0]) * q[1], Math.sin(q[0]) * q[1]); });
    }
    const a = d.ring ? 0.3 : 0.62;
    stroke([O], a, { gear: gi, dur: 0.2, w: 1.1 });
    const rim = rd - Math.max(m * 1.4, 0.012);
    stroke([circlePts(0, 0, rim, rnd() * TAU, 1)], a * 0.8, { gear: gi });
    if (d.ns) {
      const hub = rp * 0.22;
      stroke([circlePts(0, 0, hub, rnd() * TAU, 1), circlePts(0, 0, hub * 0.45, 0, 1)], a, { gear: gi });
      stroke(Array.from({ length: d.ns }, (_, i) => rad(hub, rim, TAU * i / d.ns + 0.3)), a * 0.85, { gear: gi, dur: 0.1 });
    }
  });

  // ---------- 타이밍: 무작위 시작, 길이에 비례한 지속, p=1 이전에 모두 완성 ----------
  ST.forEach((s) => {
    if (s.tie) { s.t0 = s.tie.t0; s.d = s.tie.d; return; }
    s.d = (s.dur || clamp(0.05 + s.len * 0.03, 0.06, 0.22)) * 1.5; s.t0 = rnd() * (0.97 - s.d);   // 획 하나하나가 천천히 (×1.5)
  });
  TX.forEach((x) => { x.d = 0.14; x.t0 = 0.05 + rnd() * 0.78; });
  ND.forEach((n) => { n.d = 0.16; n.t0 = 0.1 + rnd() * 0.72; });
  TR.concat(TB).forEach((x) => { x.d = 0.12 + rnd() * 0.1; x.t0 = 0.04 + rnd() * (0.94 - x.d); });   // 글자 띠·블록은 한 글자씩 써 내려간다

  // 노드 글로우 스프라이트
  const glow = document.createElement('canvas'); glow.width = glow.height = 64;
  { const g = glow.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, rgba(GOLD_L, 0.95)); gr.addColorStop(0.25, rgba(GOLD, 0.35)); gr.addColorStop(1, rgba(GOLD, 0)); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }

  // ---------- 그리기 ----------
  const bake = document.createElement('canvas'), bg = bake.getContext('2d'); let key = '';
  // 획 s를 길이 upto까지 그린다
  function path(c, s, upto, ox, oy, k, ca, sa) {
    let rem = upto, hx = 0, hy = 0, any = false;
    const X = (x, y) => ox + (x * ca - y * sa) * k, Y = (x, y) => oy + (x * sa + y * ca) * k;
    c.beginPath();
    for (let i = 0; i < s.segs.length && rem > 0; i++) {
      const P = s.segs[i], cl = s.cl[i], n = cl.length, L = cl[n - 1];
      c.moveTo(X(P[0], P[1]), Y(P[0], P[1])); any = true;
      if (rem >= L) { for (let j = 1; j < n; j++) c.lineTo(X(P[2 * j], P[2 * j + 1]), Y(P[2 * j], P[2 * j + 1])); hx = X(P[2 * n - 2], P[2 * n - 1]); hy = Y(P[2 * n - 2], P[2 * n - 1]); rem -= L; continue; }
      for (let j = 1; j < n; j++) {
        if (cl[j] <= rem) { c.lineTo(X(P[2 * j], P[2 * j + 1]), Y(P[2 * j], P[2 * j + 1])); continue; }
        const f = (rem - cl[j - 1]) / ((cl[j] - cl[j - 1]) || 1), x = P[2 * j - 2] + (P[2 * j] - P[2 * j - 2]) * f, y = P[2 * j - 1] + (P[2 * j + 1] - P[2 * j - 1]) * f;
        hx = X(x, y); hy = Y(x, y); c.lineTo(hx, hy); break;
      }
      rem = 0;
    }
    c.stroke();
    return any ? [hx, hy] : null;
  }
  function text(c, x, cx, cy, R, a) {
    c.save(); c.translate(cx, cy); c.rotate(x.rot); c.fillStyle = rgba(LINE, a); c.font = Math.max(6, Math.round(x.size * R)) + 'px ' + MFONT;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(x.s, x.x * R, x.y * R); c.restore();
  }
  // 원을 따라 도는 수식 띠: 앞에서부터 frac만큼의 글자
  function ring(c, T, cx, cy, R, frac) {
    const n = T.ch.length, m = Math.floor(n * frac), ox = cx + T.ox * R, oy = cy + T.oy * R, r = T.r * R;
    c.fillStyle = rgba(LINE, T.a); c.font = Math.max(5, Math.round(T.size * R)) + 'px ' + MFONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i < m; i++) { const an = T.a0 + TAU * i / n; c.save(); c.translate(ox + Math.cos(an) * r, oy + Math.sin(an) * r); c.rotate(an + Math.PI / 2); c.fillText(T.ch[i], 0, 0); c.restore(); }
  }
  // 수식 블록: 줄 단위로 써 내려간다
  function block(c, B, cx, cy, R, frac, W, H) {   // anc가 있으면 화면 비율 좌표 기준(칠판 필기 — 이탤릭)
    let left = Math.floor(B.n * frac); const px = Math.max(5, Math.round(B.size * R)), bx = B.anc ? B.anc[0] * W : cx, by = B.anc ? B.anc[1] * H : cy;
    c.save(); c.translate(bx + B.x * R, by + B.y * R); c.rotate(B.rot); c.fillStyle = rgba(LINE, B.a); c.font = (B.anc ? 'italic ' : '') + px + 'px ' + MFONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    const h = px * 1.45, y0 = -(B.lines.length - 1) * h / 2;
    for (let i = 0; i < B.lines.length && left > 0; i++) { const s = B.lines[i]; c.fillText(left >= s.length ? s : s.slice(0, left), 0, y0 + i * h); left -= s.length; }
    c.restore();
  }

  return {
    draw: function (ctx, o) {
      const R = o.R, cx = o.cx, cy = o.cy, p = o.p, lw = clamp(R / 420, 0.7, 1.3);
      const k2 = [Math.round(o.W * o.dpr), Math.round(o.H * o.dpr), cx, cy, R].join('|');
      if (k2 !== key) {   // 크기가 바뀌면 다시 굽는다
        key = k2; bake.width = Math.round(o.W * o.dpr); bake.height = Math.round(o.H * o.dpr);
        ST.forEach((s) => { s.baked = false; }); TX.concat(TR, TB).forEach((x) => { x.baked = false; });
      }
      bg.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); bg.lineCap = 'round'; bg.lineJoin = 'round';
      const ox = (s) => (s.anc ? s.anc[0] * o.W : cx), oy = (s) => (s.anc ? s.anc[1] * o.H : cy);
      ST.forEach((s) => { if (s.gear < 0 && !s.baked && p >= s.t0 + s.d) { bg.strokeStyle = rgba(LINE, s.a); bg.lineWidth = lw * s.w; path(bg, s, s.len, ox(s), oy(s), R, 1, 0); s.baked = true; } });
      TX.forEach((x) => { if (!x.baked && p >= x.t0 + x.d) { text(bg, x, cx, cy, R, x.a); x.baked = true; } });
      TR.forEach((x) => { if (!x.baked && p >= x.t0 + x.d) { ring(bg, x, cx, cy, R, 1); x.baked = true; } });
      TB.forEach((x) => { if (!x.baked && p >= x.t0 + x.d) { block(bg, x, cx, cy, R, 1, o.W, o.H); x.baked = true; } });

      ctx.save();
      if (o.s !== 1) { ctx.translate(cx, cy); ctx.scale(o.s, o.s); ctx.translate(-cx, -cy); }
      ctx.globalAlpha = o.a; ctx.drawImage(bake, 0, 0, o.W, o.H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ST.forEach((s) => {
        if (p <= s.t0 || (s.gear < 0 && s.baked)) return;
        const e = eIO(clamp((p - s.t0) / s.d, 0, 1));
        ctx.strokeStyle = rgba(LINE, s.a); ctx.lineWidth = lw * s.w;
        if (s.gear >= 0) { const G = GEARS[s.gear], an = G.phi + G.w * o.tau * 0.5; path(ctx, s, s.len * e, cx + G.x * R, cy + G.y * R, R, Math.cos(an), Math.sin(an)); }
        else path(ctx, s, s.len * e, ox(s), oy(s), R, 1, 0);
      });
      TX.forEach((x) => { if (x.baked || p <= x.t0) return; text(ctx, x, cx, cy, R, x.a * clamp((p - x.t0) / x.d, 0, 1)); });
      TR.forEach((x) => { if (!x.baked && p > x.t0) ring(ctx, x, cx, cy, R, clamp((p - x.t0) / x.d, 0, 1)); });
      TB.forEach((x) => { if (!x.baked && p > x.t0) block(ctx, x, cx, cy, R, clamp((p - x.t0) / x.d, 0, 1), o.W, o.H); });
      // 금빛 노드: 천천히 스며들듯 켜진다 (깜빡임·펜 끝 불꽃 없음 — 시선은 이니셜에)
      ND.forEach((n) => {
        if (p <= n.t0) return;
        const e = eIO(clamp((p - n.t0) / n.d, 0, 1)), z = R * 0.045 * n.r, x = cx + n.x * R, y = cy + n.y * R;
        ctx.globalAlpha = o.a * 0.45 * e; ctx.drawImage(glow, x - z / 2, y - z / 2, z, z);
        ctx.globalAlpha = o.a * 0.6 * e; ctx.fillStyle = rgba(GOLD_L, 1); ctx.beginPath(); ctx.arc(x, y, 0.8 + 0.5 * n.r, 0, TAU); ctx.fill();
      });
      ctx.restore(); ctx.globalAlpha = 1;
    }
  };
}
