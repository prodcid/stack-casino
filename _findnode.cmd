@echo off
rem Locates Node.js and sets NODEEXE. Exits 1 if it cannot be found.
rem A freshly installed Node is missing from already-open terminals until they
rem restart, so check the usual install paths too rather than trusting PATH.

where node >nul 2>nul
if not errorlevel 1 (
  for /f "delims=" %%N in ('where node') do (
    endlocal & set "NODEEXE=%%N"
    exit /b 0
  )
)

rem Not on PATH. Check the usual spots, and put that folder on PATH for this
rem window too, so anything we launch can find node and npm as well.
if exist "%ProgramFiles%\nodejs\node.exe" (
  endlocal & set "NODEEXE=%ProgramFiles%\nodejs\node.exe" & set "PATH=%ProgramFiles%\nodejs;%PATH%"
  exit /b 0
)
if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
  endlocal & set "NODEEXE=%ProgramFiles(x86)%\nodejs\node.exe" & set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
  exit /b 0
)
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
  endlocal & set "NODEEXE=%LOCALAPPDATA%\Programs\nodejs\node.exe" & set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
  exit /b 0
)

exit /b 1
