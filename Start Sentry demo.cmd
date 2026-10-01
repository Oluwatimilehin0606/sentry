@echo off
rem Double-click to run the Sentry demo: Sentry on http://localhost:3000 plus the pretend
rem website bakery.test. The browser opens by itself. Close this window to stop everything.
title Sentry demo (close this window to stop)
cd /d "%~dp0"

rem Build every time (about 30 seconds), so the demo always shows the latest version.
echo Preparing Sentry. This takes about 30 seconds...
call npm run build >nul 2>&1 || goto failed

echo Starting Sentry. The browser will open in a few seconds.
call npm run demo
goto end

:failed
echo.
echo The website build failed. Run "npm run build" to see why, or see "Running the demo" in README.md.
pause

:end
