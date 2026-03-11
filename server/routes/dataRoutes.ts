import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { ServerContext } from '../context.js';

export function createDataRoutes(ctx: ServerContext): Router {
    const router = Router();

    const getSGDBKey = () => {
        try {
            if (!fs.existsSync(ctx.CONFIG_FILE)) return null;
            const cfg = JSON.parse(fs.readFileSync(ctx.CONFIG_FILE, 'utf-8'));
            return cfg.sgdbKey || null;
        } catch { return null; }
    };

    router.get('/sgdb/key', (req, res) => {
        try {
            let config: any = { sgdbKey: '', sgdbEnabled: false };
            if (fs.existsSync(ctx.CONFIG_FILE)) {
                config = JSON.parse(fs.readFileSync(ctx.CONFIG_FILE, 'utf-8'));
            }
            res.json({ key: config.sgdbKey || '', enabled: config.sgdbEnabled || false });
        } catch (e) {
            res.status(500).json({ error: 'Failed to retrieve SGDB settings' });
        }
    });

    router.post('/sgdb/key', (req, res) => {
        try {
            const { key, enabled } = req.body;
            let config: any = {};
            if (fs.existsSync(ctx.CONFIG_FILE)) {
                config = JSON.parse(fs.readFileSync(ctx.CONFIG_FILE, 'utf-8'));
            }
            if (key !== undefined) config.sgdbKey = key;
            if (enabled !== undefined) config.sgdbEnabled = enabled;

            console.log(`[Config] Updating SGDB Core at: ${ctx.CONFIG_FILE}`);
            fs.writeFileSync(ctx.CONFIG_FILE, JSON.stringify(config, null, 2));
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Failed to save SGDB settings' });
        }
    });

    router.get('/data', (req, res) => {
        try {
            res.json(ctx.db.getCategories());
        } catch (e) {
            console.error('[Data] Load error:', e);
            res.status(500).json({ error: 'Failed to read data' });
        }
    });

    router.post('/data', (req, res) => {
        try {
            const categories = req.body;
            if (!Array.isArray(categories)) {
                return res.status(400).json({ error: 'Body must be a categories array' });
            }

            ctx.db.saveCategories(categories);
            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
            res.json({ success: true });
        } catch (e: any) {
            console.error('[Data] Save error:', e);
            res.status(500).json({ error: 'Failed to save data', details: e.message });
        }
    });

    router.get('/sgdb/search/:query', async (req, res) => {
        const key = getSGDBKey();
        if (!key) {
            console.error('[SGDB] Search aborted: No API Key found in config.json');
            return res.status(401).json({ error: 'No API Key' });
        }

        const query = req.params.query;
        const url = `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(query)}`;

        console.log(`[SGDB] Search Protocol Initialized: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

            console.log(`[SGDB] Remote Status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[SGDB] Remote Failure: ${response.status} - ${errorText}`);
                return res.status(response.status).json({
                    success: false,
                    error: 'REMOTE_API_ERROR',
                    detail: errorText,
                    status: response.status
                });
            }

            const data = await response.json();
            console.log(`[SGDB] Search Success: Found ${data.data?.length || 0} entries`);
            res.json(data);
        } catch (e: any) {
            console.error('[SGDB] Internal Proxy Exception:', e);
            res.status(500).json({ success: false, error: 'PROXY_EXCEPTION', detail: e.message });
        }
    });

    router.get('/sgdb/grids/:gameId/:type', async (req, res) => {
        const key = getSGDBKey();
        if (!key) return res.status(401).json({ error: 'No API Key' });
        const { gameId, type } = req.params;

        let endpointType = 'grids';
        let styleQuery = ''; // Simplified: return all styles to avoid empty results

        if (type === 'hero') {
            endpointType = 'heroes';
        } else if (type === 'logo') {
            endpointType = 'logos';
        } else if (type === 'icon') {
            endpointType = 'icons';
        } else if (type === 'banner' || type === 'grid') {
            endpointType = 'grids';
        }

        const url = `https://www.steamgriddb.com/api/v2/${endpointType}/game/${gameId}${styleQuery}`;
        console.log(`[SGDB] Fetching Assets: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[SGDB] Asset Remote Failure: ${response.status} - ${errorText}`);
                return res.status(response.status).json({ success: false, error: 'REMOTE_ASSET_ERROR', detail: errorText });
            }

            const json = await response.json();
            if (json.success && json.data) {
                if (type === 'grid') {
                    // Vertical Grids (Portrait)
                    json.data = json.data.filter((asset: any) => asset.height > asset.width);
                } else if (type === 'banner') {
                    // Horizontal Grids (Library Banner)
                    json.data = json.data.filter((asset: any) => asset.width > asset.height);
                } else if (type === 'hero') {
                    // Heroes are backgrounds, usually 16:9
                    json.data = json.data.filter((asset: any) => asset.width > asset.height);
                }
            }
            res.json(json);
        } catch (e: any) {
            console.error('[SGDB] Assets Proxy Exception:', e);
            res.status(500).json({ success: false, error: 'PROXY_ASSETS_EXCEPTION', detail: e.message });
        }
    });

    // Verify file paths exist on disk
    router.post('/verify-paths', (req, res) => {
        try {
            const { paths } = req.body;
            if (!Array.isArray(paths)) return res.status(400).json({ error: 'paths must be an array' });
            const results: Record<string, boolean> = {};
            for (const p of paths) {
                if (typeof p !== 'string') continue;
                try {
                    // Skip URLs and protocol paths
                    if (p.startsWith('http') || p.startsWith('steam://') || p.startsWith('ms-')) {
                        results[p] = true;
                        continue;
                    }
                    results[p] = fs.existsSync(p);
                } catch {
                    results[p] = false;
                }
            }
            res.json({ results });
        } catch (e) {
            res.status(500).json({ error: 'Failed to verify paths' });
        }
    });

    // Deep scan assets directory for orphaned folders and recover entries
    router.get('/integrity/scan-orphans', (req, res) => {
        try {
            const recovered: any[] = [];
            const assetsDir = ctx.ASSETS_DIR;
            if (!fs.existsSync(assetsDir)) return res.json({ recovered: [] });

            const scanDir = (dir: string, depth = 0) => {
                const items = fs.readdirSync(dir, { withFileTypes: true });
                for (const item of items) {
                    if (item.isDirectory()) {
                        const fullPath = path.join(dir, item.name);

                        // Prioritize .lnk as it is the standard for most games
                        // Fallback to .url for Steam games
                        const possibleLaunchFiles = ['launch.lnk', 'launch.url'];
                        const foundFile = possibleLaunchFiles.find(f => fs.existsSync(path.join(fullPath, f)));

                        if (foundFile) {
                            const launchPath = path.join(fullPath, foundFile);
                            const relative = path.relative(assetsDir, fullPath).replace(/\\/g, '/');
                            const parts = relative.split('/');

                            let source: any = 'manual';
                            let platform = null;
                            let gameId = item.name;

                            // Heuristic to detect source based on folder structure
                            if (parts[0] === 'emulator' && parts.length >= 3) {
                                source = 'emu';
                                platform = parts[1];
                                gameId = `emu_${platform}_${parts[2]}`;
                            } else if (parts[0] === 'steam') {
                                source = 'steam';
                                gameId = `steam_${parts[1]}`;
                            } else if (parts[0] === 'xbox') {
                                source = 'xbox';
                                gameId = `xbox_${parts[1]}`;
                            }

                            // Build recovered game object
                            const game = {
                                id: gameId,
                                title: item.name.replace(/_/g, ' ').toUpperCase(),
                                execPath: path.resolve(launchPath),
                                source,
                                platform,
                                cover: fs.existsSync(path.join(fullPath, 'cover.png')) ? path.join(fullPath, 'cover.png') :
                                    (fs.existsSync(path.join(fullPath, 'cover.jpg')) ? path.join(fullPath, 'cover.jpg') : ''),
                                banner: fs.existsSync(path.join(fullPath, 'banner.png')) ? path.join(fullPath, 'banner.png') :
                                    (fs.existsSync(path.join(fullPath, 'banner.jpg')) ? path.join(fullPath, 'banner.jpg') : ''),
                                logo: fs.existsSync(path.join(fullPath, 'logo.png')) ? path.join(fullPath, 'logo.png') :
                                    (fs.existsSync(path.join(fullPath, 'logo.jpg')) ? path.join(fullPath, 'logo.jpg') : ''),
                                wallpaper: fs.existsSync(path.join(fullPath, 'wallpaper.png')) ? path.join(fullPath, 'wallpaper.png') :
                                    (fs.existsSync(path.join(fullPath, 'wallpaper.jpg')) ? path.join(fullPath, 'wallpaper.jpg') : ''),
                            };
                            recovered.push(game);
                        } else if (depth < 2) {
                            scanDir(fullPath, depth + 1);
                        }
                    }
                }
            };

            scanDir(assetsDir);
            res.json({ recovered });
        } catch (e) {
            console.error('[Integrity] Orphan scan error:', e);
            res.status(500).json({ error: 'Failed to scan for orphaned folders' });
        }
    });

    // Server-side library search (Discovery Protocol)
    router.get('/games/search', (req, res) => {
        try {
            const query = (req.query.q as string) || '';
            const categoryId = (req.query.cat as string) || 'all';
            const games = ctx.db.searchGames(query, categoryId);
            res.json({ games });
        } catch (e: any) {
            console.error('[Data] Search error:', e);
            res.status(500).json({ error: 'Search failed' });
        }
    });

    // Update only specific game assets
    router.post('/games/update-assets', (req, res) => {
        try {
            const { gameId, assets } = req.body;
            if (!gameId || !assets) {
                return res.status(400).json({ error: 'Missing gameId or assets' });
            }
            ctx.db.updateGameAssets(gameId, assets);
            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
            res.json({ success: true });
        } catch (e: any) {
            console.error('[Data] Game update error:', e);
            res.status(500).json({ error: 'Failed to update game assets', details: e.message });
        }
    });

    // Full system wipe (PANIC_FACTORY_RESET)
    router.post('/data/wipe', (req, res) => {
        try {
            console.log('[System] Initializing Factory Reset protocol...');
            ctx.db.wipeData();

            if (fs.existsSync(ctx.STORAGE_DIR)) {
                console.log(`[System] Purging storage at: ${ctx.STORAGE_DIR}`);
                fs.rmSync(ctx.STORAGE_DIR, { recursive: true, force: true });
                fs.mkdirSync(ctx.ASSETS_DIR, { recursive: true });
            }

            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
            res.json({ success: true });
        } catch (e: any) {
            console.error('[System] Factory Reset failed:', e);
            res.status(500).json({ error: 'Failed to perform factory reset', details: e.message });
        }
    });

    return router;
}
