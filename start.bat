@echo off
echo ========================================================
echo        STARTING FASTCART POS SYSTEM
echo ========================================================
echo.

echo [1/2] Starting Backend Server...
start "Backend - FastCart POS" cmd /k "cd backend && npm run dev"

echo [2/2] Starting Frontend Server...
start "Frontend - FastCart POS" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo SYSTEM STARTED!
echo.
echo - On PC:     http://localhost:5173
echo - On Mobile: http://192.168.110.67:5173
echo.
echo (Please keep the two black windows open while using)
echo ========================================================
echo.
pause
