/* N.H.W — Second Brain : 화면 상태와 DOM 렌더링
   엔진(js/engine.js)은 캔버스만 그리고, 여기서는 오버레이(헤더·범례·월드 패널)를 상태에 맞춰 갱신한다.
   URL 파라미터로 바로 바꿔볼 수 있다:  ?font=sacramento  ?intro=0  ?orbit=0  ?accent=7CF2C8 */
(function () {
  const Q = new URLSearchParams(location.search);
  const CONFIG = {
    scriptFont: Q.get('font') || 'alegreya',           // 제목 글꼴: alegreya | allura | sacramento | parisienne | italianno
    accent: '#' + (Q.get('accent') || 'BFD3FF'),
    introFont: Q.get('introFont') || 'great-vibes',          // great-vibes | mrs-saint-delafield | pinyon-script
    introInk: '#D4AF6A',
    introThickness: 0.6,
    showIntro: Q.get('intro') !== '0',
    autoRotate: Q.get('rotate') !== '0',
    orbitMotion: Q.get('orbit') !== '0'
  };

  const G = GRAPH, $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const S = scriptOf(CONFIG.scriptFont);
  document.documentElement.style.setProperty('--script', S.css);
  document.documentElement.style.setProperty('--k', String(S.k));
  document.documentElement.style.setProperty('--script-style', S.it ? 'italic' : 'normal');
  document.documentElement.style.setProperty('--accent', CONFIG.accent);

  const state = { phase: 'intro', world: -1, section: null, note: null };   // section: 들어가 있는 섹션 행성의 key, note: 선택한 노트
  let eng = null;

  // ---------- static parts ----------
  const cnt = (id) => (G.groups.find((g) => g.id === id) || { members: [] }).members.length;
  const stats = { notes: String(G.nodes.length), links: G.edges.length.toLocaleString('en-US'), projects: String(G.projects.length), concepts: String(cnt('concepts')) };
  document.querySelectorAll('[data-stat]').forEach((el) => { el.textContent = stats[el.getAttribute('data-stat')]; });
  $('shell-rows').innerHTML = [['Core', '#FFD54F', 'home'], ['Concepts', '#7ED957', 'concepts'], ['Tools', '#B7C4D6', 'tools'], ['Courses', '#FF5C6C', 'courses']]
    .map((r) => '<div class="srow"><span class="dot" aria-hidden="true" style="background:' + r[1] + ';box-shadow:0 0 8px ' + r[1] + '"></span><span class="lab">' + r[0] + '</span><span>' + cnt(r[2]) + '</span></div>').join('');
  $('proj-rows').innerHTML = G.projects.map((p) => '<button type="button" class="lrow" data-go="' + p.moc + '"><span class="dot" aria-hidden="true" style="width:9px;height:9px;background:' + p.color + ';box-shadow:0 0 10px ' + p.color + '"></span><span class="lab">' + esc(p.label) + '</span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8D97AE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>').join('');

  // ---------- world panel ----------
  function chip(m) { return '<button type="button" class="chip" data-go="' + m.i + '"><span class="dot" aria-hidden="true" style="background:' + m.color + '"></span>' + esc(m.name) + '</button>'; }
  const readLink = (j, t) => '<a class="pill rd-open" href="#/note/' + encodeURIComponent(G.nodes[j].name) + '">' + t + ' →</a>';
  function metaHtml(rows) { return '<dl class="meta">' + rows.map((m) => '<div><dt>' + esc(m.k) + '</dt><dd>' + esc(m.v) + '</dd></div>').join('') + '</dl>'; }
  const noteName = (j) => G.nodes[j].name.replace(/^[^-\s]+-/, '');
  // 프로젝트 월드 패널(A안): 상자 없이 배경 위에 타이포만. 목록은 행성과 hover 연동되는 인덱스
  const fmtPeriod = (s) => (s || '').replace(/(\d{4})-(\d{2})-\d{2}/g, '$1.$2').replace(/\s*~\s*/, ' — ');
  const metaLine = (a) => '<p class="wmeta">' + a.filter(Boolean).map(esc).join('<i aria-hidden="true">·</i>') + '</p>';
  const wlink = (j, t) => '<a class="wlink rd-open" href="#/note/' + encodeURIComponent(G.nodes[j].name) + '">' + t + ' <span aria-hidden="true">→</span></a>';
  // 인덱스 = 데이터 팬: 왼쪽 개념 점(src)에서 곡선이 각 줄의 축 점으로 모이고, 줄 끝엔 노트별 링크 수 바코드
  function idx(rows, color, src) {
    src = src || [];
    const w = rows.map((r) => src.map((c) => r.ids.reduce((a, j) => a + (G.adj[j].has(c) ? 1 : 0), 0)));
    const mx = Math.max(1, ...rows.flatMap((r) => r.ids.map((j) => G.adj[j].size)));
    const fan = src.length ? '<svg class="wfan" aria-hidden="true" data-fan="' + esc(JSON.stringify({ c: src, s: src.map((c) => G.nodes[c].name), w: w })) + '"></svg>' : '';
    return '<ol class="widx' + (fan ? ' fan' : '') + '" style="--c:' + color + '">' + fan + rows.map((r) => {
      const bc = '<span class="bc" aria-hidden="true">' + (r.ids.length > 1 ? r.ids.slice(0, 12).map((j) => '<i style="height:' + (3 + Math.round(9 * G.adj[j].size / mx)) + 'px"></i>').join('') : '') + '</span>';
      return '<li><button type="button" class="wrow' + (r.on ? ' on' : '') + '" ' + r.attr + '><span class="no">' + r.no + '</span><span class="nm">' + esc(r.nm) + '</span>' + bc + '<span class="ct">' + r.ct + '</span></button></li>';
    }).join('') + '</ol>';
  }
  const noteIdx = (ids, color, src) => idx(ids.map((j, k) => ({ attr: 'data-note="' + j + '"', ids: [j], no: String(k + 1).padStart(2, '0'), nm: noteName(j), ct: G.adj[j].size, on: state.note === j })), color, src);
  function drawFan(panel) {   // 줄 위치가 정해진 뒤에 곡선을 그린다
    const sv = panel.querySelector('.wfan'); if (!sv) return;
    const D = JSON.parse(sv.getAttribute('data-fan')), ol = sv.parentNode, rows = Array.from(ol.querySelectorAll('.wrow')), H = ol.clientHeight;
    if (!rows.length || !H) return;
    const X0 = 6, X1 = 52, n = D.s.length, ry = rows.map((r) => r.offsetTop + r.offsetHeight / 2), f = (v) => v.toFixed(1);
    const top = ry[0], bot = ry[ry.length - 1], sy = D.s.map((_, q) => top + (bot - top) * (n > 1 ? 0.1 + 0.8 * q / (n - 1) : 0.5));
    let h = '<defs><linearGradient id="fang" gradientUnits="userSpaceOnUse" x1="' + X0 + '" x2="' + X1 + '" y1="0" y2="0"><stop offset="0" stop-color="#D4AF6A"></stop><stop offset="1" stop-color="' + ol.style.getPropertyValue('--c') + '"></stop></linearGradient></defs>';
    h += '<line class="sp" x1="' + X1 + '" y1="' + f(top - 6) + '" x2="' + X1 + '" y2="' + f(bot + 6) + '"></line>';
    let d = 0;
    ry.forEach((y, k) => D.s.forEach((s, q) => { const v = D.w[k][q]; if (!v) return;
      h += '<path data-r="' + k + '" data-q="' + q + '" pathLength="1" style="--d:' + (d++) + '" stroke="url(#fang)" stroke-width="' + Math.min(2, 0.5 + v * 0.3).toFixed(2) + '" d="M' + X0 + ' ' + f(sy[q]) + 'C' + (X0 + 26) + ' ' + f(sy[q]) + ' ' + (X1 - 22) + ' ' + f(y) + ' ' + X1 + ' ' + f(y) + '"></path>'; }));
    ry.forEach((y, k) => { h += '<line class="tk" data-r="' + k + '" x1="' + (X1 + 4) + '" y1="' + f(y) + '" x2="64" y2="' + f(y) + '"></line><circle class="rd" data-r="' + k + '" cx="' + X1 + '" cy="' + f(y) + '" r="2.4"></circle>'; });
    D.s.forEach((s, q) => { h += '<circle class="sd" data-q="' + q + '" cx="' + X0 + '" cy="' + f(sy[q]) + '" r="2.2"><title>' + esc(s) + '</title></circle>'; });
    sv.setAttribute('viewBox', '0 0 64 ' + H); sv.style.height = H + 'px'; sv.innerHTML = h; sv._D = D; lastMark = '';
  }
  // 강조: 줄(k) 또는 개념(q) 하나를 기준으로 곡선·축 점·줄·하단 태그를 함께 켠다. 같은 상태면 아무것도 안 한다(깜빡임 방지)
  let lastMark = '';
  function mark(k, q) {
    const key = k + ':' + q; if (key === lastMark) return; lastMark = key;
    const panel = $('wpanel'), sv = panel.querySelector('.wfan'), D = sv && sv._D, any = k >= 0 || q >= 0;
    const rowOn = (i) => k >= 0 ? i === k : q >= 0 && !!D && D.w[i][q] > 0;
    const qOn = (j) => q >= 0 ? j === q : k >= 0 && !!D && D.w[k][j] > 0;
    panel.querySelectorAll('.wrow').forEach((x, i) => { x.classList.toggle('hl', any && rowOn(i)); });
    if (sv) {
      sv.classList.toggle('act', any);
      sv.querySelectorAll('[data-r], [data-q]').forEach((e) => {
        const r = e.getAttribute('data-r'), c = e.getAttribute('data-q');
        e.classList.toggle('on', any && (r === null || rowOn(Number(r))) && (c === null || qOn(Number(c))));
      });
    }
    panel.querySelectorAll('.wtags [data-go]').forEach((b) => { const j = D ? D.c.indexOf(Number(b.getAttribute('data-go'))) : -1; b.classList.toggle('on', any && j >= 0 && qOn(j)); });
  }
  const rowIndex = (r) => Array.from($('wpanel').querySelectorAll('.wrow')).indexOf(r);
  const tagLine = (label, ms) => ms.length ? '<p class="wtags"><span class="tl">' + label + '</span>' + ms.map((m) => '<button type="button" data-go="' + m.i + '">' + esc(m.name) + '</button>').join('') + '</p>' : '';
  function worldHtml() {
    const i = state.world; if (i < 0) return { html: '', hint: '' };
    const n = G.nodes[i], w = worldOf(i);
    if (w.project) {
      const p = w.project, moc = G.nodes[p.moc], ids = new Set(p.members), around = {};
      p.members.forEach((m) => G.adj[m].forEach((j) => { if (!ids.has(j)) around[j] = (around[j] || 0) + 1; }));
      const ranked = Object.keys(around).map(Number).sort((a, b) => around[b] - around[a]);
      const concepts = ranked.filter((j) => G.nodes[j].kind === 'concept').slice(0, 14).map((j) => G.nodes[j]);
      const toolNames = moc.tools.length ? moc.tools : ranked.filter((j) => G.nodes[j].kind === 'tool').map((j) => G.nodes[j].name);
      const tools = toolNames.map((t) => G.byName[t]).filter(Boolean);
      const own = n.type === 'project-moc' ? null : n;
      const summary = own ? own.name + ' — ' + (own.summary || '') : moc.summary;
      const dot = '<span class="dot" aria-hidden="true" style="background:' + p.color + ';box-shadow:0 0 12px ' + p.color + '"></span>';
      const sec = state.section && p.sections.find((s) => s.key === state.section);
      const src = concepts.slice(0, 6).map((m) => m.i);   // 팬의 소스 = 하단 Concepts 태그와 같은 6개
      if (sec) {   // 섹션 행성 안: 그 섹션의 노트들이 행성이다
        let s = '<p class="wk" style="color:' + p.color + '">' + dot + 'Section ' + esc(sec.no) + '</p>';
        s += '<p class="wscript">' + esc(p.label) + '</p><h2 class="wtitle">' + esc(sec.name) + '</h2>';
        s += metaLine([moc.title || moc.name, '노트 ' + sec.ids.length]);
        s += noteIdx(sec.ids, p.color, src);
        return { html: s, hint: 'Click a planet to read its note', label: p.label + ' · ' + sec.name, back: p.label };
      }
      let h = '<p class="wk" style="color:' + p.color + '">' + dot + 'Project world</p>';
      h += '<p class="wscript">' + esc(p.label) + '</p><h2 class="wtitle">' + esc(moc.title || moc.name) + '</h2>';
      h += metaLine([fmtPeriod(moc.period), moc.status, moc.role]);
      if (summary) h += '<p class="wsum">' + esc(summary) + '</p>';
      h += wlink(own ? own.i : p.moc, own ? '노트 읽기' : '개요 읽기');
      const multi = p.sections.length > 1;
      h += multi ? idx(p.sections.map((s) => ({ attr: 'data-sec="' + esc(s.key) + '"', ids: s.ids, no: s.no, nm: s.name, ct: s.ids.length })), p.color, src)
        : noteIdx(p.sections[0].ids.filter((j) => j !== p.moc), p.color, src);
      h += '<div class="wfoot">' + tagLine('Concepts', concepts.slice(0, 6)) + tagLine('Tools', tools.slice(0, 6)) + '</div>';
      return { html: h, hint: multi ? 'Click a planet to zoom in' : 'Click a planet to read its note', label: p.label };
    }
    const kindEn = n.kind === 'concept' ? 'Concept world' : n.kind === 'tool' ? 'Tool world' : n.kind === 'course' ? 'Course world' : 'The whole brain';
    const rel = w.home ? G.projects.map((p) => ({ p: p, w: p.members.length, indirect: false })) : (w.rel || []);
    const indirect = rel.length && rel[0].indirect;
    const script = w.home ? 'Second Brain' : (/^[\x20-\x7E]+$/.test(n.name) ? n.name : '');
    let h = '<p class="wk" style="color:' + w.color + '"><span class="dot" aria-hidden="true" style="background:' + w.color + ';box-shadow:0 0 12px ' + w.color + '"></span>' + kindEn + (n.domain ? '<span class="kd">' + esc(n.domain) + '</span>' : '') + '</p>';
    if (script) h += '<p class="wscript">' + esc(script) + '</p>';
    h += '<h2 class="wtitle">' + esc(w.home ? '세컨드 브레인 전체' : (n.title || n.name)) + '</h2>';
    if (n.summary) h += '<p class="wsum">' + esc(n.summary) + '</p>';
    if (n.domain) h += metaHtml([{ k: 'Field', v: n.domain }]);
    if (!w.home) h += readLink(i, '노트 읽기');
    h += '<p class="sub" style="margin-top:24px">' + (w.home ? 'Every world I built' : 'Projects I built with this') + '</p>';
    h += '<p class="subnote">' + (!rel.length ? '이 주제로 진행한 프로젝트는 아직 없습니다. 연결된 노트에서 이어서 볼 수 있어요.' : indirect ? '직접 쓰인 프로젝트는 없고, 연결된 개념을 통해 이어진 프로젝트입니다.' : (w.home ? '각 프로젝트는 볼트 안의 독립된 세계입니다.' : '이 노드와 링크로 직접 이어진 프로젝트입니다.')) + '</p>';
    h += '<div class="pcards">' + rel.map((r) => {
      const m = G.nodes[r.p.moc];
      return '<button type="button" class="pcard" data-go="' + r.p.moc + '"><span class="row"><span class="dot" aria-hidden="true" style="background:' + r.p.color + ';box-shadow:0 0 12px ' + r.p.color + '"></span><span class="lab">' + esc(r.p.label) + '</span><span class="wt">' + (w.home ? '노트 ' : (r.indirect ? '간접 ' : '연결 ')) + r.w + '</span></span><span class="tt">' + esc(m.title || m.name) + '</span><span class="wh">' + esc([m.period, m.status].filter(Boolean).join(' · ')) + '</span></button>';
    }).join('') + '</div>';
    const nb = Array.from(G.adj[i]).map((j) => G.nodes[j]).sort((a, b) => b.deg - a.deg).slice(0, 24);
    if (nb.length) h += '<p class="sub" style="margin-top:24px">Wired to</p><div class="chips">' + nb.map(chip).join('') + '</div>';
    return { html: h, hint: rel.length ? 'Click a planet to travel' : '', label: script || n.name };
  }

  // ---------- render ----------
  let leaveT = 0;
  function render() {
    const ph = state.phase, main = ph === 'main';
    document.documentElement.classList.toggle('intro-lock', ph === 'intro');
    $('hdr').classList.toggle('is-hidden', ph === 'intro' || ph === 'dive');
    ['hero', 'legend', 'cue'].forEach((id) => $(id).classList.toggle('is-hidden', !(main || ph === 'rise')));   // 돌아오는 중(rise)에 미리 떠오르기 시작 (CSS 지연 .45s)
    $('btn-skip').hidden = ph !== 'intro';
    const wOn = ph === 'world';
    const wEl = $('world');
    if (wOn) {
      clearTimeout(leaveT); wEl.classList.remove('leave');
      const r = worldHtml();
      const panel = $('wpanel'), key = state.world + ':' + state.section, keep = panel.scrollTop, same = panel.getAttribute('data-w') === key;
      panel.innerHTML = r.html; panel.setAttribute('aria-label', r.label || ''); panel.setAttribute('data-w', key);
      drawFan(panel); if (document.fonts) document.fonts.ready.then(() => drawFan(panel));   // 폰트가 늦게 오면 줄 높이가 바뀌므로 한 번 더
      if (same) panel.scrollTop = keep; else { panel.scrollTop = 0; panel.classList.remove('pin'); void panel.offsetWidth; panel.classList.add('pin'); }   // 섹션 안팎을 오갈 때 패널이 부드럽게 바뀐다
      panel.classList.remove('pout');
      const on = panel.querySelector('.wrow.on'); if (on) on.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      $('whint').textContent = r.hint;
      $('btn-back').querySelector('.back-t').textContent = r.back ? 'Back to ' + r.back : 'Back to the brain';
      if (wEl.hidden) wEl.hidden = false;
    } else if (!wEl.hidden && !wEl.classList.contains('leave')) {   // 패널을 바로 끄지 않고 페이드아웃(0.4s)한 뒤 숨긴다
      wEl.classList.add('leave');
      leaveT = setTimeout(() => { wEl.hidden = true; wEl.classList.remove('leave'); $('wpanel').removeAttribute('data-w'); }, 400);
    }
    document.querySelectorAll('.sec').forEach((el) => { el.hidden = wOn; });   // 월드 안에서는 페이지가 스크롤되지 않는다 (아래로 내리는 대신 행성을 눌러 들어간다)
  }
  const lightUp = () => document.documentElement.classList.remove('intro-dark');   // 인트로 배경(새까만 화면) 해제 → 배경 레이어 페이드인
  function set(patch) { Object.assign(state, patch); if (state.phase !== 'intro') lightUp(); if (window.BG) window.BG.setMode(state.phase); render(); }

  function openNote(j) { location.hash = '#/note/' + encodeURIComponent(G.nodes[j].name); }   // js/reader.js가 hashchange로 연다
  function enter(i) {
    if (!eng) return;
    if (state.phase === 'world') eng.travel(i);
    else if (state.phase === 'main') { $('brain').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); eng.dive(i); }
  }

  // ---------- events ----------
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) { e.preventDefault(); enter(Number(go.getAttribute('data-go'))); return; }
    const sec = e.target.closest('[data-sec]');
    if (sec) { if (eng) eng.enterSection(sec.getAttribute('data-sec')); return; }   // 패널의 섹션 행도 행성을 누른 것과 같다: 줌인
    const note = e.target.closest('[data-note]');
    if (note) { const j = Number(note.getAttribute('data-note')); if (eng && eng.drop(j)) return; if (eng && state.note !== j) eng.pick(j); openNote(j); }   // 패널의 노트 행도 행성 낙하 → 리더 (행성이 없으면 바로 리더)
  });
  // 패널 목록 ↔ 행성 하이라이트 (양방향)
  const rowKey = (el) => el.hasAttribute('data-sec') ? el.getAttribute('data-sec') : Number(el.getAttribute('data-note'));
  // 줄 사이 틈·팬 영역(목록 안)에서는 상태를 유지한다 — 줄을 옮겨 갈 때 '꺼짐→켜짐'이 반복되던 깜빡임의 원인
  let hlKey = null;
  const engHl = (v) => { if (v !== hlKey) { hlKey = v; if (eng) eng.hl(v); } };
  $('wpanel').addEventListener('mouseover', (e) => {
    const r = e.target.closest('.wrow'), t = e.target.closest('.wtags [data-go]'), sv = $('wpanel').querySelector('.wfan');
    if (r) { engHl(rowKey(r)); mark(rowIndex(r), -1); }
    else if (t && sv && sv._D && sv._D.c.includes(Number(t.getAttribute('data-go')))) { engHl(null); mark(-1, sv._D.c.indexOf(Number(t.getAttribute('data-go')))); }   // 개념 태그 → 그 개념이 닿는 섹션들
    else if (e.target.closest('.wk, .wscript, .wtitle, .wmeta, .wsum, .wlink, .wtags [data-go]')) { engHl(null); mark(-1, -1); }   // 위쪽 제목부·도구 태그에 닿을 때만 끈다. 목록↔Concepts 사이 빈 공간·태그 사이 틈에서는 유지
  });
  $('wpanel').addEventListener('mouseleave', () => { engHl(null); mark(-1, -1); });
  function onWHover(act) {
    const v = act ? (act.sec !== undefined ? act.sec : act.note) : null;
    const r = v === null ? null : Array.from($('wpanel').querySelectorAll('.wrow')).find((x) => rowKey(x) === v);
    mark(r ? rowIndex(r) : -1, -1);
  }
  $('btn-back').addEventListener('click', () => { if (eng) eng.back(); });
  $('btn-skip').addEventListener('click', () => { if (eng) eng.skip(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.phase === 'world' && eng) eng.back(); });
  // 리더가 닫히는 순간(rd-on 해제) 낙하 연출을 역재생 — 닫기 버튼은 pushState라 hashchange가 안 와서 클래스 변화를 본다
  let rdOn = false;
  new MutationObserver(() => { const on = document.documentElement.classList.contains('rd-on'); if (rdOn && !on && eng) eng.undrop(); rdOn = on; })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // ---------- boot ----------
  const intro = CONFIG.showIntro && !reduce;
  const start = () => {
    window.BG = createBackdrop($('bg-canvas'), { onGlitch: (d) => { if (eng) eng.overload(d); } });   // 배경 글리치 ↔ 브레인 노드 과부하 연동
    eng = createEngine($('brain-canvas'), {
      intro: intro, autoRotate: CONFIG.autoRotate && !reduce, orbit: CONFIG.orbitMotion && !reduce, reduce: reduce,
      fonts: { script: S.css, k: S.k, it: S.it, body: "'Noto Sans KR', sans-serif", mono: "'Noto Sans KR', sans-serif" },
      introFont: CONFIG.introFont, ink: CONFIG.introInk, inkScale: CONFIG.introThickness
    }, {
      onBurst: () => { lightUp(); if (window.BG) window.BG.setMode('main'); },   // 파티클이 흩어지는 순간부터 배경 유체도 그래프 쪽으로 흐르기 시작
      onMain: () => set({ phase: 'main' }),
      onHover: () => {},
      onWHover: onWHover,
      onDive: () => set({ phase: 'dive' }),
      onWorld: (i) => set({ phase: 'world', world: i, section: null, note: null }),
      onZoom: () => $('wpanel').classList.add('pout'),                 // 행성으로 줌인하는 동안 패널을 먼저 흐리게
      onSec: (key) => set({ section: key, note: null }),               // 섹션 행성 안으로 들어가거나(key) 나올 때(null)
      onNote: (j) => set({ note: j }),
      onOpen: openNote,                                                 // 노트 행성 클릭 → 리더
      onRise: () => set({ phase: 'rise' }),
      onBack: () => set({ phase: 'main', world: -1, section: null, note: null })
    });
    set({ phase: intro ? 'intro' : 'main' });
  };
  // 캔버스에 필기체 라벨을 그리기 전에 폰트를 받아 둔다 (최대 1.5초 대기)
  const fontReady = document.fonts && document.fonts.load ? Promise.race([Promise.all([document.fonts.load((S.it ? 'italic ' : '') + '30px ' + S.css), document.fonts.load('13px "Noto Sans KR"')]), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontReady.then(start, start);
  render();
  document.documentElement.classList.remove('boot');   // render()가 is-hidden을 이미 걸었으므로 불투명도 변화 없이 인계된다
})();
