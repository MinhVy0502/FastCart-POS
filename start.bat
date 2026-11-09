@echo off
echo ========================================================
echo        STARTING FASTCART POS SYSTEM
echo ========================================================
echo.

:: Refresh PATH from registry if node is not immediately recognized
where node >nul 2>nul
if %errorlevel% neq 0 (
    for /f "tokens=2*" %%a in ('reg query HKCU\Environment /v Path 2^>nul') do set "USER_PATH=%%b"
    for /f "tokens=2*" %%a in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYS_PATH=%%b"
    set "PATH=%USER_PATH%;%SYS_PATH%;%PATH%"
)

echo [1/2] Starting Backend Server...
start "Backend - FastCart POS" cmd /k "cd backend && npm run dev"

echo [2/2] Starting Frontend Server...
start "Frontend - FastCart POS" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo SYSTEM STARTED!
echo.
echo - Web POS (HTTPS): https://localhost:5173
echo.
echo (Please keep the terminal windows open while using)
echo ========================================================
echo.
pause

