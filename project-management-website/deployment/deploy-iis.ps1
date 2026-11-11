#Requires -Version 5.1
#Requires -RunAsAdministrator
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$source = Split-Path $PSScriptRoot -Parent
$root = Join-Path $env:SystemDrive 'inetpub\ProjectFlow'
$web = Join-Path $root 'web'
$backend = Join-Path $root 'server'
$data = Join-Path $root 'data'
$siteName = 'ProjectFlow'
$taskName = 'ProjectFlow-Backend'
$marker = Join-Path $root '.projectflow-deployment'

function Invoke-Checked {
    param([string]$Executable, [string[]]$Arguments)
    & $Executable @Arguments
    $success = if ($Executable -eq 'robocopy.exe') { $LASTEXITCODE -lt 8 } else { $LASTEXITCODE -eq 0 }
    if (!$success) {
        throw "$Executable failed with exit code $LASTEXITCODE"
    }
}

function Wait-Healthy {
    param([string]$Url)
    $lastError = ''
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $health = Invoke-RestMethod $Url -TimeoutSec 2
            if ($health.status -eq 'ok') { return }
            $lastError = 'Unexpected health response'
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 1
    }
    throw "Health check failed: $Url. $lastError. See $root\logs\backend.log"
}

try {
    $appcmd = Join-Path $env:windir 'System32\inetsrv\appcmd.exe'
    if (!(Test-Path $appcmd)) {
        throw 'IIS is not installed. Follow deployment\IIS_DEPLOYMENT.md first.'
    }
    Import-Module WebAdministration
    Import-Module ScheduledTasks
    $modules = @(Get-WebGlobalModule | Select-Object -ExpandProperty Name)
    $missingModules = @(
        if ($modules -notcontains 'RewriteModule') {
            'IIS URL Rewrite 2.1 (RewriteModule): https://www.iis.net/downloads/microsoft/url-rewrite'
        }
        if ($modules -notcontains 'ApplicationRequestRouting') {
            'Application Request Routing 3.0 (ApplicationRequestRouting): https://www.iis.net/downloads/microsoft/application-request-routing'
        }
    )
    if ($missingModules.Count -gt 0) {
        throw ("Required IIS modules are not registered:`r`n - " + ($missingModules -join "`r`n - ") +
            "`r`nInstall the missing x64 components as Administrator (URL Rewrite before ARR), reopen 64-bit Windows PowerShell as Administrator, and rerun deployment\deploy-iis.ps1. If already installed, repair their installations.")
    }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    Invoke-Checked $node @('-e', "require('node:sqlite');")
    if ((Test-Path $root) -and !(Test-Path $marker)) {
        throw "$root already exists and is not owned by this deployment. Move it or choose another site manually."
    }
    $existingSite = Get-Website | Where-Object Name -eq $siteName
    if ($existingSite -and $existingSite.physicalPath -ne $web) {
        throw "An unrelated IIS site named $siteName already exists."
    }
    if ($existingSite -and @(Get-WebBinding -Name $siteName |
        Where-Object { $_.protocol -ne 'http' -or $_.bindingInformation -ne '127.0.0.1:8080:' }).Count -gt 0) {
        throw 'ProjectFlow has non-default bindings. Restore its local-only 127.0.0.1:8080 binding before deploying.'
    }
    $existingPool = Test-Path "IIS:\AppPools\$siteName"
    if ($existingPool -and !(Test-Path $marker)) {
        throw "An unrelated application pool named $siteName already exists."
    }
    $existingTask = Get-ScheduledTask | Where-Object TaskName -eq $taskName
    if ($existingTask -and (!(Test-Path $marker) -or $existingTask.TaskPath -ne '\')) {
        throw "An unrelated scheduled task named $taskName already exists."
    }
    $otherBindings = @(Get-Website | Where-Object Name -ne $siteName | Get-WebBinding |
        Where-Object { $_.bindingInformation -match ':8080:' })
    if ($otherBindings.Count -gt 0) {
        throw 'Port 8080 is already bound to another IIS site.'
    }
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object LocalPort -in @(5000, 5001, 8080))
    if (!(Test-Path $marker) -and ($listeners | Where-Object LocalPort -in @(5001, 8080))) {
        throw 'Port 5001 or 8080 is already in use. Release it before the first deployment.'
    }
    $firstImport = !(Test-Path (Join-Path $data 'project-management.db'))
    if ($firstImport -and ($listeners | Where-Object LocalPort -eq 5000)) {
        throw 'Stop the development backend on port 5000 before importing the database and attachments.'
    }

    Write-Host 'Building frontend and backend...'
    if (!(Test-Path (Join-Path $source 'client\node_modules'))) {
        Invoke-Checked $npm @('--prefix', (Join-Path $source 'client'), 'ci')
    }
    if (!(Test-Path (Join-Path $source 'server\node_modules'))) {
        Invoke-Checked $npm @('--prefix', (Join-Path $source 'server'), 'ci')
    }
    Invoke-Checked $npm @('--prefix', (Join-Path $source 'client'), 'run', 'build')
    Invoke-Checked $npm @('--prefix', (Join-Path $source 'server'), 'run', 'build')

    New-Item $root -ItemType Directory -Force | Out-Null
    Set-Content $marker 'ProjectFlow IIS deployment' -Encoding ASCII
    if ($existingSite) { Stop-Website $siteName }
    if ($existingTask) {
        Disable-ScheduledTask -TaskName $taskName | Out-Null
        Stop-ScheduledTask -TaskName $taskName
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            if ((Get-ScheduledTask -TaskName $taskName).State -ne 'Running') { break }
            Start-Sleep -Seconds 1
        }
        if ((Get-ScheduledTask -TaskName $taskName).State -eq 'Running') {
            throw 'The previous backend task did not stop. No deployment files were replaced.'
        }
    }
    if (Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq 5001) {
        throw 'Port 5001 is still in use. Stop the old backend before deploying.'
    }

    New-Item $web, $backend, $data, (Join-Path $root 'logs') -ItemType Directory -Force | Out-Null
    # Only the static web directory is served by IIS; data and backend stay private.
    Invoke-Checked robocopy.exe @((Join-Path $source 'client\dist'), $web, '/E', '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS')
    Copy-Item (Join-Path $PSScriptRoot 'web.config') $web -Force
    Copy-Item (Join-Path $source 'server\dist') $backend -Recurse -Force
    Copy-Item (Join-Path $source 'server\package.json'), (Join-Path $source 'server\package-lock.json') $backend -Force
    Copy-Item (Join-Path $PSScriptRoot 'start-backend.ps1') $backend -Force
    Set-Content (Join-Path $backend 'node-path.txt') $node -Encoding UTF8
    Invoke-Checked $npm @('--prefix', $backend, 'ci', '--omit=dev')

    if ($firstImport) {
        $sourceData = Join-Path $source 'server\data'
        $sourceDb = Join-Path $sourceData 'project-management.db'
        foreach ($folder in @('c2c-contracts', 'client-org-charts', 'project-sows')) {
            $from = Join-Path $sourceData $folder
            if (Test-Path $from) { Copy-Item $from $data -Recurse -Force }
        }
        if (Test-Path $sourceDb) {
            Invoke-Checked $node @((Join-Path $PSScriptRoot 'snapshot-database.cjs'), $sourceDb, (Join-Path $data 'project-management.db'))
        }
    }

    # LocalService only needs write access to data/logs, never the executable code.
    Invoke-Checked icacls.exe @($root, '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-19:(OI)(CI)RX')
    Invoke-Checked icacls.exe @($data, '/grant:r', '*S-1-5-19:(OI)(CI)M')
    Invoke-Checked icacls.exe @((Join-Path $root 'logs'), '/grant:r', '*S-1-5-19:(OI)(CI)M')
    if (!(Test-Path "IIS:\AppPools\$siteName")) { New-WebAppPool $siteName | Out-Null }
    Set-ItemProperty "IIS:\AppPools\$siteName" -Name managedRuntimeVersion -Value ''
    Set-ItemProperty "IIS:\AppPools\$siteName" -Name processModel.identityType -Value 4
    Invoke-Checked icacls.exe @($web, '/grant:r', "IIS AppPool\${siteName}:(OI)(CI)RX")
    if (!$existingSite) {
        New-Website -Name $siteName -PhysicalPath $web -ApplicationPool $siteName -IPAddress '127.0.0.1' -Port 8080 | Out-Null
    }
    Set-ItemProperty "IIS:\Sites\$siteName" -Name applicationPool -Value $siteName
    Set-ItemProperty "IIS:\Sites\$siteName" -Name serverAutoStart -Value $true
    Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter 'system.webServer/proxy' -Name enabled -Value $true
    Set-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Location $siteName -Filter 'system.webServer/security/authentication/anonymousAuthentication' -Name userName -Value ''
    foreach ($entry in @(
        @{ Section = 'system.webServer/modules'; Name = 'WebDAVModule' },
        @{ Section = 'system.webServer/handlers'; Name = 'WebDAV' }
    )) {
        $filter = "$($entry.Section)/add[@name='$($entry.Name)']"
        if (Get-WebConfiguration -PSPath 'MACHINE/WEBROOT/APPHOST' -Location $siteName -Filter $filter) {
            Remove-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Location $siteName -Filter $entry.Section -Name '.' -AtElement @{ name = $entry.Name }
        }
    }
    Set-Service W3SVC -StartupType Automatic
    Start-Service W3SVC

    $powershell = Join-Path $env:windir 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $action = New-ScheduledTaskAction -Execute $powershell -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$backend\start-backend.ps1`"" -WorkingDirectory $backend
    $principal = New-ScheduledTaskPrincipal -UserId 'S-1-5-19' -LogonType ServiceAccount -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) -Principal $principal -Settings $settings -Force | Out-Null
    Start-ScheduledTask -TaskName $taskName
    Wait-Healthy 'http://127.0.0.1:5001/api/health'
    Start-Website $siteName
    Wait-Healthy 'http://127.0.0.1:8080/api/health'
    $page = Invoke-WebRequest 'http://127.0.0.1:8080/projects' -Headers @{ Accept = 'text/html' } -UseBasicParsing
    if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<div id="root">') {
        throw 'The React deep-link check failed.'
    }
    Write-Host 'Deployment verified. Open http://127.0.0.1:8080' -ForegroundColor Green
    Write-Host "Production data: $data"
} catch {
    Write-Error -ErrorAction Continue $_
    Write-Host 'Deployment failed. Fix the reported error and rerun. Existing production data is not overwritten.' -ForegroundColor Red
    exit 1
}
