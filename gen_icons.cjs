const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const platforms = [
    { id: '3ds', label: '3DS', color: '#ce181e' },
    { id: 'n64', label: 'N64', color: '#37424a' },
    { id: 'nds', label: 'NDS', color: '#00529c' },
    { id: 'ngc', label: 'NGC', color: '#6a5097' },
    { id: 'nsw', label: 'NSW', color: '#e60012' },
    { id: 'wii', label: 'WII', color: '#009ac7' },
    { id: 'wiu', label: 'WIU', color: '#009ac7' },
    { id: 'ps2', label: 'PS2', color: '#2949a6' },
    { id: 'ps3', label: 'PS3', color: '#000000' },
    { id: 'ps4', label: 'PS4', color: '#003791' },
    { id: 'psp', label: 'PSP', color: '#000000' },
    { id: 'psv', label: 'PSV', color: '#202020' },
];

const destDir = path.join(__dirname, 'storage', 'assets', 'platforms');
if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

async function generateIcons() {
    for (const p of platforms) {
        const svg = `
      <svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
        <circle cx="128" cy="128" r="120" fill="${p.color}" stroke="white" stroke-width="4" />
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold" font-size="80" fill="white">${p.label}</text>
      </svg>
    `;
        await sharp(Buffer.from(svg))
            .png()
            .toFile(path.join(destDir, `${p.id}.png`));
        console.log(`Generated: ${p.id}.png`);
    }
}

generateIcons().catch(console.error);
