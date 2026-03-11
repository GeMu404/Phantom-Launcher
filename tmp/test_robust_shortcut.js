import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const lnk = path.resolve('d:/Media/Desktop/Phantom Launcher/tmp/test_spawn_lnk.lnk');
const target = 'C:\\Windows\\explorer.exe';
const args = 'shell:AppsFolder\\Microsoft.WindowsCalculator_8wekyb3d8bbwe!App';

if (fs.existsSync(lnk)) fs.unlinkSync(lnk);

console.log(`Creating shortcut: ${lnk}`);
console.log(`Target: ${target}`);
console.log(`Args: ${args}`);

const psScript = '& { param($lnk, $target, $args); $s = (New-Object -COM WScript.Shell).CreateShortcut($lnk); $s.TargetPath = $target; $s.Arguments = $args; $s.Save() }';

const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command', psScript,
    '-lnk', lnk,
    '-target', target,
    '-args', args
], { encoding: 'utf8' });

if (result.error) {
    console.error('Spawn error:', result.error);
} else if (result.status !== 0) {
    console.error('PowerShell error:', result.stderr);
} else {
    console.log('Success! verifying...');
    // Verify using another PowerShell command
    const verifyScript = `(New-Object -COM WScript.Shell).CreateShortcut('${lnk}').Arguments`;
    const verify = spawnSync('powershell.exe', ['-NoProfile', '-Command', verifyScript], { encoding: 'utf8' });
    console.log('Actual Arguments in .lnk:', verify.stdout.trim());
}
