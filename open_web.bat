@echo off
chcp 65001 > nul
echo =======================================================
echo   ĐANG KHỞI ĐỘNG CAPCUT VIDEO FACTORY WEB STUDIO...
echo =======================================================
echo.
echo 👉 Trình duyệt sẽ tự động mở tại: http://localhost:4000
echo 👉 Bấm Ctrl + C trong cửa sổ này để dừng server khi không dùng nữa.
echo.

start "" "http://localhost:4000"
cd /d "%~dp0node_tools"
node server.js

pause
