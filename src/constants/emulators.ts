export interface EmuPlatform {
    id: string;
    name: string;
    patterns: string[];
    icon: string;
    defaultArgs: string;
    desc: string;
}

export const EMU_PLATFORMS: EmuPlatform[] = [
    {
        id: 'nsw',
        name: 'NINTENDO_SWITCH',
        patterns: ['yuzu', 'ryujinx', 'suyu'],
        icon: '󰟐',
        defaultArgs: '"%ROM%"',
        desc: 'PROTOCOL_HUB::NSW_DECRYPTION_READY'
    },
    {
        id: 'ps3',
        name: 'PLAYSTATION_3',
        patterns: ['rpcs3'],
        icon: '󰊴',
        defaultArgs: '"%ROM%"',
        desc: 'CELL_PROCESSOR_HANDSHAKE::SUCCESS'
    },
    {
        id: 'ps2',
        name: 'PLAYSTATION_2',
        patterns: ['pcsx2'],
        icon: '󰊴',
        defaultArgs: '"%ROM%"',
        desc: 'EE_CORE_INITIALIZED'
    },
    {
        id: 'ps1',
        name: 'PLAYSTATION_1',
        patterns: ['duckstation', 'epsxe'],
        icon: '󰊴',
        defaultArgs: '"%ROM%"',
        desc: 'BIOS_MIGRATION_ACTIVE'
    },
    {
        id: 'ngc',
        name: 'GAMECUBE_WII',
        patterns: ['dolphin'],
        icon: '󰟐',
        defaultArgs: '"%ROM%"',
        desc: 'FLIPPER_GPU_EMULATION::STABLE'
    },
    {
        id: 'psp',
        name: 'PLAYSTATION_PORTABLE',
        patterns: ['ppsspp'],
        icon: '󰊴',
        defaultArgs: '"%ROM%"',
        desc: 'HLE_KERNEL_EMULATION::READY'
    },
    {
        id: '3ds',
        name: 'NINTENDO_3DS',
        patterns: ['citra', 'lime3ds'],
        icon: '󰟐',
        defaultArgs: '"%ROM%"',
        desc: 'PICA200_GEOMETRY_PIPELINE::ACTIVE'
    },
    {
        id: 'nds',
        name: 'NINTENDO_DS',
        patterns: ['desmume', 'melonds'],
        icon: '󰟐',
        defaultArgs: '"%ROM%"',
        desc: 'DUAL_SCREEN_RENDER_SYNC::OK'
    },
    {
        id: 'gba',
        name: 'GAME_BOY_ADVANCE',
        patterns: ['mgba', 'visualboyadvance'],
        icon: '󰟐',
        defaultArgs: '"%ROM%"',
        desc: 'ARM7_DECRYPTION_ACTIVE'
    },
    {
        id: 'xbox360',
        name: 'XBOX_360',
        patterns: ['xenia'],
        icon: '󰊴',
        defaultArgs: '"%ROM%"',
        desc: 'XEX_LOADER_INITIALIZED'
    },
    {
        id: 'wiu',
        name: 'WII_U',
        patterns: ['cemu'],
        icon: '󰟐',
        defaultArgs: '"%ROM%"',
        desc: 'CAFE_OS_WRAPPER::ACTIVE'
    },
    {
        id: 'multi',
        name: 'RETROARCH',
        patterns: ['retroarch'],
        icon: '󰓓',
        defaultArgs: '-L "%CORE%" "%ROM%"',
        desc: 'LIBRETRO_KERNEL_LOADED'
    }
];
