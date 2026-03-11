import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ServerContext } from '../context.js';
import { processImage, downloadImage, generateThumbnail } from '../imageUtils.js';

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

            if (assetType === 'launch') {
                const isSteam = sourcePath.startsWith('steam://');

                // Steam stays as .url for maximum safety/stealth
                if (isSteam) {
                    const targetUrlFile = path.join(gameDir, 'launch.url');
                    const urlContent = `[InternetShortcut]\nURL=${sourcePath}\n`;
                    fs.writeFileSync(targetUrlFile, urlContent);
                    return res.json({ path: path.resolve(targetUrlFile) });
                }

                // Everything else uses .lnk via a robust spawnSync + EncodedCommand
                const lnkPath = path.resolve(path.join(gameDir, 'launch.lnk'));
                if (sourcePath.toLowerCase().endsWith('.lnk')) {
                    fs.copyFileSync(sourcePath, lnkPath);
                    return res.json({ path: path.resolve(lnkPath) });
                }

                const { spawnSync } = await import('child_process');
                const workingDir = path.resolve(path.dirname(sourcePath));

                const psScript = `
                $s = (New-Object -COM WScript.Shell).CreateShortcut('${lnkPath.replace(/'/g, "''")}')
                $s.TargetPath = '${path.resolve(sourcePath).replace(/'/g, "''")}'
                $s.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
                $s.Save()
                `;
                const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

                try {
                    spawnSync('powershell.exe', [
                        '-NoProfile',
                        '-ExecutionPolicy', 'Bypass',
                        '-EncodedCommand', encoded
                    ], { windowsHide: true });
                    return res.json({ path: path.resolve(lnkPath) });
                } catch (err) {
                    console.error('[Import] Shortcut creation failed:', err);
                    return res.status(500).json({ error: 'Shortcut creation failed' });
                }
            }

            // Image processing
            const sourceExt = path.extname(sourcePath).toLowerCase();
            const processedExt = (assetType === 'logo' || assetType === 'icon' || sourceExt === '.png' || sourceExt === '.gif' || sourceExt === '.apng') ? sourceExt : '.jpg';
            const targetPath = path.join(gameDir, `${assetType}${processedExt}`);
            const tempPath = path.join(gameDir, `_temp_${assetType}${processedExt}`);

            if (sourcePath.startsWith('http')) {
                await downloadImage(sourcePath, tempPath);
                await processImage(tempPath, targetPath, assetType);
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return res.json({ path: path.resolve(targetPath) });
            } else {
                await processImage(sourcePath, targetPath, assetType);
                return res.json({ path: path.resolve(targetPath) });
            }
        } catch (e: any) {
            console.error('[Import] Critical error:', e);
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
            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
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
            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.get('/optimized-bg/:gameId', async (req, res) => {
        try {
            const { gameId } = req.params;
            const cacheDir = path.join(ctx.STORAGE_DIR, 'cache', 'thumbs');
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

            const targetPath = path.join(cacheDir, `${gameId}.webp`);

            // 1. Resolve source cover via DB first (standard path)
            const categories = ctx.db.getCategories();
            let game: any = null;
            for (const cat of categories) {
                game = cat.games.find((g: any) => g.id === gameId);
                if (game) break;
            }

            let sourceCover = game?.cover;

            // 2. FALLBACK: During Sync, the DB might not be updated yet.
            // Check the physical asset folder directly if we have a gameId
            if (!sourceCover || !fs.existsSync(sourceCover)) {
                const physicalDir = path.join(ctx.ASSETS_DIR, gameId);
                const possibleFiles = ['cover.png', 'cover.jpg', 'cover.jpeg', 'cover.webp'];
                for (const f of possibleFiles) {
                    const full = path.join(physicalDir, f);
                    if (fs.existsSync(full)) {
                        sourceCover = full;
                        break;
                    }
                }
            }

            // Still no source? Return silence (204) or a transparent pixel instead of 404
            if (!sourceCover || !fs.existsSync(sourceCover)) {
                return res.status(204).end();
            }

            // 3. Cache Invalidation
            if (fs.existsSync(targetPath)) {
                const sourceStats = fs.statSync(sourceCover);
                const cacheStats = fs.statSync(targetPath);
                if (sourceStats.mtime > cacheStats.mtime) {
                    fs.unlinkSync(targetPath);
                } else {
                    return res.sendFile(path.resolve(targetPath));
                }
            }

            // 4. Generate
            const result = await generateThumbnail(sourceCover, targetPath);
            if (result && fs.existsSync(targetPath)) {
                res.sendFile(path.resolve(targetPath));
            } else {
                res.sendFile(path.resolve(sourceCover));
            }
        } catch (e: any) {
            console.error('[Assets] Optimization error (silent fallback):', e);
            res.status(204).end();
        }
    });

    return router;
}
