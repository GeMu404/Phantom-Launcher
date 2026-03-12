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
        icon: './res/external/nsw.png',
        defaultArgs: '%ROM%',
        desc: 'PROTOCOL_HUB::NSW_DECRYPTION_READY'
    },
    {
        id: 'ps3',
        name: 'PLAYSTATION_3',
        patterns: ['rpcs3'],
        icon: './res/external/ps3.png',
        defaultArgs: '%ROM%',
        desc: 'CELL_PROCESSOR_HANDSHAKE::SUCCESS'
    },
    {
        id: 'ps2',
        name: 'PLAYSTATION_2',
        patterns: ['pcsx2', 'pcsx2-qt'],
        icon: './res/external/ps2.png',
        defaultArgs: '%ROM%',
        desc: 'EE_CORE_INITIALIZED::QT_WRAPPER_ACTIVE'
    },
    {
        id: 'ps1',
        name: 'PLAYSTATION_1',
        patterns: ['duckstation', 'epsxe', 'retroarch'],
        icon: './res/external/ps1.png',
        defaultArgs: '%ROM%',
        desc: 'BIOS_MIGRATION_ACTIVE'
    },
    {
        id: 'wii',
        name: 'NINTENDO_WII',
        patterns: ['dolphin'],
        icon: './res/external/wii.png',
        defaultArgs: '%ROM%',
        desc: 'BROADWAY_CPU_EMULATION::STABLE'
    },
    {
        id: 'ngc',
        name: 'NINTENDO_GAMECUBE',
        patterns: ['dolphin'],
        icon: './res/external/ngc.png',
        defaultArgs: '%ROM%',
        desc: 'FLIPPER_GPU_EMULATION::READY'
    },
    {
        id: 'psp',
        name: 'PLAYSTATION_PORTABLE',
        patterns: ['ppsspp', 'retroarch'],
        icon: './res/external/psp.png',
        defaultArgs: '%ROM%',
        desc: 'HLE_KERNEL_EMULATION::READY'
    },
    {
        id: '3ds',
        name: 'NINTENDO_3DS',
        patterns: ['citra', 'lime3ds'],
        icon: './res/external/3ds.png',
        defaultArgs: '%ROM%',
        desc: 'PICA200_GEOMETRY_PIPELINE::ACTIVE'
    },
    {
        id: 'nds',
        name: 'NINTENDO_DS',
        patterns: ['desmume', 'melonds', 'retroarch'],
        icon: './res/external/nds.png',
        defaultArgs: '%ROM%',
        desc: 'DUAL_SCREEN_RENDER_SYNC::OK'
    },
    {
        id: 'gba',
        name: 'GAME_BOY_ADVANCE',
        patterns: ['mgba', 'visualboyadvance', 'retroarch'],
        icon: './res/external/gba.png',
        defaultArgs: '%ROM%',
        desc: 'ARM7_DECRYPTION_ACTIVE'
    },
    {
        id: 'gb',
        name: 'GAME_BOY',
        patterns: ['mgba', 'visualboyadvance', 'bgb', 'retroarch'],
        icon: './res/external/gb.png',
        defaultArgs: '%ROM%',
        desc: 'LR35902_CPU_EMULATION::READY'
    },
    {
        id: 'gbc',
        name: 'GAME_BOY_COLOR',
        patterns: ['mgba', 'visualboyadvance', 'bgb', 'retroarch'],
        icon: './res/external/gbc.png',
        defaultArgs: '%ROM%',
        desc: 'CGB_BOOT_ROM_VERIFIED'
    },
    {
        id: 'nes',
        name: 'NES',
        patterns: ['mesen', 'nestopia', 'fceux', 'retroarch'],
        icon: './res/external/nes.png',
        defaultArgs: '%ROM%',
        desc: 'RICOH_2A03_READY'
    },
    {
        id: 'snes',
        name: 'SNES',
        patterns: ['mesen', 'snes9x', 'bsnes', 'higan', 'retroarch', 'snes', 'zsnes', 'lsnes'],
        icon: './res/external/snes.png',
        defaultArgs: '%ROM%',
        desc: 'RICOH_5A22_SYNC_OK'
    },
    {
        id: 'genesis',
        name: 'SEGA_GENESIS',
        patterns: ['kega', 'gens', 'blastem', 'retroarch'],
        icon: './res/external/genesis.png',
        defaultArgs: '%ROM%',
        desc: 'MOTOROLA_68000_INITIALIZED'
    },
    {
        id: 'ms',
        name: 'MASTER_SYSTEM',
        patterns: ['kega', 'gens', 'retroarch'],
        icon: './res/external/ms.png',
        defaultArgs: '%ROM%',
        desc: 'Z80_PROCESSOR_LINKED'
    },
    {
        id: 'gg',
        name: 'GAME_GEAR',
        patterns: ['kega', 'gens', 'retroarch'],
        icon: './res/external/gg.png',
        defaultArgs: '%ROM%',
        desc: 'VDP_COLOR_PALETTE_LOADED'
    },
    {
        id: 'n64',
        name: 'NINTENDO_64',
        patterns: ['project64', 'mupen64', 'rmg', 'retroarch'],
        icon: './res/external/n64.png',
        defaultArgs: '%ROM%',
        desc: 'REALITY_CO_PROCESSOR::READY'
    },
    {
        id: 'xbox360',
        name: 'XBOX_360',
        patterns: ['xenia'],
        icon: './res/external/xbox.png',
        defaultArgs: '%ROM%',
        desc: 'XEX_LOADER_INITIALIZED'
    },
    {
        id: 'wiu',
        name: 'WII_U',
        patterns: ['cemu'],
        icon: './res/external/wiu.png',
        defaultArgs: '%ROM%',
        desc: 'CAFE_OS_WRAPPER::ACTIVE'
    },
    {
        id: 'ps4',
        name: 'PLAYSTATION_4',
        patterns: ['shadps4'],
        icon: './res/external/ps4.png',
        defaultArgs: '%ROM%',
        desc: 'ORBIS_OS_LAYER::INITIALIZED'
    },
    {
        id: 'multi',
        name: 'RETROARCH',
        patterns: ['retroarch'],
        icon: './res/external/Emu.png',
        defaultArgs: '-L "%CORE%" %ROM%',
        desc: 'LIBRETRO_KERNEL_LOADED'
    },
    {
        id: 'custom',
        name: 'CUSTOM_EMU',
        patterns: [],
        icon: './res/external/Emu.png',
        defaultArgs: '%ROM%',
        desc: 'CUSTOM_PROTOCOL_LAYER_ACTIVE'
    }
];
