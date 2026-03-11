import { spawn } from 'child_process';
import path from 'path';

/**
 * Launch a file or URI cleanly using child_process.spawn.
 * Avoids PowerShell and COM objects to prevent Antivirus triggers.
 */
export function launchViaShell(execPath: string, execArgs: string = ''): void {
    const isShortcut = execPath.toLowerCase().endsWith('.lnk') ||
        execPath.toLowerCase().endsWith('.url');
    const isProtocol = execPath.includes('://') || execPath.startsWith('shell:');

    try {
        if (isShortcut || isProtocol) {
            // Use 'cmd /c start' for shortcuts, batch files, and protocols. 
            // This is the cleanest way to "double-click" them without PowerShell.
            // We use "" as the first argument for 'start' (title) to prevent path-parsing errors.
            spawn('cmd', ['/c', 'start', '""', execPath], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true
            }).unref();
        } else {
            // Direct launch for executables.
            // Split args safely respecting quotes.
            const args: string[] = [];
            const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
            let match;
            while ((match = regex.exec(execArgs)) !== null) {
                args.push(match[1] || match[2] || match[0]);
            }

            spawn(execPath, args, {
                cwd: path.dirname(execPath),
                detached: true,
                stdio: 'ignore',
                windowsHide: false
            }).unref();
        }
        console.log(`[Launch] Success: ${execPath} ${execArgs}`);
    } catch (e: any) {
        console.error(`[Launch] Failed to spawn ${execPath}:`, e.message);
    }
}
