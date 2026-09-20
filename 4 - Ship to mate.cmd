@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call "%~dp0_findnode.cmd" || goto :nonode

echo.
echo   ==========================================================
echo    SHIP AN UPDATE
echo    This sends the game to your mate. He gets it next time
echo    he opens launcher.html.
echo   ==========================================================
echo.
set "NOTES="
set /p "NOTES=What changed? (short description): "
if "!NOTES!"=="" set "NOTES=update"

echo.
"%NODEEXE%" ship.js "!NOTES!"
if errorlevel 1 goto :failed

echo.
echo   Done. Your mate is on the new version from now on.
goto :end

:failed
echo.
echo   ---------------------------------------------------------
echo   NOTHING was sent to your mate.
echo   The reason is printed above. Paste it to Claude.
echo.
echo   If it mentions "setup" - you still need the one-time
echo   GitHub setup. Run "5 - First time setup.cmd".
echo   ---------------------------------------------------------

:end
echo.
pause
goto :eof

:nonode
echo.
echo   Could not find Node.js on this computer.
echo   Tell Claude "node is missing" and it will sort it.
echo.
pause
