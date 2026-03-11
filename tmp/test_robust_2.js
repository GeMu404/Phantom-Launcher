import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const lnk = path.resolve('d:/Media/Desktop/Phantom Launcher/tmp/test_encoded.lnk');
const target = 'C:\\Windows\\explorer.exe';
// Explicitly include the backslash
const args = 'shell:AppsFolder\\Microsoft.WindowsCalculator_8wekyb3d8bbwe!App';

if (fs.existsSync(lnk)) fs.unlinkSync(lnk);

console.log(`Creating: ${lnk}`);
console.log(`Target: ${target}`);
console.log(`Args: ${args}`);

const psScript = `
$s = (New-Object -COM WScript.Shell).CreateShortcut('${lnk.replace(/'/g, "''")}')
$s.TargetPath = '${target.replace(/'/g, "''")}'
$s.Arguments = '${args.replace(/'/g, "''")}'
$s.Save()
`;

const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

const result = spawnSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encoded
], { encoding: 'utf8' });

if (result.error) {
    console.error('Spawn error:', result.error);
} else if (result.status !== 0) {
    console.error('PowerShell error:', result.stderr);
} else {
    console.log('Success! verifying...');
    // Verify using PowerShell to see what's actually inside the .lnk
    const verifyScript = `(New-Object -COM WScript.Shell).CreateShortcut('${lnk}').Arguments`;
    const verify = spawnSync('powershell.exe', ['-NoProfile', '-Command', verifyScript], { encoding: 'utf8' });
    console.log('Resulting Argument in file: [' + verify.stdout.trim() + ']');
}
