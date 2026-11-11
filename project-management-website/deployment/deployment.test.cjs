const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');

const backendPath = path.resolve(__dirname, '..', 'server', 'dist', 'app.js');
const snapshotPath = path.join(__dirname, 'snapshot-database.cjs');

test('IIS checks and access instructions use the bound IPv4 loopback address', () => {
    const script = fs.readFileSync(path.join(__dirname, 'deploy-iis.ps1'), 'utf8');
    const guide = fs.readFileSync(path.join(__dirname, 'IIS_DEPLOYMENT.md'), 'utf8');
    assert.match(script, /-IPAddress '127\.0\.0\.1' -Port 8080/);
    assert.match(script, /Wait-Healthy 'http:\/\/127\.0\.0\.1:8080\/api\/health'/);
    assert.match(script, /Invoke-WebRequest 'http:\/\/127\.0\.0\.1:8080\/projects'/);
    assert.match(script, /Deployment verified\. Open http:\/\/127\.0\.0\.1:8080/);
    assert.doesNotMatch(script, /http:\/\/localhost:8080/);
    assert.doesNotMatch(guide, /http:\/\/localhost:8080/);
});

test('IIS anonymous authentication is configured centrally for only the deployment site', () => {
    const script = fs.readFileSync(path.join(__dirname, 'deploy-iis.ps1'), 'utf8');
    const commands = script.split(/\r?\n/).filter((line) => line.includes("-Filter 'system.webServer/security/authentication/anonymousAuthentication'"));
    assert.equal(commands.length, 1);
    assert.match(commands[0], /-PSPath 'MACHINE\/WEBROOT\/APPHOST'/);
    assert.match(commands[0], /-Location \$siteName(?:\s|$)/);
    assert.match(commands[0], /-Name userName -Value ''/);
    assert.doesNotMatch(script, /Unlock-WebConfiguration|appcmd(?:\.exe)?\s+unlock\s+config/i);
});

test('IIS WebDAV exclusions stay in server configuration and tolerate redeployment', { skip: process.platform !== 'win32' }, () => {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
        $ErrorActionPreference = 'Stop'
        [xml]$config = Get-Content -LiteralPath './deployment/web.config' -Raw
        if ($config.SelectNodes('/configuration/system.webServer/modules | /configuration/system.webServer/handlers').Count -ne 0) {
            throw 'Locked WebDAV sections must not be written to web.config.'
        }
        $tokens = $null
        $parseErrors = $null
        $ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $PWD 'deployment/deploy-iis.ps1'), [ref]$tokens, [ref]$parseErrors)
        if ($parseErrors.Count -gt 0) { throw 'Deployment script has syntax errors.' }
        $blocks = @($ast.FindAll({ param($node)
            $node -is [System.Management.Automation.Language.ForEachStatementAst] -and $node.Extent.Text.Contains("Name = 'WebDAVModule'")
        }, $true))
        if ($blocks.Count -ne 1) { throw 'Expected one WebDAV configuration block.' }
        $siteName = 'ProjectFlow'
        $script:removed = @()
        function Get-WebConfiguration {
            param($PSPath, $Location, $Filter)
            if ($PSPath -ne 'MACHINE/WEBROOT/APPHOST' -or $Location -ne $siteName) { throw 'Incorrect read scope.' }
            if ($Filter -notin @("system.webServer/modules/add[@name='WebDAVModule']", "system.webServer/handlers/add[@name='WebDAV']")) { throw 'Incorrect lookup.' }
            return $script:installed
        }
        function Remove-WebConfigurationProperty {
            param($PSPath, $Location, $Filter, $Name, $AtElement)
            if ($PSPath -ne 'MACHINE/WEBROOT/APPHOST' -or $Location -ne $siteName) { throw 'Incorrect write scope.' }
            if ($Name -ne '.') { throw 'Incorrect collection.' }
            $script:removed += $Filter + ':' + $AtElement.name
        }
        $block = [scriptblock]::Create($blocks[0].Extent.Text)
        $script:installed = $true
        & $block
        if (($script:removed -join ',') -ne 'system.webServer/modules:WebDAVModule,system.webServer/handlers:WebDAV') { throw 'Incorrect exclusions.' }
        $script:removed = @()
        $script:installed = $false
        & $block
        if ($script:removed.Count -ne 0) { throw 'Absent WebDAV must not be removed again.' }
    `], { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
});

async function availablePort() {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1');
    await once(socket, 'listening');
    const port = socket.address().port;
    await new Promise((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
    return port;
}

test('production backend isolates and persists its database and every attachment type', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'projectflow-deployment-'));
    const data = path.join(directory, 'data with spaces');
    let child;
    let output = '';
    const port = await availablePort();
    const base = `http://127.0.0.1:${port}/api`;
    const stop = async () => {
        if (child && child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit');
            child.kill();
            await exited;
        }
    };
    const start = async () => {
        child = spawn(process.execPath, [backendPath], {
            cwd: os.tmpdir(),
            env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIRECTORY: data, NODE_ENV: 'production' },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout.on('data', (value) => { output += value; });
        child.stderr.on('data', (value) => { output += value; });
        child.on('error', (error) => { output += error.message; });
        for (let attempt = 0; attempt < 100; attempt++) {
            try {
                const health = await fetch(`${base}/health`);
                if (health.ok) {
                    assert.deepEqual(await health.json(), { status: 'ok' });
                    return;
                }
            } catch (error) {
                if (child.exitCode !== null) throw new Error(`Backend exited: ${output}`, { cause: error });
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error(`Backend did not start: ${output}`);
    };
    const request = async (url, options) => {
        const response = await fetch(`${base}${url}`, options);
        assert.ok(response.ok, `${url}: ${response.status} ${response.statusText}`);
        return response;
    };
    try {
        await start();
        const employee = await (await request('/employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Deployment persistence test' }),
        })).json();
        const projects = await (await request('/projects')).json();
        const projectId = projects[0].id;
        const pdf = '%PDF-1.4\nDeployment test\n%%EOF';
        await request(`/employees/${employee.id}/c2c-contract`, {
            method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-file-name': 'contract.pdf' }, body: pdf,
        });
        const project = await (await request(`/projects/${projectId}/sow`, {
            method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-file-name': 'SOW.pdf' }, body: pdf,
        })).json();
        const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB', 'base64');
        await request(`/projects/${projectId}/client-org-chart`, {
            method: 'PUT', headers: { 'Content-Type': 'image/png', 'x-file-name': 'chart.png' }, body: image,
        });
        for (const name of ['project-management.db', 'c2c-contracts', 'project-sows', 'client-org-charts']) {
            assert.ok(fs.existsSync(path.join(data, name)), `${name} must use DATA_DIRECTORY`);
        }
        // Snapshot a database while the backend still has its WAL connection open.
        const snapshot = path.join(directory, "snapshot with ' quote.db");
        const copied = spawnSync(process.execPath, [snapshotPath, path.join(data, 'project-management.db'), snapshot], { encoding: 'utf8' });
        assert.equal(copied.status, 0, copied.stderr);
        const copy = new DatabaseSync(snapshot, { readOnly: true });
        try {
            const row = copy.prepare("SELECT data FROM entities WHERE resource='employees' AND id=?").get(employee.id);
            assert.equal(JSON.parse(row.data).name, employee.name);
        } finally {
            copy.close();
        }
        await stop();
        await start();
        assert.equal((await (await request(`/employees/${employee.id}`)).json()).name, employee.name);
        assert.equal(await (await request(`/employees/${employee.id}/c2c-contract`)).text(), pdf);
        assert.equal(await (await request(`/projects/${projectId}/sow/${project.sowFiles[0].id}?view=1`)).text(), pdf);
        assert.deepEqual(Buffer.from(await (await request(`/projects/${projectId}/client-org-chart`)).arrayBuffer()), image);
        assert.equal((await fetch(`${base}/does-not-exist`)).status, 404);
    } finally {
        await stop();
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

test('storage keeps the original development location when DATA_DIRECTORY is unset', () => {
    const storage = path.resolve(__dirname, '..', 'server', 'dist', 'storage.js');
    const environment = { ...process.env };
    delete environment.DATA_DIRECTORY;
    const result = spawnSync(process.execPath, ['-e', 'console.log(require(process.argv[1]).dataDirectory)', storage], {
        env: environment, encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), path.resolve(__dirname, '..', 'server', 'data'));
});
