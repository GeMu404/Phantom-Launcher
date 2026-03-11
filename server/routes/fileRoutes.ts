import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { exec, spawnSync } from 'child_process';
import { ServerContext } from '../context.js';

export function createFileRoutes(ctx: ServerContext): Router {
    const router = Router();

    router.get('/drives', (req, res) => {
        try {
            const drives: string[] = [];
            for (let i = 65; i <= 90; i++) {
                const drive = String.fromCharCode(i) + ':\\';
                try { if (fs.existsSync(drive)) drives.push(drive); } catch (e) { }
            }

            // Query actual Windows Shell folder paths via robust PowerShell
            const psScript = `
                $folders = @{
                    Desktop = [Environment]::GetFolderPath('Desktop');
                    Documents = [Environment]::GetFolderPath('MyDocuments');
                    Pictures = [Environment]::GetFolderPath('MyPictures');
                    Music = [Environment]::GetFolderPath('MyMusic');
                    Videos = [Environment]::GetFolderPath('MyVideos');
                    Downloads = (New-Object -ComObject Shell.Application).NameSpace('shell:Downloads').Self.Path
                };
                $folders | ConvertTo-Json
            `;
            const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

            try {
                const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: true });
                let libraries = [];
                if (!result.error && result.stdout) {
                    try {
                        const paths = JSON.parse(result.stdout);
                        libraries = Object.entries(paths).map(([name, p]) => {
                            if (!p) return null;
                            const pathStr = (p as string);
                            return {
                                name,
                                path: pathStr.endsWith('\\') ? pathStr : pathStr + '\\'
                            };
                        }).filter((lib): lib is { name: string, path: string } => lib !== null && fs.existsSync(lib.path));
                    } catch (e) {
                        console.error('Failed to parse PS output:', e);
                    }
                }

                // Final safety fallback if PS failed or returned empty
                if (libraries.length === 0) {
                    const userProfile = process.env.USERPROFILE || '';
                    const checkPath = (folderName: string) => {
                        const stdPath = path.join(userProfile, folderName) + '\\';
                        return fs.existsSync(stdPath) ? stdPath : null;
                    };
                    libraries = [
                        { name: 'Desktop', path: checkPath('Desktop') },
                        { name: 'Documents', path: checkPath('Documents') },
                        { name: 'Pictures', path: checkPath('Pictures') },
                        { name: 'Music', path: checkPath('Music') },
                        { name: 'Videos', path: checkPath('Videos') },
                        { name: 'Downloads', path: checkPath('Downloads') }
                    ].filter((lib): lib is { name: string, path: string } => lib.path !== null);
                }

                res.json({ drives, libraries });
            } catch (err) {
                res.status(500).json({ error: 'Failed to list drives' });
            }
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to list drives' });
        }
    });

    router.post('/list', (req, res) => {
        const { dirPath } = req.body;
        if (!dirPath) return res.status(400).json({ error: 'dirPath is required' });
        try {
            const resolvedPath = path.resolve(dirPath);
            let items = fs.readdirSync(resolvedPath, { withFileTypes: true });
            const contents = items.map(item => {
                const fullPath = path.join(resolvedPath, item.name);
                try {
                    const stats = fs.statSync(fullPath);
                    return {
                        name: item.name,
                        path: fullPath,
                        isDir: item.isDirectory(),
                        size: stats.size,
                        ext: path.extname(item.name).toLowerCase()
                    };
                } catch (e) { return null; }
            }).filter((item): item is NonNullable<typeof item> => item !== null)
                .sort((a, b) => (a.isDir === b.isDir) ? a.name.localeCompare(b.name) : (a.isDir ? -1 : 1));
            res.json({ path: resolvedPath, contents });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/info', (req, res) => {
        const { filePath } = req.body;
        if (!filePath) return res.status(400).json({ error: 'filePath is required' });
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.lnk') {
            const psScript = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${filePath.replace(/'/g, "''")}'); $obj = @{ TargetPath = $s.TargetPath; Arguments = $s.Arguments; WorkingDirectory = $s.WorkingDirectory }; $obj | ConvertTo-Json`;
            const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
            try {
                const result = spawnSync('powershell.exe', ['-NoProfile', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: true });
                if (result.error) return res.status(500).json({ error: 'Failed to read shortcut' });
                res.json(JSON.parse(result.stdout));
            } catch (e) { res.status(500).json({ error: 'Parse failed' }); }
        } else if (ext === '.url') {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const match = content.match(/URL=(.*)/);
                res.json({ TargetPath: match ? match[1].trim() : filePath, Arguments: '' });
            } catch (e) { res.status(500).json({ error: 'Read failed' }); }
        } else {
            res.json({ TargetPath: filePath, Arguments: '' });
        }
    });

    router.post('/select-folder', (req, res) => {
        const psScript = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if($f.ShowDialog() -eq 'OK'){ $f.SelectedPath }`;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
        try {
            const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: true });
            res.json({ path: result.stdout.trim() || null });
        } catch (err) {
            res.status(500).json({ error: 'Failed' });
        }
    });

    router.post('/select-file', (req, res) => {
        const { filter = 'exe', returnBase64 = false } = req.body;
        const fileFilter = filter === 'exe' ? "Executables (*.exe;*.lnk;*.bat;*.url)|*.exe;*.lnk;*.bat;*.url" : "Images|*.jpg;*.jpeg;*.png;*.webp;*.gif;*.apng";
        const psScript = `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = "${fileFilter}"; $f.DereferenceLinks = $false; if($f.ShowDialog() -eq 'OK'){ $f.FileName }`;
        const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

        try {
            // Sta mode for dialogs
            const result = spawnSync('powershell.exe', ['-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { encoding: 'utf8', windowsHide: true });
            const p = result.stdout.trim();
            if (p && returnBase64) {
                try { res.json({ path: p, base64: fs.readFileSync(p).toString('base64') }); } catch (e) { res.status(500).json({ error: 'B64 failed' }); }
            } else { res.json({ path: p || null }); }
        } catch (err) {
            res.status(500).json({ error: 'Failed' });
        }
    });

    return router;
}
