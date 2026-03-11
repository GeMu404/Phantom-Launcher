import fs from 'fs';

export const PLATFORM_NAMES: Record<string, string> = {
    '3ds': 'NINTENDO 3DS', 'n64': 'NINTENDO 64', 'nds': 'NINTENDO DS',
    'ngc': 'NINTENDO GAMECUBE', 'nsw': 'NINTENDO SWITCH', 'wii': 'NINTENDO WII',
    'wiu': 'NINTENDO WII U', 'ps2': 'PLAYSTATION 2', 'ps3': 'PLAYSTATION 3',
    'ps1': 'PLAYSTATION 1', 'psp': 'PLAYSTATION PORTABLE', 'psv': 'PLAYSTATION VITA',
    'gba': 'GAME BOY ADVANCE', 'gb': 'GAME BOY', 'gbc': 'GAME BOY COLOR',
    'nes': 'NES', 'snes': 'SNES', 'genesis': 'SEGA GENESIS',
    'ms': 'MASTER SYSTEM', 'gg': 'GAME GEAR',
    'xbox360': 'XBOX 360', 'multi': 'RETROARCH'
};

export const PLATFORM_COLORS: Record<string, string> = {
    '3ds': '#ce181e', 'n64': '#316231', 'nds': '#ffffff', 'ngc': '#6a5acd',
    'nsw': '#e60012', 'wii': '#ffffff', 'wiu': '#009ac7', 'ps1': '#003791',
    'ps2': '#003791', 'ps3': '#000000', 'ps4': '#003791', 'psp': '#000000',
    'psv': '#201e1f', 'gba': '#2d1b6b', 'gb': '#8b9bb4', 'gbc': '#fb06d2',
    'nes': '#e4000f', 'snes': '#8265a1', 'genesis': '#000000',
    'ms': '#0000ff', 'gg': '#107c10',
    'xbox360': '#107c10', 'multi': '#3fe0d0'
};

export const PLATFORM_ICONS: Record<string, string> = {
    '3ds': './res/external/3ds.png', 'n64': './res/external/n64.png',
    'nds': './res/external/nds.png', 'ngc': './res/external/ngc.png',
    'nsw': './res/external/nsw.png', 'wii': './res/external/wii.png',
    'wiu': './res/external/wiu.png', 'ps1': './res/external/ps1.png',
    'ps2': './res/external/ps2.png', 'ps3': './res/external/ps3.png',
    'ps4': './res/external/ps4.png', 'psp': './res/external/psp.png',
    'psv': './res/external/psv.png', 'gba': './res/external/gba.png',
    'gb': './res/external/gb.png', 'gbc': './res/external/gbc.png',
    'nes': './res/external/nes.png', 'snes': './res/external/snes.png',
    'genesis': './res/external/genesis.png', 'ms': './res/external/ms.png',
    'gg': './res/external/gg.png',
    'xbox360': './res/external/xbox.png', 'multi': './res/external/Emu.png'
};

export const EMU_PLATFORMS: Record<string, { extensions: string[], mode: 'FILE' | 'FOLDER', defaultArgs: string }> = {
    '3ds': { extensions: ['.3ds', '.cia'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'n64': { extensions: ['.z64', '.n64', '.v64'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'nds': { extensions: ['.nds'], mode: 'FILE', defaultArgs: '-f' },
    'ngc': { extensions: ['.iso', '.gcm', '.rvz', '.7z', '.zip'], mode: 'FILE', defaultArgs: '-f -e' },
    'nsw': { extensions: ['.nsp', '.xci', '.7z', '.zip'], mode: 'FILE', defaultArgs: '-f' },
    'wii': { extensions: ['.iso', '.wbfs', '.rvz', '.7z', '.zip'], mode: 'FILE', defaultArgs: '-f -e' },
    'wiu': { extensions: ['.wud', '.wux', '.rpx'], mode: 'FILE', defaultArgs: '-f' },
    'ps1': { extensions: ['.cue', '.iso', '.chd', '.pbp', '.7z', '.zip'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'ps2': { extensions: ['.iso', '.bin', '.chd', '.7z', '.zip'], mode: 'FILE', defaultArgs: '--fullscreen --no-gui' },
    'ps3': { extensions: [], mode: 'FOLDER', defaultArgs: '--fullscreen' },
    'ps4': { extensions: [], mode: 'FOLDER', defaultArgs: '' },
    'psp': { extensions: ['.iso', '.cso'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'psv': { extensions: ['.vpk'], mode: 'FILE', defaultArgs: '' },
    'gba': { extensions: ['.gba', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'gb': { extensions: ['.gb', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'gbc': { extensions: ['.gbc', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'nes': { extensions: ['.nes', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'snes': { extensions: ['.sfc', '.smc', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'genesis': { extensions: ['.md', '.smd', '.gen', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'ms': { extensions: ['.sms', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'gg': { extensions: ['.gg', '.zip', '.7z'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'xbox360': { extensions: ['.iso', '.xex'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'multi': { extensions: ['.iso', '.zip', '.rom', '.gba', '.gb', '.gbc', '.nes', '.sfc', '.md'], mode: 'FILE', defaultArgs: '-L "%CORE%" "%ROM%"' },
    'custom': { extensions: [], mode: 'FILE', defaultArgs: '' }
};

export function cleanEmuTitle(filename: string): string {
    let name = filename.replace(/\.[^/.]+$/, ""); // Remove extension
    name = name.replace(/\s*\(.*?\)/g, ""); // Remove (USA), (En,Fr,De), etc.
    name = name.replace(/\s*\[.*?\]/g, ""); // Remove [!], [b1], etc.
    name = name.replace(/_/g, " "); // Replace underscores with spaces
    name = name.replace(/^\d+\s*-\s*/, ""); // Remove lead numbers like "0479 - "

    // Normalize and remove Zalgo/Combining marks
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
}

/**
 * Basic PARAM.SFO (Sony File Overlay) title extractor.
 * SFO files are key-value stores. We look for the "TITLE" key.
 */
export function extractTitleFromSFO(sfoPath: string): string | null {
    try {
        if (!fs.existsSync(sfoPath)) return null;
        const buffer = fs.readFileSync(sfoPath);

        const titleIndex = buffer.indexOf(Buffer.from('TITLE\0'));
        if (titleIndex === -1) return null;

        const header = {
            keyOffset: buffer.readUInt32LE(0x08),
            dataOffset: buffer.readUInt32LE(0x0C),
            count: buffer.readUInt32LE(0x10)
        };

        for (let i = 0; i < header.count; i++) {
            const entryOffset = 0x14 + (i * 16);
            const keyStart = header.keyOffset + buffer.readUInt16LE(entryOffset);

            let keyEnd = keyStart;
            while (keyEnd < buffer.length && buffer[keyEnd] !== 0) keyEnd++;
            const key = buffer.toString('utf8', keyStart, keyEnd);

            if (key === 'TITLE') {
                const dataStart = header.dataOffset + buffer.readUInt32LE(entryOffset + 0x0C);
                const dataLen = buffer.readUInt32LE(entryOffset + 0x08);
                let actualLen = 0;
                while (actualLen < dataLen && buffer[dataStart + actualLen] !== 0) actualLen++;
                return buffer.toString('utf8', dataStart, dataStart + actualLen).trim();
            }
        }
    } catch (e) {
        console.error("[SFO] Failed to parse title", e);
    }
    return null;
}
