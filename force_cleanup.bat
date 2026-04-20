@echo off
echo ==========================================
echo    8051 QUIZ PRO - PORT CLEANUP
echo ==========================================
echo.
echo Closing any old servers running on port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a
echo.
echo Cleanup Complete! 
echo Now you can double-click 'run_quiz.bat' to start the new server.
pause
