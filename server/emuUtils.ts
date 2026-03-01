import fs from 'fs';

export const PLATFORM_NAMES: Record<string, string> = {
    '3ds': 'NINTENDO 3DS',
    'n64': 'NINTENDO 64',
    'nds': 'NINTENDO DS',
    'ngc': 'NINTENDO GAMECUBE',
    'nsw': 'NINTENDO SWITCH',
    'wii': 'NINTENDO WII',
    'wiu': 'NINTENDO WII U',
    'ps2': 'PLAYSTATION 2',
    'ps3': 'PLAYSTATION 3',
    'ps1': 'PLAYSTATION 1',
    'psp': 'PLAYSTATION PORTABLE',
    'psv': 'PLAYSTATION VITA',
    'gba': 'GAME BOY ADVANCE',
    'xbox360': 'XBOX 360',
    'multi': 'RETROARCH'
};

export const EMU_PLATFORMS: Record<string, { extensions: string[], mode: 'FILE' | 'FOLDER', defaultArgs: string }> = {
    '3ds': { extensions: ['.3ds', '.cia'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'n64': { extensions: ['.z64', '.n64', '.v64'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'nds': { extensions: ['.nds'], mode: 'FILE', defaultArgs: '-f' },
    'ngc': { extensions: ['.iso', '.gcm', '.rvz'], mode: 'FILE', defaultArgs: '-f -e' },
    'nsw': { extensions: ['.nsp', '.xci'], mode: 'FILE', defaultArgs: '-f' },
    'wii': { extensions: ['.iso', '.wbfs', '.rvz'], mode: 'FILE', defaultArgs: '-f -e' },
    'wiu': { extensions: ['.wud', '.wux', '.rpx'], mode: 'FILE', defaultArgs: '-f' },
    'ps1': { extensions: ['.cue', '.iso', '.chd', '.pbp'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'ps2': { extensions: ['.iso', '.bin', '.chd'], mode: 'FILE', defaultArgs: '--fullscreen --no-gui' },
    'ps3': { extensions: [], mode: 'FOLDER', defaultArgs: '--fullscreen' },
    'ps4': { extensions: [], mode: 'FOLDER', defaultArgs: '' },
    'psp': { extensions: ['.iso', '.cso'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'psv': { extensions: ['.vpk'], mode: 'FILE', defaultArgs: '' },
    'gba': { extensions: ['.gba', '.zip'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'xbox360': { extensions: ['.iso', '.xex'], mode: 'FILE', defaultArgs: '--fullscreen' },
    'multi': { extensions: ['.iso', '.zip', '.rom'], mode: 'FILE', defaultArgs: '-L "%CORE%" "%ROM%"' },
    'custom': { extensions: [], mode: 'FILE', defaultArgs: '' }
};

export function cleanEmuTitle(filename: string): string {
    let name = filename.replace(/\.[^/.]+$/, ""); // Remove extension
    name = name.replace(/\s*\(.*?\)/g, ""); // Remove (USA), (En,Fr,De), etc.
    name = name.replace(/\s*\[.*?\]/g, ""); // Remove [!], [b1], etc.
    name = name.replace(/_/g, " "); // Replace underscores with spaces
    name = name.replace(/^\d+\s*-\s*/, ""); // Remove lead numbers like "0479 - "
    return name.trim();
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
