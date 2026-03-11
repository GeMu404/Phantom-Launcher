import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ServerContext } from '../context.js';

export function createXboxRoutes(ctx: ServerContext): Router {
    const router = Router();

    router.post('/sync', async (req, res) => {
        try {
            const { includeAssets = true } = req.body || {};
            const games = await performXboxScan(ctx, { includeAssets });
            ctx.db.importGames(games, 'xbox', { clearCategory: true });
            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
            res.json({ success: true, count: games.length, games });
        } catch (e: any) {
            console.error('[Xbox] Sync error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

async function performXboxScan(ctx: ServerContext, options: { includeAssets: boolean }) {
    const { includeAssets } = options;
    return new Promise<any[]>((resolve, reject) => {
        const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$packages = Get-AppxPackage | Where-Object { $_.IsFramework -eq $false -and $_.SignatureKind -eq "Store" }
$packageMap = @{}
foreach ($p in $packages) {
    if ($p.PackageFamilyName) { $packageMap[$p.PackageFamilyName] = $p }
}
$startApps = Get-StartApps
$games = @()
foreach ($app in $startApps) {
    if (-not $app.AppID.Contains("!")) { continue }
    $pfn = $app.AppID.Split("!")[0]
    $pkg = $packageMap[$pfn]
    if ($pkg) {
        $installLoc = $pkg.InstallLocation
        $isGame = $false
        if ($installLoc -and (Test-Path $installLoc)) {
            $manifestPath = Join-Path $installLoc "AppxManifest.xml"
            if (Test-Path $manifestPath) {
                try {
                    $content = Get-Content $manifestPath -Raw
                    if ($content -match "ms-xbl-[a-f0-9]+" -or $content -match "uap:GameMode" -or $content -match "Category=\`"windows.game\`"") { $isGame = $true }
                } catch {}
            }
        }
        if ($isGame) {
            $logoPath = ""
            if ($pkg.Logo -and $installLoc) { $possibleLogo = Join-Path $installLoc $pkg.Logo; if (Test-Path $possibleLogo) { $logoPath = $possibleLogo } }
            $games += [PSCustomObject]@{ Title = $app.Name; Id = "xbox_" + $pkg.Name; AppID = $app.AppID; Logo = $logoPath; InstallDate = (Get-Item $installLoc).CreationTime.ToString("yyyy-MM-dd HH:mm:ss") }
        }
    }
}
$games | Sort-Object InstallDate -Descending | ConvertTo-Json -Depth 2
`;
        const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
        const command = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`;

        exec(command, { maxBuffer: 1024 * 1024 * 10 }, async (error, stdout) => {
            if (error) return reject(new Error('Failed to scan Xbox games'));
            try {
                const rawGames = JSON.parse(stdout || '[]');
                const psGames = Array.isArray(rawGames) ? rawGames : [rawGames];
                const games = [];
                const { spawnSync } = await import('child_process');

                for (const g of psGames) {
                    if (!g.Id || !g.AppID) continue;
                    const gameId = g.Id;
                    const assetSubDir = path.join('xbox', gameId);
                    const fullAssetDir = path.join(ctx.ASSETS_DIR, assetSubDir);
                    if (!fs.existsSync(fullAssetDir)) fs.mkdirSync(fullAssetDir, { recursive: true });

                    const lnkPath = path.resolve(path.join(fullAssetDir, 'launch.lnk'));
                    const psScript = `
                    $s = (New-Object -COM WScript.Shell).CreateShortcut('${lnkPath.replace(/'/g, "''")}')
                    $s.TargetPath = 'C:\\Windows\\explorer.exe'
                    $s.Arguments = 'shell:AppsFolder\\${g.AppID}'
                    $s.Save()
                    `;
                    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
                    spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true });

                    let localLogoPath = '';
                    if (includeAssets && g.Logo && fs.existsSync(g.Logo)) {
                        const logoDestPng = path.join(fullAssetDir, 'logo.png');
                        try {
                            fs.copyFileSync(g.Logo, logoDestPng);
                            localLogoPath = path.resolve(logoDestPng);
                        } catch (e) { }
                    }
                    games.push({ id: gameId, title: g.Title, execPath: path.resolve(lnkPath), source: 'xbox', logo: localLogoPath });
                }
                resolve(games);
            } catch (e) { resolve([]); }
        });
    });
}
