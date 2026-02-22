import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { AppDatabase } from './database.js';
import chokidar from 'chokidar';

// Module imports
import { processImage, downloadImage, sharp } from './server/imageUtils.js';
import { getStoreTags, saveTagCache, findLocalSteamAsset } from './server/steamUtils.js';
import { EMU_PLATFORMS, PLATFORM_NAMES, cleanEmuTitle, extractTitleFromSFO } from './server/emuUtils.js';
import { launchViaShell } from './server/launchUtils.js';

// Slugify Helper
const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD') // Handle accents
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
};

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// 1. DYNAMIC BASE DIRECTORY (Handles Dev vs Prod EXE)
const isPkg = typeof (process as any).pkg !== 'undefined';
const BASE_DIR = isPkg ? path.dirname(process.execPath) : process.cwd();

const DATA_FILE = path.join(BASE_DIR, 'data.json');
const STORAGE_DIR = path.join(BASE_DIR, 'storage');
const ASSETS_DIR = path.join(STORAGE_DIR, 'assets');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');

console.log(`[Server] Environment: ${isPkg ? 'PORTABLE_EXE' : 'NODE_DEV'}`);
console.log(`[Server] Base Storage: ${BASE_DIR}`);

app.use('/res/storage', express.static(STORAGE_DIR));

// Ensure base directories exist
[STORAGE_DIR, ASSETS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// SQLite Initialization and Migration
const DB_FILE = path.join(BASE_DIR, 'phantom.db');
const db = new AppDatabase(DB_FILE);
db.migrateFromJson(DATA_FILE);

if (db.getCategories().length === 0) {
    console.log('[Init] Creating initial categories in SQLite...');
    db.saveCategories([
        { id: 'all', name: 'ALL GAMES', icon: 'grid', color: '#ffffff', games: [], enabled: true },
        { id: 'favorites', name: 'FAVORITES', icon: 'heart', color: '#ff4444', games: [], enabled: true }
    ]);
}

// SGDB Key & Settings Management
// (Using global CONFIG_FILE defined at the top)

app.get('/api/sgdb/key', (req, res) => {
    try {
        let config: any = { sgdbKey: '', sgdbEnabled: false };
        if (fs.existsSync(CONFIG_FILE)) {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
        res.json({ key: config.sgdbKey || '', enabled: config.sgdbEnabled || false });
    } catch (e) {
        res.status(500).json({ error: 'Failed to retrieve SGDB settings' });
    }
});

app.post('/api/sgdb/key', (req, res) => {
    try {
        const { key, enabled } = req.body;
        let config: any = {};
        if (fs.existsSync(CONFIG_FILE)) {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
        if (key !== undefined) config.sgdbKey = key;
        if (enabled !== undefined) config.sgdbEnabled = enabled;

        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save SGDB settings' });
    }
});

// Get Launcher Data
app.get('/api/data', (req, res) => {
    try {
        res.json(db.getCategories());
    } catch (e) {
        console.error('[Data] Load error:', e);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Save Launcher Data
app.post('/api/data', (req, res) => {
    try {
        const categories = req.body;
        if (!Array.isArray(categories)) {
            return res.status(400).json({ error: 'Body must be a categories array' });
        }

        db.saveCategories(categories);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save data' });
    }
});



const getSGDBKey = () => {
    try {
        if (!fs.existsSync(CONFIG_FILE)) return null;
        const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        return cfg.sgdbKey || null;
    } catch { return null; }
};

app.get('/api/sgdb/search/:query', (req, res) => {
    const key = getSGDBKey();
    if (!key) return res.status(401).json({ error: 'No API Key' });

    // SGDB requires Bearer token
    const url = `https://www.steamgriddb.com/api/v2/search/autocomplete/${encodeURIComponent(req.params.query)}`;
    const options = {
        headers: { 'Authorization': `Bearer ${key}` }
    };

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

app.get('/api/sgdb/grids/:gameId/:type', (req, res) => {
    const key = getSGDBKey();
    if (!key) return res.status(401).json({ error: 'No API Key' });
    const { gameId, type } = req.params; // type: 'grid' | 'hero' | 'logo' | 'banner'

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
        // Banners are horizontal grids
    }

    const url = `https://www.steamgriddb.com/api/v2/${endpointType}/game/${gameId}${styleQuery}`;
    console.log(`[SGDB] Fetching: ${url}`);
    const options = {
        headers: { 'Authorization': `Bearer ${key}` }
    };

    https.get(url, options, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.success && json.data) {
                    if (type === 'grid') {
                        // Strict Portrait
                        json.data = json.data.filter((asset: any) => asset.height > asset.width);
                    } else if (type === 'banner') {
                        // Strict Landscape for grids
                        json.data = json.data.filter((asset: any) => asset.width > asset.height);
                    }
                    // 'hero' endpoint naturally returns heroes, no extra filter needed
                }
                res.json(json);
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse SGDB response' });
            }
        });
    }).on('error', (e) => res.status(500).json({ error: e.message }));
});

// Import Asset (Copy to local storage)
app.post('/api/assets/import', async (req, res) => {
    const { sourcePath, gameId, assetType } = req.body;
    if (!sourcePath || !gameId || !assetType) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const gameDir = path.join(ASSETS_DIR, gameId);
        if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

        // Standardize extensions for processed files: Preserve PNG/GIF, otherwise fallback to JPG
        const sourceExt = path.extname(sourcePath).toLowerCase();
        const processedExt = (assetType === 'logo' || assetType === 'icon' || sourceExt === '.png' || sourceExt === '.gif' || sourceExt === '.apng') ? sourceExt : '.jpg';
        const targetPath = path.join(gameDir, `${assetType}${processedExt}`);
        const tempPath = path.join(gameDir, `_temp_${assetType}${processedExt}`);

        if (assetType === 'launch') {
            console.log(`[Assets] Creating/Copying Launch Shortcut for: ${sourcePath}`);
            const internalLnk = path.join(gameDir, 'launch.lnk');

            if (sourcePath.toLowerCase().endsWith('.lnk')) {
                // JUST COPY IT
                fs.copyFileSync(sourcePath, internalLnk);
                res.json({ path: path.resolve(internalLnk) });
            } else {
                // Normal shortcut creation for EXEs
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
                    if (err) {
                        console.error('[Assets] Shortcut creation failed:', err);
                        return res.status(500).json({ error: 'Shortcut creation failed' });
                    }

                    // Verification: Ensure it actually appeared on disk
                    if (fs.existsSync(internalLnk)) {
                        res.json({ path: path.resolve(internalLnk) });
                    } else {
                        res.status(500).json({ error: 'Verification failed: launch.lnk not found after creation' });
                    }
                });
            }
            return;
        }

        if (sourcePath.startsWith('http')) {
            console.log(`[Assets] Downloading & Resizing URL: ${sourcePath}`);
            await downloadImage(sourcePath, tempPath);
            await processImage(tempPath, targetPath, assetType);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            res.json({ path: path.resolve(targetPath) });
        } else if (['.exe', '.lnk', '.bat', '.url'].includes(path.extname(sourcePath).toLowerCase())) {
            // Legacy/Direct shortcut handling (keeping for compatibility, though 'launch' type is preferred now)
            const lnkPath = path.join(gameDir, `launch${path.extname(sourcePath).toLowerCase() === '.lnk' ? '' : '.lnk'}`);
            const psCommand = `$s=(New-Object -COM WScript.Shell).CreateShortcut('${lnkPath}');$s.TargetPath='${sourcePath}';$s.Save()`;
            exec(`powershell -Command "${psCommand}"`, (err) => {
                if (err) return res.status(500).json({ error: 'Shortcut creation failed' });
                res.json({ path: path.resolve(lnkPath) });
            });
        } else {
            // Local file import: Resize it!
            console.log(`[Assets] Importing & Resizing Local: ${sourcePath}`);
            await processImage(sourcePath, targetPath, assetType);
            res.json({ path: path.resolve(targetPath) });
        }
    } catch (e: any) {
        console.error(`[Assets] Import/Process failed: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// Delete Game & Assets
app.post('/api/games/delete', (req, res) => {
    const { gameId } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId required' });

    try {
        db.deleteGame(gameId);

        // 2. Delete Assets Folder
        const gameDir = path.join(ASSETS_DIR, gameId);
        if (fs.existsSync(gameDir)) {
            fs.rmSync(gameDir, { recursive: true, force: true });
            console.log(`[Assets] Purged assets for game: ${gameId}`);
        }

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Verify Integrity of Game Shortcuts
app.post('/api/games/verify-integrity', (req, res) => {
    console.log('[Integrity] Verifying game shortcut paths...');
    try {
        const brokenIds: string[] = [];

        // Collect all unique games across categories
        const gamesMap = new Map();
        const categories = db.getCategories();

        categories.forEach((cat: any) => {
            cat.games?.forEach((g: any) => {
                if (!gamesMap.has(g.id)) gamesMap.set(g.id, g);
            });
        });

        gamesMap.forEach((game, id) => {
            if (game.execPath) {
                // If it's a URL (http/steam/discord), consider it valid
                if (game.execPath.startsWith('http') || game.execPath.startsWith('steam:') || game.execPath.startsWith('com.epicgames')) {
                    return;
                }

                // Check physical existence
                if (!fs.existsSync(game.execPath)) {
                    console.log(`[Integrity] Broken Path: ${game.title} -> ${game.execPath}`);
                    brokenIds.push(id);
                }
            }
        });

        res.json({ brokenIds });
    } catch (e: any) {
        console.error('[Integrity] Error:', e);
        res.status(500).json({ error: 'Integrity check failed' });
    }
});

// System Wipe (Factory Reset)
app.post('/api/system/wipe', (req, res) => {
    try {
        db.wipeData();
        if (fs.existsSync(STORAGE_DIR)) {
            fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
            fs.mkdirSync(ASSETS_DIR, { recursive: true });
        }
        console.log('[System] FACTORY_RESET_COMPLETE');
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Health Check for Frontend
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// --- File Exploration Endpoints ---

// List system drives (Windows)
app.get('/api/files/drives', (req, res) => {
    console.log('[FS_EXPLORER] Listing logical drives natively...');
    try {
        const drives: string[] = [];
        for (let i = 65; i <= 90; i++) {
            const drive = String.fromCharCode(i) + ':\\';
            try {
                if (fs.existsSync(drive)) drives.push(drive);
            } catch (e) { }
        }

        const userProfile = process.env.USERPROFILE || '';
        const rawLibraries = {
            Desktop: path.join(userProfile, 'Desktop') + '\\',
            Documents: path.join(userProfile, 'Documents') + '\\',
            Pictures: path.join(userProfile, 'Pictures') + '\\',
            Music: path.join(userProfile, 'Music') + '\\',
            Videos: path.join(userProfile, 'Videos') + '\\',
            Downloads: path.join(userProfile, 'Downloads') + '\\'
        };

        const libraries = Object.entries(rawLibraries).map(([name, p]) => {
            return { name, path: fs.existsSync(p) ? p : '' };
        }).filter(lib => lib.path && lib.path.length > 1);

        res.json({ drives, libraries });
    } catch (error: any) {
        console.error('[FS_EXPLORER] Failed to list drives natively:', error.message);
        res.status(500).json({ error: 'Failed to list drives' });
    }
});

// List directory contents
app.post('/api/files/list', (req, res) => {
    const { dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'dirPath is required' });

    try {
        const resolvedPath = path.resolve(dirPath);
        console.log(`[FS_EXPLORER] Listing contents of: ${resolvedPath}`);

        let items;
        try {
            items = fs.readdirSync(resolvedPath, { withFileTypes: true });
        } catch (err: any) {
            console.error(`[FS_EXPLORER] Access Denied to directory: ${resolvedPath}`);
            return res.status(403).json({ error: 'ACCESS_DENIED', path: resolvedPath });
        }

        const contents = items.map(item => {
            const fullPath = path.join(resolvedPath, item.name);
            try {
                // Check if we have permission to access the item metadata
                const stats = fs.statSync(fullPath);

                return {
                    name: item.name,
                    path: fullPath,
                    isDir: item.isDirectory(),
                    size: stats.size,
                    ext: path.extname(item.name).toLowerCase()
                };
            } catch (e) {
                // If stat fails (e.g. system folder), return null to filter out
                console.warn(`[FS_EXPLORER] Skipping restricted item: ${fullPath}`);
                return null;
            }
        }).filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => {
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
                return a.name.localeCompare(b.name);
            });

        res.json({ path: resolvedPath, contents });
    } catch (e: any) {
        console.error(`[FS_EXPLORER] Error listing ${dirPath}: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

// Get File Info (Arguments from shortcut)
app.post('/api/files/info', (req, res) => {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath is required' });

    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.lnk') {
        const psScript = `
$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${filePath.replace(/'/g, "''")}');
$obj = @{
    TargetPath = $s.TargetPath
    Arguments = $s.Arguments
    WorkingDirectory = $s.WorkingDirectory
}
$obj | ConvertTo-Json
`;
        exec(`powershell -NoProfile -Command "${psScript}"`, (err, stdout) => {
            if (err) return res.status(500).json({ error: 'Failed to read shortcut' });
            try {
                const info = JSON.parse(stdout);
                res.json(info);
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse shortcut info' });
            }
        });
    } else if (ext === '.url') {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const match = content.match(/URL=(.*)/);
            if (match && match[1]) {
                res.json({ TargetPath: match[1].trim(), Arguments: '' });
            } else {
                res.json({ TargetPath: filePath, Arguments: '' });
            }
        } catch (e) {
            res.status(500).json({ error: 'Failed to read .url file' });
        }
    } else {
        res.json({ TargetPath: filePath, Arguments: '' });
    }
});

// Proxy Local Image with Resizing Support
const PROXY_CACHE_VERSION = 'v4'; // v4: Animated WebP Optimization
app.get('/api/proxy-image', async (req, res) => {
    const filePath = req.query.path as string;
    // DEBUG: Log Raw Request
    console.log(`[Proxy] Request: ${req.url}`);
    console.log(`[Proxy] Query Path: "${filePath}"`);
    const width = req.query.width ? parseInt(req.query.width as string) : undefined;
    const height = req.query.height ? parseInt(req.query.height as string) : undefined;

    if (!filePath) return res.status(400).send('Path is required');

    // Robust Resolution Strategy: Try multiple interpretations of the path
    // 1. Resolved absolute path
    // 2. Raw input (if it's already absolute)
    // 3. Decoded input (if double encoded)
    // EXHAUSTIVE RESOLUTION STRATEGY
    let candidates: string[] = [];

    // 1. As-is
    candidates.push(filePath);
    candidates.push(path.resolve(filePath));
    candidates.push(path.normalize(filePath));

    // 2. Single Decode
    try {
        const d1 = decodeURIComponent(filePath);
        candidates.push(d1);
        candidates.push(path.resolve(d1));
    } catch (e) { }

    // 3. Double Decode (in case of double encoding)
    try {
        const d2 = decodeURIComponent(decodeURIComponent(filePath));
        candidates.push(d2);
        candidates.push(path.resolve(d2));
    } catch (e) { }

    // 4. Fallback for potential legacy encoded chars
    if (filePath.includes('%')) {
        candidates.push(unescape(filePath));
    }

    // Clean and dedup
    candidates = [...new Set(candidates.filter(Boolean))];

    console.log(`[Proxy] Candidates: ${JSON.stringify(candidates)}`);
    // Remove duplicates
    candidates = [...new Set(candidates)];

    let finalPath = '';

    // 1. Search for exact match
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            finalPath = p;
            break;
        }
    }

    // 2. Fallback extensions (if exact match failed)
    if (!finalPath) {
        for (const p of candidates) {
            const ext = path.extname(p).toLowerCase();
            const altExt = ext === '.jpg' ? '.png' : (ext === '.png' ? '.jpg' : null);
            if (altExt) {
                const altPath = p.slice(0, -ext.length) + altExt;
                if (fs.existsSync(altPath)) {
                    finalPath = altPath;
                    break;
                }
            }
        }
    }

    // 3. Deep fallback for assets (storage logic)
    if (!finalPath) {
        for (const p of candidates) {
            // Try looking in CWD/system/storage/assets if path seems lost
            if (p.includes('storage') && p.includes('assets') && !p.includes('PhantomLauncher')) {
                try {
                    const possiblePath = path.resolve(process.cwd(), 'system', 'storage', 'assets', path.basename(path.dirname(p)), path.basename(p));
                    if (fs.existsSync(possiblePath)) {
                        finalPath = possiblePath;
                        console.log(`[Proxy] STORAGE RECOVERY MATCH: ${finalPath}`);
                        break;
                    }
                } catch (e) { }
            }

            if (p.includes('storage\\assets')) {
                const dir = path.dirname(p);
                const ext = path.extname(p);
                const base = path.basename(p, ext);
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    const match = files.find(f => f.startsWith(base + '.'));
                    if (match) {
                        finalPath = path.join(dir, match);
                        break;
                    }
                }
            }
        }
    }

    // 4. HAIL MARY: If lookups fail, serve a fallback image
    if (!finalPath || !fs.existsSync(finalPath)) {
        console.warn(`[Proxy] Lookup failed for: ${filePath}. Proceeding with fallback image.`);
        // Decide fallback based on requested width (if >= 800 it's likely a banner/wallpaper)
        const isWide = width && width >= 800;
        finalPath = path.resolve(process.cwd(), isWide ? 'res/templates/banner.png' : 'res/templates/cover.png');

        // If even the fallback is missing somehow, just return a 404 immediately
        if (!fs.existsSync(finalPath)) {
            return res.status(404).send('Not Found and no fallback available.');
        }
    }

    // Serving Logic
    if (width || height) {
        const ext = path.extname(finalPath) || '.png';

        // FIX: Use hash of full path + mtime + size to ensure uniqueness AND freshness
        // This prevents collisions and ensures updates are reflected immediately
        let stats;
        try {
            stats = fs.statSync(finalPath);
        } catch (e) {
            stats = { mtimeMs: 0, size: 0 };
        }

        let hash = 5381;
        // Include mtime, size, and cache version in the hash input
        const str = `${finalPath}_${stats.mtimeMs}_${stats.size}_${PROXY_CACHE_VERSION}`;

        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
        }
        const safeHash = (hash >>> 0).toString(36);

        const safeBase = path.basename(finalPath, ext).replace(/[^a-z0-9\-_]/gi, '_');
        const cacheFilename = `${safeBase}_${safeHash}_${width || 'auto'}x${height || 'auto'}${ext}`;
        const cacheDir = path.join(path.dirname(process.execPath), 'phantom_cache');
        const cachePath = path.join(cacheDir, cacheFilename);

        if (fs.existsSync(cachePath)) {
            return res.sendFile(cachePath);
        }

        if (!fs.existsSync(cacheDir)) {
            try { fs.mkdirSync(cacheDir, { recursive: true }); } catch (e) { }
        }

        try {
            if (!sharp) throw new Error("sharp is undefined");

            const metadata = await sharp(finalPath).metadata();
            const isAnimated = metadata.pages && metadata.pages > 1;

            if (isAnimated) {
                console.log(`[Proxy] Animation detected (frames: ${metadata.pages}). Bypassing resize for ${finalPath}`);
                return res.sendFile(finalPath);
            }

            let sharpInstance = sharp(finalPath, { animated: true });

            if (isAnimated) {
                // For animated images, always convert to WebP to save VRAM in Wallpaper Engine/CEF
                sharpInstance = sharpInstance.webp({ effort: 0 });
            }

            if (width && height) {
                sharpInstance = sharpInstance.resize(width, height, { fit: 'cover' });
            } else if (width) {
                sharpInstance = sharpInstance.resize(width, null);
            } else if (height) {
                sharpInstance = sharpInstance.resize(null, height);
            }

            await sharpInstance.toFile(cachePath);
            return res.sendFile(cachePath);
        } catch (e: any) {
            console.error(`[Proxy] Read/Resize Failed for ${finalPath}:`, e.message);
            return res.sendFile(finalPath, (err) => {
                if (err && !res.headersSent) res.status(404).send(`Not Found: ${finalPath}`);
            });
        }
    } else {
        return res.sendFile(finalPath, (err) => {
            if (err && !res.headersSent) res.status(404).send(`Not Found: ${finalPath}`);
        });
    }



    res.sendFile(finalPath);
});

// Helper to parse VDF simply using regex
const parseVdfPaths = (content: string): string[] => {
    const paths: string[] = [];
    const pathRegex = /"path"\s+"(.*?)"/g;
    let match;
    while ((match = pathRegex.exec(content)) !== null) {
        paths.push(match[1].replace(/\\\\/g, '\\'));
    }
    return paths;
};

const parseAcfManifest = (content: string) => {
    const appidMatch = content.match(/"appid"\s+"(\d+)"/);
    const nameMatch = content.match(/"name"\s+"(.*?)"/);
    const lastUpdatedMatch = content.match(/"LastUpdated"\s+"(\d+)"/);
    if (appidMatch && nameMatch) {
        return {
            appid: appidMatch[1],
            name: nameMatch[1],
            lastUpdated: lastUpdatedMatch ? parseInt(lastUpdatedMatch[1]) : 0
        };
    }
    return null;
};

// Endpoint to select a file via OS dialog
app.post('/api/select-folder', (req, res) => {
    console.log('[Server] Folder picker requested');
    const psScript = `
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.Description = "Select Folder via Phantom Launcher"
    $result = $f.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $f.SelectedPath
    }
} catch {
    Write-Error $_.Exception.Message
}
`;
    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    const command = `powershell -NoProfile -Sta -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('[Server] Folder picker exec error:', error);
            return res.status(500).json({ error: 'Failed to open dialog' });
        }
        const selectedPath = stdout.trim();
        res.json({ path: selectedPath || null });
    });
});

app.post('/api/select-file', (req, res) => {
    const { filter = 'exe', returnBase64 = false } = req.body;
    console.log(`[Server] File picker requested (filter: ${filter}, base64: ${returnBase64})`);

    let fileFilter = "All Files (*.*)|*.*";
    if (filter === 'exe') {
        fileFilter = "Executables (*.exe;*.bat;*.lnk;*.url)|*.exe;*.bat;*.lnk;*.url|All Files (*.*)|*.*";
    } else if (filter === 'image') {
        fileFilter = "Images (*.jpg;*.jpeg;*.png;*.webp;*.jfif)|*.jpg;*.jpeg;*.png;*.webp;*.jfif|All Files (*.*)|*.*";
    }

    const psScript = `
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Filter = "${fileFilter}"
    $f.Title = "Select File via Phantom Launcher"
    $f.InitialDirectory = [Environment]::GetFolderPath("Desktop")
    $f.DereferenceLinks = $false
    
    $result = $f.ShowDialog()
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $f.FileName
    }
} catch {
    Write-Error $_.Exception.Message
}
`;
    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    const command = `powershell -NoProfile -Sta -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('[Server] File picker exec error:', error);
            return res.status(500).json({ error: 'Failed to open dialog' });
        }
        const selectedPath = stdout.trim();
        if (!selectedPath) return res.json({ path: null });

        if (returnBase64) {
            try {
                const fileBuffer = fs.readFileSync(selectedPath);
                const ext = path.extname(selectedPath).toLowerCase().replace('.', '');
                const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
                const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
                res.json({ path: selectedPath, base64: base64Data });
            } catch (readError) {
                console.error('[Server] Base64 read error:', readError);
                res.status(500).json({ error: 'Failed to read file for Base64' });
            }
        } else {
            res.json({ path: selectedPath });
        }
    });
});

app.all('/api/steam/scan', async (req, res) => {
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

                            // Extract LastPlayed times
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

                // Process each game sequentially to avoid overwhelming Steam API
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
                                    const fullAssetDir = path.join(ASSETS_DIR, assetSubDir);
                                    if (!fs.existsSync(fullAssetDir)) fs.mkdirSync(fullAssetDir, { recursive: true });

                                    const dest = path.join(fullAssetDir, `${asset.type}${ext}`);
                                    gameObj[asset.type] = path.resolve(dest);

                                    // Background download/copy
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
        saveTagCache(); // Persist tags for next launch
        // Sort explicitly by our resolved lastUpdated value
        res.json({ games: games.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)) });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint to scan Xbox / Microsoft Store games
app.all('/api/xbox/scan', async (req, res) => {
    console.log('[Server] Scanning Xbox/Store games...');
    try {
        // Escape backslashes for PowerShell string
        const assetsDirPs = ASSETS_DIR.replace(/\\/g, '\\\\');

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
                $s.Arguments = "shell:AppsFolder\\" + $app.AppID
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
                        const fullAssetDir = path.join(ASSETS_DIR, assetSubDir);
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


app.post('/api/emu/scan', async (req, res) => {
    try {
        const { platformId, romsDir, emuExe, execArgs } = req.body;
        if (!platformId || !romsDir || !emuExe) {
            return res.status(400).json({ error: 'Missing platformId, romsDir or emuExe' });
        }

        const config = EMU_PLATFORMS[platformId];
        if (!config) return res.status(400).json({ error: 'Invalid platformId' });

        if (!fs.existsSync(romsDir)) return res.status(404).json({ error: 'ROMs directory not found' });

        const games: any[] = [];
        const shortcutTasks: { lnkPath: string, targetExe: string, args: string }[] = [];

        const scan = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);

                if (config.mode === 'FILE' && !stat.isDirectory()) {
                    const ext = path.extname(file).toLowerCase();
                    if (config.extensions.includes(ext)) {
                        if (platformId === 'nsw' && (file.includes('[UPD]') || file.includes('[v'))) continue;

                        const gameId = `emu_${platformId}_${slugify(file)}`;
                        const gameDir = path.join(ASSETS_DIR, gameId);
                        if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

                        const lnkPath = path.join(gameDir, 'launch.lnk');
                        const finalArgs = execArgs ? `${execArgs} "${fullPath}"` : `${config.defaultArgs} "${fullPath}"`;
                        shortcutTasks.push({ lnkPath, targetExe: emuExe, args: finalArgs });

                        games.push({
                            id: gameId,
                            title: cleanEmuTitle(file),
                            execPath: path.resolve(lnkPath),
                            source: 'emulator',
                            sourceId: platformId,
                            platform: platformId,
                            category: PLATFORM_NAMES[platformId] || platformId.toUpperCase()
                        });
                    }
                } else if (config.mode === 'FOLDER' && stat.isDirectory()) {
                    let folderArgs = `"${fullPath}"`;
                    let detectedTitle = cleanEmuTitle(file);

                    if (platformId === 'ps3') {
                        const sfoPath = path.join(fullPath, 'PS3_GAME', 'PARAM.SFO');
                        const sfoTitle = extractTitleFromSFO(sfoPath);
                        if (sfoTitle) detectedTitle = sfoTitle;
                        const eboot = path.join(fullPath, 'PS3_GAME', 'USRDIR', 'EBOOT.BIN');
                        if (fs.existsSync(eboot)) folderArgs = `"${eboot}"`;
                    } else if (platformId === 'ps4') {
                        const sfoPath = path.join(fullPath, 'sce_sys', 'param.sfo');
                        const sfoTitle = extractTitleFromSFO(sfoPath);
                        if (sfoTitle) detectedTitle = sfoTitle;
                    }

                    const gameId = `emu_${platformId}_${slugify(file)}`;
                    const gameDir = path.join(ASSETS_DIR, gameId);
                    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
                    const lnkPath = path.join(gameDir, 'launch.lnk');
                    shortcutTasks.push({ lnkPath, targetExe: emuExe, args: folderArgs });

                    games.push({
                        id: gameId,
                        title: detectedTitle,
                        execPath: path.resolve(lnkPath),
                        source: 'emulator',
                        platform: platformId
                    });
                } else if (stat.isDirectory()) {
                    scan(fullPath);
                }
            }
        };

        scan(romsDir);

        // Batch-create all shortcuts via PowerShell
        if (shortcutTasks.length > 0) {
            console.log(`[EmuScan] Creating ${shortcutTasks.length} shortcuts...`);
            const psLines = shortcutTasks.map(t => {
                const lnk = t.lnkPath.replace(/'/g, "''");
                const target = t.targetExe.replace(/'/g, "''");
                const args = t.args.replace(/'/g, "''");
                return `$s=$w.CreateShortcut('${lnk}');$s.TargetPath='${target}';$s.Arguments='${args}';$s.Save()`;
            });
            const psScript = `$w=New-Object -ComObject WScript.Shell\n${psLines.join('\n')}`;
            const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

            await new Promise<void>((resolve, reject) => {
                exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
                    { maxBuffer: 1024 * 1024 * 10 }, (err) => {
                        if (err) {
                            console.error('[EmuScan] Shortcut creation failed:', err.message);
                            reject(err);
                        } else {
                            console.log(`[EmuScan] ${shortcutTasks.length} shortcuts created`);
                            resolve();
                        }
                    });
            });
        }

        res.json({ games });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint to trigger missing assets fetch for a category
app.post('/api/assets/fetch-missing', async (req, res) => {
    try {
        const { categoryId } = req.body;
        const categories = db.getCategories();
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return res.status(404).json({ error: 'Category not found' });

        res.json({ success: true, count: cat.games.filter(g => !g.logo || !g.cover || !g.banner).length });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Endpoint to launch the file
app.post('/api/launch', (req, res) => {
    try {
        const { path: execPath, args: execArgs = '', gameId } = req.body;
        if (!execPath) return res.status(400).json({ error: 'No path provided' });
        console.log(`[Server] Executing: ${execPath} ${execArgs}`);

        // Update Last Played Timestamp
        if (gameId) {
            try {
                db.updateGameLastPlayed(gameId);
                console.log(`[Server] Updated lastPlayed for ${gameId} in DB`);
            } catch (err) {
                console.error('[Server] Failed to update lastPlayed:', err);
            }
        }

        if (execPath.startsWith('http') || execPath.startsWith('steam://')) {
            console.log(`[Launch] Protocol URL: ${execPath}`);
            exec(`start "" "${execPath}"`);
        } else if (execPath.startsWith('shell:AppsFolder')) {
            // UWP Apps: Launch via explorer.exe
            console.log(`[Launch] UWP/Store App: ${execPath}`);
            exec(`explorer.exe "${execPath}"`, (error) => {
                if (error) console.error('[Launch] Explorer failed:', error);
            });
        } else {
            // Launch via Shell.Application COM — equivalent to double-clicking
            console.log(`[Launch] Shell.Application: ${execPath}`);
            launchViaShell(execPath, execArgs);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[Server] Launch error', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Duplicate integrity endpoint removed

const findFrontend = () => {
    const exeDir = path.dirname(process.execPath);
    const localFront = path.join(exeDir, 'front');
    const possiblePaths = [localFront, path.join(exeDir, '..', 'front'), path.join(process.cwd(), 'phantom_app/front')];
    for (const p of possiblePaths) {
        if (fs.existsSync(p) && fs.existsSync(path.join(p, 'index.html'))) return p;
    }
    return null;
};

const frontPath = findFrontend();
if (frontPath) {
    app.use(express.static(frontPath));
    app.get(/^(?!\/api).+/, (req, res) => res.sendFile(path.join(frontPath, 'index.html')));
} else {
    app.get('/', (req, res) => res.send(`Phantom Server Running.<br>Frontend NOT FOUND.`));
}

// --- Phase 5: Auto-Synchronization Engine (SSE + Chokidar) ---
let sseClients: any[] = [];

app.get('/api/sync/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);
    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

const broadcastSyncEvent = (eventData: any) => {
    sseClients.forEach(client => client.write(`data: ${JSON.stringify(eventData)}\n\n`));
};

try {
    const steamConfigPath = 'C:/Program Files (x86)/Steam/userdata/*/config/grid';
    const watchPaths = [ASSETS_DIR, steamConfigPath];

    console.log(`[Sync] Mounting Chokidar Sentry on:`);
    watchPaths.forEach(p => console.log(`  -> ${p}`));

    chokidar.watch(watchPaths, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        ignoreInitial: true,
        depth: 5
    }).on('all', (event, filePath) => {
        if (['add', 'change', 'unlink'].includes(event)) {
            if (filePath.match(/\.(png|jpg|jpeg|webp)$/i)) {
                console.log(`[Sync] Triggered SSE Push. File changed: ${filePath}`);
                // Debounce could be added here if multiple rapid firing events occur
                broadcastSyncEvent({ type: 'ASSET_CHANGED', path: filePath, event });
            }
        }
    }).on('error', (error: any) => {
        console.error(`[Sync] Chokidar Watcher Error:`, error.message);
    });
} catch (e: any) {
    console.error('[Sync] Sentry mount failed:', e.message);
}

app.listen(port, '127.0.0.1', () => console.log(`[Server] Phantom Launcher Backend running at http://127.0.0.1:${port} (VERSION: SHORTCUTS ENABLED)`));
