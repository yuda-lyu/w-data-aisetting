@echo off
setlocal

rem Update the AI CLIs used by this project on this machine (claude, codex, agy, opencode).
rem Each step runs even if an earlier one fails; failures are listed at the end.
rem "call" is required: codex / npm (and possibly agy) are .cmd shims, and running a .cmd
rem without "call" ends this batch file after the first one.

set "FAILED="

echo [1/4] claude
rem install: irm https://claude.ai/install.ps1 ^| iex
call claude update
if errorlevel 1 set "FAILED=%FAILED% claude"

echo.
echo [2/4] codex
rem install: npm i -g @openai/codex
call codex update
if errorlevel 1 set "FAILED=%FAILED% codex"

echo.
echo [3/4] agy (antigravity)
rem install: irm https://antigravity.google/cli/install.ps1 ^| iex
call agy update
if errorlevel 1 set "FAILED=%FAILED% agy"

echo.
echo [4/4] opencode
rem check version: opencode --version
call npm install -g --allow-scripts=opencode-ai opencode-ai@latest
if errorlevel 1 set "FAILED=%FAILED% opencode"

echo.
if defined FAILED (
    echo Done with failures:%FAILED%
) else (
    echo Done. All updates succeeded.
)
pause
exit /b 0
