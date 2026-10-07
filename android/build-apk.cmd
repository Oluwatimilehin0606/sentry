@echo off
rem Builds, signs and verifies Sentry's Android app (Windows). See README.md in this folder.
rem   build-apk.cmd 1.0.2
rem The version must go up for every release. Output: <SENTRY_APK_DIR>\output\sentry-<version>.apk
rem plus a .sha256 checksum file. Set JAVA_HOME and ANDROID_HOME below or before running.
setlocal
set VERSION=%~1
if "%VERSION%"=="" set /p VERSION=Version to build (e.g. 1.0.2):
if "%VERSION%"=="" ( echo No version given. & exit /b 1 )

if "%JAVA_HOME%"=="" set "JAVA_HOME=%USERPROFILE%\Android\jdk17"
if "%ANDROID_HOME%"=="" set "ANDROID_HOME=%USERPROFILE%\Android\sdk"
if "%SENTRY_APK_DIR%"=="" set "SENTRY_APK_DIR=%USERPROFILE%\Documents\Sentry APK"

pushd "%~dp0" || exit /b 1
if not exist node_modules\@bubblewrap\core ( call npm install --no-audit --no-fund || ( popd & exit /b 1 ) )
call node build-apk.mjs %VERSION%
if errorlevel 1 ( echo Build failed. & popd & exit /b 1 )
call node verify-apk.mjs "%SENTRY_APK_DIR%\output\sentry-%VERSION%.apk"
if errorlevel 1 ( echo Verification failed. & popd & exit /b 1 )
popd
echo.
echo Done: %SENTRY_APK_DIR%\output\sentry-%VERSION%.apk
endlocal
