@echo off
echo ==========================================
echo    8051 QUIZ PRO - INTERNET SHARING
echo ==========================================
echo.
echo This script uses Pinggy to give you a public link for your students.
echo Look for the URL that looks like "https://xxxx.a.pinggy.io"
echo.
echo Keep this window open while students are taking the quiz!
echo.
ssh -p 443 -R0:localhost:8000 a.pinggy.io
pause
