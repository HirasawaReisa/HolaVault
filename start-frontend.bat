@echo off
title HaloVault - Frontend (Vite)
cd /d "%~dp0frontend"
echo Starting HaloVault Frontend...
echo.
call npm run dev
pause
