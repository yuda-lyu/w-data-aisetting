@echo off
setlocal

rem Sync https://github.com/yuda-lyu/w-data-aisetting (GitHub, public, branch master, no login needed) to this machine:
rem   repo skills\*   -> %USERPROFILE%\.claude\skills    (then npm i there)
rem   repo CLAUDE_global.md -> %USERPROFILE%\.claude\CLAUDE.md   (renamed on copy)
rem The global settings draft is named CLAUDE_global.md in the repo so that agents working
rem inside this repo do not auto-load it as the project's own CLAUDE.md.
rem Existing files are overwritten, nothing is deleted; remove obsolete skill folders manually.

set "REPO=https://github.com/yuda-lyu/w-data-aisetting.git"
set "BRANCH=master"
set "WORK=%~dp0tmp"
set "SRC=%WORK%\w-data-aisetting"
set "CLAUDE_HOME=%USERPROFILE%\.claude"
set "DST=%CLAUDE_HOME%\skills"

echo [1/6] create "%WORK%"
if exist "%SRC%" rmdir /s /q "%SRC%"
if not exist "%WORK%" mkdir "%WORK%"

echo [2/6] git clone %REPO% (branch %BRANCH%)
git clone --depth 1 -b %BRANCH% -c core.autocrlf=false "%REPO%" "%SRC%"
if errorlevel 1 goto :fail

echo [3/6] copy skills to "%DST%"
robocopy "%SRC%\skills" "%DST%" /E /R:2 /W:1 /NFL /NDL /NP /NJH
if errorlevel 8 goto :fail

echo [4/6] copy CLAUDE_global.md to "%CLAUDE_HOME%\CLAUDE.md"
if not exist "%CLAUDE_HOME%" mkdir "%CLAUDE_HOME%"
if not exist "%SRC%\CLAUDE_global.md" goto :fail
copy /Y "%SRC%\CLAUDE_global.md" "%CLAUDE_HOME%\CLAUDE.md" >nul
if errorlevel 1 goto :fail

echo [5/6] npm i and npm update in "%DST%"
rem npm i installs what is missing (fresh machine); npm update then upgrades every installed
rem package to the newest version allowed by package.json - npm i alone keeps old versions
rem that already satisfy the ranges, even without a lock file. The local lock is removed first.
rem package.json "allowScripts" approves the install scripts that npm 12 blocks by default.
if exist "%DST%\package-lock.json" del /q "%DST%\package-lock.json"
pushd "%DST%" || goto :fail
call npm i
set "RC=%errorlevel%"
if "%RC%"=="0" call npm update
if "%RC%"=="0" set "RC=%errorlevel%"
popd
if not "%RC%"=="0" goto :fail

echo [6/6] delete "%WORK%"
rmdir /s /q "%WORK%"

echo Done. Obsolete skill folders in "%DST%" are NOT removed - delete them manually.
pause
exit /b 0

:fail
rmdir /s /q "%WORK%" 2>nul
echo Failed, see messages above.
pause
exit /b 1
