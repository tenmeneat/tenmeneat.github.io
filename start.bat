@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=5173
title N.H.W site - localhost:%PORT%

where node >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  node tools\serve.mjs %PORT%
  goto :end
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  py -m http.server %PORT% --bind 127.0.0.1
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:%PORT%
  python -m http.server %PORT% --bind 127.0.0.1
  goto :end
)
echo Node.js 또는 Python 이 필요합니다. https://nodejs.org 에서 Node.js LTS 를 설치한 뒤 다시 실행하세요.
pause
:end
