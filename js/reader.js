/* N.H.W — 노트 리더 · 전체 목록 · 검색
   #/note/<노트 이름>  노트 본문 (공유·뒤로가기 가능)
   #/index             전체 노트 목록 (프로젝트 · 분야별 개념 · 도구 · 과목)
   Ctrl+K 또는 /       검색 (제목 · 요약 · 본문)
   본문은 vault/notes.json(빌드 산출물). 처음 필요할 때 marked + KaTeX를 받고, mermaid는 다이어그램이 있을 때만 받는다. */
(function () {
  const G = GRAPH, el = document.getElementById('reader');
  const CDN = 'https://cdn.jsdelivr.net/npm/';
  const IMG = /\.(png|jpe?g|gif|svg|webp)$/i;
  const VIEWERS = { 'gft-turbine': 'GreenFlow-T 터빈 3D 뷰어', 'hystep-cleaner': 'HY-Step 세정기 3D 뷰어', 'f1t-pipeline': 'F1TENTH 파이프라인 맵' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const href = (n) => '#/note/' + encodeURIComponent(n.name);
  const asset = (name) => 'vault/assets/' + encodeURIComponent(name.replace(/\.(png|jpe?g)$/i, '.webp'));   // 빌드가 PNG·JPG를 WebP로 바꿔 둔다
  const isPub = (n) => notes[n.i] != null;
  let notes = null, ready = null, mermaidReady = null, view = '';

  const script = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  function load() {
    if (!ready) {
      const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = CDN + 'katex@0.16.11/dist/katex.min.css'; document.head.appendChild(l);
      ready = Promise.all([fetch('vault/notes.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }), script(CDN + 'marked@12.0.2/marked.min.js'), script(CDN + 'katex@0.16.11/dist/katex.min.js')])
        .then((r) => { notes = r[0]; setup(); })
        .catch((e) => { ready = null; throw e; });   // 실패하면 다음에 다시 시도
    }
    return ready;
  }

  // ---------- 옵시디언 문법 → marked 확장 ----------
  function tex(s, display) { try { return katex.renderToString(s, { displayMode: display, throwOnError: false }); } catch (_) { return esc(s); } }
  function wiki(t) {
    const name = t.target.split('/').pop();
    if (t.embed && IMG.test(name)) {
      const w = /^\d+$/.test(t.alias || '') ? ' width="' + t.alias + '"' : '';
      return '<img src="' + asset(name) + '" alt="' + esc(name.replace(IMG, '')) + '" loading="lazy"' + w + '>';
    }
    const n = G.byName[name], label = esc(t.alias || name);
    return n ? '<a class="wl" href="' + href(n) + '">' + label + '</a>' : '<span class="wl-x">' + label + '</span>';
  }
  function setup() {
    marked.use({
      gfm: true, breaks: true,   // 옵시디언 기본값: 줄바꿈 하나도 줄바꿈
      extensions: [
        { name: 'mathBlock', level: 'block', start: (s) => s.indexOf('$$'),
          tokenizer(s) { const m = /^\$\$([\s\S]+?)\$\$[^\S\n]*(?:\n|$)/.exec(s); if (m) return { type: 'mathBlock', raw: m[0], text: m[1] }; },
          renderer: (t) => '<div class="math">' + tex(t.text, true) + '</div>' },
        { name: 'mathInline', level: 'inline', start: (s) => s.indexOf('$'),
          tokenizer(s) { const m = /^\$\$([\s\S]+?)\$\$/.exec(s) || /^\$(?!\s)((?:\\.|[^\\$\n])+?)(?<!\s)\$(?!\d)/.exec(s); if (m) return { type: 'mathInline', raw: m[0], text: m[1], d: m[0].startsWith('$$') }; },
          renderer: (t) => tex(t.text, t.d) },
        { name: 'wiki', level: 'inline', start: (s) => { const k = s.search(/!?\[\[/); return k < 0 ? undefined : k; },
          tokenizer(s) { const m = /^(!?)\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/.exec(s); if (m) return { type: 'wiki', raw: m[0], embed: !!m[1], target: m[2].trim(), alias: m[3] }; },
          renderer: wiki },
        { name: 'mark', level: 'inline', start: (s) => s.indexOf('=='),
          tokenizer(s) { const m = /^==([^=\n]+)==/.exec(s); if (m) return { type: 'mark', raw: m[0], tokens: this.lexer.inlineTokens(m[1]) }; },
          renderer(t) { return '<mark>' + this.parser.parseInline(t.tokens) + '</mark>'; } }
      ],
      renderer: {
        code(code, lang) {
          lang = (lang || '').trim();
          if (lang === 'mermaid') return '<pre class="mermaid">' + esc(code) + '</pre>';
          if (VIEWERS[lang]) { const h = /height:\s*(\d+)/.exec(code); return '<iframe class="viewer" src="vault/assets/' + lang + '.html" title="' + VIEWERS[lang] + '" loading="lazy" style="height:' + (h ? h[1] : 560) + 'px"></iframe>'; }
          return false;   // 나머지는 marked 기본 렌더
        }
      }
    });
  }
  // > [!tip] 제목  → 콜아웃 상자
  function callouts(root) {
    root.querySelectorAll('blockquote').forEach((q) => {
      const p = q.firstElementChild; if (!p || p.tagName !== 'P') return;
      const m = /^\[!(\w+)\][+-]?[ \t]*/.exec(p.innerHTML); if (!m) return;
      let rest = p.innerHTML.slice(m[0].length); const k = rest.indexOf('<br>');
      const title = k < 0 ? rest : rest.slice(0, k); rest = k < 0 ? '' : rest.slice(k + 4).replace(/^\n/, '');
      q.className = 'co co-' + m[1].toLowerCase();
      if (rest.trim()) p.innerHTML = rest; else p.remove();
      const t = document.createElement('p'); t.className = 'co-t'; t.innerHTML = title.trim() || m[1]; q.prepend(t);
    });
  }
  function diagrams(root) {
    const nodes = root.querySelectorAll('pre.mermaid'); if (!nodes.length) return;
    mermaidReady = mermaidReady || script(CDN + 'mermaid@10.9.1/dist/mermaid.min.js').then(() => mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' }));
    mermaidReady.then(() => mermaid.run({ nodes: nodes })).catch(() => {});
  }

  // ---------- 노트 화면 ----------
  const bar = () => '<div class="rd-bar"><button type="button" class="pill" data-close>← 닫기 <kbd>Esc</kbd></button><a class="pill" href="#/index">전체 목록</a><button type="button" class="pill" data-search>검색 <kbd>Ctrl K</kbd></button></div>';
  function side(i) {
    const nb = Array.from(G.adj[i]).map((j) => G.nodes[j]).sort((a, b) => b.deg - a.deg);
    return '<aside class="rd-side"><p class="rd-st">연결된 노트 <span>' + nb.length + '</span></p><div class="rd-nb">' +
      nb.map((n) => '<a class="chip" href="' + href(n) + '"><span class="dot" aria-hidden="true" style="background:' + n.color + '"></span>' + esc(n.name) + '</a>').join('') + '</div>' +
      '<button type="button" class="pill rd-go" data-go="' + i + '">그래프에서 보기 →</button></aside>';
  }
  // 성숙도 (frontmatter stage, 없으면 짧은 노트만 '씨앗') — 미완성 노트도 부담 없이 공개하기 위한 표시
  const STAGE = { seedling: ['씨앗', '아직 짧은 메모 — 자라는 중인 노트'], budding: ['자라는 중', '뼈대는 섰고 계속 보강 중'], evergreen: ['상록', '정리가 끝나 자주 참조하는 노트'] };
  const stage = (n) => (n.stage ? '<span class="stg stg-' + n.stage + '" title="' + STAGE[n.stage][1] + '">' + STAGE[n.stage][0] + '</span>' : '');
  const dates = (n) => [n.created && '생성 ' + n.created, n.updated && n.updated !== n.created && '수정 ' + n.updated].filter(Boolean).join(' · ');
  // 쓰인 곳 (자동): 이 노트와 링크로 이어진 프로젝트 노트를 프로젝트별로 — 개념 노트의 '어디서 썼나' 표를 손으로 채우지 않아도 된다
  function usedIn(i) {
    if (G.nodes[i].kind === 'project' || G.nodes[i].kind === 'home') return '';
    const by = groupBy(Array.from(G.adj[i]).map((j) => G.nodes[j]).filter((m) => m.kind === 'project'), (m) => m.grp.gi);
    if (!by.length) return '';
    return '<section class="rd-used"><h2>쓰인 곳 <span class="ix-c">링크로 자동 정리</span></h2>' + by.sort((a, b) => b[1].length - a[1].length).map((e) => {
      const g = e[1][0].grp;
      return '<div class="u-p"><p class="u-h"><span class="dot" aria-hidden="true" style="background:' + g.color + '"></span>' + esc(g.label) + ' <span class="ix-c">' + e[1].length + '</span></p>' +
        '<div class="ix-list">' + e[1].sort(byName).map((m) => '<a class="ix-row" href="' + href(m) + '"><span class="ix-n">' + esc(m.name) + '</span><span class="ix-s">' + esc(m.summary) + '</span></a>').join('') + '</div></div>';
    }).join('') + '</section>';
  }
  function show(i) {
    const n = G.nodes[i], md = notes[i];
    const kicker = [n.grp.label, n.domain, n.status].filter(Boolean).map(esc).join(' · ');
    let body;
    if (md == null) body = '<h1>' + esc(n.title || n.name) + '</h1><p class="rd-private">비공개 노트입니다. 그래프에는 제목과 연결만 공개됩니다.</p>';
    else { body = marked.parse(md); if (!/^\s*<h1/.test(body)) body = '<h1>' + esc(n.title || n.name) + '</h1>' + body; }
    el.innerHTML = bar() + '<div class="rd-in"><article class="rd-doc"><p class="rd-k" style="color:' + n.color + '">' + kicker + '</p><div class="rd-body">' + body + usedIn(i) + '</div></article>' + side(i) + '</div>';
    const b = el.querySelector('.rd-body'); callouts(b); diagrams(b);
    const meta = [dates(n), stage(n)].filter(Boolean).join(' ');
    if (meta) b.querySelector('h1').insertAdjacentHTML('afterend', '<p class="rd-dates">' + meta + '</p>');
    el.querySelectorAll('.rd-body table').forEach((t) => { const w = document.createElement('div'); w.className = 'tbl'; t.replaceWith(w); w.appendChild(t); });
    el.setAttribute('aria-label', n.name); el.scrollTop = 0;
    document.title = n.name + ' — N.H.W';
  }
  function message(t) { el.innerHTML = bar() + '<div class="rd-in"><article class="rd-doc"><p class="rd-private">' + esc(t) + '</p></article></div>'; }

  // ---------- 전체 목록 (#/index) ----------
  const byName = (a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true });
  function groupBy(list, key) { const m = new Map(); list.forEach((n) => { const k = key(n); if (!m.has(k)) m.set(k, []); m.get(k).push(n); }); return Array.from(m.entries()); }
  function showIndex() {
    const row = (n) => '<a class="ix-row' + (isPub(n) ? '' : ' priv') + '" href="' + href(n) + '"><span class="ix-n">' + esc(n.name) + (isPub(n) ? stage(n) : '') + '</span><span class="ix-s">' + esc(isPub(n) ? n.summary : '비공개') + '</span></a>';
    const list = (ns) => '<div class="ix-list">' + ns.map(row).join('') + '</div>';
    const sub = (id, title, ns) => '<h3' + (id ? ' id="' + id + '"' : '') + '>' + esc(title) + ' <span class="ix-c">' + ns.length + '</span></h3>' + list(ns.sort(byName));
    const of = (k) => G.nodes.filter((n) => n.kind === k);
    const groups = [];

    groups.push({ id: 'ix-projects', label: 'Projects', color: '#BFD3FF', count: G.projects.reduce((s, p) => s + p.members.length, 0),
      html: G.projects.map((p) => '<h3 class="ix-p"><span class="dot" aria-hidden="true" style="background:' + p.color + '"></span>' + esc(p.label) + ' <span class="ix-pt">' + esc(G.nodes[p.moc].title || '') + '</span></h3>' +
        p.sections.map((s) => (p.sections.length > 1 ? '<p class="ix-sec">' + esc(s.no + ' ' + s.name) + '</p>' : '') + list(s.ids.map((j) => G.nodes[j]).sort((a, b) => (a.type === 'project-moc' ? -1 : b.type === 'project-moc' ? 1 : byName(a, b))))).join('')).join('') });

    const domains = groupBy(of('concept'), (n) => n.domain || '기타').sort((a, b) => (a[0] === '기타') - (b[0] === '기타') || b[1].length - a[1].length);
    groups.push({ id: 'ix-concepts', label: 'Concepts', color: '#7ED957', count: of('concept').length,
      jumps: domains.map((d, k) => '<button type="button" class="chip" data-jump="ix-d' + k + '">' + esc(d[0]) + ' <span class="ix-c">' + d[1].length + '</span></button>').join(''),
      html: domains.map((d, k) => sub('ix-d' + k, d[0], d[1])).join('') });

    groups.push({ id: 'ix-tools', label: 'Tools', color: '#B7C4D6', count: of('tool').length, html: list(of('tool').sort(byName)) });

    const courses = groupBy(of('course'), (n) => (/^([^-\s]+)-/.exec(n.name) || [0, ''])[1]).sort((a, b) => (a[0] === '') - (b[0] === ''));
    groups.push({ id: 'ix-courses', label: 'Courses', color: '#FF5C6C', count: of('course').length,
      html: courses.map((c) => { const moc = c[1].find((n) => /-00 /.test(n.name)); return sub('', c[0] ? (moc && moc.title) || c[0] : '기타', c[1]); }).join('') });

    const total = groups.reduce((s, g) => s + g.count, 0), pub = G.nodes.filter((n) => n.kind !== 'home' && isPub(n)).length;
    el.innerHTML = bar() + '<div class="rd-in ix"><article class="rd-doc"><p class="rd-k">Second Brain · Index</p><div class="rd-body"><h1>전체 노트</h1>' +
      '<p class="ix-lead">노트 ' + total + '개 · 본문 공개 ' + pub + '개. 비공개 노트는 제목과 연결만 보입니다. <button type="button" class="ix-find" data-search>제목·본문으로 찾기 <kbd>Ctrl K</kbd></button></p>' +
      '<div class="chips ix-jumps">' + groups.map((g) => '<button type="button" class="chip" data-jump="' + g.id + '"><span class="dot" aria-hidden="true" style="background:' + g.color + '"></span>' + g.label + ' <span class="ix-c">' + g.count + '</span></button>').join('') + '</div>' +
      '<section class="ix-g"><h2>최근 바뀐 노트</h2><div class="ix-list">' + recent(9).map((n) => '<a class="ix-row" href="' + href(n) + '"><span class="ix-n"><span class="ix-d">' + n.updated.slice(5) + '</span>' + esc(n.name) + stage(n) + '</span><span class="ix-s">' + esc(n.summary) + '</span></a>').join('') + '</div></section>' +
      groups.map((g) => '<section class="ix-g" id="' + g.id + '"><h2><span class="dot" aria-hidden="true" style="background:' + g.color + '"></span>' + g.label + ' <span class="ix-c">' + g.count + '</span></h2>' + (g.jumps ? '<div class="chips ix-jumps">' + g.jumps + '</div>' : '') + g.html + '</section>').join('') +
      '</div></article></div>';
    el.setAttribute('aria-label', '전체 노트'); el.scrollTop = 0;
    document.title = '전체 노트 — N.H.W';
  }

  // ---------- 최근 바뀐 노트 (요약이 있는 노트 = 공개 노트, 빌드가 비공개 노트의 요약을 지운다) ----------
  function recent(k) {
    return G.nodes.filter((n) => n.summary && n.kind !== 'home').sort((a, b) => (b.updated > a.updated) - (b.updated < a.updated) || b.deg - a.deg).slice(0, k);
  }
  const fresh = document.getElementById('fresh');
  if (fresh) {
    const latest = recent(1)[0];
    document.getElementById('fresh-lead').textContent = '볼트에서 가장 최근에 손본 노트입니다. 마지막 수정 ' + (latest ? latest.updated : '—') + ' · 아직 짧은 ‘씨앗’ 노트 ' + G.nodes.filter((n) => n.stage === 'seedling' && n.summary).length + '개는 계속 자라는 중이에요.';
    fresh.innerHTML = recent(6).map((n) => '<a class="panel fcard" href="' + href(n) + '"><span class="fk" style="color:' + n.color + '">' + esc(n.grp.label) + (n.domain ? ' · ' + esc(n.domain) : '') + '</span>' +
      '<span class="ft">' + esc(n.name) + '</span><span class="fs">' + esc(n.summary) + '</span><span class="fd">' + n.updated + stage(n) + '</span></a>').join('');
  }

  // ---------- Projects · Timeline · Right now — 볼트 각 프로젝트 '00 개요'의 속성에서 만든다 ----------
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);   // 지난 일정·다음 일정은 보는 날 기준
  const bold = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const live = (m) => /진행/.test(m.status);
  // "2026-08-17 조향 LUT 삭제 — 설명" → { date, title, desc }
  const stones = G.projects.flatMap((p) => G.nodes[p.moc].milestones.map((s) => { const m = /^(\d{4}-\d{2}(?:-\d{2})?)\s+(.+?)(?:\s+—\s+(.+))?$/.exec(s); return m && { p: p, date: m[1], title: m[2], desc: m[3] || '' }; }).filter(Boolean))
    .sort((a, b) => (a.date > b.date) - (a.date < b.date));
  const lastDate = (p) => stones.filter((s) => s.p === p).map((s) => s.date).pop() || '';
  const nextOf = (p) => stones.find((s) => s.p === p && s.date >= today);
  const linkNote = (name, label, cls) => { const n = G.byName[name]; if (!n) return ''; return n.summary ? '<a class="' + cls + '" href="' + href(n) + '">' + esc(label || name) + '</a>' : '<span class="' + cls + ' priv" title="비공개 노트 — 볼트에서 publish: true로 바꾸면 열립니다">' + esc(label || name) + ' · 비공개</span>'; };

  const grid = document.getElementById('proj-grid');
  if (grid) grid.innerHTML = G.projects.slice().sort((a, b) => live(G.nodes[b.moc]) - live(G.nodes[a.moc]) || (lastDate(b) > lastDate(a)) - (lastDate(b) < lastDate(a))).map((p) => {
    const m = G.nodes[p.moc], cn = G.byName[m.coverNote] || m, title = (m.title || '').replace(new RegExp('^' + p.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*—\\s*'), '');
    let cover = '';
    if (VIEWERS[m.cover]) cover = '<div class="pcover"><iframe src="vault/assets/' + m.cover + '.html" title="' + VIEWERS[m.cover] + '" loading="lazy" tabindex="-1" aria-hidden="true"></iframe><a class="pcover-a" href="' + href(cn) + '" aria-label="' + esc(cn.name) + ' 열기"></a></div>';
    else if (m.cover) cover = '<a class="pcover" href="' + href(cn) + '"><img src="' + asset(m.cover) + '" alt="' + esc(p.label) + ' 표지" loading="lazy"></a>';
    const flow = [['문제', m.problem], ['접근', m.approach], ['결과', m.result], ['다시 한다면', m.retro]].filter((r) => r[1]);
    const verify = m.verify.map((v) => linkNote(v, v.replace(/^[^-\s]+-/, ''), 'vchip')).filter(Boolean);
    return '<article class="panel proj">' + cover +
      '<header><span class="status' + (live(m) ? ' live' : ' done') + '">' + esc(m.status) + '</span><span class="when">' + esc(m.period) + '</span></header>' +
      '<h3 class="s">' + esc(p.label) + '</h3><p class="ptitle">' + esc(title) + '</p>' +
      (flow.length ? '<dl class="flow">' + flow.map((r) => '<div><dt>' + r[0] + '</dt><dd>' + bold(r[1]) + '</dd></div>').join('') + '</dl>' : '<p class="pdesc">' + esc(m.summary) + '</p>') +
      (verify.length ? '<p class="vrow"><span class="vk">검증 기록</span>' + verify.join('') + '</p>' : '') +
      (m.role ? '<p class="role">역할 · ' + esc(m.role) + '</p>' : '') +
      (m.tools.length ? '<p class="tags">' + m.tools.map((t) => '<span>' + esc(t) + '</span>').join('') + '</p>' : '') +
      '<p class="pact"><button type="button" class="pill" data-go="' + p.moc + '">세계로 들어가기</button><a class="pill" href="' + href(m) + '">개요 읽기</a>' + (cn !== m ? '<a class="pill" href="' + href(cn) + '">' + (VIEWERS[m.cover] || /3D/.test(cn.name) ? '인터랙티브 보기' : '그림 노트') + '</a>' : '') + '</p></article>';
  }).join('');

  const tl = document.getElementById('tl-list');
  if (tl) tl.innerHTML = stones.map((s, k) => {
    const prevYear = k ? stones[k - 1].date.slice(0, 4) : '';
    const when = s.date.length === 7 || s.date.slice(0, 4) !== prevYear ? s.date.slice(0, 4) + '.' + s.date.slice(5).replace('-', '.') : s.date.slice(5).replace('-', '.');
    return '<li' + (s.date >= today ? ' class="next"' : '') + '><time>' + when + '</time><p><span class="tl-p" style="color:' + s.p.color + '">' + esc(s.p.label) + (s.date >= today ? ' · 예정' : '') + '</span><b>' + esc(s.title) + '</b>' + (s.desc ? ' — ' + esc(s.desc) : '') + '</p></li>';
  }).join('');

  const now = document.getElementById('now');
  if (now) now.innerHTML = G.projects.filter((p) => live(G.nodes[p.moc])).map((p) => {
    const m = G.nodes[p.moc], nx = nextOf(p);
    return '<li><b>' + esc(p.label) + '</b> ' + esc(m.todo || m.status) + (nx ? ' → ' + nx.date.slice(5).replace('-', '.') + ' ' + esc(nx.title) : '') + '</li>';
  }).join('') || '<li class="dim">진행 중인 프로젝트 없음</li>';

  // ---------- 라우팅 ----------
  const TITLE = document.title;
  function route() {
    const m = /^#\/(note|index)(?:\/(.*))?$/.exec(location.hash);
    if (!m) { if (!el.hidden) { el.hidden = true; view = ''; document.documentElement.classList.remove('rd-on'); document.title = TITLE; } return; }
    const wasHidden = el.hidden;
    el.hidden = false; document.documentElement.classList.add('rd-on');
    let key, draw;
    if (m[1] === 'index') { key = 'index'; draw = showIndex; }
    else {
      const n = G.byName[decodeURIComponent(m[2] || '')];
      if (!n) { view = ''; message('노트를 찾을 수 없습니다.'); return; }
      key = 'n' + n.i; draw = () => show(n.i);
    }
    if (key === view) return;
    view = key;
    if (!notes) message('불러오는 중…');
    load().then(() => { if (view === key) draw(); }, () => { if (view === key) { view = ''; message('본문을 불러오지 못했습니다. 로컬 서버(start.bat)로 열었는지 확인해 주세요.'); } });
    if (wasHidden) setTimeout(() => { const x = el.querySelector('[data-close]'); if (x) x.focus({ preventScroll: true }); }, 0);
  }
  function close() { history.pushState(null, '', location.pathname + location.search); route(); }

  // ---------- 검색 (Ctrl+K) ----------
  const sbox = document.createElement('div');
  sbox.className = 'search'; sbox.hidden = true;
  sbox.setAttribute('role', 'dialog'); sbox.setAttribute('aria-modal', 'true'); sbox.setAttribute('aria-label', '노트 검색');
  sbox.innerHTML = '<div class="s-in"><div class="s-q"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>' +
    '<input type="search" placeholder="노트 제목 · 요약 · 본문 검색" aria-label="검색어" aria-controls="s-res" autocomplete="off" spellcheck="false"></div>' +
    '<ol class="s-res" id="s-res" role="listbox"></ol><p class="s-foot">↑↓ 이동 · Enter 열기 · Esc 닫기 · 띄어쓰기로 여러 단어 (모두 포함)</p></div>';
  document.body.appendChild(sbox);
  const input = sbox.querySelector('input'), res = sbox.querySelector('.s-res');
  let hits = [], sel = 0, plain = null;

  // 검색용 본문: 코드·블록 수식·그림을 빼고 마크다운 기호를 걷어낸 평문
  const strip = (md) => md.replace(/```[\s\S]*?```/g, ' ').replace(/\$\$[\s\S]*?\$\$/g, ' ').replace(/!\[\[[^\]]*\]\]/g, ' ')
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_, a, b) => b || a).replace(/^\s*>\s*\[![^\]]*\][+-]?/gm, ' ')
    .replace(/-{2,}/g, ' ').replace(/[#>*_`|=$\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  const terms = () => input.value.toLowerCase().split(/\s+/).filter(Boolean);
  function find(ts) {
    if (!ts.length) return [];
    const q = ts.join(' '), out = [];
    G.nodes.forEach((n) => {
      const head = (n.name + ' ' + n.title).toLowerCase(), sum = n.summary.toLowerCase(), body = plain ? plain[n.i].low : '';
      let score = 0;
      for (const t of ts) { const s = (head.includes(t) ? 10 : 0) + (sum.includes(t) ? 4 : 0) + (body.includes(t) ? 1 : 0); if (!s) return; score += s; }
      const nm = n.name.toLowerCase(); if (nm === q) score += 50; else if (nm.startsWith(ts[0])) score += 5;
      out.push({ n: n, score: score });
    });
    return out.sort((a, b) => b.score - a.score || b.n.deg - a.n.deg).slice(0, 40);
  }
  function snippet(n, ts) {
    const p = plain && plain[n.i], sum = n.summary.toLowerCase();
    const t = p && ts.find((t) => p.low.includes(t) && !sum.includes(t) && !n.name.toLowerCase().includes(t));
    if (!t) return n.summary || (p ? p.txt.slice(0, 100) : '');
    const k = p.low.indexOf(t), a = Math.max(0, k - 40);
    return (a ? '…' : '') + p.txt.slice(a, k + t.length + 70) + '…';
  }
  function hl(s, ts) {
    if (!ts.length) return esc(s);
    const re = new RegExp('(' + ts.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    return s.split(re).map((x, k) => (k % 2 ? '<mark>' + esc(x) + '</mark>' : esc(x))).join('');
  }
  function drawResults() {
    const ts = terms(); hits = find(ts); sel = 0;
    if (!ts.length) res.innerHTML = '<li class="s-empty">노트 ' + G.nodes.length + '개에서 찾습니다' + (plain ? '' : ' · 본문 색인 불러오는 중…') + '</li>';
    else if (!hits.length) res.innerHTML = '<li class="s-empty">‘' + esc(input.value.trim()) + '’ 결과 없음' + (plain ? '' : ' · 본문 색인 불러오는 중…') + '</li>';
    else res.innerHTML = hits.map((h, k) => '<li role="option" id="s-' + k + '" aria-selected="' + (k === 0) + '"><a href="' + href(h.n) + '">' +
      '<span class="s-k" style="color:' + h.n.color + '">' + esc(h.n.grp.label) + (notes && !isPub(h.n) ? ' · 비공개' : '') + '</span>' +
      '<span class="s-t">' + hl(h.n.name, ts) + '</span><span class="s-s">' + hl(snippet(h.n, ts), ts) + '</span></a></li>').join('');
    input.setAttribute('aria-activedescendant', hits.length ? 's-0' : '');
  }
  function move(d) {
    if (!hits.length) return;
    const old = res.children[sel]; if (old) old.setAttribute('aria-selected', 'false');
    sel = (sel + d + hits.length) % hits.length;
    const li = res.children[sel]; li.setAttribute('aria-selected', 'true'); li.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', li.id);
  }
  function openSearch() {
    sbox.hidden = false; document.documentElement.classList.add('s-on');
    input.focus(); input.select(); drawResults();
    if (!plain) load().then(() => { plain = plain || notes.map((md) => { const txt = md ? strip(md) : ''; return { txt: txt, low: txt.toLowerCase() }; }); if (!sbox.hidden) drawResults(); }, () => {});
  }
  function closeSearch() { sbox.hidden = true; document.documentElement.classList.remove('s-on'); }
  input.addEventListener('input', drawResults);
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;   // 한글 조합 중 Enter·화살표는 IME 몫
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' && hits[sel]) { e.preventDefault(); closeSearch(); location.hash = href(hits[sel].n); }
  });
  sbox.addEventListener('click', (e) => { if (e.target === sbox || e.target.closest('a')) closeSearch(); });   // 바깥 클릭 또는 결과 클릭

  // ---------- 이벤트 ----------
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { close(); return; }
    const j = e.target.closest('[data-jump]'); if (j) { const t = el.querySelector('#' + j.getAttribute('data-jump')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (e.target.closest('[data-go]')) close();   // 이어서 app.js가 그 노드의 세계로 돌진한다
  });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-search]')) openSearch(); });
  window.addEventListener('keydown', (e) => {   // capture: 월드의 Esc(뒤로)보다 먼저
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (sbox.hidden) openSearch(); else closeSearch(); return; }
    if (e.key === '/' && sbox.hidden && !typing) { e.preventDefault(); openSearch(); return; }
    if (e.key !== 'Escape') return;
    if (!sbox.hidden) { e.stopPropagation(); closeSearch(); }
    else if (!el.hidden) { e.stopPropagation(); close(); }
  }, true);
  window.addEventListener('hashchange', route);
  route();
})();
