import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const g = { AppID: "Microsoft.WindowsCalculator_8wekyb3d8bbwe!App" };
const fullAssetDir = path.resolve('d:/Media/Desktop/Phantom Launcher/tmp/final_test');
if (!fs.existsSync(fullAssetDir)) fs.mkdirSync(fullAssetDir, { recursive: true });

const lnkPath = path.resolve(path.join(fullAssetDir, 'launch.lnk'));

// EXACT LOGIC FROM xboxRoutes.ts
const psScript = `
$s = (New-Object -COM WScript.Shell).CreateShortcut('${lnkPath.replace(/'/g, "''")}')
$s.TargetPath = 'C:\\Windows\\explorer.exe'
$s.Arguments = 'shell:AppsFolder\\${g.AppID}'
$s.Save()
`;

const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

spawnSync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-EncodedCommand', encoded
], { windowsHide: true });

// Verify
const verify = spawnSync('powershell.exe', ['-NoProfile', '-Command', `(New-Object -COM WScript.Shell).CreateShortcut('${lnkPath}').Arguments`], { encoding: 'utf8' });
console.log('Resulting Args: [' + verify.stdout.trim() + ']');

if (verify.stdout.trim() === 'shell:AppsFolder\\' + g.AppID) {
    console.log('TEST PASSED! Backslash is present.');
} else {
    console.log('TEST FAILED! Output: [' + verify.stdout.trim() + ']');
}
