@echo off
setlocal
cd /d "%~dp0"
call "%~dp0_findnode.cmd" || goto :nonode

echo.
echo   Running the full check. Takes about 6 minutes.
echo   A hidden browser plays every game and checks the payout maths.
echo.
echo   You want to see "44/44 checks passed" at the end.
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
