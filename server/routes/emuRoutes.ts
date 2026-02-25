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

                            const gameId = `emu_${platformId}_${ctx.slugify(file)}`;
                            const gameDir = path.join(ctx.ASSETS_DIR, gameId);
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

                        const gameId = `emu_${platformId}_${ctx.slugify(file)}`;
                        const gameDir = path.join(ctx.ASSETS_DIR, gameId);
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

    return router;
}
