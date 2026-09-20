@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call "%~dp0_findnode.cmd" || goto :nonode

echo.
echo   ==========================================================
echo    ONE-TIME SETUP
echo   ==========================================================
echo.
echo   Before running this you need to have:
echo.
echo     1. A free GitHub account       ( github.com )
echo     2. An EMPTY PUBLIC repo named "stack-casino"
echo        Make it at github.com/new
echo        - tick Public
echo        - do NOT tick any "add a README" boxes
echo.
echo   If you have not done those yet, close this and do them first.
echo.
pause
echo.
set "GHUSER="
set /p "GHUSER=Your GitHub username: "
if "!GHUSER!"=="" goto :end

echo.
"%NODEEXE%" ship.js setup "!GHUSER!" stack-casino
if errorlevel 1 goto :failed

echo.
echo   ----------------------------------------------------------
echo   Setup done. Now run "4 - Ship to mate.cmd" once to put the
echo   first build up, then send your mate launcher.html.
echo   ----------------------------------------------------------
goto :end

:failed
echo.
echo   Setup failed. The reason is printed above - paste it to Claude.
goto :end

:nonode
echo.
echo   Could not find Node.js on this computer.
echo   Tell Claude "node is missing" and it will sort it.

:end
echo.
pause
