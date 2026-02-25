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

    router.get('/sgdb/search/:query', (req, res) => {
        const key = getSGDBKey();
        if (!key) return res.status(401).json({ error: 'No API Key' });

        const url = `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(req.params.query)}`;
        const options = { headers: { 'Authorization': `Bearer ${key}` } };

        https.get(url, options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    res.json(JSON.parse(data));
                } catch (e) {
                    res.status(500).json({ error: 'Failed to parse SGDB response' });
                }
            });
        }).on('error', (e) => res.status(500).json({ error: e.message }));
    });

    router.get('/sgdb/grids/:gameId/:type', (req, res) => {
        const key = getSGDBKey();
        if (!key) return res.status(401).json({ error: 'No API Key' });
        const { gameId, type } = req.params;

        let endpointType = 'grids';
        let styleQuery = '?styles=alternate,blurred,material';

        if (type === 'hero') {
            endpointType = 'heroes';
        } else if (type === 'logo') {
            endpointType = 'logos';
            styleQuery = '';
        } else if (type === 'icon') {
            endpointType = 'icons';
            styleQuery = '';
        } else if (type === 'banner') {
            endpointType = 'grids';
        }

        const url = `https://www.steamgriddb.com/api/v2/${endpointType}/game/${gameId}${styleQuery}`;
        const options = { headers: { 'Authorization': `Bearer ${key}` } };

        https.get(url, options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.success && json.data) {
                        if (type === 'grid') {
                            json.data = json.data.filter((asset: any) => asset.height > asset.width);
                        } else if (type === 'banner') {
                            json.data = json.data.filter((asset: any) => asset.width > asset.height);
                        }
                    }
                    res.json(json);
                } catch (e) {
                    res.status(500).json({ error: 'Failed to parse SGDB response' });
                }
            });
        }).on('error', (e) => res.status(500).json({ error: e.message }));
    });

    return router;
}
