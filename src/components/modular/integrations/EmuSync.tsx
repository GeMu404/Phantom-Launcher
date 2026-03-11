import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EMU_PLATFORMS, EmuPlatform } from '../../../constants/emulators';
import { useTranslation } from '../../../hooks/useTranslation';

interface EmuSyncProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    handleSyncEmuLibrary: (platformId: string, romsDir: string, emuExe: string, customArgs: string, customIcon?: string, extension?: string, onProgress?: (p: number) => void, includeAssets?: boolean) => Promise<void>;
    onCommandUpdate: (
        command: { text: string; desc: string } | null,
        onExecute?: (() => void) | null,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean,
        _scrollProgress?: number | null,
        _showScrollMarker?: boolean | null,
        execStart?: (() => void) | null,
        execEnd?: (() => void) | null
    ) => void;
    triggerFileBrowser: (target: string, type: string) => void;
    emuPath: string;
    romsDir: string;
    emuIcon: string;
    includeAssets: boolean;
    setIncludeAssets: (v: boolean) => void;
    sgdbEnabled?: boolean;
    onResetFields: () => void;
}

const SyncCardBorder = ({ color, isActive }: { color: string; isActive: boolean }) => {
    if (!isActive) return null;
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            <div className="absolute top-0 left-0 h-[2px]" style={{ right: '20px', backgroundColor: color }} />
            <div className="absolute bottom-0 right-0 h-[2px]" style={{ left: '20px', backgroundColor: color }} />
            <div className="absolute top-[20px] bottom-0 right-0 w-[2px]" style={{ backgroundColor: color }} />
            <div className="absolute top-0 bottom-[20px] left-0 w-[2px]" style={{ backgroundColor: color }} />

            <svg className="absolute top-0 right-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
            <svg className="absolute bottom-0 left-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
        </div>
    );
};

const EmuSync: React.FC<EmuSyncProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    handleSyncEmuLibrary,
    onCommandUpdate,
    triggerFileBrowser,
    emuPath,
    romsDir,
    emuIcon,
    includeAssets,
    setIncludeAssets,
    sgdbEnabled,
    onResetFields
}) => {
    const [customArgs, setCustomArgs] = useState('');
    const [customExt, setCustomExt] = useState('.iso');
    const [isExecuting, setIsExecuting] = useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    React.useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    // Auto-detect platforms based on executable path (Support for multi-system emulators)
    const [platformId, setPlatformId] = useState<string | null>(null);
    const [manualPlatform, setManualPlatform] = useState<EmuPlatform | null>(null);

    const detectedPlatforms = React.useMemo(() => {
        if (!emuPath) return [];
        const fileName = emuPath.split(/[\\/]/).pop()?.toLowerCase() || '';
        const matches = EMU_PLATFORMS.filter(p => p.patterns.length > 0 && p.patterns.some(pattern => fileName.includes(pattern)));

        if (matches.length > 0) {
            // Case: RetroArch (Multi-system)
            if (matches.some(p => p.id === 'multi')) {
                // Return all platforms except 'multi' and 'custom' for selection
                return EMU_PLATFORMS.filter(p => p.id !== 'multi' && p.id !== 'custom');
            }
            // Case: Known Emulator (e.g. Dolphin) - Return only matches, NO CUSTOM
            return matches;
        }

        // Case: Unknown - Show ONLY CUSTOM
        const customEmu = EMU_PLATFORMS.find(p => p.id === 'custom');
        return customEmu ? [customEmu] : [];
    }, [emuPath]);

    const isReady = !!(emuPath && romsDir);
    const currentPlatform = manualPlatform || (detectedPlatforms.length === 1 ? detectedPlatforms[0] : (detectedPlatforms.find(p => p.id === platformId) || null));

    // Reset manual override and sync default args when path changes
    React.useEffect(() => {
        setManualPlatform(null);
        if (detectedPlatforms.length === 1) {
            setPlatformId(detectedPlatforms[0].id);
            setCustomArgs(prev => prev || detectedPlatforms[0].defaultArgs);
        } else if (detectedPlatforms.some(p => p.id === 'multi')) {
            // RetroArch special case
            setPlatformId('multi');
            setCustomArgs(EMU_PLATFORMS.find(p => p.id === 'multi')?.defaultArgs || '');
        } else {
            setPlatformId(null);
        }
    }, [emuPath, detectedPlatforms.map(p => p.id).join(',')]);

    const handleExecuteSync = useCallback(async () => {
        if (!emuPath || !romsDir) return;
        setIsExecuting(true);
        try {
            const commandTitle = currentPlatform ? `${currentPlatform.name.toUpperCase()}_SYNC_CORE` : 'EMU_SYNC_CORE';
            await handleSyncEmuLibrary(
                platformId!,
                romsDir,
                emuPath,
                customArgs,
                currentPlatform?.icon || './res/external/Emu.png',
                customExt,
                (p) => {
                    onCommandUpdate({ text: commandTitle, desc: t('emu.syncing') }, undefined, p, true, true);
                },
                includeAssets
            );

            onCommandUpdate({ text: commandTitle, desc: t('emu.complete') }, undefined, 100, true, true);
            setTimeout(() => {
                setIsExecuting(false);
                onActiveToggle(false);
                onResetFields();
            }, 800);
        } catch (error) {
            setIsExecuting(false);
            onCommandUpdate({ text: 'SYNC_ERROR', desc: 'ST_PROTOCOL_FAILURE' }, handleExecuteSync, 0, false, isReady);
        }
    }, [emuPath, romsDir, currentPlatform, handleSyncEmuLibrary, platformId, customArgs, customExt, onCommandUpdate, t, includeAssets, onActiveToggle, onResetFields, isReady]);

    const handleToggleActive = () => {
        onActiveToggle(!isActive);
    };

    const [holdProgress, setHoldProgress] = useState(0);
    const holdTimerRef = useRef<any>(null);

    const handleHoldStart = useCallback(() => {
        if (isExecuting || !isReady) return;
        setHoldProgress(0);
        const start = Date.now();
        const duration = 1000;
        holdTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - start;
            const p = Math.min(100, (elapsed / duration) * 100);
            setHoldProgress(p);
            if (p >= 100) {
                clearInterval(holdTimerRef.current);
                handleExecuteSync();
                setHoldProgress(0);
            }
        }, 30);
    }, [isExecuting, isReady, handleExecuteSync]);

    const handleHoldEnd = useCallback(() => {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        setHoldProgress(0);
    }, []);

    const executeRef = useRef(handleExecuteSync);
    useEffect(() => { executeRef.current = handleExecuteSync; }, [handleExecuteSync]);

    const holdStartRef = useRef(handleHoldStart);
    const holdEndRef = useRef(handleHoldEnd);
    useEffect(() => { holdStartRef.current = handleHoldStart; }, [handleHoldStart]);
    useEffect(() => { holdEndRef.current = handleHoldEnd; }, [handleHoldEnd]);

    const stableStart = useCallback(() => holdStartRef.current(), []);
    const stableEnd = useCallback(() => holdEndRef.current(), []);

    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (isActive) {
            onCommandUpdate(
                {
                    text: currentPlatform ? `${currentPlatform.name.toUpperCase()}_SYNC_CORE` : 'EMU_SYNC_CORE',
                    desc: !currentPlatform
                        ? t('emu.desc_sync_no_emu')
                        : t('emu.desc_sync_platform').replace('{{name}}', currentPlatform.name.toUpperCase())
                },
                null,
                holdProgress,
                isExecuting,
                isReady,
                null,
                null,
                isReady ? stableStart : null,
                isReady ? stableEnd : null
            );
        }
    }, [isActive, isExecuting, isReady, currentPlatform, holdProgress, stableStart, stableEnd, onCommandUpdate, t, emuPath, romsDir]);

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;



    return (
        <div ref={cardRef} className="w-full relative">
            {/* The Active Border Layer */}
            <SyncCardBorder color={accentColor} isActive={isActive} />

            {/* Main Interaction Card */}
            <div
                onClick={handleToggleActive}
                className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'justify-center' : ''} ${isExecuting ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: `${accentColor}26`,
                    minHeight: '100px'
                }}
            >
                {/* Header Row - Adjusted for natural flow */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px]' : ''}`}>
                    <div className="flex items-center gap-[20px]">
                        <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-transform duration-500 ${isActive ? 'scale-110' : ''}`}>
                            <img
                                src={currentPlatform?.icon || './res/external/Emu.png'}
                                className="w-14 h-14 object-contain opacity-90"
                                alt=""
                                onError={(e) => { e.currentTarget.src = './res/external/Emu.png'; }}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                {currentPlatform ? `${currentPlatform.name.toUpperCase()}_SYNC_CORE` : 'EMU_SYNC_CORE'}
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
                                    {isReady ? 'READY_FOR_UPLINK' : 'WAITING_FOR_UPLINK'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Action Toggle */}
                    <div className="flex flex-col items-end gap-1 min-w-[210px]" onClick={(e) => e.stopPropagation()}>
                        {isActive && sgdbEnabled && (
                            <button
                                onClick={() => !isExecuting && setIncludeAssets(!includeAssets)}
                                disabled={isExecuting}
                                className={`px-4 py-2 w-full transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${isExecuting ? 'opacity-50' : 'active:scale-95'}`}
                                style={{
                                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                                    backgroundColor: includeAssets ? accentColor : 'rgba(255,255,255,0.05)',
                                    color: includeAssets ? '#000' : `${accentColor}cc`,
                                    border: 'none'
                                }}
                            >
                                {isExecuting ? t('integrations.syncing') : (includeAssets ? t('integrations.fetch_assets_active') : t('integrations.fetch_assets_inactive'))}
                            </button>
                        )}
                    </div>
                </div>

                {/* Integrated Config Panels (Internal) */}
                {isActive && (
                    <div className="flex flex-col gap-4 mt-6 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Executable Path */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">CORE_BINARY_LINK</span>
                                <div className="flex gap-[3px] h-10">
                                    <div className="flex items-center flex-1 min-w-0 px-3 bg-black/30"
                                        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                        <span className="text-[9px] font-mono text-white/40 truncate">{emuPath || 'not_set'}</span>
                                    </div>
                                    <button
                                        onClick={() => triggerFileBrowser('emuPath', 'exe')}
                                        className="w-10 h-full shrink-0 flex items-center justify-center bg-black/30 hover:bg-white/10 transition-all active:scale-95"
                                        style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* ROMs Directory */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">ROM_STORAGE_REPOS</span>
                                <div className="flex gap-[3px] h-10">
                                    <div className="flex items-center flex-1 min-w-0 px-3 bg-black/30"
                                        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                        <span className="text-[9px] font-mono text-white/40 truncate">{romsDir || 'not_set'}</span>
                                    </div>
                                    <button
                                        onClick={() => triggerFileBrowser('romsDir', 'folder')}
                                        className="w-10 h-full shrink-0 flex items-center justify-center bg-black/30 hover:bg-white/10 transition-all active:scale-95"
                                        style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Command Arguments */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">RUN_COMMAND_VECTORS</span>
                            <div className="flex gap-[3px] h-10">
                                <div className="flex items-center flex-1 min-w-0 px-3 bg-black/30"
                                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                    <input
                                        type="text"
                                        value={customArgs}
                                        onChange={(e) => setCustomArgs(e.target.value)}
                                        placeholder="[--fullscreen --rom %ROM%]"
                                        className="w-full bg-transparent border-none outline-none font-mono text-[9px] text-white/40 tracking-[0.2em] uppercase placeholder:opacity-20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Platform Selector & Extension Input */}
                        <div className="flex flex-col gap-4">
                            {detectedPlatforms.length > 1 && (
                                <div className="flex gap-2 mt-4 w-full">
                                    {detectedPlatforms.map(p => {
                                        const isSel = platformId === p.id;

                                        return (
                                            <button
                                                key={p.id}
                                                onClick={() => {
                                                    setPlatformId(p.id);
                                                    setManualPlatform(p);
                                                    setCustomArgs(p.defaultArgs);
                                                }}
                                                className={`flex-1 px-4 py-2 text-[9px] font-black font-['Space_Mono'] transition-all uppercase tracking-widest
                                                        ${isSel
                                                        ? 'text-black opacity-100 shadow-[0_0_20px_rgba(255,255,255,0.1)]'
                                                        : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                                                    }`}
                                                style={{
                                                    backgroundColor: isSel ? accentColor : 'rgba(255,255,255,0.05)',
                                                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                                                }}
                                            >
                                                {p.name.replace(/_/g, ' ')}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {platformId === 'custom' && (
                                <div className="flex flex-col gap-1 mt-4">
                                    <span className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">CUSTOM_CORE_EXTENSION</span>
                                    <div className="flex gap-[3px] h-10">
                                        <div className="flex items-center flex-1 min-w-0 px-3 bg-black/30"
                                            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                            <input
                                                type="text"
                                                value={customExt}
                                                onChange={(e) => setCustomExt(e.target.value)}
                                                placeholder=".ISO"
                                                className="w-full bg-transparent border-none outline-none font-mono text-[9px] text-white/40 placeholder:opacity-20"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmuSync;
