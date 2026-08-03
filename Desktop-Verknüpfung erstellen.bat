@echo off
rem =====================================================================
rem  Legt eine Verknuepfung "Manu" mit App-Icon auf dem Desktop an.
rem  Einmal per Doppelklick ausfuehren - danach startet die App
rem  bequem ueber das Icon auf dem Desktop.
rem =====================================================================
setlocal
set "ZIEL=%~dp0Manu starten.bat"
set "ICON=%~dp0manu.ico"
set "ARBEIT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'),'Manu.lnk'));" ^
  "$s.TargetPath='%ZIEL%';" ^
  "$s.WorkingDirectory='%ARBEIT%';" ^
  "$s.IconLocation='%ICON%';" ^
  "$s.Description='Manu - Hausverwaltung und Controlling';" ^
  "$s.Save()"

if %errorlevel%==0 (
    echo Fertig! Auf dem Desktop liegt jetzt das Icon "Manu".
) else (
    echo Es gab ein Problem beim Anlegen der Verknuepfung.
)
pause
endlocal
