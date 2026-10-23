@echo off
setlocal
cd /d "%~dp0"
call "%~dp0_findnode.cmd" || goto :nonode

echo.
echo   Running the full check. Takes about 3 minutes.
echo   A hidden browser logs in, plays every game, places sports and micro bets and checks the maths.
echo.
echo   You want to see "12/12 passed" at the end.
echo.
"%NODEEXE%" test.js
goto :end

:nonode
echo.
echo   Could not find Node.js on this computer.
echo   Tell Claude "node is missing" and it will sort it.
echo.

:end
echo.
pause
