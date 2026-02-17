import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import Link from 'react'; // Dummy import
// standard jimp import for v0.x
import Jimp from 'jimp';

const __filename = '';
const __dirname = path.resolve();

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

// Ensure data.json exists with CORRECT structure
if (!fs.existsSync(DATA_FILE) || fs.readFileSync(DATA_FILE, 'utf-8').trim() === '') {
    console.log('[Init] Creating initial data.json with default categories...');
    const defaultData = {
        categories: [
            { id: 'all', name: 'ALL GAMES', icon: 'grid', color: '#ffffff', games: [], enabled: true },
            { id: 'favorites', name: 'FAVORITES', icon: 'heart', color: '#ff4444', games: [], enabled: true }
        ]
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
}

// Image Processor for standardizing dimensions
const processImage = async (input: string | Buffer, dest: string, type: string): Promise<string> => {
    console.log(`[Jimp] Processing ${type} -> ${dest}`);
    try {
        const image = await Jimp.read(input as any);

        if (type === 'cover') {
            // Vertical Grid: 600x900 (Fill/Cover)
            image.cover(600, 900);
        } else if (type === 'banner') {
            // Horizontal Grid: 920x430 (Fill/Cover)
            image.cover(920, 430);
        } else if (type === 'logo') {
            // Logo: Match contain logic - check dimensions
            const w = image.bitmap.width;
            const h = image.bitmap.height;
            const ratio = Math.min(800 / w, 800 / h, 1);
            if (ratio < 1) {
                image.resize(Math.round(w * ratio), Math.round(h * ratio));
            }
        }

        // Quality optimization and save
        await image.writeAsync(dest);
        return dest;
    } catch (e: any) {
        console.error(`[Jimp] Final error on ${dest}:`, e.message);
        // Fallback: if jimp fails but we have the file, just move it
        if (typeof input === 'string' && fs.existsSync(input) && input !== dest) {
            fs.copyFileSync(input, dest);
        }
        return dest;
    }
};

// Download Helper for Offline protocol
const downloadImage = (url: string, dest: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        // We always re-download if we want to process it, but here we'll just check existence for simplicity in Steam scan
        if (dest.includes('steam_') && fs.existsSync(dest)) return resolve(dest);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to download: ${response.statusCode}`));
            }
            const chunks: any[] = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const buffer = Buffer.concat(chunks);
                fs.writeFileSync(dest, buffer);
                resolve(dest);
            });
        }).on('error', reject);
    });
};

// Local Steam Asset Crawler
const findLocalSteamAsset = (appId: string, type: 'cover' | 'banner' | 'logo' | 'hero'): string | null => {
    const steamPath = 'C:\\Program Files (x86)\\Steam';
    const filenameMap = {
        cover: `${appId}_library_600x900.jpg`,
        banner: `${appId}_header.jpg`,
        logo: `${appId}_logo.png`,
        hero: `${appId}_library_hero.jpg`
    };
    const targetFile = filenameMap[type];

    // Priority 1: userdata/*/config/grid (User custom artwork)
    const userdataDir = path.join(steamPath, 'userdata');
    if (fs.existsSync(userdataDir)) {
        const users = fs.readdirSync(userdataDir);
        for (const user of users) {
            const gridDir = path.join(userdataDir, user, 'config', 'grid');
            const localPath = path.join(gridDir, targetFile);
            if (fs.existsSync(localPath)) return localPath;
        }
    }

    // Priority 2: appcache/librarycache (Official Steam cache)
    const libraryCache = path.join(steamPath, 'appcache', 'librarycache', targetFile);
    if (fs.existsSync(libraryCache)) return libraryCache;

    return null;
};

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
        if (!fs.existsSync(DATA_FILE)) return res.json({ categories: [] });
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsedData = JSON.parse(data);

        // Return the full object if it exists, legacy support for games array if needed
        if (Array.isArray(parsedData)) {
            return res.json({ categories: [{ id: 'all', name: 'ALL GAMES', games: parsedData, enabled: true }] });
        }
        res.json(parsedData.categories || []);
    } catch (e) {
        console.error('[Data] Load error:', e);
        res.status(500).json({ error: 'Failed to read data' });
    }
});

// Save Launcher Data
app.post('/api/data', (req, res) => {
    try {
        // req.body should be the CATEGORIES array
        const categories = req.body;
        if (!Array.isArray(categories)) {
            return res.status(400).json({ error: 'Body must be a categories array' });
        }

        const dataToSave = { categories };
        fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
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
    const { gameId, type } = req.params; // type: 'grid' | 'hero' | 'logo'

    // Unified Grid logic: Both 'grid' and 'hero' now pull from the 'grids' endpoint
    // but filter by the targeted aspect ratios/dimensions.
    let endpointType = 'grids';
    let styleQuery = '';

    if (type === 'grid') {
        // Vertical Grids (Portrait)
        styleQuery = '?styles=alternate,blurred,material';
    } else if (type === 'hero') {
        // Horizontal Grids (Landscape)
        styleQuery = '?styles=alternate,blurred,material';
    } else if (type === 'logo') {
        endpointType = 'logos';
        styleQuery = '';
    } else if (type === 'icon') {
        endpointType = 'icons';
        styleQuery = '';
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
                if (json.success && json.data && (type === 'grid' || type === 'hero')) {
                    // Filter Grids by Aspect Ratio instead of strict dimensions
                    json.data = json.data.filter((asset: any) => {
                        const isVertical = asset.height > asset.width;
                        return type === 'grid' ? isVertical : !isVertical;
                    });
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

        // Standardize extensions for processed files
        const processedExt = assetType === 'logo' ? '.png' : '.jpg';
        const targetPath = path.join(gameDir, `${assetType}${processedExt}`);
        const tempPath = path.join(gameDir, `_temp_${assetType}${processedExt}`);

        if (sourcePath.startsWith('http')) {
            console.log(`[Assets] Downloading & Resizing URL: ${sourcePath}`);
            await downloadImage(sourcePath, tempPath);
            await processImage(tempPath, targetPath, assetType);
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            res.json({ path: path.resolve(targetPath) });
        } else if (['.exe', '.lnk', '.bat', '.url'].includes(path.extname(sourcePath).toLowerCase())) {
            // Handle shortcuts
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
        // 1. Update data.json
        const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        const newData = data.filter((g: any) => g.id !== gameId);
        fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));

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

// System Wipe (Factory Reset)
app.post('/api/system/wipe', (req, res) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
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
    console.log('[FS_EXPLORER] Listing logical drives...');
    exec('powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"', (error, stdout) => {
        if (error) {
            console.error('[FS_EXPLORER] Failed to list drives:', error.message);
            return res.status(500).json({ error: 'Failed to list drives' });
        }

        const drives = stdout.split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0 && line.includes(':'))
            .map(line => line.endsWith('\\') ? line : line + '\\');

        const psFolders = "$f=@{}; " +
            "$f.Desktop=[Environment]::GetFolderPath('Desktop'); " +
            "$f.Documents=[Environment]::GetFolderPath('MyDocuments'); " +
            "$f.Pictures=[Environment]::GetFolderPath('MyPictures'); " +
            "$f.Music=[Environment]::GetFolderPath('MyMusic'); " +
            "$f.Videos=[Environment]::GetFolderPath('MyVideos'); " +
            "$f.Downloads=(New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path; " +
            "$f | ConvertTo-Json";

        exec(`powershell -Command "${psFolders}"`, (psError, psStdout) => {
            let libraries: { name: string, path: string }[] = [];
            if (psStdout) {
                try {
                    const resolved = JSON.parse(psStdout);
                    libraries = Object.entries(resolved)
                        .map(([name, path]: [string, any]) => ({
                            name,
                            path: path ? (String(path).endsWith('\\') ? String(path) : String(path) + '\\') : ''
                        }))
                        .filter(lib => lib.path && lib.path.length > 1);
                } catch (e) {
                    console.error('[FS_EXPLORER] Failed to parse library paths:', e);
                }
            }
            res.json({ drives, libraries });
        });
    });
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

    // 4. HAIL MARY: If lookups fail, try the first reasonable candidate anyway
    if (!finalPath) {
        console.warn(`[Proxy] Lookup failed for: ${filePath}. Candidates: ${JSON.stringify(candidates)}`);
        finalPath = candidates[0];
        console.warn(`[Proxy] Attempting Blind Read on: ${finalPath}`);
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
        // Include mtime and size in the hash input
        const str = `${finalPath}_${stats.mtimeMs}_${stats.size}`;

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
            if (!Jimp) throw new Error("Jimp is undefined");

            const image = await Jimp.read(finalPath);

            if (width && height) image.cover(width, height);
            else if (width) image.resize(width, Jimp.AUTO);
            else if (height) image.resize(Jimp.AUTO, height);

            await image.writeAsync(cachePath);
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
    if (appidMatch && nameMatch) {
        return {
            appid: appidMatch[1],
            name: nameMatch[1]
        };
    }
    return null;
};

// Endpoint to select a file via OS dialog
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

// Endpoint to scan Steam libraries
app.all('/api/steam/scan', async (req, res) => {
    console.log('[Server] Scanning Steam libraries...');
    try {
        const { includeHidden = false, includeSoftware = false } = req.body || {};
        const vdfPath = 'C:\\Program Files (x86)\\Steam\\config\\libraryfolders.vdf';

        if (!fs.existsSync(vdfPath)) {
            return res.status(404).json({ error: 'Steam config not found at default location' });
        }

        const hiddenAppIds = new Set<string>();
        const softwareAppIds = new Set<string>([
            '214850', '250820', '365670', '1486350', '431960', '388080', '993090', '331200', '228980'
        ]);

        try {
            const userdataRoot = 'C:\\Program Files (x86)\\Steam\\userdata';
            if (fs.existsSync(userdataRoot)) {
                const users = fs.readdirSync(userdataRoot);
                for (const user of users) {
                    const sharedConfigPath = path.join(userdataRoot, user, '7', 'remote', 'sharedconfig.vdf');
                    if (fs.existsSync(sharedConfigPath)) {
                        const content = fs.readFileSync(sharedConfigPath, 'utf-8');
                        const appsBlockRegex = /"apps"\s*\{([\s\S]*?)\}\s*\}/;
                        const appsMatch = content.match(appsBlockRegex);
                        if (appsMatch) {
                            const appSectionRegex = /"(\d+)"\s*\{([\s\S]*?)\}/g;
                            let appMatch;
                            while ((appMatch = appSectionRegex.exec(appsMatch[1])) !== null) {
                                if (appMatch[2].toLowerCase().includes('"hidden"')) {
                                    hiddenAppIds.add(appMatch[1]);
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('[Server] Failed to parse hidden apps:', e);
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
                                const isSoftware = softwareAppIds.has(info.appid) ||
                                    softwareKeywords.some(kw => info.name.toLowerCase().includes(kw.toLowerCase())) ||
                                    softwareKeywords.some(kw => file.toLowerCase().includes(kw.toLowerCase()));
                                if (!includeSoftware && isSoftware) continue;
                                const isHidden = hiddenAppIds.has(info.appid);
                                if (!includeHidden && isHidden) continue;

                                const gameId = `steam_${info.appid}`;
                                const gameDir = path.join(ASSETS_DIR, gameId);
                                if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

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
                                    source: 'steam'
                                };

                                for (const asset of steamAssets) {
                                    const source = asset.local || asset.remote;
                                    const ext = source.toLowerCase().includes('.png') ? '.png' : '.jpg';
                                    const dest = path.join(gameDir, `${asset.type}${ext}`);

                                    // Assign resolved path to game object
                                    gameObj[asset.type] = path.resolve(dest);

                                    // Background process: download/copy
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
        res.json({ games });
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
            }
        }
    }
}
$games | ConvertTo-Json -Depth 2
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
                    const gameDir = path.join(ASSETS_DIR, gameId);
                    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
                    let localLogoPath = null;
                    if (g.Logo && (fs.existsSync(g.Logo))) {
                        const logoDestPng = path.join(gameDir, 'logo.png');
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

// Endpoint to launch the file
app.post('/api/launch', (req, res) => {
    try {
        const { path: execPath, args: execArgs = '', gameId } = req.body;
        if (!execPath) return res.status(400).json({ error: 'No path provided' });
        console.log(`[Server] Executing: ${execPath} ${execArgs}`);

        // Update Last Played Timestamp
        if (gameId) {
            try {
                const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
                let gameFound = false;

                // Loop through categories to find the game
                for (const cat of data.categories) {
                    const game = cat.games.find((g: any) => g.id === gameId);
                    if (game) {
                        game.lastPlayed = new Date().toISOString();
                        gameFound = true;
                        // Don't break, game might be in multiple categories (though id should be unique per game object instance, 
                        // but conceptual game is same. references might differ if we duplicated objects. 
                        // System currently duplicates game objects in categories. We should update all instances.)
                    }
                }

                if (gameFound) {
                    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
                    console.log(`[Server] Updated lastPlayed for ${gameId}`);
                }
            } catch (err) {
                console.error('[Server] Failed to update lastPlayed:', err);
            }
        }

        if (execPath.startsWith('http') || execPath.startsWith('steam://')) {
            exec(`start "" "${execPath}"`);
        } else if (execPath.startsWith('shell:AppsFolder')) {
            // UWP Apps: Launch via explorer.exe
            console.log(`[Launch] Executing via Explorer: ${execPath}`);
            // Note: shell apps usually don't take traditional args this way, but we keep it for consistency
            exec(`explorer.exe "${execPath}"`, (error) => {
                if (error) console.error('[Launch] Explorer failed:', error);
            });
        } else {
            // Standard executables
            const fullCommand = execArgs ? `start "" "${execPath}" ${execArgs}` : `start "" "${execPath}"`;
            exec(fullCommand);
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[Server] Launch error', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

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

app.listen(port, () => console.log(`[Server] Phantom Launcher Backend running at http://localhost:${port} (VERSION: SHORTCUTS ENABLED)`));
