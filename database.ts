import fs from 'fs';
import path from 'path';

import { createRequire } from 'node:module';

// Dynamic import for better-sqlite3 using createRequire for Node SEA compatibility
const isExe = process.execPath.toLowerCase().endsWith('phantomserver.exe');
const requireFunc = isExe ? createRequire(process.execPath) : (typeof require !== 'undefined' ? require : eval('require'));

let Database: any = null;
try {
    const exeDir = isExe ? path.dirname(process.execPath) : process.cwd();
    const dbPathModule = path.join(exeDir, 'node_modules', 'better-sqlite3');
    Database = requireFunc(dbPathModule);
} catch (e) {
    console.error("FATAL: First absolute load failed for better-sqlite3:", e);
    try {
        Database = requireFunc('better-sqlite3');
    } catch (e2) {
        console.error("FATAL: Could not load better-sqlite3 module.", e2);
    }
}

export class AppDatabase {
    private db: any;

    constructor(dbPath: string) {
        if (!Database) throw new Error("SQLite Database module not loaded");
        this.db = new Database(dbPath);
        this.initSchema();
    }

    private initSchema() {
        this.db.pragma('journal_mode = WAL'); // Better performance and concurrency

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS Categories (
                id TEXT PRIMARY KEY,
                name TEXT,
                icon TEXT,
                color TEXT,
                enabled INTEGER,
                sortOrder INTEGER,
                wallpaper TEXT,
                wallpaperMode TEXT,
                gridOpacity REAL,
                cardOpacity REAL,
                cardBlurEnabled INTEGER,
                cardTransparencyEnabled INTEGER,
                innerGlowEnabled INTEGER,
                outerGlowEnabled INTEGER,
                lowResWallpaper INTEGER,
                wallpaperAAEnabled INTEGER,
                highQualityBlobs INTEGER,
                configIcon TEXT,
                bgAnimationsEnabled INTEGER,
                gridEnabled INTEGER,
                scanlineEnabled INTEGER,
                vignetteEnabled INTEGER,
                performanceMode TEXT,
                assetColor TEXT,
                nodeColor TEXT,
                syncColor TEXT,
                coreColor TEXT,
                slimModeEnabled INTEGER,
                monochromeModeEnabled INTEGER
            );
            
            CREATE TABLE IF NOT EXISTS Games (
                id TEXT PRIMARY KEY,
                title TEXT,
                execPath TEXT,
                source TEXT,
                lastPlayed TEXT,
                lastUpdated INTEGER,
                cover TEXT,
                banner TEXT,
                logo TEXT,
                hero TEXT,
                installDate TEXT
            );

            CREATE TABLE IF NOT EXISTS CategoryGames (
                categoryId TEXT,
                gameId TEXT,
                PRIMARY KEY (categoryId, gameId),
                FOREIGN KEY(categoryId) REFERENCES Categories(id) ON DELETE CASCADE,
                FOREIGN KEY(gameId) REFERENCES Games(id) ON DELETE CASCADE
            );
        `);

        // Migration: Add missing columns if they don't exist (Safer than wipe)
        const columns = this.db.prepare("PRAGMA table_info(Categories)").all();
        const hasColumn = (name: string) => columns.some((c: any) => c.name === name);

        const newCols = [
            ['wallpaper', 'TEXT'], ['wallpaperMode', 'TEXT'], ['gridOpacity', 'REAL'], ['cardOpacity', 'REAL'],
            ['cardBlurEnabled', 'INTEGER'], ['cardTransparencyEnabled', 'INTEGER'], ['innerGlowEnabled', 'INTEGER'],
            ['outerGlowEnabled', 'INTEGER'], ['lowResWallpaper', 'INTEGER'], ['wallpaperAAEnabled', 'INTEGER'],
            ['highQualityBlobs', 'INTEGER'], ['configIcon', 'TEXT'], ['bgAnimationsEnabled', 'INTEGER'],
            ['gridEnabled', 'INTEGER'], ['scanlineEnabled', 'INTEGER'], ['vignetteEnabled', 'INTEGER'],
            ['performanceMode', 'TEXT'], ['assetColor', 'TEXT'], ['nodeColor', 'TEXT'], ['syncColor', 'TEXT'],
            ['coreColor', 'TEXT'], ['slimModeEnabled', 'INTEGER'], ['monochromeModeEnabled', 'INTEGER']
        ];

        newCols.forEach(([name, type]) => {
            if (!hasColumn(name)) {
                try {
                    this.db.prepare(`ALTER TABLE Categories ADD COLUMN ${name} ${type}`).run();
                } catch (e) { console.error(`Failed to add column ${name}:`, e); }
            }
        });
    }

    public migrateFromJson(jsonPath: string) {
        if (!fs.existsSync(jsonPath)) return;

        try {
            console.log('[DB] Found legacy data.json. Starting migration to SQLite...');
            const rawData = fs.readFileSync(jsonPath, 'utf-8');
            if (!rawData.trim()) return;
            const data = JSON.parse(rawData);

            let categories = [];
            if (data.categories) {
                categories = data.categories;
            } else if (Array.isArray(data)) {
                // very old legacy 
                categories = [{ id: 'all', name: 'ALL GAMES', icon: 'grid', color: '#ffffff', enabled: true, games: data }];
            }

            if (categories.length > 0) {
                this.saveCategories(categories);
                fs.renameSync(jsonPath, jsonPath + '.bak');
                console.log('[DB] Migration complete. data.json renamed to data.json.bak');
            } else {
                // Empty categories but file exists, rename to avoid future attempts
                fs.renameSync(jsonPath, jsonPath + '.bak');
            }
        } catch (e) {
            console.error('[DB] Migration failed:', e);
            // Rename to error to prevent crash loops
            try { fs.renameSync(jsonPath, jsonPath + '.err'); } catch (e2) { }
        }
    }

    public getCategories(): any[] {
        const cats = this.db.prepare('SELECT * FROM Categories ORDER BY sortOrder ASC').all();
        const gamesStmt = this.db.prepare(`
            SELECT g.* FROM Games g
            JOIN CategoryGames cg ON g.id = cg.gameId
            WHERE cg.categoryId = ?
        `);

        return cats.map((cat: any) => {
            const games = gamesStmt.all(cat.id).map((g: any) => ({
                ...g,
                // SQLite returns 0/1 for booleans, map them back
                enabled: g.enabled === 1
            }));
            return {
                id: cat.id,
                name: cat.name,
                icon: cat.icon,
                color: cat.color,
                enabled: cat.enabled === 1,
                wallpaper: cat.wallpaper,
                wallpaperMode: cat.wallpaperMode,
                gridOpacity: cat.gridOpacity,
                cardOpacity: cat.cardOpacity,
                cardBlurEnabled: cat.cardBlurEnabled === 1,
                cardTransparencyEnabled: cat.cardTransparencyEnabled === 1,
                innerGlowEnabled: cat.innerGlowEnabled === 1,
                outerGlowEnabled: cat.outerGlowEnabled === 1,
                lowResWallpaper: cat.lowResWallpaper === 1,
                wallpaperAAEnabled: cat.wallpaperAAEnabled === 1,
                highQualityBlobs: cat.highQualityBlobs === 1,
                configIcon: cat.configIcon,
                bgAnimationsEnabled: cat.bgAnimationsEnabled === 1,
                gridEnabled: cat.gridEnabled === 1,
                scanlineEnabled: cat.scanlineEnabled === 1,
                vignetteEnabled: cat.vignetteEnabled === 1,
                performanceMode: cat.performanceMode,
                assetColor: cat.assetColor,
                nodeColor: cat.nodeColor,
                syncColor: cat.syncColor,
                coreColor: cat.coreColor,
                slimModeEnabled: cat.slimModeEnabled === 1,
                monochromeModeEnabled: cat.monochromeModeEnabled === 1,
                games
            };
        });
    }

    public saveCategories(categories: any[]) {
        const tx = this.db.transaction(() => {
            // Because categories are small and we want an exact mirror of the frontend state, 
            // a clear and rewrite is the most robust way to ensure synchronization in a local app.
            this.db.prepare('DELETE FROM CategoryGames').run();
            this.db.prepare('DELETE FROM Categories').run();
            this.db.prepare('DELETE FROM Games').run();

            const insertCat = this.db.prepare(`
                INSERT INTO Categories (
                    id, name, icon, color, enabled, sortOrder, 
                    wallpaper, wallpaperMode, gridOpacity, cardOpacity, 
                    cardBlurEnabled, cardTransparencyEnabled, innerGlowEnabled, 
                    outerGlowEnabled, lowResWallpaper, wallpaperAAEnabled, 
                    highQualityBlobs, configIcon, bgAnimationsEnabled, 
                    gridEnabled, scanlineEnabled, vignetteEnabled, 
                    performanceMode, assetColor, nodeColor, syncColor, 
                    coreColor, slimModeEnabled, monochromeModeEnabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const insertGame = this.db.prepare('INSERT OR IGNORE INTO Games (id, title, execPath, source, lastPlayed, lastUpdated, cover, banner, logo, hero, installDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            const insertRelation = this.db.prepare('INSERT INTO CategoryGames (categoryId, gameId) VALUES (?, ?)');

            categories.forEach((cat, index) => {
                insertCat.run(
                    cat.id, cat.name, cat.icon || '', cat.color || '#fff', cat.enabled ? 1 : 0, index,
                    cat.wallpaper || null, cat.wallpaperMode || 'cover', cat.gridOpacity ?? 0.15, cat.cardOpacity ?? 0.7,
                    cat.cardBlurEnabled ? 1 : 0, cat.cardTransparencyEnabled ? 1 : 0, cat.innerGlowEnabled ? 1 : 0,
                    cat.outerGlowEnabled ? 1 : 0, cat.lowResWallpaper ? 1 : 0, cat.wallpaperAAEnabled ? 1 : 0,
                    cat.highQualityBlobs ? 1 : 0, cat.configIcon || null, cat.bgAnimationsEnabled ? 1 : 0,
                    cat.gridEnabled ? 1 : 0, cat.scanlineEnabled ? 1 : 0, cat.vignetteEnabled ? 1 : 0,
                    cat.performanceMode || 'high', cat.assetColor || null, cat.nodeColor || null, cat.syncColor || null,
                    cat.coreColor || null, cat.slimModeEnabled ? 1 : 0, cat.monochromeModeEnabled ? 1 : 0
                );
                if (Array.isArray(cat.games)) {
                    cat.games.forEach((g: any) => {
                        insertGame.run(
                            g.id, g.title, g.execPath || '', g.source || '', g.lastPlayed || '', g.lastUpdated || 0,
                            g.cover || '', g.banner || '', g.logo || '', g.hero || '', g.installDate || ''
                        );
                        insertRelation.run(cat.id, g.id);
                    });
                }
            });
        });
        tx();
    }

    public updateGameLastPlayed(gameId: string) {
        const timestamp = new Date().toISOString();
        this.db.prepare('UPDATE Games SET lastPlayed = ? WHERE id = ?').run(timestamp, gameId);
    }

    public deleteGame(gameId: string) {
        // Since we have ON DELETE CASCADE, CategoryGames is cleaned automatically
        this.db.prepare('DELETE FROM Games WHERE id = ?').run(gameId);
    }

    public wipeData() {
        this.db.prepare('DELETE FROM CategoryGames').run();
        this.db.prepare('DELETE FROM Categories').run();
        this.db.prepare('DELETE FROM Games').run();
    }
}
