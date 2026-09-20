@echo off
setlocal
cd /d "%~dp0"
call "%~dp0_findnode.cmd" || goto :nonode

echo.
echo   Building a copy of exactly what your mate would get...
echo.
"%NODEEXE%" ship.js --local "trying it out"
if errorlevel 1 goto :failed

echo.
echo   Opening it now. Play it. This has NOT been sent to your mate.
echo.
start "" "%~dp0dist\stack-casino.html"
goto :end

:failed
echo.
echo   ---------------------------------------------------------
echo   The build was refused, so nothing was created.
echo   The reason is printed above. Paste it to Claude.
echo   ---------------------------------------------------------
goto :end

:nonode
echo.
echo   Could not find Node.js on this computer.
echo   Tell Claude "node is missing" and it will sort it.
echo.

:end
echo.
pause
