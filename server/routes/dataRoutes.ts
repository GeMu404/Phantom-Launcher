import { Router } from 'express';
import fs from 'fs';
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
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: 'Failed to save data' });
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

    return router;
}
