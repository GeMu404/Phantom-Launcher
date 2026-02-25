import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { ServerContext } from '../context.js';
import { sharp } from '../imageUtils.js';

export function createProxyRoutes(ctx: ServerContext): Router {
    const router = Router();
    const PROXY_CACHE_VERSION = 'v4'; // v4: Animated WebP Optimization

    router.get('/proxy-image', async (req, res) => {
        const filePath = req.query.path as string;
        if (!filePath) return res.status(400).send('No path provided');

        const width = req.query.w ? parseInt(req.query.w as string) : null;
        const height = req.query.h ? parseInt(req.query.h as string) : null;

        let candidates = [filePath];
        try {
            if (filePath.includes('\\')) candidates.push(filePath.replace(/\\/g, '/'));
            if (filePath.includes('/')) candidates.push(filePath.replace(/\//g, '\\'));
        } catch (e) { }

        if (filePath.includes('%')) candidates.push(unescape(filePath));
        candidates = [...new Set(candidates.filter(Boolean))];

        let finalPath = '';
        for (const p of candidates) {
            if (fs.existsSync(p)) { finalPath = p; break; }
            if (p.includes('/storage/assets/')) {
                const altPath = path.join(ctx.BASE_DIR, p.split('/storage/assets/')[1]);
                if (fs.existsSync(altPath)) { finalPath = altPath; break; }
            }
        }

        if (!finalPath) {
            for (const p of candidates) {
                if (p.includes('storage') && p.includes('assets') && !p.includes('PhantomLauncher')) {
                    try {
                        const parts = p.split(/[\\/]/);
                        const assetsIdx = parts.lastIndexOf('assets');
                        const subPath = parts.slice(assetsIdx + 1).join(path.sep);
                        const dir = path.join(ctx.BASE_DIR, 'storage', 'assets');
                        const gameId = parts[assetsIdx + 1];
                        const assetName = parts[parts.length - 1];
                        const targetDir = path.join(dir, gameId);
                        if (fs.existsSync(targetDir)) {
                            const files = fs.readdirSync(targetDir);
                            const match = files.find(f => f.toLowerCase().startsWith(assetName.split('.')[0].toLowerCase()));
                            if (match) { finalPath = path.join(targetDir, match); break; }
                        }
                    } catch (e) { }
                }
            }
        }

        if (!finalPath || !fs.existsSync(finalPath)) {
            const fallbackType = (width && width >= 800) ? 'hero' : 'cover';
            finalPath = path.join(ctx.BASE_DIR, 'front', 'assets', `fallback_${fallbackType}.jpg`);
            if (!fs.existsSync(finalPath)) return res.status(404).send('Not Found');
        }

        if (width || height) {
            const ext = path.extname(finalPath) || '.png';
            const stats = fs.statSync(finalPath);
            const cacheKey = `${ctx.slugify(finalPath)}_${stats.mtimeMs}_${stats.size}_w${width}_h${height}_${PROXY_CACHE_VERSION}`;
            const cacheDir = path.join(ctx.STORAGE_DIR, 'cache');
            const cachePath = path.join(cacheDir, `${cacheKey}${ext}`);

            if (fs.existsSync(cachePath)) return res.sendFile(cachePath);
            if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

            try {
                if (!sharp) throw new Error("sharp is undefined");
                const metadata = await sharp(finalPath).metadata();
                const isAnimated = metadata.pages && metadata.pages > 1;

                if (isAnimated) {
                    await sharp(finalPath, { animated: true })
                        .resize(width, height, { fit: 'cover', position: 'center' })
                        .webp({ effort: 0 })
                        .toFile(cachePath);
                } else {
                    await sharp(finalPath)
                        .resize(width, height, { fit: 'cover', position: 'center' })
                        .toFile(cachePath);
                }
                return res.sendFile(cachePath);
            } catch (err) {
                console.error('[Proxy] Resize failed:', err);
                return res.sendFile(finalPath);
            }
        }

        res.sendFile(finalPath);
    });

    return router;
}
