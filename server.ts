import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { AppDatabase } from './database.js';
import chokidar from 'chokidar';

import { ServerContext } from './server/context.js';
import { launchViaShell } from './server/launchUtils.js';
import { createSteamRoutes } from './server/routes/steamRoutes.js';
import { createXboxRoutes } from './server/routes/xboxRoutes.js';
import { createEmuRoutes } from './server/routes/emuRoutes.js';
import { createDataRoutes } from './server/routes/dataRoutes.js';
import { createAssetRoutes } from './server/routes/assetRoutes.js';
import { createFileRoutes } from './server/routes/fileRoutes.js';
import { createProxyRoutes } from './server/routes/proxyRoutes.js';
import { setupSyncEngine } from './server/syncEngine.js';

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
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 1. DYNAMIC BASE DIRECTORY (Handles Dev vs Prod EXE)
const isExe = process.execPath.toLowerCase().endsWith('phantomserver.exe');
const BASE_DIR = isExe ? path.dirname(process.execPath) : process.cwd();

const DATA_FILE = path.join(BASE_DIR, 'data.json');
const STORAGE_DIR = path.join(BASE_DIR, 'storage');
const ASSETS_DIR = path.join(STORAGE_DIR, 'assets');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');

console.log(`[Server] Environment: ${isExe ? 'PACKAGE_EXE' : 'NODE_DEV'}`);
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

// Robust Initialization: Ensure "ALL GAMES" exists
const categories = db.getCategories();
const hasAll = categories.some(c => c.id === 'all');

if (!hasAll) {
    console.log('[Init] Creating mandatory "ALL GAMES" category...');
    db.saveCategories([
        ...categories,
        { id: 'all', name: 'ALL GAMES', icon: './res/ui/all.png', color: '#ffffff', games: [], enabled: true }
    ]);
}

// Cleanup: Remove legacy favorites category if it exists
if (categories.some(c => c.id === 'favorites')) {
    console.log('[Cleanup] Removing legacy favorites category...');
    db.saveCategories(db.getCategories().filter(c => c.id !== 'favorites'));
}

// Create shared context for route modules
const ctx: ServerContext = { db, ASSETS_DIR, STORAGE_DIR, CONFIG_FILE, BASE_DIR, slugify };

// Mount route modules
app.use('/api/steam', createSteamRoutes(ctx));
app.use('/api/xbox', createXboxRoutes(ctx));
app.use('/api/emu', createEmuRoutes(ctx));
app.use('/api', createDataRoutes(ctx));
app.use('/api/assets', createAssetRoutes(ctx));
app.use('/api/games', createAssetRoutes(ctx)); // Alias for backward compatibility
app.use('/api/system', createAssetRoutes(ctx)); // Alias
app.use('/api/files', createFileRoutes(ctx));
app.use('/api', createFileRoutes(ctx)); // For top-level picks (select-folder, select-file)
app.use('/api', createProxyRoutes(ctx));

// --- Core System Endpoints ---

// Health Check for Frontend
app.get('/api/health', (req, res) => {
    res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Endpoint to launch the file
app.post('/api/launch', (req, res) => {
    try {
        const { path: execPath, args: execArgs = '', gameId, romPath } = req.body as { path: string, args: string, gameId?: string, romPath?: string };
        if (!execPath) return res.status(400).json({ error: 'No path provided' });

        let finalArgs = execArgs;

        // 1. Resolve Variables: Replace common placeholders if data is available
        if (romPath) {
            finalArgs = finalArgs.replace(/%ROM%/g, romPath);
            finalArgs = finalArgs.replace(/%EXEC_DIR%/g, path.dirname(romPath));
        }

        // 2. Emulator Shortcut Redundancy Guard:
        // If the target is a .lnk (internal emulator shortcut) and it STILL contains %ROM%,
        // it means replacement failed or the user is launching a raw scan template.
        // We clear finalArgs here because the .lnk itself ALREADY contains the correctly resolved target+args+rom.
        // Passing them again results in double-arguments (e.g. PCSX2 fails as it thinks flags are part of filename).
        if (execPath.toLowerCase().endsWith('.lnk') && finalArgs.includes('%ROM%')) {
            console.log(`[Server] Detected internal .lnk launch for ${gameId}. Clearing redundant template args.`);
            finalArgs = '';
        }

        console.log(`[Server] Final Execution: ${execPath} ${finalArgs}`);

        if (gameId) {
            try {
                db.updateGameLastPlayed(gameId);
                console.log(`[Server] Updated lastPlayed for ${gameId} in DB`);
                (app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
            } catch (err) {
                console.error('[Server] Failed to update lastPlayed:', err);
            }
        }

        if (execPath.startsWith('http') || execPath.startsWith('steam://')) {
            exec(`start "" "${execPath}"`);
        } else {
            launchViaShell(execPath, finalArgs);
            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });
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

// --- Setup Auto-Synchronization Engine ---
setupSyncEngine(ctx, app);

app.listen(port, () => console.log(`[Server] Phantom Launcher Backend running at http://0.0.0.0:${port}`));
