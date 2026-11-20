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
    const s = { segs: segs, cl: cl, len: cl.reduce((t, c) => t + c[c.length - 1], 0), a: a, gear: opt.gear ?? -1, dur: opt.dur, tie: opt.tie, w: opt.w || 1, baked: false };
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

  return {
    draw: function (ctx, o) {
      const R = o.R, cx = o.cx, cy = o.cy, p = o.p, lw = clamp(R / 420, 0.7, 1.3);
      const k2 = [Math.round(o.W * o.dpr), Math.round(o.H * o.dpr), cx, cy, R].join('|');
      if (k2 !== key) {   // 크기가 바뀌면 다시 굽는다
        key = k2; bake.width = Math.round(o.W * o.dpr); bake.height = Math.round(o.H * o.dpr);
        ST.forEach((s) => { s.baked = false; }); TX.forEach((x) => { x.baked = false; });
      }
      bg.setTransform(o.dpr, 0, 0, o.dpr, 0, 0); bg.lineCap = 'round'; bg.lineJoin = 'round';
      ST.forEach((s) => { if (s.gear < 0 && !s.baked && p >= s.t0 + s.d) { bg.strokeStyle = rgba(LINE, s.a); bg.lineWidth = lw * s.w; path(bg, s, s.len, cx, cy, R, 1, 0); s.baked = true; } });
      TX.forEach((x) => { if (!x.baked && p >= x.t0 + x.d) { text(bg, x, cx, cy, R, x.a); x.baked = true; } });

      ctx.save();
      if (o.s !== 1) { ctx.translate(cx, cy); ctx.scale(o.s, o.s); ctx.translate(-cx, -cy); }
      ctx.globalAlpha = o.a; ctx.drawImage(bake, 0, 0, o.W, o.H);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ST.forEach((s) => {
        if (p <= s.t0 || (s.gear < 0 && s.baked)) return;
        const e = eIO(clamp((p - s.t0) / s.d, 0, 1));
        ctx.strokeStyle = rgba(LINE, s.a); ctx.lineWidth = lw * s.w;
        if (s.gear >= 0) { const G = GEARS[s.gear], an = G.phi + G.w * o.tau * 0.5; path(ctx, s, s.len * e, cx + G.x * R, cy + G.y * R, R, Math.cos(an), Math.sin(an)); }
        else path(ctx, s, s.len * e, cx, cy, R, 1, 0);
      });
      TX.forEach((x) => { if (x.baked || p <= x.t0) return; text(ctx, x, cx, cy, R, x.a * clamp((p - x.t0) / x.d, 0, 1)); });
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
