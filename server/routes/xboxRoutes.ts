import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ServerContext } from '../context.js';

export function createXboxRoutes(ctx: ServerContext): Router {
    const router = Router();

    router.all('/scan', async (req, res) => {
        console.log('[Server] Scanning Xbox/Store games...');
        try {
            const assetsDirPs = ctx.ASSETS_DIR.replace(/\\/g, '\\\\');

            const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$assetsDir = "${assetsDirPs}"
$WScript = New-Object -ComObject WScript.Shell

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
                    if ($content -match "ms-xbl-[a-f0-9]+" -or $content -match "uap:GameMode" -or $content -match "Category=\`"windows.game\`"") { 
                        $isGame = $true 
                    }
                } catch {}
            }
        }

        if ($isGame) {
             $logoPath = ""
            if ($pkg.Logo -and $installLoc) {
                $possibleLogo = Join-Path $installLoc $pkg.Logo
                if (Test-Path $possibleLogo) { $logoPath = $possibleLogo }
            }
            
            # Create Shortcut
            $gameId = "xbox_" + $pkg.Name
            $gameDir = Join-Path $assetsDir $gameId
            if (-not (Test-Path $gameDir)) { New-Item -ItemType Directory -Path $gameDir -Force | Out-Null }
            
            $lnkPath = Join-Path $gameDir "launch.lnk"
            try {
                $s = $WScript.CreateShortcut($lnkPath)
                $s.TargetPath = "explorer.exe"
                $s.Arguments = "shell:AppsFolder\\\\" + $app.AppID
                $s.IconLocation = "$logoPath,0"
                $s.Save()
            } catch {
                Write-Host "Failed to create shortcut for $($app.Name): $_"
            }

            $games += [PSCustomObject]@{
                Title = $app.Name
                Id = $gameId
                ExecPath = $lnkPath
                Logo = $logoPath
                InstallDate = (Get-Item $installLoc).CreationTime.ToString("yyyy-MM-dd HH:mm:ss")
            }
        }
    }
}
$games | Sort-Object InstallDate -Descending | ConvertTo-Json -Depth 2
`;
            const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
            const command = `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`;

            exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout) => {
                if (error) return res.status(500).json({ error: 'Failed to scan Xbox games' });
                try {
                    const rawGames = JSON.parse(stdout || '[]');
                    const psGames = Array.isArray(rawGames) ? rawGames : [rawGames];
                    const games = [];
                    for (const g of psGames) {
                        if (!g.Id) continue;
                        const gameId = g.Id;
                        let localLogoPath = null;
                        if (g.Logo && (fs.existsSync(g.Logo))) {
                            const assetSubDir = path.join('xbox', gameId);
                            const fullAssetDir = path.join(ctx.ASSETS_DIR, assetSubDir);
                            if (!fs.existsSync(fullAssetDir)) fs.mkdirSync(fullAssetDir, { recursive: true });

                            const logoDestPng = path.join(fullAssetDir, 'logo.png');
                            try {
                                fs.copyFileSync(g.Logo, logoDestPng);
                                localLogoPath = path.resolve(logoDestPng);
                            } catch (e) { }
                        }
                        games.push({
                            id: gameId,
                            title: g.Title,
                            execPath: g.ExecPath,
                            source: 'xbox',
                            logo: localLogoPath || ''
                        });
                    }
                    res.json({ games });
                } catch (parseError) {
                    res.json({ games: [] });
                }
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
