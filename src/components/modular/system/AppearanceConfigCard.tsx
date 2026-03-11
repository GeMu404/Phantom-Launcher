import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Category } from '../../../types';

interface AppearanceConfigCardProps {
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
    categories: Category[];
    isSecretUnlocked: boolean;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    taskbarMargin: number;
    onUpdateTaskbarMargin: (val: number) => void;
    uiScale: number;
    onUpdateUIScale: (val: number) => void;
    cardTransparencyEnabled: boolean;
    outerGlowEnabled: boolean;
    outlineEnabled: boolean;
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

const ColorPickerBlock = ({
    label,
    color,
    onChange
}: {
    label: string,
    color: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => {
    return (
        <div className="relative group/picker flex h-10 w-full cursor-pointer hover:opacity-100 opacity-90 transition-opacity">
            {/* Text Side */}
            <div
                className="flex-1 flex items-center px-4 font-bold text-[9px] text-white tracking-[0.1em] uppercase"
                style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)'
                }}
            >
                {label}
            </div>
            {/* Color Area - Slanted divider simulating the image diagram */}
            <div
                className="relative w-[34px] ml-1"
                style={{
                    backgroundColor: color,
                    clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)'
                }}
            >
                <input
                    type="color"
                    value={color}
                    onChange={onChange}
                    className="absolute inset-0 w-[150%] h-[150%] -top-2 -left-2 cursor-pointer opacity-0"
                />
            </div>
        </div>
    );
};

const FixedSlider = ({
    label,
    value,
    setValue,
    min,
    max,
    step,
    unit,
    accentColor
}: {
    label: string,
    value: number,
    setValue: (v: number) => void,
    min: number,
    max: number,
    step: number,
    unit: string,
    accentColor: string
}) => {
    // We render a custom track based on progress
    const progress = ((value - min) / (max - min)) * 100;

    return (
        <div className="flex flex-col gap-1 w-full relative">
            <div className="flex justify-between items-center px-1">
                <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-white/80">{label}</span>
                <span className="text-[9px] font-bold tracking-[0.1em] text-white/80">{unit === '%' ? Math.round(value * 100) + '%' : `+ ${value}PX`}</span>
            </div>

            <div
                className="h-8 w-full relative group cursor-pointer mt-1"
                style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)'
                }}
            >
                {/* Fill track */}
                <div
                    className="absolute top-0 bottom-0 left-0 transition-all duration-150"
                    style={{
                        width: `${progress}%`,
                        minWidth: progress > 0 ? '16px' : '0px',
                        backgroundColor: accentColor
                    }}
                ></div>

                {/* Invisible native input over everything */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => setValue(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </div>
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

const AppearanceConfigCard: React.FC<AppearanceConfigCardProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    onCommandUpdate,
    allGamesCategory,
    categories,
    isSecretUnlocked,
    onUpdateCategories,
    taskbarMargin,
    onUpdateTaskbarMargin,
    uiScale,
    onUpdateUIScale,
    cardTransparencyEnabled,
    outerGlowEnabled,
    outlineEnabled
}) => {
    const [isExecuting, setIsExecuting] = useState(false);

    // List of dynamic cores and their respective configuration keys inside `Category`
    const coreDefinitions = [
        { id: 'core', label: 'CONFIG_CORE', key: 'coreColor', default: '#9acd32' },
        { id: 'games', label: 'GAMES_CORE', key: 'configColor', default: '#ff0055' },
        { id: 'asset', label: 'ASSET_CORE', key: 'assetColor', default: '#a855f7' },
        { id: 'sync', label: 'SYNC_CORE', key: 'syncColor', default: '#22c55e' },
        { id: 'nodes', label: 'LIBRARY_CORE', key: 'nodeColor', default: '#06b6d4' },
        { id: 'secret', label: 'SECRET_CORE', key: 'secretColor', default: '#b829da' }
    ];

    // Local Config State dynamically mapped from definitions
    const [localColors, setLocalColors] = useState<Record<string, string>>(() => {
        const initialColors: Record<string, string> = {};
        coreDefinitions.forEach(core => {
            initialColors[core.key] = (allGamesCategory as any)?.[core.key] || core.default;
        });
        return initialColors;
    });

    const [localCardOpacity, setLocalCardOpacity] = useState(allGamesCategory?.cardOpacity ?? 0.12);
    const [localTaskbarMargin, setLocalTaskbarMargin] = useState(taskbarMargin);
    const [localUiScale, setLocalUiScale] = useState(uiScale);

    // Performance & Appearance states
    const [localSlimMode, setLocalSlimMode] = useState(!!allGamesCategory?.slimModeEnabled);
    const [localMonochrome, setLocalMonochrome] = useState(!!allGamesCategory?.monochromeModeEnabled);
    const [localGlow, setLocalGlow] = useState(!!allGamesCategory?.outerGlowEnabled);
    const [localOutline, setLocalOutline] = useState(allGamesCategory?.outlineEnabled ?? true);
    const [localTransEnabled, setLocalTransEnabled] = useState(allGamesCategory?.cardTransparencyEnabled ?? true);

    const [localVignette, setLocalVignette] = useState(allGamesCategory?.vignetteEnabled ?? true);
    const [localScanline, setLocalScanline] = useState(allGamesCategory?.scanlineEnabled ?? true);
    const [localGrid, setLocalGrid] = useState(allGamesCategory?.gridEnabled ?? true);
    const [localBgAnim, setLocalBgAnim] = useState(allGamesCategory?.bgAnimationsEnabled ?? true);
    const [localLowRes, setLocalLowRes] = useState(!!allGamesCategory?.lowResWallpaper);

    const [localPerformanceMode, setLocalPerformanceMode] = useState(allGamesCategory?.performanceMode || 'custom');
    const [localPrimingAnim, setLocalPrimingAnim] = useState(allGamesCategory?.primingAnimation || 'waterfill');

    const cardRef = useRef<HTMLDivElement>(null);

    // Sync from props when becoming inactive
    useEffect(() => {
        if (!isActive) {
            const nextColors: Record<string, string> = {};
            coreDefinitions.forEach(core => {
                nextColors[core.key] = (allGamesCategory as any)?.[core.key] || core.default;
            });
            setLocalColors(nextColors);
            setLocalCardOpacity(allGamesCategory?.cardOpacity ?? 0.12);
            setLocalTaskbarMargin(taskbarMargin);
            setLocalUiScale(uiScale);

            setLocalSlimMode(!!allGamesCategory?.slimModeEnabled);
            setLocalMonochrome(!!allGamesCategory?.monochromeModeEnabled);
            setLocalGlow(!!allGamesCategory?.outerGlowEnabled);
            setLocalOutline(allGamesCategory?.outlineEnabled ?? true);
            setLocalTransEnabled(allGamesCategory?.cardTransparencyEnabled ?? true);

            setLocalVignette(allGamesCategory?.vignetteEnabled ?? true);
            setLocalScanline(allGamesCategory?.scanlineEnabled ?? true);
            setLocalGrid(allGamesCategory?.gridEnabled ?? true);
            setLocalBgAnim(allGamesCategory?.bgAnimationsEnabled ?? true);
            setLocalLowRes(!!allGamesCategory?.lowResWallpaper);

            setLocalPerformanceMode(allGamesCategory?.performanceMode || 'custom');
            setLocalPrimingAnim(allGamesCategory?.primingAnimation || 'waterfill');
        }
    }, [allGamesCategory, taskbarMargin, uiScale, isActive]);

    useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    // Apply Presets
    const applyPreset = (mode: 'custom' | 'low' | 'balanced' | 'high') => {
        if (isExecuting) return;
        setLocalPerformanceMode(mode);
        if (mode === 'custom') return;

        if (mode === 'low') {
            setLocalVignette(false);
            setLocalScanline(false);
            setLocalGrid(false);
            setLocalBgAnim(false);
            setLocalLowRes(true);
            setLocalGlow(false);
            // decoupled transparency from low preset as requested
        } else if (mode === 'balanced') {
            setLocalVignette(true);
            setLocalScanline(true);
            setLocalGrid(false);
            setLocalBgAnim(true);
            setLocalLowRes(false);
            setLocalGlow(true);
            setLocalTransEnabled(true);
        } else if (mode === 'high') {
            setLocalVignette(true);
            setLocalScanline(true);
            setLocalGrid(true);
            setLocalBgAnim(true);
            setLocalLowRes(false);
            setLocalGlow(true);
            setLocalTransEnabled(true);
        }
    };

    // Check if there are pending modifications
    const isModifiedColors = coreDefinitions.some(
        core => localColors[core.key] !== ((allGamesCategory as any)[core.key] || core.default)
    );

    const isModified =
        isModifiedColors ||
        localCardOpacity !== (allGamesCategory.cardOpacity ?? 0.12) ||
        localTaskbarMargin !== taskbarMargin ||
        localUiScale !== uiScale ||
        localSlimMode !== !!allGamesCategory.slimModeEnabled ||
        localMonochrome !== !!allGamesCategory.monochromeModeEnabled ||
        localGlow !== !!allGamesCategory.outerGlowEnabled ||
        localOutline !== (allGamesCategory.outlineEnabled ?? true) ||
        localTransEnabled !== (allGamesCategory.cardTransparencyEnabled ?? true) ||
        localVignette !== (allGamesCategory.vignetteEnabled ?? true) ||
        localScanline !== (allGamesCategory.scanlineEnabled ?? true) ||
        localGrid !== (allGamesCategory.gridEnabled ?? true) ||
        localBgAnim !== (allGamesCategory.bgAnimationsEnabled ?? true) ||
        localLowRes !== !!allGamesCategory.lowResWallpaper ||
        localPerformanceMode !== (allGamesCategory.performanceMode || 'custom') ||
        localPrimingAnim !== (allGamesCategory.primingAnimation || 'waterfill');

    const handleExecute = useCallback(() => {
        if (isExecuting) return;
        setIsExecuting(true);

        let prog = 0;
        onCommandUpdate(
            { text: 'APARENCE_SET_PROTOCOL', desc: 'RECOMPILING_STYLE_MATRICES' },
            undefined, 0, true, true
        );

        const interval = setInterval(() => {
            prog += 5 + Math.random() * 5;
            if (prog >= 98) {
                prog = 98;
                clearInterval(interval);
            }
            onCommandUpdate(
                { text: 'APARENCE_SET_PROTOCOL', desc: 'UPDATING_CORE_GEOMETRY' },
                undefined,
                prog,
                true,
                true
            );
        }, 30);

        setTimeout(() => {
            clearInterval(interval);

            onUpdateCategories(prev => prev.map(c => c.id === 'all' ? {
                ...c,
                ...localColors,
                cardOpacity: localCardOpacity,
                slimModeEnabled: localSlimMode,
                monochromeModeEnabled: localMonochrome,
                outerGlowEnabled: localGlow,
                innerGlowEnabled: localGlow,
                outlineEnabled: localOutline,
                cardTransparencyEnabled: localTransEnabled,
                vignetteEnabled: localVignette,
                scanlineEnabled: localScanline,
                gridEnabled: localGrid,
                bgAnimationsEnabled: localBgAnim,
                lowResWallpaper: localLowRes,
                performanceMode: localPerformanceMode,
                primingAnimation: localPrimingAnim
            } : c));

            onUpdateTaskbarMargin(localTaskbarMargin);
            onUpdateUIScale(localUiScale);

            onCommandUpdate(
                { text: 'APARENCE_SET_PROTOCOL', desc: 'STYLING_MODULES_SUCCESSFULLY_UPDATED' },
                undefined,
                100,
                true,
                true
            );

            setTimeout(() => {
                setIsExecuting(false);
                onActiveToggle(false);
            }, 800);
        }, 600);
    }, [isExecuting, onCommandUpdate, onUpdateCategories, localColors, localCardOpacity, localSlimMode, localMonochrome, localGlow, localOutline, localTransEnabled, localVignette, localScanline, localGrid, localBgAnim, localLowRes, localPerformanceMode, localPrimingAnim, onUpdateTaskbarMargin, localTaskbarMargin, onUpdateUIScale, localUiScale, onActiveToggle]);

    const executeRef = useRef(handleExecute);
    useEffect(() => { executeRef.current = handleExecute; }, [handleExecute]);
    const stableExecute = useCallback(() => executeRef.current(), []);

    useEffect(() => {
        if (isActive) {
            onCommandUpdate(
                {
                    text: 'APPEARANCE_SET_PROTOCOL',
                    desc: 'THIS PROTOCOL WILL RECOMPILE THE STYLING MATRICES AND OVERRIDE GEOMETRY LIMITS.'
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
    };

    // Check if Secret core is actually present in categories
    const hasSecretCore = isSecretUnlocked;

    return (
        <div ref={cardRef} className="w-full relative">
            <ConfigCardBorder color={accentColor} isActive={isActive} outerGlowEnabled={outerGlowEnabled} />

            <div
                onClick={handleToggleActive}
                className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'justify-center cursor-pointer' : ''} ${isExecuting ? 'cursor-wait opacity-80' : ''}`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: cardTransparencyEnabled ? `${accentColor}1F` : `${accentColor}26`,
                    minHeight: '100px'
                }}
            >
                {/* Header Row */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px]' : ''}`}>
                    <div className="flex items-center gap-[20px]">
                        <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-transform duration-500 ${isExecuting ? 'animate-pulse' : ''} ${isActive ? 'scale-110' : ''}`}>
                            <img
                                src="./res/ui/paint.png"
                                alt="Appearance"
                                className="w-14 h-14 object-contain opacity-90 transition-opacity"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                APPEARANCE_SET_PROTOCOL
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                                <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic truncate max-w-[200px] transition-colors ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                                    {isActive ? (isModified ? 'PENDING_MODIFICATIONS' : 'READY_FOR_EXECUTION') : 'STANDBY_MODE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Config Panel Content */}
                {isActive && (
                    <div className="flex flex-col gap-6 mt-6 pointer-events-auto w-full" onClick={(e) => e.stopPropagation()}>

                        {/* Colors Matrix */}
                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
                                {coreDefinitions.map(core => {
                                    // Conditional for Secret Core
                                    if (core.id === 'secret') {
                                        return isSecretUnlocked ? (
                                            <ColorPickerBlock
                                                key={core.id}
                                                label={core.label}
                                                color={localColors[core.key]}
                                                onChange={e => setLocalColors(prev => ({ ...prev, [core.key]: e.target.value }))}
                                            />
                                        ) : null;
                                    }

                                    return (
                                        <ColorPickerBlock
                                            key={core.id}
                                            label={core.label}
                                            color={localColors[core.key]}
                                            onChange={e => setLocalColors(prev => ({ ...prev, [core.key]: e.target.value }))}
                                        />
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sliders Zone */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 pt-2">
                            <FixedSlider
                                label="CARD_TRANSPARENCY"
                                value={localCardOpacity}
                                setValue={setLocalCardOpacity}
                                min={0.1}
                                max={1.0}
                                step={0.1}
                                unit="%"
                                accentColor={accentColor}
                            />

                            <FixedSlider
                                label="TASKBAR_OFFSET"
                                value={localTaskbarMargin}
                                setValue={setLocalTaskbarMargin}
                                min={0}
                                max={120}
                                step={10}
                                unit="PX"
                                accentColor={accentColor}
                            />

                            <FixedSlider
                                label="TERMINAL_DPI_SCALING"
                                value={localUiScale}
                                setValue={setLocalUiScale}
                                min={0.5}
                                max={1.5}
                                step={0.1}
                                unit="%"
                                accentColor={accentColor}
                            />
                        </div>

                        {/* TogglesZone */}
                        <div className="flex flex-col gap-6 pt-2">
                            {/* Performance Presets */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[7px] font-black tracking-[0.2em] opacity-30 px-1 uppercase text-white/50">PERFORMANCE_PRESETS</span>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                    <ModeButton label="LOW [ECO]" isActive={localPerformanceMode === 'low'} onClick={() => applyPreset('low')} accentColor={accentColor} disabled={isExecuting} />
                                    <ModeButton label="BALANCED" isActive={localPerformanceMode === 'balanced'} onClick={() => applyPreset('balanced')} accentColor={accentColor} disabled={isExecuting} />
                                    <ModeButton label="HIGH [GPU]" isActive={localPerformanceMode === 'high'} onClick={() => applyPreset('high')} accentColor={accentColor} disabled={isExecuting} />
                                    <ModeButton label="CUSTOM" isActive={localPerformanceMode === 'custom'} onClick={() => applyPreset('custom')} accentColor={accentColor} disabled={isExecuting} />
                                </div>
                            </div>

                            {/* Render Protocols */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[7px] font-black tracking-[0.2em] opacity-30 px-1 uppercase text-white/50">RENDER_PROTOCOLS</span>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                    <ToggleButton label="SLIM_MODE" isActive={localSlimMode} onClick={() => { setLocalSlimMode(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="MONOCHROME" isActive={localMonochrome} onClick={() => { setLocalMonochrome(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="GLOW_FX" isActive={localGlow} onClick={() => { setLocalGlow(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="OUTLINE_FX" isActive={localOutline} onClick={() => setLocalOutline(p => !p)} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="TRANS_FX" isActive={localTransEnabled} onClick={() => { setLocalTransEnabled(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="VIGNETTE_FX" isActive={localVignette} onClick={() => { setLocalVignette(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="SCANLINE_FX" isActive={localScanline} onClick={() => { setLocalScanline(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="GRID_FX" isActive={localGrid} onClick={() => { setLocalGrid(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="AMBIENT_FX" isActive={localBgAnim} onClick={() => { setLocalBgAnim(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                    <ToggleButton label="LOW_RES_FX" isActive={localLowRes} onClick={() => { setLocalLowRes(p => !p); setLocalPerformanceMode('custom'); }} accentColor={accentColor} disabled={isExecuting} />
                                </div>
                            </div>

                            {/* Priming Animations */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[7px] font-black tracking-[0.2em] opacity-30 px-1 uppercase text-white/50">PRIMING_ANIMATION</span>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {(['waterfill', 'scanline', 'ignition', 'charge', 'shockwave', 'glow_pulse'] as const).map(anim => (
                                        <ModeButton
                                            key={anim}
                                            label={anim.toUpperCase()}
                                            isActive={localPrimingAnim === anim}
                                            onClick={() => setLocalPrimingAnim(anim)}
                                            accentColor={accentColor}
                                            disabled={isExecuting}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default AppearanceConfigCard;
