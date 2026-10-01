@echo off
title HaloVault - Backend (Spring Boot)
cd /d "%~dp0backend"
echo Starting HaloVault Backend...
echo.
call mvnw.cmd spring-boot:run
pause
