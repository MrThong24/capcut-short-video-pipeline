@echo off
chcp 65001 > nul
echo =======================================================
echo   SHORT-VIDEO AUTOMATION: DÂY CHUYỀN RENDER VOICE AI
echo =======================================================
cd /d "%~dp0node_tools"
node tts_runner.js %*
echo.
pause

