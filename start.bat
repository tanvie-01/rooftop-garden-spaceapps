@echo off
start "Backend" "%~dp0run-backend.bat"
start "Frontend" "%~dp0run-frontend.bat"
timeout /t 10 >nul
start http://localhost:3000