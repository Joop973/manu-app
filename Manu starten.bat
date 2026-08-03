@echo off
rem =====================================================================
rem  Manu - Hausverwaltung starten (Doppelklick)
rem  Startet die App ohne schwarzes Konsolenfenster.
rem =====================================================================
cd /d "%~dp0"

rem pythonw = Python ohne Konsolenfenster
where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw "manu.py"
    goto :eof
)

rem Fallback: normales python (zeigt Konsole)
where python >nul 2>nul
if %errorlevel%==0 (
    python "manu.py"
    goto :eof
)

echo Python wurde nicht gefunden.
echo Bitte Python von https://www.python.org installieren
echo und beim Setup "Add Python to PATH" anhaken.
pause
