import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ServerContext } from '../context.js';
import { processImage, downloadImage } from '../imageUtils.js';

export function createAssetRoutes(ctx: ServerContext): Router {
    const router = Router();

    router.post('/import', async (req, res) => {
        const { sourcePath, gameId, assetType } = req.body;
        if (!sourcePath || !gameId || !assetType) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            const gameDir = path.join(ctx.ASSETS_DIR, gameId);
            if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

            const sourceExt = path.extname(sourcePath).toLowerCase();
            const processedExt = (assetType === 'logo' || assetType === 'icon' || sourceExt === '.png' || sourceExt === '.gif' || sourceExt === '.apng') ? sourceExt : '.jpg';
            const targetPath = path.join(gameDir, `${assetType}${processedExt}`);
            const tempPath = path.join(gameDir, `_temp_${assetType}${processedExt}`);

            if (assetType === 'launch') {
                const internalLnk = path.join(gameDir, 'launch.lnk');
                if (sourcePath.toLowerCase().endsWith('.lnk')) {
                    fs.copyFileSync(sourcePath, internalLnk);
                    res.json({ path: path.resolve(internalLnk) });
                } else {
                    const combinedScript = `
$targetPath = '${internalLnk.replace(/'/g, "''")}';
$finalTarget = '${sourcePath.replace(/'/g, "''")}';
if ($finalTarget -like '*.url') {
    if (Test-Path $finalTarget) {
        $content = Get-Content $finalTarget -Raw;
        if ($content -match 'URL=(.*)') { $finalTarget = $matches[1].Trim() }
    }
}
$WScript = New-Object -ComObject WScript.Shell;
$newS = $WScript.CreateShortcut($targetPath);
$newS.TargetPath = $finalTarget;
$newS.Save();
`;
                    const encoded = Buffer.from(combinedScript, 'utf16le').toString('base64');
                    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, (err) => {
                        if (err) return res.status(500).json({ error: 'Shortcut creation failed' });
                        if (fs.existsSync(internalLnk)) {
                            res.json({ path: path.resolve(internalLnk) });
                        } else {
                            res.status(500).json({ error: 'Verification failed: launch.lnk not found' });
                        }
                    });
                }
                return;
            }

            if (sourcePath.startsWith('http')) {
                await downloadImage(sourcePath, tempPath);
                await processImage(tempPath, targetPath, assetType);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                res.json({ path: path.resolve(targetPath) });
            } else if (['.exe', '.lnk', '.bat', '.url'].includes(path.extname(sourcePath).toLowerCase())) {
                const lnkPath = path.join(gameDir, `launch${path.extname(sourcePath).toLowerCase() === '.lnk' ? '' : '.lnk'}`);
                const psCommand = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${lnkPath}');$s.TargetPath='${sourcePath}';$s.Save()`;
                exec(`powershell -Command "${psCommand}"`, (err) => {
                    if (err) return res.status(500).json({ error: 'Shortcut creation failed' });
                    res.json({ path: path.resolve(lnkPath) });
                });
            } else {
                await processImage(sourcePath, targetPath, assetType);
                res.json({ path: path.resolve(targetPath) });
            }
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/delete', (req, res) => {
        const { gameId } = req.body;
        if (!gameId) return res.status(400).json({ error: 'gameId required' });
        try {
            ctx.db.deleteGame(gameId);
            const gameDir = path.join(ctx.ASSETS_DIR, gameId);
            if (fs.existsSync(gameDir)) {
                fs.rmSync(gameDir, { recursive: true, force: true });
            }
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/verify-integrity', (req, res) => {
        try {
            const brokenIds: string[] = [];
            const gamesMap = new Map();
            const categories = ctx.db.getCategories();
            categories.forEach((cat: any) => {
                cat.games?.forEach((g: any) => {
                    if (!gamesMap.has(g.id)) gamesMap.set(g.id, g);
                });
            });
            gamesMap.forEach((game, id) => {
                if (game.execPath) {
                    if (game.execPath.startsWith('http') || game.execPath.startsWith('steam:') || game.execPath.startsWith('com.epicgames')) return;
                    if (!fs.existsSync(game.execPath)) brokenIds.push(id);
                }
            });
            res.json({ brokenIds });
        } catch (e: any) {
            res.status(500).json({ error: 'Integrity check failed' });
        }
    });

    router.post('/fetch-missing', async (req, res) => {
        try {
            const { categoryId } = req.body;
            const categories = ctx.db.getCategories();
            const cat = categories.find(c => c.id === categoryId);
            if (!cat) return res.status(404).json({ error: 'Category not found' });
            res.json({ success: true, count: cat.games.filter(g => !g.logo || !g.cover || !g.banner).length });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/wipe', (req, res) => {
        try {
            ctx.db.wipeData();
            if (fs.existsSync(ctx.STORAGE_DIR)) {
                fs.rmSync(ctx.STORAGE_DIR, { recursive: true, force: true });
                fs.mkdirSync(ctx.ASSETS_DIR, { recursive: true });
            }
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
