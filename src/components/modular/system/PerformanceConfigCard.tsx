import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Category } from '../../../types';

interface PerformanceConfigCardProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    onCommandUpdate: (
        command: { text: string; desc: string } | null,
        onExecute?: () => void,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean
    ) => void;
    allGamesCategory: Category;
    onUpdateCategories: (updater: (prev: Category[]) => Category[]) => void;
}

const ConfigCardBorder = ({ color, isActive }: { color: string; isActive: boolean }) => {
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

const ToggleButton = ({
    label,
    isActive,
    onClick,
    accentColor,
    disabled
}: {
    label: string,
    isActive: boolean,
    onClick: () => void,
    accentColor: string,
    disabled: boolean
}) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-2 py-2 w-full transition-all flex items-center justify-center text-[7px] md:text-[8px] font-bold tracking-[0.1em] uppercase text-center relative overflow-hidden ${disabled ? 'opacity-50' : 'active:scale-95'}`}
            style={{
                clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)',
                backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.05)',
                color: isActive ? '#000' : `${accentColor}cc`,
                border: 'none',
                minHeight: '32px'
            }}
        >
            {label}
        </button>
    );
};

const ModeButton = ({
    label,
    isActive,
    onClick,
    accentColor,
    disabled
}: {
    label: string,
    isActive: boolean,
    onClick: () => void,
    accentColor: string,
    disabled: boolean
}) => {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-3 w-full transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${disabled ? 'opacity-50' : 'active:scale-95'}`}
            style={{
                clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.05)',
                color: isActive ? '#000' : `${accentColor}cc`,
                border: 'none'
            }}
        >
            {isActive ? `[ ${label}_ACTIVE ]` : `[ ${label} ]`}
        </button>
    );
};

const PerformanceConfigCard: React.FC<PerformanceConfigCardProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    onCommandUpdate,
    allGamesCategory,
    onUpdateCategories
}) => {
    const [isExecuting, setIsExecuting] = useState(false);

    // Local Config State
    const [localToggles, setLocalToggles] = useState<Record<string, boolean>>({});
    const [localMode, setLocalMode] = useState<'custom' | 'low' | 'balanced' | 'high'>('custom');

    const cardRef = useRef<HTMLDivElement>(null);

    const toggles = [
        { key: 'vignetteEnabled', label: 'VIGNETTE_SHADOW' },
        { key: 'scanlineEnabled', label: 'SCANLINE_FX' },
        { key: 'gridEnabled', label: 'MATRIX_GRID' },
        { key: 'bgAnimationsEnabled', label: 'AMBIENT_MOTION' },
        { key: 'lowResWallpaper', label: 'WALLPAPER_RES [960P]' }
    ];

    // Initialize/Sync State
    useEffect(() => {
        if (!isActive) {
            const newToggles: Record<string, boolean> = {};
            toggles.forEach(tggl => {
                newToggles[tggl.key] = !!allGamesCategory[tggl.key as keyof Category];
            });
            setLocalToggles(newToggles);
            setLocalMode(allGamesCategory.performanceMode || 'custom');
        }
    }, [allGamesCategory, isActive]);

    useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    // Check Modifications
    const isModified =
        localMode !== (allGamesCategory.performanceMode || 'custom') ||
        toggles.some(tggl => localToggles[tggl.key] !== !!allGamesCategory[tggl.key as keyof Category]);

    const handleExecute = () => {
        if (isExecuting || !isModified) return;
        setIsExecuting(true);

        let prog = 0;
        onCommandUpdate({ text: 'PERFORMANCE_PROTOCOL', desc: 'UPDATING_RENDERING_PIPELINE' }, null, 0, true, true);

        const interval = setInterval(() => {
            prog += 10 + Math.random() * 10;
            if (prog >= 98) {
                prog = 98;
                clearInterval(interval);
            }
            onCommandUpdate({ text: 'PERFORMANCE_PROTOCOL', desc: 'RECONFIGURING_GPU_BUFFERS' }, null, prog, true, true);
        }, 40);

        setTimeout(() => {
            clearInterval(interval);

            // Apply all configurations dynamically
            onUpdateCategories(prev => prev.map(c => c.id === 'all' ? {
                ...c,
                performanceMode: localMode,
                ...localToggles
            } : c));

            onCommandUpdate({ text: 'PERFORMANCE_PROTOCOL', desc: 'MODIFICATIONS_SUCCESSFUL' }, null, 100, true, false);

            setTimeout(() => {
                setIsExecuting(false);
            }, 800);
        }, 800);
    };

    const executeRef = useRef(handleExecute);
    useEffect(() => { executeRef.current = handleExecute; }, [handleExecute]);
    const stableExecute = useCallback(() => executeRef.current(), []);

    useEffect(() => {
        if (isActive) {
            onCommandUpdate(
                {
                    text: 'PERFORMANCE_PROTOCOL',
                    desc: 'THIS PROTOCOL WILL RECONFIGURE RENDERING QUALITY AND UI PERFORMANCE LIMITS.'
                },
                stableExecute,
                0,
                isExecuting,
                isModified
            );
        }
    }, [isActive, isExecuting, isModified, stableExecute, onCommandUpdate]);

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
            // Re-sync
            const newToggles: Record<string, boolean> = {};
            toggles.forEach(tggl => {
                newToggles[tggl.key] = !!allGamesCategory[tggl.key as keyof Category];
            });
            setLocalToggles(newToggles);
            setLocalMode(allGamesCategory.performanceMode || 'custom');
        }
    };

    const toggleKey = (key: string) => {
        if (isExecuting) return;
        setLocalToggles(prev => ({ ...prev, [key]: !prev[key] }));
        setLocalMode('custom'); // Automatically switch to custom if manually tweaking
    };

    const applyPreset = (mode: 'custom' | 'low' | 'balanced' | 'high') => {
        if (isExecuting) return;
        if (mode === 'custom') {
            setLocalMode('custom');
            return;
        }

        const newToggles = { ...localToggles };
        if (mode === 'low') {
            Object.keys(newToggles).forEach(k => newToggles[k] = false);
            newToggles.lowResWallpaper = true;
        } else if (mode === 'balanced') {
            Object.keys(newToggles).forEach(k => newToggles[k] = false);
            newToggles.vignetteEnabled = true;
            newToggles.scanlineEnabled = true;
            newToggles.cardTransparencyEnabled = true;
            newToggles.bgAnimationsEnabled = true;
            newToggles.lowResWallpaper = false;
        } else if (mode === 'high') {
            Object.keys(newToggles).forEach(k => newToggles[k] = true);
            newToggles.lowResWallpaper = false;
        }

        setLocalToggles(newToggles);
        setLocalMode(mode);
    };

    return (
        <div ref={cardRef} className="w-full relative">
            <ConfigCardBorder color={accentColor} isActive={isActive} />

            <div
                onClick={handleToggleActive}
                className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'justify-center' : ''} ${isExecuting ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: `${accentColor}26`, // unified tint
                    minHeight: '100px'
                }}
            >
                {/* Header Row */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px] mb-4' : ''}`}>
                    <div className="flex items-center gap-[20px]">
                        <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-transform duration-500 ${isExecuting ? 'animate-pulse' : ''} ${isActive ? 'scale-110' : ''}`}>
                            <img
                                src="./res/ui/perf.png"
                                alt="Performance"
                                className="w-14 h-14 object-contain opacity-90 transition-opacity"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                PERFORMANCE_SET_PROTOCOL
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                                <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic truncate max-w-[200px] transition-colors ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                                    {isActive ? (isModified ? 'PENDING_MODIFICATIONS' : 'PROTOCOL_READY') : 'STANDBY_MODE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Config Panel Content */}
                {isActive && (
                    <div className="flex flex-col gap-4 mt-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>

                        {/* Toggles Grid (Image 3 layout) */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {toggles.map((item) => (
                                <ToggleButton
                                    key={item.key}
                                    label={item.label}
                                    isActive={localToggles[item.key]}
                                    onClick={() => toggleKey(item.key)}
                                    accentColor={accentColor}
                                    disabled={isExecuting}
                                />
                            ))}
                        </div>

                        {/* Performance Preset Buttons (Bottom bar of Image 3) */}
                        <div className="grid grid-cols-4 gap-2 mt-2">
                            <ModeButton
                                label="LOW [ECO]"
                                isActive={localMode === 'low'}
                                onClick={() => applyPreset('low')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                            />
                            <ModeButton
                                label="BALANCED"
                                isActive={localMode === 'balanced'}
                                onClick={() => applyPreset('balanced')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                            />
                            <ModeButton
                                label="HIGH [GPU]"
                                isActive={localMode === 'high'}
                                onClick={() => applyPreset('high')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                            />
                            <ModeButton
                                label="CUSTOM"
                                isActive={localMode === 'custom'}
                                onClick={() => applyPreset('custom')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                            />
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default PerformanceConfigCard;
