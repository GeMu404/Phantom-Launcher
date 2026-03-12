import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec, spawnSync } from 'child_process';
import AdmZip from 'adm-zip';
import { ServerContext } from '../context.js';
import { EMU_PLATFORMS, PLATFORM_NAMES, PLATFORM_COLORS, PLATFORM_ICONS, cleanEmuTitle, extractTitleFromSFO } from '../emuUtils.js';

export function createEmuRoutes(ctx: ServerContext): Router {
    const router = Router();

    router.post('/scan', async (req, res) => {
        try {
            const { platformId, romsDir, emuExe, execArgs, extension } = req.body;
            if (!platformId || !romsDir || !emuExe) {
                return res.status(400).json({ error: 'Missing platformId, romsDir or emuExe' });
            }
            const games = await performEmuScan(ctx, { platformId, romsDir, emuExe, execArgs, extension });

            const catId = `emu_${platformId}`;
            ctx.db.importGames(games, catId, {
                clearCategory: true,
                categoryName: PLATFORM_NAMES[platformId] || platformId.toUpperCase(),
                categoryColor: PLATFORM_COLORS[platformId] || '#ffffff',
                categoryIcon: PLATFORM_ICONS[platformId] || ''
            });
            (req.app as any).broadcastSyncEvent?.({ type: 'DATA_UPDATED' });

            res.json({ success: true, count: games.length, games });
        } catch (e: any) {
            console.error('[Emu] Sync error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    return router;
}

function isZipValidForPlatform(zipPath: string, validExts: string[]): boolean {
    try {
        const zip = new AdmZip(zipPath);
        const entries = zip.getEntries();
        return entries.some(entry => {
            const ext = path.extname(entry.entryName).toLowerCase();
            // We looking for a valid ROM extension that ISN'T a zip (to avoid nested issues)
            return validExts.includes(ext) && ext !== '.zip' && ext !== '.7z';
        });
    } catch (e) {
        console.error(`[Emu] Failed to peek into ZIP: ${zipPath}`, e);
        return false;
    }
}

async function performEmuScan(ctx: ServerContext, options: { platformId: string, romsDir: string, emuExe: string, execArgs?: string, extension?: string }) {
    const { platformId, romsDir, emuExe, execArgs, extension } = options;
    const config = EMU_PLATFORMS[platformId];
    if (!config) throw new Error('Invalid platformId');
    if (!fs.existsSync(romsDir)) throw new Error('ROMs directory not found');

    const games: any[] = [];
    const shortcutsToCreate: { lnkPath: string, targetPath: string, args: string, workingDir: string }[] = [];

    console.log(`[Emu] Starting scan for ${platformId} in ${romsDir}`);

    const scan = (dir: string, depth = 0) => {
        if (!fs.existsSync(dir) || depth > 4) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (file.startsWith('.')) continue; // Ignore hidden files/folders
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (config.mode === 'FILE' && !stat.isDirectory()) {
                const ext = path.extname(file).toLowerCase();
                const targetExtensions = (platformId === 'custom' && extension)
                    ? extension.split(',').map((e: string) => e.trim().toLowerCase())
                    : config.extensions;

                if (targetExtensions.includes(ext)) {
                    // Smart ZIP Verification
                    if (ext === '.zip') {
                        // Check if the ZIP really contains what we want
                        if (!isZipValidForPlatform(fullPath, targetExtensions)) {
                            console.log(`[Emu] Skipping invalid ZIP: ${file}`);
                            continue;
                        }
                    }

                    // Smart Switch Filtering
                    if (platformId === 'nsw') {
                        const lowerFile = file.toLowerCase();
                        const versionLimitRegex = /(?:\[v|[\s_]v)([1-9]\d*(\.\d+)*)/i;
                        const hasUpdateTag = lowerFile.includes('[upd]') || lowerFile.includes('update') || lowerFile.includes('patch') || versionLimitRegex.test(file);
                        const hasDlcTag = lowerFile.includes('[dlc]') || lowerFile.includes('dlc') || lowerFile.includes('addon');
                        const titleIdMatch = file.match(/\[([0-9a-fA-F]{16})\]/);
                        if (titleIdMatch) {
                            const titleId = titleIdMatch[1].toUpperCase();
                            if (!titleId.endsWith('000')) continue;
                        } else if (hasUpdateTag || hasDlcTag) continue;
                    }

                    const cleanFilename = ctx.slugify(file);
                    const gameId = `emu_${platformId}_${cleanFilename}`;
                    const assetSubDir = path.join('emulator', platformId, cleanFilename);
                    const gameDir = path.join(ctx.ASSETS_DIR, assetSubDir);
                    if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

                    let finalArgs = execArgs || config.defaultArgs || '"%ROM%"';
                    if (finalArgs.includes('%ROM%')) {
                        finalArgs = finalArgs.replace(/%ROM%/g, `"${fullPath}"`);
                    } else if (!finalArgs.includes(fullPath)) {
                        finalArgs = `${finalArgs} "${fullPath}"`;
                    }

                    const lnkPath = path.resolve(path.join(gameDir, 'launch.lnk'));
                    const workingDir = path.resolve(path.dirname(emuExe));
                    
                    shortcutsToCreate.push({
                        lnkPath,
                        targetPath: emuExe,
                        args: finalArgs,
                        workingDir
                    });

                    games.push({
                        id: gameId, title: cleanEmuTitle(file), execPath: path.resolve(lnkPath),
                        execArgs: '', source: 'emu', sourceId: platformId, platform: platformId,
                        category: PLATFORM_NAMES[platformId] || platformId.toUpperCase(), romPath: fullPath
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
                const cleanFolderName = ctx.slugify(file);
                const gameId = `emu_${platformId}_${cleanFolderName}`;
                const assetSubDir = path.join('emulator', platformId, cleanFolderName);
                const gameDir = path.join(ctx.ASSETS_DIR, assetSubDir);
                if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
                const lnkPath = path.resolve(path.join(gameDir, 'launch.lnk'));
                const workingDir = path.resolve(path.dirname(emuExe));
                
                shortcutsToCreate.push({
                    lnkPath,
                    targetPath: emuExe,
                    args: folderArgs,
                    workingDir
                });

                games.push({ id: gameId, title: detectedTitle, execPath: path.resolve(lnkPath), execArgs: '', source: 'emu', platform: platformId, romPath: fullPath });
            } else if (stat.isDirectory()) {
                scan(fullPath, depth + 1);
            }
        }
    };
    scan(romsDir, 0);

    // Batch execute shortcut creation to avoid thousands of powershell spawns
    if (shortcutsToCreate.length > 0) {
        console.log(`[Emu] Creating ${shortcutsToCreate.length} shortcuts...`);
        const batchSize = 100;
        for (let i = 0; i < shortcutsToCreate.length; i += batchSize) {
            const batch = shortcutsToCreate.slice(i, i + batchSize);
            const psScript = batch.map(s => `
                $s = (New-Object -COM WScript.Shell).CreateShortcut('${s.lnkPath.replace(/'/g, "''")}')
                $s.TargetPath = '${s.targetPath.replace(/'/g, "''")}'
                $s.Arguments = '${s.args.replace(/'/g, "''")}'
                $s.WorkingDirectory = '${s.workingDir.replace(/'/g, "''")}'
                $s.Save()
            `).join('\n');
            const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
            spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true });
        }
    }

    console.log(`[Emu] Scan complete. Found ${games.length} games.`);
    return games;
}
