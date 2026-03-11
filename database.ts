import fs from 'fs';
import path from 'path';

import { createRequire } from 'node:module';

// Dynamic import for better-sqlite3 using createRequire for Node SEA compatibility
const isExe = process.execPath.toLowerCase().endsWith('phantomserver.exe');

// Robust require for both ESM (ts-node) and CJS (bundled)
let requireFunc: any;
if (isExe) {
    // In SEA, createRequire(process.execPath) allows loading modules relative to the EXE
    requireFunc = createRequire(process.execPath);
} else {
    try {
        // @ts-ignore
        requireFunc = require;
    } catch (e) {
        requireFunc = createRequire(import.meta.url);
    }
}

let Database: any = null;
try {
    const exeDir = isExe ? path.dirname(process.execPath) : process.cwd();
    // In SEA, we need to point to the external node_modules folder
    const dbPathModule = path.join(exeDir, 'node_modules', 'better-sqlite3');
    Database = requireFunc(dbPathModule);
} catch (e) {
    if (isExe) console.error("FATAL: First absolute load failed for better-sqlite3:", e);
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
        this.db.pragma('foreign_keys = ON'); // Enforce relations

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
                configColor TEXT,
                secretColor TEXT,
                slimModeEnabled INTEGER,
                monochromeModeEnabled INTEGER,
                outlineEnabled INTEGER,
                primingAnimation TEXT
            );
            
            CREATE TABLE IF NOT EXISTS Games (
                id TEXT PRIMARY KEY,
                title TEXT,
                execPath TEXT,
                source TEXT,
                sourceId TEXT,
                platform TEXT,
                category TEXT,
                lastPlayed TEXT,
                lastUpdated INTEGER,
                cover TEXT,
                banner TEXT,
                logo TEXT,
                wallpaper TEXT,
                installDate TEXT,
                execArgs TEXT
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
            ['coreColor', 'TEXT'], ['configColor', 'TEXT'], ['secretColor', 'TEXT'],
            ['slimModeEnabled', 'INTEGER'], ['monochromeModeEnabled', 'INTEGER'], ['outlineEnabled', 'INTEGER'],
            ['primingAnimation', 'TEXT']
        ];

        newCols.forEach(([name, type]) => {
            if (!hasColumn(name)) {
                try {
                    this.db.prepare(`ALTER TABLE Categories ADD COLUMN ${name} ${type}`).run();
                } catch (e) { console.error(`Failed to add column ${name}:`, e); }
            }
        });

        const gameColumns = this.db.prepare("PRAGMA table_info(Games)").all();
        const hasGameColumn = (name: string) => gameColumns.some((c: any) => c.name === name);
        ['execArgs', 'sourceId', 'platform', 'category', 'cover', 'banner', 'logo', 'wallpaper', 'installDate'].forEach(col => {
            if (!hasGameColumn(col)) {
                try {
                    this.db.prepare(`ALTER TABLE Games ADD COLUMN ${col} TEXT`).run();
                } catch (e) { console.error(`Failed to add ${col} column to Games:`, e); }
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
            let games;
            if (cat.id === 'all') {
                games = this.db.prepare('SELECT * FROM Games').all().map((g: any) => ({
                    ...g,
                    enabled: true
                }));
            } else {
                games = gamesStmt.all(cat.id).map((g: any) => ({
                    ...g,
                    enabled: true
                }));
            }
            return {
                ...cat,
                enabled: cat.enabled === 1,
                games
            };
        });
    }

    public saveCategories(categories: any[]) {
        const tx = this.db.transaction(() => {
            const insertCat = this.db.prepare(`
                INSERT OR REPLACE INTO Categories (
                    id, name, icon, color, enabled, sortOrder, 
                    wallpaper, wallpaperMode, gridOpacity, cardOpacity, 
                    cardBlurEnabled, cardTransparencyEnabled, innerGlowEnabled, 
                    outerGlowEnabled, lowResWallpaper, wallpaperAAEnabled, 
                    highQualityBlobs, configIcon, bgAnimationsEnabled, 
                    gridEnabled, scanlineEnabled, vignetteEnabled, 
                    performanceMode, assetColor, nodeColor, syncColor, 
                    coreColor, configColor, secretColor, 
                    slimModeEnabled, monochromeModeEnabled, outlineEnabled, primingAnimation
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const insertGame = this.db.prepare(`
                INSERT INTO Games (
                    id, title, execPath, source, sourceId, platform, category, 
                    lastPlayed, lastUpdated, cover, banner, logo, wallpaper, 
                    installDate, execArgs
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    execPath=excluded.execPath,
                    source=excluded.source,
                    sourceId=excluded.sourceId,
                    platform=excluded.platform,
                    category=excluded.category,
                    lastPlayed=excluded.lastPlayed,
                    lastUpdated=excluded.lastUpdated,
                    cover=excluded.cover,
                    banner=excluded.banner,
                    logo=excluded.logo,
                    wallpaper=excluded.wallpaper,
                    installDate=excluded.installDate,
                    execArgs=excluded.execArgs
            `);

            const cleanRelations = this.db.prepare('DELETE FROM CategoryGames WHERE categoryId = ?');
            const insertRelation = this.db.prepare('INSERT INTO CategoryGames (categoryId, gameId) VALUES (?, ?)');

            // 1. Delete categories that are NOT in the update list (except 'all' which is managed/mandatory)
            const placeholders = categories.map(() => '?').join(',');
            const deleteStmt = this.db.prepare(`DELETE FROM Categories WHERE id NOT IN (${placeholders}) AND id != 'all'`);
            deleteStmt.run(...categories.map(c => c.id));

            // 2. Perform Insert/Replace for each category in the payload
            categories.forEach((cat, index) => {
                insertCat.run(
                    cat.id, cat.name, cat.icon || '', cat.color || '#fff', cat.enabled ? 1 : 0, index,
                    cat.wallpaper || null, cat.wallpaperMode || 'cover', cat.gridOpacity ?? 0.15, cat.cardOpacity ?? 0.7,
                    cat.cardBlurEnabled ? 1 : 0, cat.cardTransparencyEnabled ? 1 : 0, cat.innerGlowEnabled ? 1 : 0,
                    cat.outerGlowEnabled ? 1 : 0, cat.lowResWallpaper ? 1 : 0, cat.wallpaperAAEnabled ? 1 : 0,
                    cat.highQualityBlobs ? 1 : 0, cat.configIcon || null, cat.bgAnimationsEnabled ? 1 : 0,
                    cat.gridEnabled ? 1 : 0, cat.scanlineEnabled ? 1 : 0, cat.vignetteEnabled ? 1 : 0,
                    cat.performanceMode || 'high', cat.assetColor || null, cat.nodeColor || null, cat.syncColor || null,
                    cat.coreColor || null, cat.configColor || null, cat.secretColor || null,
                    cat.slimModeEnabled ? 1 : 0, cat.monochromeModeEnabled ? 1 : 0, (cat.outlineEnabled ?? true) ? 1 : 0, cat.primingAnimation || 'waterfill'
                );

                // Surgical update of relations for this category
                cleanRelations.run(cat.id);

                if (Array.isArray(cat.games)) {
                    cat.games.forEach((g: any) => {
                        insertGame.run(
                            g.id, g.title, g.execPath || '', g.source || '', g.sourceId || null, g.platform || null, g.category || null,
                            g.lastPlayed || '', g.lastUpdated || 0,
                            g.cover || '', g.banner || '', g.logo || '', g.wallpaper || '', g.installDate || '', g.execArgs || ''
                        );
                        if (cat.id !== 'all' && cat.id !== 'recent') {
                            insertRelation.run(cat.id, g.id);
                        }
                    });
                }
            });
        });
        tx();
    }

    public importGames(games: any[], categoryId: string, options: { clearCategory?: boolean, allCategory?: boolean, categoryName?: string, categoryColor?: string, categoryIcon?: string } = {}) {
        const tx = this.db.transaction(() => {
            const insertGame = this.db.prepare(`
                INSERT INTO Games (
                    id, title, execPath, source, sourceId, platform, category, 
                    lastPlayed, lastUpdated, cover, banner, logo, wallpaper, 
                    installDate, execArgs
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    execPath=excluded.execPath,
                    source=excluded.source,
                    sourceId=excluded.sourceId,
                    platform=excluded.platform,
                    category=excluded.category,
                    lastPlayed=CASE WHEN excluded.lastPlayed != '' THEN excluded.lastPlayed ELSE Games.lastPlayed END,
                    lastUpdated=excluded.lastUpdated,
                    cover=CASE WHEN excluded.cover != '' THEN excluded.cover ELSE Games.cover END,
                    banner=CASE WHEN excluded.banner != '' THEN excluded.banner ELSE Games.banner END,
                    logo=CASE WHEN excluded.logo != '' THEN excluded.logo ELSE Games.logo END,
                    wallpaper=CASE WHEN excluded.wallpaper != '' THEN excluded.wallpaper ELSE Games.wallpaper END,
                    installDate=excluded.installDate,
                    execArgs=CASE WHEN excluded.execArgs != '' THEN excluded.execArgs ELSE Games.execArgs END
            `);

            const insertRelation = this.db.prepare('INSERT OR IGNORE INTO CategoryGames (categoryId, gameId) VALUES (?, ?)');
            const clearRelations = this.db.prepare('DELETE FROM CategoryGames WHERE categoryId = ?');

            if (options.clearCategory) {
                clearRelations.run(categoryId);
            }

            // 1. ENSURE CATEGORIES EXIST (Only if missing, DON'T OVERWRITE)
            const categoriesToEnsure = [categoryId, 'all'];
            categoriesToEnsure.forEach(id => {
                const catExists = this.db.prepare('SELECT id FROM Categories WHERE id = ?').get(id);
                if (!catExists) {
                    const catName = id === 'all' ? 'ALL GAMES' : (id === categoryId ? (options.categoryName || id.toUpperCase()) : id.toUpperCase());
                    const catColor = (id === 'steam' ? '#66c0f4' : id === 'xbox' ? '#107c10' : (id === categoryId ? (options.categoryColor || '#ffffff') : '#ffffff'));
                    const catIcon = id === 'all' ? './res/ui/all.png' : (id === 'steam' ? './res/external/steam.png' : (id === 'xbox' ? './res/external/xbox.png' : (id === categoryId ? (options.categoryIcon || '') : '')));
                    this.db.prepare('INSERT INTO Categories (id, name, icon, color, enabled, sortOrder) VALUES (?, ?, ?, ?, 1, 999)')
                        .run(id, catName, catIcon, catColor);
                }
            });

            games.forEach((g: any) => {
                insertGame.run(
                    g.id, g.title, g.execPath || '', g.source || categoryId, g.sourceId || null, g.platform || null, g.category || null,
                    g.lastPlayed || '', g.lastUpdated || 0,
                    g.cover || '', g.banner || '', g.logo || '', g.wallpaper || '', g.installDate || '', g.execArgs || ''
                );

                if (categoryId !== 'all' && categoryId !== 'recent') {
                    insertRelation.run(categoryId, g.id);
                }
            });
        });
        tx();
    }

    public updateGameLastPlayed(gameId: string) {
        const timestamp = new Date().toISOString();
        this.db.prepare('UPDATE Games SET lastPlayed = ? WHERE id = ?').run(timestamp, gameId);
    }

    public updateGameAssets(gameId: string, assets: { cover?: string, banner?: string, logo?: string, wallpaper?: string }) {
        const fields = [];
        const values = [];
        if (assets.cover !== undefined) { fields.push('cover = ?'); values.push(assets.cover); }
        if (assets.banner !== undefined) { fields.push('banner = ?'); values.push(assets.banner); }
        if (assets.logo !== undefined) { fields.push('logo = ?'); values.push(assets.logo); }
        if (assets.wallpaper !== undefined) { fields.push('wallpaper = ?'); values.push(assets.wallpaper); }

        if (fields.length === 0) return;
        values.push(gameId);
        const sql = `UPDATE Games SET ${fields.join(', ')} WHERE id = ?`;
        this.db.prepare(sql).run(...values);
    }

    public deleteGame(gameId: string) {
        this.db.prepare('DELETE FROM Games WHERE id = ?').run(gameId);
    }

    public searchGames(query: string, categoryId?: string): any[] {
        let sql = "SELECT * FROM Games WHERE title LIKE ?";
        let params: any[] = [`%${query}%`];
        const isSecretQuery = categoryId === 'hidden' || categoryId === 'secret';

        if (categoryId && !['all', 'recent', 'hidden', 'secret', 'orphaned'].includes(categoryId)) {
            sql = `
                SELECT g.* FROM Games g
                JOIN CategoryGames cg ON g.id = cg.gameId
                WHERE cg.categoryId = ? AND g.title LIKE ?
            `;
            params = [categoryId, `%${query}%`];
        } else if (categoryId === 'orphaned') {
            sql = `
                SELECT * FROM Games 
                WHERE id NOT IN (SELECT gameId FROM CategoryGames)
                AND title LIKE ?
            `;
            params = [`%${query}%`];
        } else if (isSecretQuery) {
            sql = `
                SELECT g.* FROM Games g
                JOIN CategoryGames cg ON g.id = cg.gameId
                WHERE cg.categoryId = ? AND g.title LIKE ?
            `;
            params = [categoryId, `%${query}%`];
        }

        const isSecretSelected = categoryId === 'secret' || categoryId === 'hidden';
        if (!isSecretSelected) {
            sql = `
                SELECT * FROM (${sql}) AS results
                WHERE id NOT IN (
                    SELECT gameId FROM CategoryGames 
                    WHERE categoryId IN ('hidden', 'secret')
                )
            `;
        }

        return this.db.prepare(sql).all(...params).map((g: any) => ({
            ...g,
            enabled: true
        }));
    }

    public wipeData() {
        this.db.prepare('DELETE FROM CategoryGames').run();
        this.db.prepare('DELETE FROM Categories').run();
        this.db.prepare('DELETE FROM Games').run();

        this.db.prepare(`
            INSERT INTO Categories (
                id, name, icon, color, enabled, sortOrder, 
                wallpaperMode, gridOpacity, cardOpacity,
                cardBlurEnabled, cardTransparencyEnabled, innerGlowEnabled,
                outerGlowEnabled, lowResWallpaper, wallpaperAAEnabled,
                highQualityBlobs, bgAnimationsEnabled, gridEnabled,
                scanlineEnabled, vignetteEnabled, performanceMode,
                slimModeEnabled, monochromeModeEnabled, outlineEnabled, primingAnimation
            ) VALUES (
                'all', 'ALL GAMES', './res/ui/all.png', '#ffffff', 1, 0,
                'cover', 0.15, 0.7,
                1, 1, 0,
                1, 0, 1,
                0, 1, 1,
                0, 1, 'high',
                0, 0, 1, 'waterfill'
            )
        `).run();
    }
}
