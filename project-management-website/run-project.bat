@echo off
setlocal
cd /d "%~dp0"

echo Starting ProjectFlow...

if not exist "server\node_modules" (
    echo Installing server dependencies...
    call npm.cmd --prefix "%~dp0server" install
    if errorlevel 1 (
        echo Failed to install server dependencies.
        pause
        exit /b 1
    )
)

if not exist "client\node_modules" (
    echo Installing client dependencies...
    call npm.cmd --prefix "%~dp0client" install
    if errorlevel 1 (
        echo Failed to install client dependencies.
        pause
        exit /b 1
    )
)

start "ProjectFlow Backend" cmd /k "cd /d "%~dp0server" && npm.cmd start"
start "ProjectFlow Frontend" cmd /k "cd /d "%~dp0client" && npm.cmd start"

echo Waiting for the frontend at http://localhost:3000 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; 1..60 | ForEach-Object { try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 1; if ($response.StatusCode -eq 200) { $ready = $true; return } } catch {}; Start-Sleep -Seconds 1 }; if ($ready) { Start-Process 'http://localhost:3000/' } else { Write-Host 'Frontend did not become ready within 60 seconds.' -ForegroundColor Yellow; Write-Host 'Open http://localhost:3000/ manually after checking the frontend terminal.' }"

endlocal
