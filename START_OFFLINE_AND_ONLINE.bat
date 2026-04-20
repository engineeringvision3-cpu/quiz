@echo off
echo ==========================================
echo    8051 QUIZ PRO - MASTER LAUNCHER
echo ==========================================
echo.
echo 1. Starting the internal server...
start "8051 Server" cmd /k "run_quiz.bat"

echo 2. Starting the internet sharing link...
start "8051 Sharing" cmd /k "share_quiz.bat"

echo.
echo ==========================================
echo SUCCESS!
echo - Use LOCALHOST:8000 for your Dashboard.
echo - Use the LINK in the SECOND window for Students.
echo ==========================================
echo.
echo KEEP BOTH BLACK WINDOWS OPEN!
pause
