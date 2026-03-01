import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { ServerContext } from '../context.js';
import { EMU_PLATFORMS, PLATFORM_NAMES, cleanEmuTitle, extractTitleFromSFO } from '../emuUtils.js';

export function createEmuRoutes(ctx: ServerContext): Router {
    const router = Router();

    router.post('/scan', async (req, res) => {
        try {
            const { platformId, romsDir, emuExe, execArgs, extension } = req.body;
            if (!platformId || !romsDir || !emuExe) {
                return res.status(400).json({ error: 'Missing platformId, romsDir or emuExe' });
            }

            const config = EMU_PLATFORMS[platformId];
            if (!config) return res.status(400).json({ error: 'Invalid platformId' });

            if (!fs.existsSync(romsDir)) return res.status(404).json({ error: 'ROMs directory not found' });

            const games: any[] = [];
            const shortcutTasks: { lnkPath: string, targetExe: string, args: string }[] = [];

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
                            // Smart Switch Filtering: Base Game Detection (Title ID analysis)
                            if (platformId === 'nsw') {
                                const lowerFile = file.toLowerCase();

                                // 1. Check for explicit keywords and version tags (more robust)
                                const versionLimitRegex = /(?:\[v|[\s_]v)([1-9]\d*(\.\d+)*)/i;
                                const hasUpdateTag = lowerFile.includes('[upd]') || lowerFile.includes('update') || lowerFile.includes('patch') || versionLimitRegex.test(file);
                                const hasDlcTag = lowerFile.includes('[dlc]') || lowerFile.includes('dlc') || lowerFile.includes('addon');

                                // 2. Protocol Check: Title ID (16 hex chars). 
                                // Switch Base Games ALMOST ALWAYS end in '000'. 
                                // Updates end in '800', DLCs end in '001', '002', etc.
                                const titleIdMatch = file.match(/\[([0-9a-fA-F]{16})\]/);
                                if (titleIdMatch) {
                                    const titleId = titleIdMatch[1].toUpperCase();
                                    if (!titleId.endsWith('000')) continue; // Skip if not base game ID
                                } else if (hasUpdateTag || hasDlcTag) {
                                    // Fallback filter if no Title ID is found but keywords/versions are present
                                    continue;
                                }
                            }

                            const gameId = `emu_${platformId}_${ctx.slugify(file)}`;
                            const gameDir = path.join(ctx.ASSETS_DIR, gameId);
                            if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });

                            const lnkPath = path.join(gameDir, 'launch.lnk');

                            // Argument Replacement Logic: If %ROM% exists, replace it. Otherwise, append at the end.
                            let finalArgs = execArgs || config.defaultArgs || '"%ROM%"';
                            if (finalArgs.includes('%ROM%')) {
                                finalArgs = finalArgs.replace(/%ROM%/g, fullPath);
                            } else {
                                finalArgs = `${finalArgs} "${fullPath}"`;
                            }

                            shortcutTasks.push({ lnkPath, targetExe: emuExe, args: finalArgs });

                            games.push({
                                id: gameId,
                                title: cleanEmuTitle(file),
                                execPath: path.resolve(lnkPath),
                                execArgs: '', // Arguments are inside the shortcut
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

                        const gameId = `emu_${platformId}_${ctx.slugify(file)}`;
                        const gameDir = path.join(ctx.ASSETS_DIR, gameId);
                        if (!fs.existsSync(gameDir)) fs.mkdirSync(gameDir, { recursive: true });
                        const lnkPath = path.join(gameDir, 'launch.lnk');
                        shortcutTasks.push({ lnkPath, targetExe: emuExe, args: folderArgs });

                        games.push({
                            id: gameId,
                            title: detectedTitle,
                            execPath: path.resolve(lnkPath),
                            execArgs: '', // Arguments are inside the shortcut
                            source: 'emulator',
                            platform: platformId
                        });
                    } else if (stat.isDirectory()) {
                        scan(fullPath, depth + 1);
                    }
                }
            };

            scan(romsDir, 0);

            // Batch-create all shortcuts via PowerShell using a temporary script file
            // This avoids "The command line is too long" error when scanning many ROMs
            if (shortcutTasks.length > 0) {
                console.log(`[EmuScan] Creating ${shortcutTasks.length} shortcuts...`);
                const psLines = shortcutTasks.map(t => {
                    const lnk = t.lnkPath.replace(/'/g, "''");
                    const target = t.targetExe.replace(/'/g, "''");
                    const args = t.args.replace(/'/g, "''");
                    return `$s=$w.CreateShortcut('${lnk}');$s.TargetPath='${target}';$s.Arguments='${args}';$s.Save()`;
                });
                const psScript = `$ErrorActionPreference = 'Stop'\n$w=New-Object -ComObject WScript.Shell\n${psLines.join('\n')}`;

                const tempScriptPath = path.join(ctx.ASSETS_DIR, `sync_${Date.now()}.ps1`);
                // Use UTF-8 with BOM to ensure PowerShell 5.1 reads it correctly
                fs.writeFileSync(tempScriptPath, '\ufeff' + psScript, 'utf8');

                await new Promise<void>((resolve, reject) => {
                    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
                        { maxBuffer: 1024 * 1024 * 10 }, (err) => {
                            // Cleanup temp file
                            try { if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath); } catch (e) { }

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

    return router;
}
