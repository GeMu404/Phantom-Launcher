import React, { useState, useEffect } from 'react';
import { EMU_PLATFORMS, EmuPlatform } from '../../../constants/emulators';

interface EmuSyncProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    handleSyncEmuLibrary: (platformId: string, romsDir: string, emuExe: string, customArgs: string) => Promise<void>;
    onCommandUpdate: (command: { text: string; desc: string } | null, execute?: () => void, progress?: number) => void;
    triggerFileBrowser: (target: string, type: string) => void;
    emuPath: string;
    romsDir: string;
    emuIcon: string;
}

const EmuSync: React.FC<EmuSyncProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    handleSyncEmuLibrary,
    onCommandUpdate,
    triggerFileBrowser,
    emuPath,
    romsDir,
    emuIcon
}) => {
    const [customArgs, setCustomArgs] = useState('');
    const [platformId, setPlatformId] = useState<string | null>(null);
    const [detectedPlatform, setDetectedPlatform] = useState<EmuPlatform | null>(null);
    const [isExecuting, setIsExecuting] = useState(false);

    // Auto-detect platform based on executable path
    useEffect(() => {
        if (!emuPath) {
            setDetectedPlatform(null);
            setPlatformId('pc');
            return;
        }

        const fileName = emuPath.split(/[\\/]/).pop()?.toLowerCase() || '';
        const platform = EMU_PLATFORMS.find(p =>
            p.patterns.length > 0 && p.patterns.some(pattern => fileName.includes(pattern))
        );

        if (platform) {
            setDetectedPlatform(platform);
            setPlatformId(platform.id);
            // Only set default args if current args are empty to avoid overwriting user changes
            setCustomArgs(prev => prev || platform.defaultArgs);
        } else {
            setDetectedPlatform(EMU_PLATFORMS.find(p => p.id === 'pc') || null);
            setPlatformId('pc');
        }
    }, [emuPath]);

    const handleExecuteSync = async () => {
        if (!emuPath || !romsDir) return;
        setIsExecuting(true);
        try {
            await handleSyncEmuLibrary(platformId, romsDir, emuPath, customArgs);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleToggleActive = () => {
        const nextState = !isActive;
        onActiveToggle(nextState);

        if (nextState) {
            onCommandUpdate(
                {
                    text: 'SYNC_EMU_DATABASE',
                    desc: detectedPlatform ? detectedPlatform.desc : 'INICIALIZANDO PROTOCOLO DE ESCANEO DE ROMS.'
                },
                handleExecuteSync
            );
        } else {
            onCommandUpdate(null, undefined, 0);
        }
    };

    useEffect(() => {
        if (isActive) {
            const hasPaths = emuPath && romsDir;
            onCommandUpdate(
                {
                    text: detectedPlatform ? `${detectedPlatform.name.replace(/_/g, ' ')} SYNC PROTOCOL` : 'EMU SYNC PROTOCOL',
                    desc: !detectedPlatform
                        ? 'ESTA FUNCION SINCRONIZARA LOS JUEGOS DE TU CONSOLA FAVORITA CON EL LANZADOR, SELECCIONA UN EMULADOR PRIMERO'
                        : `ESTA FUNCION SINCRONIZARA TUS JUEGOS DE LA CONSOLA ${detectedPlatform.name.replace(/_/g, ' ')} CON EL LANZADOR`
                },
                hasPaths ? handleExecuteSync : undefined
            );
        }
    }, [emuPath, romsDir, customArgs, platformId, detectedPlatform, isActive]);

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;

    const isReady = !!(emuPath && romsDir);

    return (
        <div className="w-full">
            {/* Main Interaction Card */}
            <div
                onClick={handleToggleActive}
                className={`w-full transition-all duration-300 group relative cursor-pointer ${isExecuting ? 'cursor-wait opacity-80' : ''}`}
                style={{
                    backgroundColor: isActive ? accentColor : 'transparent', // The neon outline
                    clipPath: cardClip,
                    padding: '2px'
                }}
            >
                {/* Inner Body - Integrated background depth */}
                <div
                    className="w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden"
                    style={{
                        clipPath: cardClip,
                        background: isActive ? 'rgba(10, 10, 10, 0.85)' : `${accentColor}26`,
                    }}
                >
                    {/* Header Row - Adjusted for natural flow */}
                    <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px]' : 'h-[70px]'}`}>
                        <div className="flex items-center gap-[20px]">
                            <div className={`w-12 h-12 flex items-center justify-center bg-black/40 border border-white/5 text-[20px] transition-transform duration-500 ${isActive ? 'scale-110' : ''}`}>
                                {detectedPlatform?.icon || '󰓓'}
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                    {detectedPlatform ? `${detectedPlatform.name.replace(/_/g, ' ')} SYNC PROTOCOL` : 'EMU SYNC PROTOCOL'}
                                </span>
                                <div className="flex items-center gap-3">
                                    {/* Status Dot: Active only when fully configured */}
                                    <div
                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${isReady ? 'animate-pulse' : ''}`}
                                        style={{
                                            backgroundColor: isReady ? accentColor : 'white',
                                            opacity: isReady ? 1 : 0.2,
                                            boxShadow: isReady ? `0 0 8px ${accentColor}` : 'none'
                                        }}
                                    />
                                    <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic truncate max-w-[200px] transition-colors ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                                        {detectedPlatform ? `MAPPED_SYSTEM::${detectedPlatform.id.toUpperCase()}` : 'WAITING_FOR_UPLINK'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right status light removed as per request */}
                    </div>

                    {/* Integrated Config Panels (Internal) */}
                    {isActive && (
                        <div className="flex flex-col gap-4 mt-6 animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Executable Path */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[7px] font-black font-['Space_Mono'] uppercase tracking-[0.2em] opacity-30 ml-2">CORE_BINARY_LINK</span>
                                    <div className="flex gap-2 h-10">
                                        <div className="flex-1 bg-black/40 border border-white/5 flex items-center px-4 overflow-hidden"
                                            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                            <span className="text-[9px] font-['Space_Mono'] text-white/50 lowercase truncate">{emuPath || 'not_set'}</span>
                                        </div>
                                        <button
                                            onClick={() => triggerFileBrowser('emuPath', 'exe')}
                                            className="w-10 shrink-0 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/5 active:scale-95"
                                            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                                        >
                                            <div className="w-1.5 h-1.5 border border-white/40"></div>
                                        </button>
                                    </div>
                                </div>

                                {/* ROMs Directory */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-[7px] font-black font-['Space_Mono'] uppercase tracking-[0.2em] opacity-30 ml-2">ROM_STORAGE_REPOS</span>
                                    <div className="flex gap-2 h-10">
                                        <div className="flex-1 bg-black/40 border border-white/5 flex items-center px-4 overflow-hidden"
                                            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                            <span className="text-[9px] font-['Space_Mono'] text-white/50 lowercase truncate">{romsDir || 'not_set'}</span>
                                        </div>
                                        <button
                                            onClick={() => triggerFileBrowser('romsDir', 'folder')}
                                            className="w-10 shrink-0 bg-white/5 hover:bg-white/10 transition-all flex items-center justify-center border border-white/5 active:scale-95"
                                            style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                                        >
                                            <div className="w-1.5 h-1.5 border border-white/40"></div>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Command Arguments */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[7px] font-black font-['Space_Mono'] uppercase tracking-[0.2em] opacity-30 ml-2">RUN_COMMAND_VECTORS</span>
                                <div className="flex bg-black/40 border border-white/5 px-4 h-10 items-center overflow-hidden"
                                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                    <input
                                        type="text"
                                        value={customArgs}
                                        onChange={(e) => setCustomArgs(e.target.value)}
                                        placeholder="[--fullscreen --rom %ROM%]"
                                        className="w-full bg-transparent border-none outline-none font-['Space_Mono'] text-[10px] text-white tracking-[0.2em] uppercase placeholder:opacity-20"
                                    />
                                </div>
                            </div>

                            {/* Platform Selector */}
                            <div className="flex flex-wrap gap-2 mt-2">
                                {EMU_PLATFORMS.map(p => {
                                    const isSel = platformId === p.id;
                                    return (
                                        <button
                                            key={p.id}
                                            disabled={!detectedPlatform}
                                            onClick={() => {
                                                setPlatformId(p.id);
                                                setDetectedPlatform(p);
                                                setCustomArgs(p.defaultArgs);
                                            }}
                                            className={`px-3 py-1.5 text-[8px] font-black font-['Space_Mono'] transition-all border ${!detectedPlatform ? 'opacity-10 opacity-10 cursor-not-allowed' : (isSel ? 'text-white' : 'border-white/5 text-white/20 hover:text-white/40 hover:bg-white/5')}`}
                                            style={{
                                                backgroundColor: isSel ? `${accentColor}44` : 'transparent',
                                                borderColor: isSel ? accentColor : undefined,
                                                clipPath: 'polygon(4px 0, 100% 0, 100% 100%, 0 100%, 0 4px)'
                                            }}
                                        >
                                            {p.id.toUpperCase()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmuSync;
