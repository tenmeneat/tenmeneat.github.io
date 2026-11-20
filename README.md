# N.H.W — Second Brain (개인 웹사이트)

옵시디언 SecondBrain 볼트의 Shell Graph를 그대로 옮긴 포트폴리오 사이트. 빌드 단계 없는 정적 사이트(HTML · CSS · JS).

## 실행 (localhost)

| 방법 | 명령 |
|---|---|
| 더블클릭 | `start.bat` → 브라우저가 `http://localhost:5173` 으로 열림 |
| 터미널 | `node tools/serve.mjs 5173` |
| Python | `python -m http.server 5173` |

종료: 서버 창에서 `Ctrl + C`.

## 구조

```
NHW-website/
├─ index.html          마크업 (히어로 · 월드 오버레이 · About · Contact)
├─ css/style.css       스타일 (--script, --k = 필기체와 크기 보정)
├─ js/data.js          볼트 그래프 데이터 (자동 생성)
├─ js/glyphs.js        인트로 N.H.W 필기 획 데이터
├─ js/engine.js        캔버스 엔진 — 인트로 · Shell Graph · 노드 → 월드 전환
├─ js/app.js           화면 상태 · 오버레이 렌더 · CONFIG
├─ js/reader.js        노트 리더 (#/note/<이름>) — marked · KaTeX · mermaid는 CDN에서 처음 열 때 받음
├─ vault/              노트 본문(notes.json)과 그림·3D 뷰어 (자동 생성, 손대지 말 것)
├─ tools/serve.mjs     의존성 없는 로컬 서버
├─ tools/build-data.mjs  볼트 → js/data.js 재생성
├─ design/Main.dc.html 디자인 캔버스 원본 (참고용)
└─ start.bat
```

## 볼트가 바뀌었을 때

```
node tools/build-data.mjs
```

볼트 경로를 안 주면 옆 폴더 `../SecondBrain`을 쓴다. 볼트의 `_system/shell_graph/src` (Shell Graph 플러그인 소스)의 `config.js`·`layout.js`를 그대로 불러 플러그인과 같은 좌표를 만든다.

메인 페이지의 Projects · Timeline · Right now는 각 프로젝트 `00 개요`의 속성에서 만든다 (index.html에 직접 쓰지 않는다):

| 속성 | 쓰임 |
|---|---|
| `problem` · `approach` · `result` · `retro` | 카드의 문제 → 접근 → 결과 → 다시 한다면 (`retro`가 없으면 그 줄을 뺀다) |
| `verify` (목록) | 카드의 *검증 기록* 링크. 비공개 노트는 점선 "비공개"로 표시 |
| `cover` · `cover_note` | 표지 그림 파일명 또는 뷰어 키(`f1t-pipeline` 등), 표지를 누르면 열 노트 |
| `milestones` (목록) | `"YYYY-MM-DD 제목 — 설명"`. 모아서 Timeline, 보는 날 이후 일정은 *예정* |
| 본문의 첫 `- [ ]` | Right now의 "지금 할 일" (진행중 프로젝트만) |

그림: PNG·JPG는 빌드 때 `tools/webp.py`(Pillow)가 긴 변 1800 px · 품질 82의 WebP로 바꾼다. 파이썬이나 Pillow가 없으면 경고를 내고 원본을 그대로 쓴다.

공개 범위:
- `publish: false` 노트는 그래프에 제목·연결만 남고 본문은 나가지 않는다 (리더에 "비공개 노트" 표시).
- 날짜: 생성 = `created`, 수정 = `created` · `updated` · 파일 수정 시각 중 가장 늦은 날. 메인의 *Fresh notes*와 목록의 *최근 바뀐 노트*가 이 순서로 정렬된다.
- 성숙도 배지: frontmatter `stage: seedling | budding | evergreen`(씨앗 · 자라는 중 · 상록)이 있으면 그대로 쓴다. 없으면 본문 400자 미만이면서 `##` 소제목이 3개 미만인 메모만 자동으로 '씨앗'.
- 개념·도구·과목 노트 아래의 *쓰인 곳*은 그 노트와 링크로 이어진 프로젝트 노트를 프로젝트별로 자동 정리한 것이다.
- 실명은 `tools/redact.local.json`의 `phrases`(문구 단위) → `names`(이름 단위) 순서로 바꿔 쓴다. 이 파일은 실명이 들어 있어 Git에 올리지 않는다(.gitignore). 없으면 빌드가 멈추고, 바꾼 뒤에도 `names`의 실명이 남아 있으면 빌드가 실패한다. 새 팀원이 생기면 `names`에 추가. 형식은 `tools/redact.example.json`.

## 배포 (GitHub Pages)

볼트는 이 PC에만 있으므로 빌드는 로컬에서 하고, 결과물(`js/data.js`, `vault/`)까지 커밋해 올린다. `design/`은 올리지 않는다.

```
node tools/build-data.mjs
git add -A
git commit -m "볼트 갱신"
git push
```

push 1~2분 뒤 GitHub Pages에 반영된다 (저장소 Settings → Pages → `main` / `(root)`).

## 바로 바꿔보기 (URL 파라미터)

| 파라미터 | 값 |
|---|---|
| `?font=` | `allura`(기본) · `sacramento` · `parisienne` · `italianno` |
| `?intro=0` | 인트로 생략 |
| `?orbit=0` | 껍데기 공전 끔 |
| `?rotate=0` | 자동 회전 끔 |
| `?accent=7CF2C8` | 강조색 (# 없이) |
| `?introFont=` | `mrs-saint-delafield`(기본) · `great-vibes` · `pinyon-script` |

기본값은 `js/app.js` 맨 위 `CONFIG`.

## 조작

- 드래그: 회전 · 노드 클릭: 그 노드로 돌진 → 주제의 세계
- 월드 패널의 *노트 읽기* / 노트 카드 / 노트 행성: 본문 리더가 열린다. 주소가 `#/note/<이름>`이라 링크로 공유할 수 있다. `Esc`로 닫기
- `#/index` (헤더 *Index*): 전체 노트 목록 — 프로젝트(섹션별) · 개념(분야별) · 도구 · 과목
- `Ctrl+K` 또는 `/` (헤더 *Search*): 제목 · 요약 · 본문 검색. 띄어쓰기로 여러 단어를 주면 모두 포함한 노트만
- 월드: 행성 클릭(프로젝트 하위 폴더 열기 / 다른 프로젝트 세계로 이동), `Esc` 또는 *Back to the brain* 으로 복귀
- 스크롤: About(내용 미정) → Contact
