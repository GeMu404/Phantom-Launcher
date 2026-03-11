import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Category } from '../../../types';

interface DataManagementConfigCardProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    onCommandUpdate: (
        command: { text: string; desc: string } | null,
        onExecute?: () => void,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean,
        scrollProgress?: number | (() => void),
        showScrollMarker?: boolean | (() => void),
        execStart?: () => void,
        execEnd?: () => void
    ) => void;
    allGamesCategory: Category;
    onUpdateCategories: (updater: (prev: Category[]) => Category[]) => void;
    handleWipeMasterRegistry: (requestConfirmation?: ((msg: string, onConfirm: () => void, isDanger?: boolean) => void) | null) => void;
    cardTransparencyEnabled: boolean;
    outerGlowEnabled: boolean;
}

const ConfigCardBorder = ({ color, isActive, outerGlowEnabled }: { color: string; isActive: boolean, outerGlowEnabled: boolean }) => {
    if (!isActive) return null;
    const glowStyle = outerGlowEnabled ? { filter: `drop-shadow(0 0 6px ${color})`, boxShadow: `0 0 10px ${color}33` } : {};
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10, ...glowStyle }}>
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

const ModeButton = ({
    label,
    isActive,
    onClick,
    accentColor,
    disabled,
    danger = false
}: {
    label: string,
    isActive: boolean,
    onClick: () => void,
    accentColor: string,
    disabled: boolean,
    danger?: boolean
}) => {
    const baseColor = danger ? '#ff3333' : accentColor;
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-3 w-full transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${disabled ? 'opacity-50' : 'active:scale-95'} ${danger && isActive ? 'animate-pulse' : ''}`}
            style={{
                clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                backgroundColor: isActive ? baseColor : 'rgba(255,255,255,0.05)',
                color: isActive ? '#000' : `${baseColor}cc`,
                border: 'none',
                minHeight: '40px'
            }}
        >
            {isActive ? `[ ${label}_ACTIVE ]` : `[ ${label} ]`}
        </button>
    );
};

const DataManagementConfigCard: React.FC<DataManagementConfigCardProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    onCommandUpdate,
    allGamesCategory,
    onUpdateCategories,
    handleWipeMasterRegistry,
    cardTransparencyEnabled,
    outerGlowEnabled
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [selectedAction, setSelectedAction] = useState<'none' | 'restart' | 'autodestruct' | 'integrity'>('none');
    const [holdProgress, setHoldProgress] = useState(0);

    const holdTimerRef = useRef<number | null>(null);
    const holdIntervalRef = useRef<number | null>(null);
    const isHoldingRef = useRef(false);

    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive) {
            setSelectedAction('none');
            setHoldProgress(0);
        }
    }, [isActive]);

    useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    // --- Integrity Verification ---
    const handleExecuteIntegrity = useCallback(async () => {
        if (isExecuting) return;
        setIsExecuting(true);

        const statusUpdate = (desc: string, prog: number) => {
            onCommandUpdate({ text: 'INTEGRITY_CHECK', desc }, undefined, prog, true, true);
        };

        statusUpdate('PHASE_1: SCANNING_ASSETS_FOR_ORPHANED_NODES...', 10);
        await new Promise(r => setTimeout(r, 400));

        try {
            const scanRes = await fetch('/api/integrity/scan-orphans');
            const scanData = await scanRes.json();

            if (scanData.recovered && scanData.recovered.length > 0) {
                statusUpdate(`PHASE_1: RECOVERED_${scanData.recovered.length}_ORPHANED_NODES.`, 25);
                onUpdateCategories(prev => {
                    const allCat = prev.find(c => c.id === 'all');
                    if (!allCat) return prev;

                    const existingIds = new Set(allCat.games.map(g => g.id));
                    const newGames = scanData.recovered.filter((g: any) => !existingIds.has(g.id));

                    if (newGames.length === 0) return prev;

                    return prev.map(c => c.id === 'all' ? { ...c, games: [...c.games, ...newGames] } : c);
                });
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (e) {
            console.error('[Integrity] Orphan scan failed', e);
        }

        statusUpdate('PHASE_2: ALIGNING_REGISTRY_RELATIONS...', 40);
        await new Promise(r => setTimeout(r, 300));

        onUpdateCategories(prev => {
            const allCat = prev.find(c => c.id === 'all');
            if (!allCat) return prev;
            const allIds = new Set(allCat.games.map(g => g.id));
            const missingFromAll: any[] = [];

            for (const cat of prev) {
                if (cat.id === 'all' || cat.id === 'recent' || cat.id === 'hidden' || cat.id === 'secret') continue;
                for (const game of cat.games) {
                    if (!allIds.has(game.id)) {
                        missingFromAll.push(game);
                        allIds.add(game.id);
                    }
                }
            }
            if (missingFromAll.length === 0) return prev;
            return prev.map(c => c.id === 'all' ? { ...c, games: [...c.games, ...missingFromAll] } : c);
        });

        statusUpdate('PHASE_3: VALIDATING_PHYSICAL_ACCESS_PATHS...', 60);

        const allGames = allGamesCategory?.games || [];
        const pathsToCheck = allGames
            .filter(g => g.execPath && g.execPath.trim() !== '')
            .map(g => g.execPath);
        const uniquePaths = [...new Set(pathsToCheck)];

        let pathResults: Record<string, boolean> = {};
        if (uniquePaths.length > 0) {
            try {
                const res = await fetch('/api/verify-paths', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paths: uniquePaths })
                });
                const data = await res.json();
                pathResults = data.results || {};
            } catch {
            }
        }

        statusUpdate('PHASE_4: FLAG_CORRUPTED_IDENTIFIERS...', 85);
        await new Promise(r => setTimeout(r, 200));

        const invalidIds = new Set<string>();
        for (const game of allGames) {
            if (!game.execPath || game.execPath.trim() === '') continue;
            if (pathResults[game.execPath] === false) {
                invalidIds.add(game.id);
            }
        }

        const finalCategories = await new Promise<Category[]>(resolve => {
            onUpdateCategories(prev => {
                let next;
                if (invalidIds.size > 0) {
                    next = prev.map(cat => ({
                        ...cat,
                        games: cat.games.map(g => {
                            const isInvalid = invalidIds.has(g.id);
                            const cleanTitle = g.title.startsWith('! ') ? g.title.substring(2) : g.title;
                            if (isInvalid) {
                                return { ...g, title: `! ${cleanTitle}` };
                            } else {
                                return { ...g, title: cleanTitle };
                            }
                        })
                    }));
                } else {
                    next = prev.map(cat => ({
                        ...cat,
                        games: cat.games.map(g => g.title.startsWith('! ') ? { ...g, title: g.title.substring(2) } : g)
                    }));
                }
                resolve(next);
                return next;
            });
        });

        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalCategories)
        });

        const stats = `${invalidIds.size}_INVALID_NODES_FLAGGED.`;
        onCommandUpdate(
            { text: 'VERIFICATION_SUCCESS', desc: `INTEGRITY_REPAIRED. ${stats}` },
            undefined, 100, false, false
        );
        setIsExecuting(false);
    }, [isExecuting, onCommandUpdate, onUpdateCategories, allGamesCategory]);

    const handleExecuteRestart = useCallback(() => {
        if (isExecuting) return;
        setIsExecuting(true);
        let prog = 0;
        const interval = window.setInterval(() => {
            prog += 10;
            if (prog > 100) {
                clearInterval(interval);
                onCommandUpdate({ text: 'REBOOT_SEQUENCE_INITIATED', desc: 'RELOADING_HUD_COMPONENTS' }, undefined, 100, true, true);
                setTimeout(() => {
                    window.location.reload();
                }, 500);
                return;
            }
            onCommandUpdate({ text: 'REBOOT_SEQUENCE_INITIATED', desc: 'RELOADING_HUD_COMPONENTS' }, undefined, prog, true, true);
        }, 16);
    }, [isExecuting, onCommandUpdate]);

    // Autodestruct Handling
    const handleExecuteStart = () => {
        if (isExecuting || selectedAction !== 'autodestruct') return;
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        isHoldingRef.current = true;
        setHoldProgress(0);

        let elapsed = 0;
        const totalHoldTime = 5000;
        const intervalTime = 16;

        holdIntervalRef.current = window.setInterval(() => {
            if (!isHoldingRef.current) {
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
                return;
            }
            elapsed += intervalTime;
            const percentage = Math.min((elapsed / totalHoldTime) * 100, 100);
            setHoldProgress(percentage);

            if (elapsed >= totalHoldTime) {
                isHoldingRef.current = false;
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
                executeWipeProtocol();
            }
        }, intervalTime);
    };

    const handleExecuteEnd = () => {
        isHoldingRef.current = false;
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (!isExecuting && holdProgress < 100) {
            setHoldProgress(0); // Cancelled
        }
    };

    const executeWipeProtocol = async () => {
        setIsExecuting(true);
        setHoldProgress(100);
        onCommandUpdate({ text: 'WIPE_PROTOCOL_ENGAGED', desc: 'PURGING_ALL_RECORDS...' }, undefined, 100, true, true);

        try {
            await handleWipeMasterRegistry(null); // Execute immediate wipe
            onCommandUpdate({ text: 'WIPE_COMPLETE', desc: 'SYSTEM_HAS_BEEN_RESET. REBOOTING_CORE...' }, undefined, 100, true, true);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error('Wipe error', e);
            onCommandUpdate({ text: 'WIPE_FAILED', desc: 'ERROR_DURING_PURGE. ABORTED.' }, undefined, 0, false, false);
            setIsExecuting(false);
            setHoldProgress(0);
        }
    };

    const integrityRef = useRef(handleExecuteIntegrity);
    const restartRef = useRef(handleExecuteRestart);
    const startRef = useRef(handleExecuteStart);
    const endRef = useRef(handleExecuteEnd);

    useEffect(() => { integrityRef.current = handleExecuteIntegrity; }, [handleExecuteIntegrity]);
    useEffect(() => { restartRef.current = handleExecuteRestart; }, [handleExecuteRestart]);
    useEffect(() => { startRef.current = handleExecuteStart; }, [handleExecuteStart]);
    useEffect(() => { endRef.current = handleExecuteEnd; }, [handleExecuteEnd]);

    const stableIntegrity = useCallback(() => integrityRef.current(), []);
    const stableRestart = useCallback(() => restartRef.current(), []);
    const stableStart = useCallback(() => startRef.current(), []);
    const stableEnd = useCallback(() => endRef.current(), []);

    useEffect(() => {
        if (isActive) {
            if (selectedAction === 'integrity') {
                onCommandUpdate(
                    {
                        text: 'VERIFY_INTEGRITY_PROTOCOL',
                        desc: 'SCANNING_AND_REPAIRING_REGISTRY_ENTRIES.'
                    },
                    stableIntegrity,
                    0, isExecuting, true, null, null,
                    null, null
                );
            } else if (selectedAction === 'autodestruct') {
                onCommandUpdate(
                    {
                        text: 'PANIC_FACTORY_RESET',
                        desc: 'WARNING:_CRITICAL_ACTION._HOLD_FOR_5_SECONDS_TO_WIPE_ALL_DATA.'
                    },
                    null,
                    holdProgress, isExecuting, true, null, null,
                    stableStart,
                    stableEnd
                );
            } else if (selectedAction === 'restart') {
                onCommandUpdate(
                    {
                        text: 'RESTART_APP_PROTOCOL',
                        desc: 'THIS_ACTION_WILL_REBOOT_THE_HUD_AND_RELOAD_SERVICES.'
                    },
                    stableRestart,
                    0, isExecuting, true, null, null,
                    null, null
                );
            }
        }
    }, [isActive, isExecuting, selectedAction, holdProgress, stableIntegrity, stableRestart, stableStart, stableEnd, onCommandUpdate]);

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;

    const handleToggleActive = () => {
        if (isExecuting) return;
        const nextState = !isActive;
        onActiveToggle(nextState);
        if (!nextState) {
            onCommandUpdate(null, null, 0, false, false, null, null, null, null);
            setSelectedAction('none');
        }
    };

    return (
        <div ref={cardRef} className="w-full relative">
            <ConfigCardBorder color={selectedAction === 'autodestruct' ? '#ff3333' : accentColor} isActive={isActive} outerGlowEnabled={outerGlowEnabled} />

            <div
                onClick={handleToggleActive}
                className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'justify-center' : ''} ${isExecuting ? 'cursor-wait opacity-80' : 'cursor-pointer'} ${selectedAction === 'autodestruct' && isHoldingRef.current ? 'animate-pulse' : ''}`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: selectedAction === 'autodestruct'
                        ? (holdProgress > 0 ? '#ff000022' : '#ff00000a')
                        : (cardTransparencyEnabled ? `${accentColor}1F` : `${accentColor}26`),
                    minHeight: '100px'
                }}
            >
                {/* Header Row */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px] mb-4' : ''}`}>
                    <div className="flex items-center gap-[20px]">
                        <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-all duration-500 ${isExecuting || (selectedAction === 'autodestruct' && holdProgress > 0) ? 'animate-pulse scale-110' : ''} ${isActive ? 'scale-110' : ''}`}>
                            <img
                                src="./res/ui/data.png"
                                alt="Data Management"
                                className={`w-14 h-14 object-contain opacity-90 transition-opacity ${selectedAction === 'autodestruct' ? 'hue-rotate-180 brightness-150 saturate-200' : ''}`}
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${selectedAction === 'autodestruct' ? 'text-red-500' : isActive ? 'text-white' : 'text-white/40'}`}>
                                DATA_MANAGEMENT_SET_PROTOCOL
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedAction === 'autodestruct' ? '#ff3333' : isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                                <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic truncate max-w-[200px] transition-colors ${selectedAction === 'autodestruct' ? 'text-red-500/80 animate-pulse' : isActive ? 'text-white/60' : 'text-white/20'}`}>
                                    {isActive ? (selectedAction === 'autodestruct' && holdProgress > 0 ? 'WARNING_DELETION_IMMINENT' : selectedAction === 'autodestruct' ? 'HAZARD_LEVEL_MAXIMUM' : 'ACTIVE_MAINTENANCE_BAY') : 'STANDBY_MODE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Config Panel Content */}
                {isActive && (
                    <div className="flex flex-col gap-6 mt-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>

                        {/* Selected warning text for autodestruct */}
                        {selectedAction === 'autodestruct' && (
                            <div className="border border-red-500/30 bg-red-900/10 p-4 -mt-2">
                                <p className="text-[9px] text-red-400 font-['Space_Mono'] uppercase tracking-widest leading-relaxed">
                                    <span className="font-bold text-red-500">[!] WARNING:</span> SYSTEM-WIDE FACTORY RESET WILL TERMINATE ALL NODE REGISTRIES, CUSTOM IDENTIFIERS, AND LOCAL CONFIGURATIONS. THIS ACTION IS ABSOLUTE AND IRREVERSIBLE.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                            <ModeButton
                                label="RESTART_APP"
                                isActive={selectedAction === 'restart'}
                                onClick={() => setSelectedAction('restart')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                            />

                            <ModeButton
                                label="VERIFY_INTEGRITY"
                                isActive={selectedAction === 'integrity'}
                                onClick={() => setSelectedAction('integrity')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                            />

                            <ModeButton
                                label="AUTODESTRUCTION"
                                isActive={selectedAction === 'autodestruct'}
                                onClick={() => setSelectedAction('autodestruct')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                                danger={true}
                            />
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default DataManagementConfigCard;
