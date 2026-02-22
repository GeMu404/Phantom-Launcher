import { exec } from 'child_process';
import path from 'path';

/**
 * Launch a file via Shell.Application COM object.
 * Routes through the RUNNING Explorer shell process,
 * which always has foreground rights. Equivalent to double-clicking the file.
 */
export function launchViaShell(execPath: string, execArgs: string = ''): void {
    const dir = path.dirname(execPath);

    const psScript = `$shell = New-Object -ComObject Shell.Application; $shell.ShellExecute('${execPath.replace(/'/g, "''")}', '${(execArgs || '').replace(/'/g, "''")}', '${dir.replace(/'/g, "''")}', 'open', 1)`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, (error) => {
        if (error) {
            console.error('[Launch] Shell.Application failed, fallback:', error.message);
            exec(`start "" "${execPath}" ${execArgs}`);
        }
    });
}
