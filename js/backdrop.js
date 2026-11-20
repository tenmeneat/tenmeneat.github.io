/* N.H.W — 배경 레이어 (초안)
   ref1: 금빛 시계 기어  ×  ref2: 천문 다이얼·별자리  +  열추진(터빈 팬) · 대마법진(공학·수학 문양)
   메인 캔버스(brain-canvas) 뒤에 깔리는 별도 캔버스. 저해상도로 그리고 CSS blur·opacity로 흐리게 만든다.
   createBackdrop(canvas, opt) → { setMode(phase), setOpts(o), destroy() } */
'use strict';
function createBackdrop(cv, opt) {
  opt = Object.assign({ speed: 3, res: 0.7, layers: { gears: true, dial: true, fan: true, stars: true } }, opt || {});
  const ctx = cv.getContext('2d');
  const TAU = Math.PI * 2;
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let W = 1, H = 1, S = 1, U = 1, R = 300;
  let mode = 'intro', mix = 0, dim = 1;              // mix: 0 = 인트로(골드 쪽), 1 = 메인(실버-블루 쪽)
  const C = { x: 0, y: 0, r: 300 };                   // 마법진·별의 중심 = 그래프 구의 중심을 따라간다
  let t = 0, last = performance.now(), raf = 0, visible = true, acc = 0, tw = null;   // tw: 모드 전환 이동 트윈

  function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lerpC(a, b, f) { return [0, 1, 2].map((i) => Math.round(lerp(a[i], b[i], f))); }
  const GOLD = [212, 175, 106], GOLD_D = [120, 88, 40], GOLD_L = [244, 222, 170];
  const SILVER = [201, 212, 242], WARM = [232, 217, 181];

  // ---------- 별 · 별자리 (ref2) ----------
  const STARS = [], CONS = [];
  (function () {
    const r = rng(11);
    for (let i = 0; i < 220; i++) STARS.push({ a: r() * TAU, d: Math.sqrt(r()) * 1.25, s: 0.4 + Math.pow(r(), 3) * 2.2, tw: r() * TAU, sp: 0.4 + r() * 0.8 });
    for (let k = 0; k < 7; k++) {          // 가까운 별 4~6개를 이어 작은 별자리
      const n = 4 + Math.floor(r() * 3), a0 = r() * TAU, d0 = 0.55 + r() * 0.6, pts = [];
      let a = a0, d = d0;
      for (let j = 0; j < n; j++) { pts.push({ a: a, d: d }); a += (r() - 0.5) * 0.28; d += (r() - 0.5) * 0.16; }
      CONS.push(pts);
    }
  })();

  // ---------- 기어 (ref1) : 실제로 맞물리도록 잇수·위상 계산 ----------
  // 이 i번째 중심 = 국소각 2πi/z. A 오른쪽에 각 θ로 붙는 B의 위상: φB = θ + π − (2π/zB)(½ − uA), uA = (θ − φA)·zA/2π
  function gearSprite(z, rp, style) {
    const L0 = style.back ? [150, 118, 70] : GOLD_L, M0 = style.back ? [96, 72, 38] : GOLD, D0 = style.back ? [52, 38, 20] : GOLD_D;
    const m = 2 * rp / z, ra = rp + m, rd = rp - 1.25 * m, pad = 4;
    const sz = Math.ceil((ra + pad) * 2), c = document.createElement('canvas'); c.width = c.height = sz;
    const g = c.getContext('2d'), o = sz / 2; g.translate(o, o);
    // 톱니 외곽
    g.beginPath();
    for (let i = 0; i < z; i++) {
      const a = TAU * i / z, hw = Math.PI / z;
      const p = [[a - hw * 1.0, rd], [a - hw * 0.55, ra], [a + hw * 0.55, ra], [a + hw * 1.0, rd]];
      p.forEach((q, k) => { const x = Math.cos(q[0]) * q[1], y = Math.sin(q[0]) * q[1]; if (i === 0 && k === 0) g.moveTo(x, y); else g.lineTo(x, y); });
    }
    g.closePath();
    // 림 안쪽을 비우고 살(spoke)을 남긴다
    const rim = Math.max(1, rd - Math.max(3, m * 1.6)), hub = rp * 0.2, ns = style.spokes;
    g.moveTo(rim, 0); g.arc(0, 0, rim, 0, TAU, true);
    const gr = g.createLinearGradient(-ra, -ra, ra, ra);
    gr.addColorStop(0, rgba(L0, 1)); gr.addColorStop(0.45, rgba(M0, 1)); gr.addColorStop(1, rgba(D0, 1));
    g.fillStyle = gr; g.fill('evenodd');
    // 살 + 허브
    g.beginPath();
    for (let k = 0; k < ns; k++) {
      const a = TAU * k / ns + 0.3, w = rp * (style.thin ? 0.06 : 0.1);
      const ca = Math.cos(a), sa = Math.sin(a), nx = -sa * w, ny = ca * w;
      g.moveTo(ca * hub + nx, sa * hub + ny); g.lineTo(ca * (rim + 1) + nx * 0.7, sa * (rim + 1) + ny * 0.7);
      g.lineTo(ca * (rim + 1) - nx * 0.7, sa * (rim + 1) - ny * 0.7); g.lineTo(ca * hub - nx, sa * hub - ny); g.closePath();
    }
    g.moveTo(hub * 1.6, 0); g.arc(0, 0, hub * 1.6, 0, TAU);
    g.fill();
    // 허브 구멍 · 리벳
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.arc(0, 0, hub * 0.55, 0, TAU); g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = rgba(D0, 0.9); g.lineWidth = Math.max(1, m * 0.25);
    g.beginPath(); g.arc(0, 0, rim, 0, TAU); g.stroke();
    g.beginPath(); g.arc(0, 0, hub * 1.6, 0, TAU); g.stroke();
    g.fillStyle = rgba(L0, 0.9);
    for (let k = 0; k < ns; k++) { const a = TAU * k / ns + 0.3 + Math.PI / ns; g.beginPath(); g.arc(Math.cos(a) * hub * 1.25, Math.sin(a) * hub * 1.25, Math.max(1, hub * 0.12), 0, TAU); g.fill(); }
    return { c: c, o: o };
  }
  // 기어열 정의: 뷰포트 비율 위치 + U(=짧은 변) 단위 모듈. 첫 기어 기준으로 각 θ 방향에 차례로 맞물린다
  // 앞(front) 기어열 = 밝은 골드, 뒤(back) 기어열 = 어두운 브론즈로 깊이를 만든다 (ref1의 겹친 무브먼트)
  const TRAINS = [
    { at: [0.02, -0.02], mod: 0.0062, w0: 0.018, back: 1, gears: [{ z: 84, sp: 8 }, { z: 30, th: 0.95, sp: 6 }, { z: 48, th: 0.15, sp: 7 }] },
    { at: [-0.03, 0.05], mod: 0.0058, w0: -0.022, gears: [{ z: 60, sp: 6 }, { z: 20, th: 0.25, sp: 5 }, { z: 36, th: -0.45, sp: 6 }, { z: 14, th: 0.9, sp: 4, thin: 1 }, { z: 28, th: 1.55, sp: 5 }] },
    { at: [1.0, 0.0], mod: 0.0048, w0: 0.02, back: 1, gears: [{ z: 56, sp: 6 }, { z: 22, th: 2.6, sp: 5 }] },
    { at: [0.96, -0.05], mod: 0.0042, w0: -0.026, gears: [{ z: 40, sp: 5 }, { z: 16, th: 2.0, sp: 4, thin: 1 }, { z: 26, th: 2.75, sp: 5 }] }
  ];
  let GEARS = [];
  function buildGears() {
    GEARS = [];
    TRAINS.concat(EXTRA).forEach((T) => {
      const m = T.mod * U; let prev = null;
      T.gears.forEach((d) => {
        const rp = m * d.z / 2, spr = gearSprite(d.z, rp * S, { spokes: d.sp, thin: d.thin, back: T.back });
        const G = { back: !!T.back, z: d.z, rp: rp, spr: spr, x: 0, y: 0, phi: 0, w: 0 };
        if (!prev) { G.x = T.abs ? T.at[0] : T.at[0] * W; G.y = T.abs ? T.at[1] : T.at[1] * H; G.phi = 0.2; G.w = T.w0; }
        else {
          const th = d.th, dist = prev.rp + rp;
          G.x = prev.x + Math.cos(th) * dist; G.y = prev.y + Math.sin(th) * dist;
          const uA = (th - prev.phi) * prev.z / TAU;
          G.phi = th + Math.PI - (TAU / d.z) * (0.5 - uA); G.w = -prev.w * prev.z / d.z;
        }
        GEARS.push(G); prev = G;
      });
    });
  }

  // ---------- 스크롤로 이어지는 긴 기계 구조 ----------
  // 첫 화면의 시계 문양(기어·다이얼·터빈)은 스크롤의 PAR배 속도로 천천히 올라가고(패럴랙스),
  // 그 아래로는 세로 "척추"(레일) + 기어 군집 + 천문 다이얼 + 기울어진 고리가 페이지 끝까지 이어진다.
  // 월드 좌표(y: 0 = 페이지 맨 위 첫 화면)로 한 번 생성하고, 화면에 보이는 부분만 그린다.
  const PAR = 0.45;
  let OY = 0, EXTRA = [], SPN = null, maxScrollSeen = 0;
  const GTPL = [   // 기어 군집 템플릿 (th: 앞 기어에서 뻗는 방향)
    [{ z: 60, sp: 6 }, { z: 20, th: 0.25, sp: 5 }, { z: 36, th: -0.45, sp: 6 }, { z: 14, th: 0.9, sp: 4, thin: 1 }],
    [{ z: 56, sp: 6 }, { z: 22, th: 0.5, sp: 5 }, { z: 30, th: 1.4, sp: 5 }],
    [{ z: 40, sp: 5 }, { z: 16, th: -0.6, sp: 4, thin: 1 }, { z: 26, th: 0.3, sp: 5 }, { z: 12, th: 1.1, sp: 4, thin: 1 }]
  ];
  function buildSpine() {
    maxScrollSeen = Math.max(maxScrollSeen, document.documentElement.scrollHeight - window.innerHeight);
    const LT = H * 1.3 + PAR * Math.max(maxScrollSeen, 2.4 * H), r = rng(77), sx = W * 0.5, dy = U * 0.85;
    EXTRA = []; const dials = [], rings = [], dust = [];
    for (let k = 0, y = H * 0.95; y < LT; k++, y += dy) {
      const side = k % 2 ? -1 : 1, tpl = GTPL[k % GTPL.length];
      EXTRA.push({ abs: true, at: [sx + side * U * (0.34 + 0.12 * r()), y + (r() - 0.5) * dy * 0.25], mod: 0.0052 + 0.0014 * r(), w0: (r() < 0.5 ? -1 : 1) * (0.018 + 0.01 * r()), back: k % 3 === 1 ? 1 : 0,
        gears: side > 0 ? tpl : tpl.map((g) => (g.th === undefined ? g : Object.assign({}, g, { th: Math.PI - g.th }))) });
      const SR = U * (0.3 + 0.1 * r()); dials.push({ x: sx - side * U * 0.12, y: y + dy * 0.5, R: SR, seal: buildSeal(SR, 500 + k * 17, false) });   // 척추 위의 작은 마법진
      rings.push({ x: sx + (r() - 0.5) * W * 0.3, y: y + dy * 0.2, rx: U * (0.55 + 0.35 * r()), ry: U * (0.16 + 0.14 * r()), rot: (r() - 0.5) * 1.1, ph: r() * TAU, dir: r() < 0.5 ? -1 : 1 });
    }
    for (let i = 0, n = Math.round(LT / H * 70); i < n; i++) dust.push({ x: sx + (r() + r() + r() - 1.5) * W * 0.5, y: H * 0.8 + r() * (LT - H * 0.8), s: 0.5 + r() * 1.6, tw: r() * TAU });
    SPN = { LT: LT, sx: sx, dials: dials, rings: rings, dust: dust };
  }
  function drawSpine(col, a) {
    if (!SPN) return;
    const sx = SPN.sx, vy0 = -OY - 300, vy1 = -OY + H + 300, y0 = H * 0.7, y1 = SPN.LT * 0.97, fade = H * 0.3;
    const ramp = (y) => Math.max(0, Math.min(1, (y - y0) / fade, (y1 - y) / fade));
    ctx.strokeStyle = rgba(col, 1); ctx.fillStyle = rgba(col, 1);
    // 레일: 이중선 + 점선 중심선 (위쪽 끝·아래쪽 끝은 서서히 나타나고 사라진다)
    const gr = ctx.createLinearGradient(0, y0, 0, y1), f0 = Math.min(0.4, fade / (y1 - y0));
    gr.addColorStop(0, rgba(col, 0)); gr.addColorStop(f0, rgba(col, 1)); gr.addColorStop(1 - f0, rgba(col, 1)); gr.addColorStop(1, rgba(col, 0));
    ctx.strokeStyle = gr; ctx.lineWidth = 1.2; ctx.globalAlpha = a * 0.55; ctx.beginPath(); ctx.moveTo(sx - 10, y0); ctx.lineTo(sx - 10, y1); ctx.moveTo(sx + 10, y0); ctx.lineTo(sx + 10, y1); ctx.stroke();
    ctx.setLineDash([1.5, 9]); ctx.lineWidth = 1.8; ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.moveTo(sx, y0); ctx.lineTo(sx, y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = rgba(col, 1);
    // 눈금·장식: 짧은 가로 눈금 → 마름모 → 동심원 → 가로 막대 순으로 반복
    const gap = U * 0.07, i0 = Math.ceil(Math.max(vy0, y0) / gap), i1 = Math.floor(Math.min(vy1, y1) / gap);
    ctx.lineWidth = 1.1;
    for (let i = i0; i <= i1; i++) {
      const y = i * gap, rp = ramp(y); if (rp <= 0) continue;
      const m = i % 14; ctx.globalAlpha = a * 0.6 * rp; ctx.beginPath();
      if (m === 0) { ctx.moveTo(sx, y - 9); ctx.lineTo(sx + 7, y); ctx.lineTo(sx, y + 9); ctx.lineTo(sx - 7, y); ctx.closePath(); if (i % 28 === 0) { ctx.moveTo(sx - 70, y); ctx.lineTo(sx - 12, y); ctx.moveTo(sx + 12, y); ctx.lineTo(sx + 70, y); ctx.moveTo(sx - 70, y - 4); ctx.lineTo(sx - 70, y + 4); ctx.moveTo(sx + 70, y - 4); ctx.lineTo(sx + 70, y + 4); } }
      else if (m === 7) { ctx.moveTo(sx + 5, y); ctx.arc(sx, y, 5, 0, TAU); ctx.moveTo(sx + 17, y); ctx.arc(sx, y, 17, 0, TAU); }
      else { const l = m % 2 ? 6 : 12; ctx.moveTo(sx - 10, y); ctx.lineTo(sx - 10 - l, y); ctx.moveTo(sx + 10, y); ctx.lineTo(sx + 10 + l, y); }
      ctx.stroke();
    }
    // 기울어진 큰 고리 (ref: 아밀러리 스피어) — 눈금과 궤도를 도는 점
    SPN.rings.forEach((R) => {
      if (R.y < vy0 - R.rx || R.y > vy1 + R.rx) return;
      const rp = ramp(R.y); if (rp <= 0) return;
      ctx.save(); ctx.translate(R.x, R.y); ctx.rotate(R.rot);
      ctx.globalAlpha = a * 0.4 * rp; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(0, 0, R.rx, R.ry, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = a * 0.3 * rp; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, R.rx * 0.95, R.ry * 0.95, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([3, 8]); ctx.globalAlpha = a * 0.25 * rp; ctx.beginPath(); ctx.ellipse(0, 0, R.rx * 0.86, R.ry * 0.86, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = a * 0.32 * rp; ctx.beginPath();
      for (let k = 0; k < 96; k++) { const an = TAU * k / 96, c = Math.cos(an), s = Math.sin(an), l = k % 8 === 0 ? 1.07 : 1.03; ctx.moveTo(R.rx * c, R.ry * s); ctx.lineTo(R.rx * l * c, R.ry * l * s); }
      ctx.stroke();
      const an = R.ph + t * 0.02 * R.dir; ctx.globalAlpha = a * 0.9 * rp; ctx.beginPath(); ctx.arc(Math.cos(an) * R.rx, Math.sin(an) * R.ry, 3, 0, TAU); ctx.fill();
      ctx.globalAlpha = a * 0.25 * rp; ctx.beginPath(); ctx.arc(Math.cos(an) * R.rx, Math.sin(an) * R.ry, 9, 0, TAU); ctx.fill();
      ctx.restore();
    });
    // 척추 위의 작은 천문 다이얼 (첫 화면의 큰 다이얼과 같은 구조)
    SPN.dials.forEach((D) => { if (D.y < vy0 - D.R || D.y > vy1 + D.R) return; const rp = ramp(D.y); if (rp > 0) drawSeal(D.seal, D.x, D.y, 1, a * 0.8 * rp); });
    // 별가루
    ctx.fillStyle = rgba(col, 1);
    SPN.dust.forEach((d) => { if (d.y < vy0 || d.y > vy1) return; const rp = ramp(d.y); if (rp <= 0) return; ctx.globalAlpha = a * (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.25 + d.tw))) * rp; ctx.fillRect(d.x - d.s / 2, d.y - d.s / 2, d.s, d.s); });
  }

  let SY = 0, AO = 1, sm = 0, lastSy = window.scrollY || 0;   // SY: 스크롤 위치, AO: 브레인 마스크 세기 0~1 (브레인이 화면을 벗어나면 0), sm: 스크롤 속도(px/s)

  // ---------- 크기 ----------
  function centerFor(m) {
    const mob = W < 760;
    if (m === 'intro') return [W / 2, H * 0.46, Math.min(W, H) * 0.3];
    if (m === 'world' || m === 'dive') return mob ? [W / 2, H * 0.27, Math.min(W * 0.36, H * 0.2)] : [W * 0.65, H * 0.5, Math.min(W * 0.26, H * 0.34)];
    return mob ? [W / 2, H * 0.3, Math.min(W * 0.36, H * 0.2)] : [W * 0.6, H * 0.5, Math.min(W * 0.26, H * 0.34)];
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); U = Math.min(W, H);
    S = opt.res; cv.width = Math.round(W * S); cv.height = Math.round(H * S);
    const c0 = centerFor(mode); if (!C.init) { C.x = c0[0]; C.y = c0[1]; C.r = c0[2]; C.init = 1; }
    // 무거운 스프라이트(마법진·기어)는 창 크기를 끄는 동안 매번 다시 만들지 않고 멈춘 뒤 한 번만 만든다
    if (!SPN) rebuildDeco(); else { clearTimeout(rbT); rbT = setTimeout(rebuildDeco, 180); }
    if (reduce) draw(0);
  }
  let rbT = 0;
  function rebuildDeco() {
    HERO = buildSeal(2.95 * Math.max.apply(null, ['intro', 'main', 'world', 'dive'].map((m) => centerFor(m)[2])), 2026, true);   // 첫 화면의 대마법진 (브레인 뒤)
    buildSpine(); buildGears();
    // 큰 스프라이트는 처음 그릴 때 GPU로 올라가며 끊김이 생기므로, 미리 한 번씩 그려 둔다 (스크롤 중 첫 등장 때 멈칫하지 않게)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.01;
    [HERO].concat(SPN.dials.map((D) => D.seal)).forEach((sl) => sl.layers.forEach((L) => ctx.drawImage(L.c, 0, 0, 2, 2)));
    GEARS.forEach((G) => ctx.drawImage(G.spr.c, 0, 0, 2, 2));
    ctx.restore();
    if (reduce) draw(0);
  }
  const ro = new ResizeObserver(resize); ro.observe(cv);
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }); io.observe(cv);

  // ---------- 그리기 ----------
  function drawStars(col, a) {
    const rot = t * 0.0035, M = Math.hypot(W, H) * 0.62;
    ctx.fillStyle = rgba(col, 1);
    STARS.forEach((s) => {
      const x = C.x + Math.cos(s.a + rot) * s.d * M, y = C.y + Math.sin(s.a + rot) * s.d * M;
      if (x < -5 || y < -5 || x > W + 5 || y > H + 5) return;
      const tw = 0.45 + 0.55 * Math.sin(t * 0.25 * s.sp + s.tw);
      ctx.globalAlpha = a * (0.25 + 0.75 * tw) * Math.min(1, s.s); const z = s.s;
      ctx.fillRect(x - z / 2, y - z / 2, z, z);
      if (s.s > 1.9) { ctx.globalAlpha *= 0.5; ctx.fillRect(x - z * 2, y - 0.4, z * 4, 0.8); ctx.fillRect(x - 0.4, y - z * 2, 0.8, z * 4); }
    });
    ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = 0.7; ctx.globalAlpha = a * 0.35;
    CONS.forEach((P) => {
      ctx.beginPath();
      P.forEach((p, i) => { const x = C.x + Math.cos(p.a + rot) * p.d * M, y = C.y + Math.sin(p.a + rot) * p.d * M; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      P.forEach((p) => { const x = C.x + Math.cos(p.a + rot) * p.d * M, y = C.y + Math.sin(p.a + rot) * p.d * M; ctx.globalAlpha = a * 0.8; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fillStyle = rgba(col, 1); ctx.fill(); });
      ctx.globalAlpha = a * 0.35;
    });
  }
  // ---------- 대마법진: 공학·수학의 문양 ----------
  // 겹마다 따로 스프라이트로 한 번 그려 두고, 프레임마다 서로 반대 방향으로 돌리기만 한다 (아무리 복잡해도 프레임 비용은 낮다).
  const MFONT = "'Cambria Math','STIX Two Math','Noto Sans Math','Segoe UI Symbol','Times New Roman',serif";
  const MSYM = Array.from('ΣΔΩωλμρστφψθε∇∂∫∮∞≈≡∝±√∈⊗⊕ℏπξηζκνχ');
  const FORM = ['∇·E = ρ/ε₀', '∇×B = μ₀J + μ₀ε₀ ∂E/∂t', 'ρ(∂u/∂t + u·∇u) = −∇p + μ∇²u', 'F(ω) = ∫ f(t) e^(−iωt) dt', 'e^(iπ) + 1 = 0', 'σ = Eε', 'Re = ρuL/μ',
    'H(s) = 1/(s² + 2ζωₙs + ωₙ²)', 'ẋ = Ax + Bu', 'M ẍ + C ẋ + K x = F(t)', '∂²u/∂t² = c²∇²u', 'det(A − λI) = 0', '∮ B·dl = μ₀I', 'ΣF = m·a', 'Q = ṁ cₚ ΔT', 'τ = Iα', 'L = T − V', 'δ∫L dt = 0'];
  const SEAL_C = [206, 216, 244];
  function sealLayer(Rext, lw) {
    const sz = Math.ceil(2 * Rext * S) + 4, c = document.createElement('canvas'); c.width = c.height = sz;
    const g = c.getContext('2d'); g.setTransform(S, 0, 0, S, sz / 2, sz / 2);
    g.strokeStyle = g.fillStyle = rgba(SEAL_C, 1); g.lineWidth = lw; g.lineJoin = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle';
    return { c: c, g: g };
  }
  const sRing = (g, r) => { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); };
  function sTicks(g, r0, len, n, every) {
    g.beginPath();
    for (let i = 0; i < n; i++) { const an = TAU * i / n, l = i % every === 0 ? len * 2.2 : len, c = Math.cos(an), s = Math.sin(an); g.moveTo(c * r0, s * r0); g.lineTo(c * (r0 - l), s * (r0 - l)); }
    g.stroke();
  }
  function sArcText(g, str, r, a0, size) {   // 원호를 따라 글자를 배치 (위쪽에서 시계방향으로 읽힘). 끝 각도를 돌려준다
    g.font = size + 'px ' + MFONT; let a = a0;
    for (const ch of str) { const w = g.measureText(ch).width + size * 0.14; a += w / 2 / r; g.save(); g.rotate(a); g.translate(0, -r); g.fillText(ch, 0, 0); g.restore(); a += w / 2 / r; }
    return a;
  }
  function sStar(g, r, n, k, nr) {   // 성형 다각형 {n/k} + 꼭짓점 원
    g.beginPath();
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + TAU * i / n, b = -Math.PI / 2 + TAU * (i + k) / n; g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(b) * r, Math.sin(b) * r); }
    g.stroke();
    if (nr > 0) { g.beginPath(); for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + TAU * i / n; g.moveTo(Math.cos(a) * r + nr, Math.sin(a) * r); g.arc(Math.cos(a) * r, Math.sin(a) * r, nr, 0, TAU); } g.stroke(); }
  }
  function sSpiro(g, rad, m, d) {   // 하이포트로코이드 (톱니바퀴가 굴러가며 그리는 곡선)
    const k = 1 - 1 / m, sc = rad / (k + d); g.beginPath();
    for (let i = 0; i <= 720; i++) { const t = TAU * i / 720, x = (k * Math.cos(t) + d * Math.cos((m - 1) * t)) * sc, y = (k * Math.sin(t) - d * Math.sin((m - 1) * t)) * sc; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  }
  function sRose(g, rad, p, q) {   // 장미 곡선 r = cos(pθ/q)
    g.beginPath();
    for (let i = 0; i <= 900; i++) { const th = TAU * q * i / 900, rr = Math.cos(p * th / q) * rad; if (i) g.lineTo(Math.cos(th) * rr, Math.sin(th) * rr); else g.moveTo(Math.cos(th) * rr, Math.sin(th) * rr); }
    g.stroke();
  }
  function sFlower(g, rho, rings, clipR) {   // 생명의 꽃
    g.save(); g.beginPath(); g.arc(0, 0, clipR, 0, TAU); g.clip(); g.beginPath();
    for (let i = -rings; i <= rings; i++) for (let j = -rings; j <= rings; j++) { if (Math.abs(i + j) > rings) continue; const x = rho * (i + j / 2), y = rho * j * 0.8660254; g.moveTo(x + rho, y); g.arc(x, y, rho, 0, TAU); }
    g.stroke(); g.restore();
  }
  function sMeta(g, rho) {   // 메타트론의 정육면체: 13개 점을 모두 잇는다
    const P = [[0, 0]]; for (let k = 0; k < 6; k++) { const a = TAU * k / 6; P.push([Math.cos(a) * rho, Math.sin(a) * rho]); P.push([Math.cos(a) * rho * 2, Math.sin(a) * rho * 2]); }
    g.beginPath(); for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { g.moveTo(P[i][0], P[i][1]); g.lineTo(P[j][0], P[j][1]); }
    P.forEach((p) => { g.moveTo(p[0] + rho * 0.28, p[1]); g.arc(p[0], p[1], rho * 0.28, 0, TAU); });
    g.stroke();
  }
  function sCog(g, r, n, h) {   // 톱니 링
    g.beginPath();
    for (let i = 0; i < n; i++) { const a = TAU * i / n, w = Math.PI / n; [[a - w, r], [a - w * 0.5, r + h], [a + w * 0.5, r + h], [a + w, r]].forEach((q, k) => { const x = Math.cos(q[0]) * q[1], y = Math.sin(q[0]) * q[1]; if (!i && !k) g.moveTo(x, y); else g.lineTo(x, y); }); }
    g.closePath(); g.stroke();
  }
  function sIcosa(g, r, ax, ay) {   // 정이십면체 와이어프레임
    const f = (1 + Math.sqrt(5)) / 2, V = []; [-1, 1].forEach((a) => [-f, f].forEach((b) => { V.push([0, a, b], [a, b, 0], [b, 0, a]); }));
    const ca = Math.cos(ax), sa = Math.sin(ax), cb = Math.cos(ay), sb = Math.sin(ay), sc = r / Math.hypot(1, f);
    const Q = V.map((v) => { const y1 = v[1] * ca - v[2] * sa, z1 = v[1] * sa + v[2] * ca, x2 = v[0] * cb + z1 * sb; return [x2 * sc, y1 * sc]; });
    g.beginPath(); for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) { if (Math.abs(Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]) - 2) < 1e-6) { g.moveTo(Q[i][0], Q[i][1]); g.lineTo(Q[j][0], Q[j][1]); } }
    g.stroke(); g.beginPath(); Q.forEach((q) => { g.moveTo(q[0] + 2, q[1]); g.arc(q[0], q[1], 2, 0, TAU); }); g.fill();
  }
  function sSpiral(g, rad) {   // 황금 나선
    const b = Math.log((1 + Math.sqrt(5)) / 2) / (Math.PI / 2), a = rad / Math.exp(b * 7 * Math.PI / 2); g.beginPath();
    for (let i = 0; i <= 400; i++) { const th = 7 * Math.PI / 2 * i / 400, rr = a * Math.exp(b * th); if (i) g.lineTo(Math.cos(th) * rr, Math.sin(th) * rr); else g.moveTo(Math.cos(th) * rr, Math.sin(th) * rr); }
    g.stroke();
  }
  function sRune(g, size, rn) {   // 임의의 룬: 3×5 격자 위 선분 3~5개 (+ 가끔 원)
    const P = (i) => [((i % 3) - 1) * size * 0.32, (Math.floor(i / 3) - 2) * size * 0.26]; g.beginPath();
    for (let k = 0, n = 3 + Math.floor(rn() * 3); k < n; k++) { const a = P(Math.floor(rn() * 15)), b = P(Math.floor(rn() * 15)); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); }
    if (rn() < 0.35) { const c = P(Math.floor(rn() * 15)); g.moveTo(c[0] + size * 0.1, c[1]); g.arc(c[0], c[1], size * 0.1, 0, TAU); }
    g.stroke();
  }
  // 대마법진 하나를 겹별 스프라이트로 만든다. R = 바깥 반지름, full = 바깥 눈금띠·위성 인장까지 포함
  function buildSeal(R, seed, full) {
    const rn = rng(seed), lw = Math.max(1, R * 0.0018), layers = [], sg = rn() < 0.5 ? -1 : 1, fs = FORM.slice().sort(() => rn() - 0.5);
    const add = (Rext, w, a, fn) => { const o = sealLayer(Rext, lw); fn(o.g); layers.push({ c: o.c, w: w, a: a, ph: rn() * TAU }); };
    if (full) add(R * 1.08, 0.004 * sg, 0.55, (g) => {   // 1. 바깥 눈금띠 + 각도 숫자 + 위성 인장 6개
      sRing(g, R); sRing(g, R * 0.985); sRing(g, R * 0.915); sTicks(g, R * 0.985, R * 0.011, 360, 10); sTicks(g, R * 0.915, R * 0.008, 180, 5);
      g.font = Math.round(R * 0.028) + 'px ' + MFONT;
      for (let i = 0; i < 12; i++) { g.save(); g.rotate(TAU * i / 12); g.translate(0, -R * 0.95); g.fillText(String(i * 30).padStart(3, '0'), 0, 0); g.restore(); }
      for (let i = 0; i < 6; i++) { const an = TAU * (i + 0.5) / 6, sm = R * 0.05; g.save(); g.rotate(an); g.translate(0, -R * 0.985); sRing(g, sm); sRing(g, sm * 0.78); sRing(g, sm * 0.5); sStar(g, sm * 0.72, 6, 2, 0); g.beginPath(); g.arc(0, 0, 2, 0, TAU); g.fill(); g.restore(); }
    });
    add(R * 0.92, -0.006 * sg, 0.6, (g) => {   // 2. 방정식 띠: 맥스웰·나비에–스토크스·푸리에 …
      sRing(g, R * 0.9); sRing(g, R * 0.8); sTicks(g, R * 0.8, R * 0.007, 480, 8);
      const size = R * 0.034, r = R * 0.845; let a = 0.05, fi = 0;
      while (a < TAU - 0.35 && fi < 40) { const s = fs[fi++ % fs.length], est = s.length * size * 0.62 / r; if (a + est > TAU - 0.12) continue; a = sArcText(g, s, r, a, size); g.save(); g.rotate(a + 0.045); g.translate(0, -r); g.beginPath(); g.moveTo(0, -size * 0.4); g.lineTo(size * 0.3, 0); g.lineTo(0, size * 0.4); g.lineTo(-size * 0.3, 0); g.closePath(); g.stroke(); g.restore(); a += 0.1; }
    });
    add(R * 0.8, 0.009 * sg, 0.55, (g) => {   // 3. 룬·수학 기호 띠 (칸 36개)
      const N = 36; sRing(g, R * 0.78); sRing(g, R * 0.66); sRing(g, R * 0.725);
      g.beginPath(); for (let i = 0; i < N; i++) { const an = TAU * i / N; g.moveTo(Math.cos(an) * R * 0.66, Math.sin(an) * R * 0.66); g.lineTo(Math.cos(an) * R * 0.78, Math.sin(an) * R * 0.78); } g.stroke();
      for (let i = 0; i < N; i++) { g.save(); g.rotate(TAU * (i + 0.5) / N); g.translate(0, -R * 0.722); if (rn() < 0.5) { g.font = Math.round(R * 0.058) + 'px ' + MFONT; g.fillText(MSYM[Math.floor(rn() * MSYM.length)], 0, 0); } else sRune(g, R * 0.075, rn); g.restore(); }
    });
    add(R * 0.67, -0.013 * sg, 0.5, (g) => {   // 4. 성형 다각형 두 겹 + 접원
      const A = [[18, 7], [16, 7], [14, 5], [12, 5], [11, 4], [10, 3]][Math.floor(rn() * 6)], B = [[9, 4], [8, 3], [7, 3], [7, 2], [5, 2]][Math.floor(rn() * 5)];
      sRing(g, R * 0.66); sStar(g, R * 0.655, A[0], A[1], R * 0.011); sRing(g, R * 0.655 * Math.cos(Math.PI * A[1] / A[0]));
      sStar(g, R * 0.655, A[0], 1, 0);
      sStar(g, R * 0.46, B[0], B[1], R * 0.014); sRing(g, R * 0.46); sRing(g, R * 0.46 * Math.cos(Math.PI * B[1] / B[0]));
    });
    add(R * 0.5, 0.02 * sg, 0.5, (g) => {   // 5. 스피로그래프 · 장미 곡선 · 생명의 꽃
      sRing(g, R * 0.485); g.globalAlpha = 0.5; sFlower(g, R * 0.085, 3, R * 0.43); g.globalAlpha = 1;
      const m = 5 + Math.floor(rn() * 5); sSpiro(g, R * 0.46, m, (0.7 + 0.9 * rn()) / m); sRose(g, R * 0.4, 5 + Math.floor(rn() * 4), 2);
    });
    add(R * 0.35, -0.03 * sg, 0.55, (g) => {   // 6. 톱니 링 + 메타트론 + 정이십면체
      sCog(g, R * 0.32, 36, R * 0.022); sRing(g, R * 0.31); sRing(g, R * 0.27); sMeta(g, R * 0.095); sIcosa(g, R * 0.14, 0.6 + rn(), 0.5 + rn());
    });
    add(R * 0.18, 0.045 * sg, 0.7, (g) => {   // 7. 중심: 헥사그램 + 황금 나선
      sRing(g, R * 0.17); sRing(g, R * 0.12); sStar(g, R * 0.16, 6, 2, R * 0.008); sSpiral(g, R * 0.1); g.beginPath(); g.arc(0, 0, R * 0.012, 0, TAU); g.fill();
    });
    return { layers: layers, R: R };
  }
  let HERO = null;
  function drawSeal(sl, cx, cy, sc, a) {
    sl.layers.forEach((L) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(L.ph + L.w * t); if (sc !== 1) ctx.scale(sc, sc);
      ctx.globalAlpha = a * L.a; ctx.drawImage(L.c, -L.c.width / 2 / S, -L.c.height / 2 / S, L.c.width / S, L.c.height / S); ctx.restore();
    });
  }

  // 열추진: 터보팬 전면 — 비틀린 블레이드 원판
  function drawFan(col, a) {
    const x = W * 1.0 - U * 0.04, y = H + U * 0.06, R0 = U * 0.34, N = 22, hub = R0 * 0.3;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.03);
    ctx.strokeStyle = rgba(col, 1); ctx.fillStyle = rgba(col, 1);
    ctx.globalAlpha = a * 0.5; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, R0 * 1.04, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, R0 * 1.1, 0, TAU); ctx.stroke();
    for (let i = 0; i < N; i++) {
      const a0 = TAU * i / N; ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const f = k / 10, rr = hub + (R0 - hub) * f, an = a0 + 0.55 * f * f; const px = Math.cos(an) * rr, py = Math.sin(an) * rr; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      for (let k = 10; k >= 0; k--) { const f = k / 10, rr = hub + (R0 - hub) * f, an = a0 + 0.55 * f * f + 0.11 + 0.05 * f; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
      ctx.closePath(); ctx.globalAlpha = a * 0.12; ctx.fill(); ctx.globalAlpha = a * 0.45; ctx.lineWidth = 0.8; ctx.stroke();
    }
    ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.arc(0, 0, hub, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a * 0.18; ctx.beginPath(); ctx.arc(0, 0, hub, 0, TAU); ctx.fill();
    ctx.globalAlpha = a * 0.5; ctx.beginPath(); for (let i = 0; i < 6; i++) { const an = TAU * i / 6; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * hub, Math.sin(an) * hub); } ctx.stroke();
    ctx.restore();
  }
  function drawGears(a) {
    GEARS.slice().sort((p, q) => (q.back ? 1 : 0) - (p.back ? 1 : 0)).forEach((G) => {
      const gy = G.y + OY, R = G.rp * 1.3 + 10; if (gy < -R || gy > H + R) return;   // 화면 밖 기어는 건너뜀
      const sp = G.spr, ang = G.phi + G.w * t;
      ctx.save(); ctx.translate(G.x, G.y); ctx.rotate(ang); ctx.globalAlpha = a * (G.back ? 0.55 : 0.8);
      ctx.drawImage(sp.c, -sp.o / S, -sp.o / S, sp.c.width / S, sp.c.height / S);
      ctx.restore();
    });
  }
  function draw(dt) {
    ctx.setTransform(S, 0, 0, S, 0, 0); ctx.clearRect(0, 0, W, H);
    const L = opt.layers, col = lerpC(WARM, SILVER, mix), gA = lerp(0.95, 0.7, mix) * dim, dA = lerp(1.0, 1.5, mix) * dim;
    if (L.stars) drawStars(col, 0.9 * dim);
    ctx.save(); ctx.translate(0, OY);   // 시계 문양 레이어는 스크롤의 PAR배로 올라간다 (별은 고정)
    if (L.dial) { if (HERO) drawSeal(HERO, C.x, C.y, C.r * 2.95 / HERO.R, dA * 0.8); drawSpine(col, dA * 0.42); }   // 본문(About) 글자 뒤라서 첫 화면보다 살짝 약하게
    if (L.fan) drawFan(lerpC(GOLD_L, SILVER, mix * 0.6), lerp(1.1, 1.0, mix) * dim);
    if (L.gears) drawGears(gA);
    ctx.restore();
    // 본문 보호: 좌하단 히어로 문구 · 중앙 그래프 코어 쪽을 살짝 지운다
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-out';
    const hx = W < 760 ? W * 0.5 : 330, hy = H - 260 - SY, g1 = ctx.createRadialGradient(hx, hy, 0, hx, hy, 560);   // 히어로 문구도 페이지와 함께 올라간다
    g1.addColorStop(0, 'rgba(0,0,0,' + (0.85 * mix) + ')'); g1.addColorStop(0.55, 'rgba(0,0,0,' + (0.5 * mix) + ')'); g1.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(C.x, C.y - SY, 0, C.x, C.y - SY, C.r * 1.25);   // 브레인 쪽을 비우는 마스크: 브레인과 함께 올라가며 사라진다
    g2.addColorStop(0, 'rgba(0,0,0,' + (0.7 * AO) + ')'); g2.addColorStop(0.6, 'rgba(0,0,0,' + (0.25 * AO) + ')'); g2.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, now - last); last = now;
    if (!visible) return;
    acc += dt;
    const busy = tw || Math.abs(sm) > 5;   // 스크롤·이동 중엔 ~60fps, 평소엔 30fps
    if (acc < (busy ? 15 : 33)) return;
    const step = acc / 1000; acc = 0;
    t += step * opt.speed;
    // 스크롤 위치 추적: 브레인(장애물)이 페이지와 함께 올라가는 것만 반영한다 (흐름 기울기·가속 효과는 뺌)
    const sy = window.scrollY || 0; sm += ((sy - lastSy) / Math.max(step, 0.001) - sm) * (1 - Math.exp(-step * 8)); lastSy = sy; SY = sy; OY = -sy * PAR;
    const tgt = centerFor(mode), mt = mode === 'intro' ? 0 : 1;
    if (tw) {                                        // 시간 기반 이징: 속도 0에서 출발해 0으로 멈춘다
      const p = Math.min(1, (now - tw.t0) / tw.dur), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      C.x = lerp(tw.from[0], tgt[0], e); C.y = lerp(tw.from[1], tgt[1], e); C.r = lerp(tw.from[2], tgt[2], e); mix = lerp(tw.mix, mt, e);
      if (p >= 1) tw = null;
    } else { C.x = tgt[0]; C.y = tgt[1]; C.r = tgt[2]; mix = mt; }
    // 브레인은 페이지와 함께 스크롤돼 올라간다: 브레인 쪽을 비우는 마스크도 같이 올라가고, 브레인이 화면을 벗어나면 사라진다 (AO: 1 → 0)
    const kb = C.r * 1.12, q = Math.min(1, Math.max(0, (C.y - sy + kb) / (1.6 * kb)));
    AO = q * q * (3 - 2 * q);
    dim += ((mode === 'world' ? 0.55 : mode === 'dive' ? 0.4 : 1) - dim) * (1 - Math.exp(-step * 1.5));
    draw(step);
  }
  resize();
  if (!reduce) raf = requestAnimationFrame(frame); else { mix = 1; draw(0); }
  return {
    setMode: function (m) {
      m = m === 'rise' ? 'main' : m; if (m === mode) return;
      if (reduce) { mode = m; const c = centerFor(m); C.x = c[0]; C.y = c[1]; C.r = c[2]; mix = m === 'intro' ? 0 : 1; draw(0); return; }
      tw = { from: [C.x, C.y, C.r], mix: mix, t0: performance.now(), dur: mode === 'intro' && m === 'main' ? 2400 : 1600 };
      mode = m;
    },
    setOpts: function (o) { Object.assign(opt, o); if (o.res) resize(); if (reduce) draw(0); },
    destroy: function () { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); }
  };
}
