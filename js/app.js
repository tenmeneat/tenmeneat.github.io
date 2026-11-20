/* N.H.W — Second Brain : 화면 상태와 DOM 렌더링
   엔진(js/engine.js)은 캔버스만 그리고, 여기서는 오버레이(헤더·범례·월드 패널)를 상태에 맞춰 갱신한다.
   URL 파라미터로 바로 바꿔볼 수 있다:  ?font=sacramento  ?intro=0  ?orbit=0  ?accent=7CF2C8 */
(function () {
  const Q = new URLSearchParams(location.search);
  const CONFIG = {
    scriptFont: Q.get('font') || 'allura',             // allura | sacramento | parisienne | italianno
    accent: '#' + (Q.get('accent') || 'BFD3FF'),
    introFont: Q.get('introFont') || 'mrs-saint-delafield', // mrs-saint-delafield | great-vibes | pinyon-script
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
  function noteCards(ids, color) {
    return '<div class="ncards">' + ids.map((j) => { const nd = G.nodes[j];
      return '<button type="button" class="ncard' + (state.note === j ? ' on' : '') + '" data-note="' + j + '" style="--c:' + color + '"><span class="nt">' + esc(noteName(j)) + '</span>' + (nd.summary ? '<span class="ns">' + esc(nd.summary) + '</span>' : '') + '<span class="nl">링크 ' + G.adj[j].size + '</span></button>'; }).join('') + '</div>';
  }
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
      if (sec) {   // 섹션 행성 안: 그 섹션의 노트들이 행성이다
        let s = '<p class="wk" style="color:' + p.color + '">' + dot + 'Section world<span class="kd">' + esc(p.label) + '</span></p>';
        s += '<p class="wscript">' + esc(sec.no) + '</p><h2 class="wtitle">' + esc(sec.name) + '</h2>';
        s += '<p class="wsum">' + esc(moc.title || moc.name) + '의 한 섹션입니다. 행성 하나가 노트 하나예요.</p>';
        s += metaHtml([{ k: 'Project', v: p.label }, { k: 'Notes', v: String(sec.ids.length) }]);
        s += '<p class="sub">Notes in this world</p>' + noteCards(sec.ids, p.color);
        return { html: s, hint: 'Click a planet to read its note', label: p.label + ' · ' + sec.name, back: p.label };
      }
      let h = '<p class="wk" style="color:' + p.color + '">' + dot + 'Project world</p>';
      h += '<p class="wscript">' + esc(p.label) + '</p><h2 class="wtitle">' + esc(moc.title || moc.name) + '</h2>';
      if (summary) h += '<p class="wsum">' + esc(summary) + '</p>';
      h += metaHtml([{ k: 'Period', v: moc.period || '—' }, { k: 'Status', v: moc.status || '—' }, { k: 'Role', v: moc.role || '—' }]);
      h += readLink(own ? own.i : p.moc, own ? '노트 읽기' : '개요 읽기');
      const multi = p.sections.length > 1;
      h += '<p class="sub">' + (multi ? 'Inside this world' : 'Notes in this world') + '</p>';
      h += multi ? '<div class="secs">' + p.sections.map((s) => '<button type="button" class="sechead secrow" data-sec="' + esc(s.key) + '"><span class="no" style="color:' + p.color + '">' + s.no + '</span><span class="nm">' + esc(s.name) + '</span><span class="ct">노트 ' + s.ids.length + '</span><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8D97AE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>').join('') + '</div>'
        : noteCards(p.sections[0].ids.filter((j) => j !== p.moc), p.color);
      if (concepts.length) h += '<p class="sub">Concepts it runs on</p><div class="chips">' + concepts.map(chip).join('') + '</div>';
      if (tools.length) h += '<p class="sub">Tools in hand</p><div class="chips">' + tools.map((m) => '<button type="button" class="chip" data-go="' + m.i + '">' + esc(m.name) + '</button>').join('') + '</div>';
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
      if (same) panel.scrollTop = keep; else { panel.scrollTop = 0; panel.classList.remove('pin'); void panel.offsetWidth; panel.classList.add('pin'); }   // 섹션 안팎을 오갈 때 패널이 부드럽게 바뀐다
      panel.classList.remove('pout');
      const on = panel.querySelector('.ncard.on'); if (on) on.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
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
    if (note) { const j = Number(note.getAttribute('data-note')); if (eng && state.note !== j) eng.pick(j); openNote(j); }   // 행성을 짚고 리더로 본문을 연다
  });
  $('btn-back').addEventListener('click', () => { if (eng) eng.back(); });
  $('btn-skip').addEventListener('click', () => { if (eng) eng.skip(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.phase === 'world' && eng) eng.back(); });

  // ---------- boot ----------
  const intro = CONFIG.showIntro && !reduce;
  const start = () => {
    window.BG = createBackdrop($('bg-canvas'));
    eng = createEngine($('brain-canvas'), {
      intro: intro, autoRotate: CONFIG.autoRotate && !reduce, orbit: CONFIG.orbitMotion && !reduce,
      fonts: { script: S.css, k: S.k, body: "'Noto Sans KR', sans-serif", mono: "'Noto Sans KR', sans-serif" },
      introFont: CONFIG.introFont, ink: CONFIG.introInk, inkScale: CONFIG.introThickness
    }, {
      onBurst: () => { lightUp(); if (window.BG) window.BG.setMode('main'); },   // 파티클이 흩어지는 순간부터 배경 유체도 그래프 쪽으로 흐르기 시작
      onMain: () => set({ phase: 'main' }),
      onHover: () => {},
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
  const fontReady = document.fonts && document.fonts.load ? Promise.race([Promise.all([document.fonts.load('30px ' + S.css), document.fonts.load('13px "Noto Sans KR"')]), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontReady.then(start, start);
  render();
  document.documentElement.classList.remove('boot');   // render()가 is-hidden을 이미 걸었으므로 불투명도 변화 없이 인계된다
})();
