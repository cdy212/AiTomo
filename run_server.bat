@echo off
echo ==========================================
echo  AiTomo Local Server Starting...
echo ==========================================
echo.
echo Opening browser to http://localhost:8000 ...

:: 브라우저를 먼저 실행하여 index.html 주소로 접속시킵니다.
start http://localhost:8000

:: 파이썬 간이 서버를 8000 포트에서 실행합니다.
python -m http.server 8000

pause
