import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ServerContext } from '../context.js';
import { getStoreTags, saveTagCache, findLocalSteamAsset } from '../steamUtils.js';
import { downloadImage } from '../imageUtils.js';

// VDF parser (moved from server.ts)
function parseVdfPaths(content: string): string[] {
    const paths: string[] = [];
    const regex = /"path"\s*"([^"]+)"/gi;
    let match;
    while ((match = regex.exec(content)) !== null) paths.push(match[1].replace(/\\\\/g, '\\'));
    return paths;
}

function parseAcfManifest(content: string) {
    const appidMatch = content.match(/"appid"\s*"(\d+)"/);
    const nameMatch = content.match(/"name"\s*"([^"]+)"/);
    const lastUpdatedMatch = content.match(/"LastUpdated"\s*"(\d+)"/);
    if (appidMatch && nameMatch) {
        return { appid: appidMatch[1], name: nameMatch[1], lastUpdated: lastUpdatedMatch ? parseInt(lastUpdatedMatch[1]) : 0 };
    }
    return null;
}

export function createSteamRoutes(ctx: ServerContext): Router {
    const router = Router();

    router.all('/scan', async (req, res) => {
        console.log('[Server] Scanning Steam libraries...');
        try {
            const { includeHidden = false, includeSoftware = false, includeAdultOnly = false } = req.body || {};
            const vdfPath = 'C:\\Program Files (x86)\\Steam\\config\\libraryfolders.vdf';

            if (!fs.existsSync(vdfPath)) {
                return res.status(404).json({ error: 'Steam config not found at default location' });
            }

            const hiddenAppIds = new Set<string>();
            const lastPlayedMap = new Map<string, number>();
            const softwareAppIds = new Set<string>([
                '214850', '250820', '365670', '1486350', '431960', '388080', '993090', '331200', '228980'
            ]);

            try {
                const userdataRoot = 'C:\\Program Files (x86)\\Steam\\userdata';
                if (fs.existsSync(userdataRoot)) {
                    const users = fs.readdirSync(userdataRoot);
                    for (const user of users) {
                        const configPaths = [
                            path.join(userdataRoot, user, '7', 'remote', 'sharedconfig.vdf'),
                            path.join(userdataRoot, user, 'config', 'localconfig.vdf')
                        ];

                        for (const configPath of configPaths) {
                            if (fs.existsSync(configPath)) {
                                const content = fs.readFileSync(configPath, 'utf-8');

                                const hiddenTagRegex = /"(\d+)"\s*\{[^}]*"tags"\s*\{[^}]*"hidden"/gi;
                                let match;
                                while ((match = hiddenTagRegex.exec(content)) !== null) {
                                    hiddenAppIds.add(match[1]);
                                }

                                const hiddenKeyRegex = /"(\d+)"\s*\{[^}]*"Hidden"\s*"1"/gi;
                                while ((match = hiddenKeyRegex.exec(content)) !== null) {
                                    hiddenAppIds.add(match[1]);
                                }

                                const lastPlayedRegex = /"([^"]+)"\s*\{[^}]*"LastPlayed"\s*"(\d+)"/gi;
                                while ((match = lastPlayedRegex.exec(content)) !== null) {
                                    lastPlayedMap.set(match[1], parseInt(match[2]));
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[Server] Failed to parse local configs:', e);
            }

            const vdfContent = fs.readFileSync(vdfPath, 'utf-8');
            const libraryPaths = parseVdfPaths(vdfContent);
            const games: any[] = [];
            const softwareKeywords = ['Steamworks', 'Redistributable', 'Soundtrack', 'Artbook', 'SDK', 'Dedicated Server', 'Benchmark', 'Tool', 'Utility', 'Studio', 'Editor', 'Engine', 'Framework', 'Application', 'Software', 'Demo', 'Player', 'Workshop', 'Server', 'Client', 'Driver', 'Config'];

            for (const libPath of libraryPaths) {
                const appsPath = path.join(libPath, 'steamapps');
                if (fs.existsSync(appsPath)) {
                    const files = fs.readdirSync(appsPath);

                    for (const file of files) {
                        if (file.startsWith('appmanifest_') && file.endsWith('.acf')) {
                            try {
                                const manifestContent = fs.readFileSync(path.join(appsPath, file), 'utf-8');
                                const info = parseAcfManifest(manifestContent);
                                if (info) {
                                    let isSoftware = softwareAppIds.has(info.appid) ||
                                        softwareKeywords.some(kw => info.name.toLowerCase().includes(kw.toLowerCase())) ||
                                        softwareKeywords.some(kw => file.toLowerCase().includes(kw.toLowerCase()));

                                    const tags = await getStoreTags(info.appid);
                                    if (tags.includes('software') || tags.includes('audio production') || tags.includes('utilities')) {
                                        isSoftware = true;
                                    }

                                    const isAdultOnly = tags.includes('adultonly') || tags.includes('nsfw');

                                    if (!includeSoftware && isSoftware) continue;
                                    if (!includeAdultOnly && isAdultOnly) continue;

                                    const isHidden = hiddenAppIds.has(info.appid);
                                    if (!includeHidden && isHidden) continue;
                                    const gameId = `steam_${info.appid}`;
                                    const steamAssets = [
                                        { type: 'cover', remote: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${info.appid}/library_600x900.jpg`, local: findLocalSteamAsset(info.appid, 'cover') },
                                        { type: 'banner', remote: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${info.appid}/header.jpg`, local: findLocalSteamAsset(info.appid, 'banner') },
                                        { type: 'logo', remote: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${info.appid}/logo.png`, local: findLocalSteamAsset(info.appid, 'logo') },
                                        { type: 'hero', remote: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${info.appid}/library_hero.jpg`, local: findLocalSteamAsset(info.appid, 'hero') }
                                    ];

                                    const gameObj: any = {
                                        id: gameId,
                                        title: info.name,
                                        execPath: `steam://rungameid/${info.appid}`,
                                        source: 'steam',
                                        lastUpdated: lastPlayedMap.get(info.appid) || info.lastUpdated || 0
                                    };

                                    for (const asset of steamAssets) {
                                        const source = asset.local || asset.remote;
                                        const ext = source.toLowerCase().includes('.png') ? '.png' : '.jpg';
                                        const assetSubDir = path.join('steam', info.appid.toString());
                                        const fullAssetDir = path.join(ctx.ASSETS_DIR, assetSubDir);
                                        if (!fs.existsSync(fullAssetDir)) fs.mkdirSync(fullAssetDir, { recursive: true });

                                        const dest = path.join(fullAssetDir, `${asset.type}${ext}`);
                                        gameObj[asset.type] = path.resolve(dest);

                                        (async () => {
                                            if (source.startsWith('http')) {
                                                if (!fs.existsSync(dest)) await downloadImage(source, dest).catch(() => { });
                                            } else {
                                                try {
                                                    if (!fs.existsSync(dest)) fs.copyFileSync(source, dest);
                                                } catch (e) { }
                                            }
                                        })();
                                    }
                                    games.push(gameObj);
                                }
                            } catch (e) { }
                        }
                    }
                }
            }
            saveTagCache();
            res.json({ games: games.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)) });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}
