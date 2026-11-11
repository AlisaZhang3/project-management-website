$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$env:NODE_ENV = 'production'
$env:HOST = '127.0.0.1'
$env:PORT = '5001'
$env:DATA_DIRECTORY = Join-Path $root 'data'
$nodePath = (Get-Content (Join-Path $PSScriptRoot 'node-path.txt') -Raw).Trim()
$logPath = Join-Path $root 'logs\backend.log'

try {
    Set-Location $PSScriptRoot
    if (!(Test-Path $nodePath) -or !(Test-Path (Join-Path $PSScriptRoot 'dist\app.js'))) {
        throw 'Node.js or the compiled backend is missing. Run deployment again.'
    }
    if ((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 10MB) {
        Move-Item $logPath "$logPath.1" -Force
    }
    Add-Content $logPath ("`r`nBackend starting at {0:o}" -f (Get-Date))
    # Native stderr includes Node's SQLite warnings; it must not terminate PowerShell.
    $ErrorActionPreference = 'Continue'
    & $nodePath (Join-Path $PSScriptRoot 'dist\app.js') >> $logPath 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    if ($code -ne 0) {
        Add-Content $logPath "Backend exited with code $code"
        exit $code
    }
    exit 0
} catch {
    Write-Error -ErrorAction Continue $_
    exit 1
}
