import React from 'react';
import Subsection from './Subsection';
import AssetInput from '../AssetInput';
import { useTranslation } from '../../hooks/useTranslation';
import { Category } from '../../types';

interface SystemTabProps {
    activeAccent: string;
    allGamesCategory: Category;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    taskbarMargin: number;
    onUpdateTaskbarMargin: (val: number) => void;
    uiScale: number;
    onUpdateUIScale: (val: number) => void;
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    onResolveAsset: (path: string | undefined) => string;
    handleSystemFormat: () => void;
}

const PanicResetButton: React.FC<{ handleAction: () => void; t: any }> = ({ handleAction, t }) => {
    const [clicks, setClicks] = React.useState(0);
    const [isBreaking, setIsBreaking] = React.useState(false);

    const handleClick = () => {
        if (clicks < 3) {
            setClicks(prev => prev + 1);
            setIsBreaking(true);
            setTimeout(() => setIsBreaking(false), 200);
        } else {
            handleAction();
            // Reset state so it's not "stuck" in breaking mode
            setClicks(0);
            setIsBreaking(false);
        }
    };

    const glitchStyle = isBreaking ? {
        transform: `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`,
        filter: 'hue-rotate(90deg) contrast(150%)',
    } : {};

    const damageLevels = [
        'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]',
        'shadow-[0_0_30px_rgba(239,68,68,0.5)] border-red-500/80 scale-[0.99] text-red-400',
        'shadow-[0_0_50px_rgba(239,68,68,0.7)] border-red-400 scale-[0.98] rotate-[0.5deg] text-red-300 animate-pulse',
        'shadow-[0_0_80px_rgba(255,0,0,0.9)] border-red-300 scale-[0.95] -rotate-[1deg] text-white bg-red-600 animate-[ping_0.2s_infinite]'
    ];

    const messages = [
        t('system_tab.panic_factory_reset'),
        '[ ! CAUTION_SYSTEM_INTERRUPT ! ]',
        '[ !! KERNEL_PANIC_IMMUTABLE !! ]',
        '[ !!! VOID_PROTOCOL_ACTIVE !!! ]'
    ];

    return (
        <button
            onClick={handleClick}
            style={glitchStyle}
            className={`
                w-full py-4 bg-transparent font-bold text-[10px] uppercase tracking-[0.5em] border-2 transition-all active:scale-90 relative overflow-hidden
                ${damageLevels[clicks] || damageLevels[0]}
            `}
        >
            {messages[clicks] || messages[0]}
            {isBreaking && (
                <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none"></div>
            )}
        </button>
    );
};

const SystemTab: React.FC<SystemTabProps> = ({
    activeAccent, allGamesCategory, onUpdateCategories,
    taskbarMargin, onUpdateTaskbarMargin, uiScale, onUpdateUIScale, triggerFileBrowser, onResolveAsset, handleSystemFormat
}) => {
    const { t, language, setLanguage } = useTranslation();
    const [localScale, setLocalScale] = React.useState(uiScale);

    // Sync local state if prop changes externally
    React.useEffect(() => {
        setLocalScale(uiScale);
    }, [uiScale]);
    return (
        <div className="flex flex-col gap-6 lg:gap-8">
            <Subsection title={t('system_tab.language_settings')} accentColor={activeAccent}>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                    <label className="text-[9px] lg:text-[10px] opacity-60 uppercase tracking-[0.2em] text-white font-bold">{t('system_tab.system_language')}</label>
                    <div className="flex gap-4">
                        <button onClick={() => setLanguage('en')} className={`px-4 py-2 border-2 ${language === 'en' ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10'} font-bold text-[8px] uppercase tracking-widest transition-all hover:text-white hover:border-white`}>ENGLISH</button>
                        <button onClick={() => setLanguage('es')} className={`px-4 py-2 border-2 ${language === 'es' ? 'bg-white text-black border-white' : 'bg-transparent text-white/40 border-white/10'} font-bold text-[8px] uppercase tracking-widest transition-all hover:text-white hover:border-white`}>ESPAÑOL</button>
                    </div>
                </div>
            </Subsection>

            <Subsection title={t('system_tab.interface_control_matrix')} accentColor={activeAccent}>
                <div className="flex flex-wrap gap-4 col-span-full">
                    {[
                        { key: 'assetColor', label: t('system_tab.assets_hex'), default: '#a855f7' },
                        { key: 'nodeColor', label: t('system_tab.nodes_hex'), default: '#06b6d4' },
                        { key: 'syncColor', label: t('system_tab.sync_hex'), default: '#22c55e' },
                        { key: 'coreColor', label: t('system_tab.core_hex'), default: '#9acd32' }
                    ].map(cp => {
                        const currentColor = (allGamesCategory as any)[cp.key] || cp.default;
                        return (
                            <div key={cp.key} className="flex flex-col gap-1.5">
                                <label className="text-[7px] opacity-40 uppercase tracking-widest font-bold">{cp.label}</label>
                                <div className="relative group/picker overflow-hidden border-2 transition-all p-[1.5px]"
                                    style={{
                                        width: '44px',
                                        height: '20px',
                                        borderColor: currentColor,
                                        clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                                        WebkitClipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)'
                                    }}>
                                    <div className="absolute inset-0" style={{ backgroundColor: currentColor }}></div>
                                    <input type="color" value={currentColor} onChange={e => onUpdateCategories(prev => prev.map(c => c.id === 'all' ? { ...c, [cp.key]: e.target.value } : c))} className="absolute inset-0 w-[150%] h-[150%] bg-transparent border-none cursor-pointer -translate-x-1/4 -translate-y-1/4 opacity-0" />
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-2 mt-2 col-span-full">
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] lg:text-[10px] opacity-60 uppercase tracking-[0.2em] text-white font-bold">{t('system_tab.taskbar_offset_buffer')}</label>
                        <button
                            onClick={() => onUpdateTaskbarMargin(0)}
                            className="text-[7px] font-bold opacity-30 hover:opacity-100 border border-white/10 px-1.5 py-0.5"
                        >
                            {t('system_tab.reset_btn')}
                        </button>
                    </div>
                    <div className="flex justify-between items-center mb-1"><span className="text-[11px] font-mono text-white/90 shadow-black drop-shadow-md" style={{ textShadow: `0 0 10px ${activeAccent}` }}>{taskbarMargin}PX</span></div>
                    <input type="range" min="0" max="120" value={taskbarMargin} onChange={e => onUpdateTaskbarMargin(parseInt(e.target.value))} className="w-full h-1 bg-white/10 appearance-none cursor-pointer hover:bg-white/20 transition-all" style={{ outline: 'none', accentColor: activeAccent }} />
                </div>
                <div className="flex flex-col gap-2 mt-3 col-span-full">
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] lg:text-[10px] opacity-60 uppercase tracking-[0.2em] text-white font-bold">{t('system_tab.chroma_mesh_transparency')}</label>
                        <button
                            onClick={() => onUpdateCategories(prev => prev.map(c => c.id === 'all' ? { ...c, cardOpacity: 0.7 } : c))}
                            className="text-[7px] font-bold opacity-30 hover:opacity-100 border border-white/10 px-1.5 py-0.5"
                        >
                            {t('system_tab.reset_btn')}
                        </button>
                    </div>
                    <div className="flex justify-between items-center mb-1"><span className="text-[11px] font-mono text-white/90 shadow-black drop-shadow-md" style={{ textShadow: `0 0 10px ${activeAccent}` }}>{Math.round((allGamesCategory.cardOpacity ?? 0.7) * 100)}%</span></div>
                    <input type="range" min="0.1" max="1.0" step="0.01" value={allGamesCategory.cardOpacity ?? 0.7} onChange={e => onUpdateCategories(prev => prev.map(c => c.id === 'all' ? { ...c, cardOpacity: parseFloat(e.target.value) } : c))} className="w-full h-1 bg-white/10 appearance-none cursor-pointer hover:bg-white/20 transition-all" style={{ outline: 'none', accentColor: activeAccent }} />
                </div>
                <div className="flex flex-col gap-2 mt-3 col-span-full">
                    <div className="flex justify-between items-center">
                        <label className="text-[9px] lg:text-[10px] opacity-60 uppercase tracking-[0.2em] text-white font-bold">{t('system_tab.terminal_dpi_scaling')}</label>
                        <button
                            onClick={() => {
                                setLocalScale(1.0);
                                onUpdateUIScale(1.0);
                            }}
                            className="text-[7px] font-bold opacity-30 hover:opacity-100 border border-white/10 px-1.5 py-0.5"
                        >
                            {t('system_tab.reset_btn')}
                        </button>
                    </div>
                    <div className="flex justify-between items-center mb-1"><span className="text-[11px] font-mono text-white/90 shadow-black drop-shadow-md" style={{ textShadow: `0 0 10px ${activeAccent}` }}>{Math.round(localScale * 100)}%</span></div>
                    <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.1"
                        value={localScale}
                        onChange={e => {
                            const val = parseFloat(e.target.value);
                            setLocalScale(val);
                            onUpdateUIScale(val);
                        }}
                        className="w-full h-1 bg-white/10 appearance-none cursor-pointer hover:bg-white/20 transition-all font-bold"
                        style={{ outline: 'none', accentColor: activeAccent }}
                    />
                </div>
            </Subsection>

            <Subsection title={t('system_tab.ambience_protocol')} accentColor={activeAccent}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 col-span-full">
                    {[
                        { key: 'vignetteEnabled', label: t('system_tab.vignette_shadow') },
                        { key: 'scanlineEnabled', label: t('system_tab.scanline_fx') },
                        { key: 'gridEnabled', label: t('system_tab.matrix_grid') },
                        { key: 'bgAnimationsEnabled', label: t('system_tab.ambient_motion') },
                        { key: 'highQualityBlobs', label: t('system_tab.ambient_quality') },
                        { key: 'lowResWallpaper', label: t('system_tab.wallpaper_res') },
                        { key: 'wallpaperAAEnabled', label: t('system_tab.wallpaper_smooth') },
                        { key: 'cardTransparencyEnabled', label: t('system_tab.card_transparency') },
                        { key: 'cardBlurEnabled', label: t('system_tab.card_blur') }
                    ].map(toggle => (
                        <div key={toggle.key} className="flex items-center justify-between py-2 border-b border-white/5">
                            <label className="text-[8px] lg:text-[9px] font-bold uppercase tracking-widest text-white/60">{toggle.label}</label>
                            <button
                                onClick={() => onUpdateCategories(prev => prev.map(c => c.id === 'all' ? {
                                    ...c,
                                    [toggle.key]: !(c as any)[toggle.key],
                                    performanceMode: 'custom' // Switch to custom when manually toggled
                                } : c))}
                                className={`w-12 h-6 relative transition-all duration-300 border-2 ${(allGamesCategory as any)[toggle.key] !== false ? `bg-[localAccent] border-[localAccent] shadow-lg` : 'bg-black border-white/20'}`}
                                style={{
                                    backgroundColor: (allGamesCategory as any)[toggle.key] !== false ? activeAccent : undefined,
                                    borderColor: (allGamesCategory as any)[toggle.key] !== false ? activeAccent : undefined
                                }}
                            >
                                <div className={`absolute top-0.5 bottom-0.5 w-4 transition-all duration-300 ${(allGamesCategory as any)[toggle.key] !== false ? 'right-0.5 bg-black' : 'left-0.5 bg-white/20'}`}></div>
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-4 mt-8 pt-4 border-t border-white/10 col-span-full">
                    <div className="flex flex-col gap-1">
                        <span className="text-[7px] text-white/40 font-mono">ADJUST_RENDER_FIDELITY</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                        {[
                            {
                                id: 'low',
                                label: t('system_tab.performance_low'),
                                config: {
                                    vignetteEnabled: false, scanlineEnabled: false, gridEnabled: false, bgAnimationsEnabled: false,
                                    lowResWallpaper: true, wallpaperAAEnabled: true, highQualityBlobs: false,
                                    cardTransparencyEnabled: false, cardBlurEnabled: false, cardOpacity: 1.0
                                }
                            },
                            {
                                id: 'balanced',
                                label: t('system_tab.performance_balanced'),
                                config: {
                                    vignetteEnabled: true, scanlineEnabled: false, gridEnabled: true, bgAnimationsEnabled: true,
                                    lowResWallpaper: false, wallpaperAAEnabled: false, highQualityBlobs: false,
                                    cardTransparencyEnabled: true, cardBlurEnabled: false, cardOpacity: 0.7
                                }
                            },
                            {
                                id: 'high',
                                label: t('system_tab.performance_high'),
                                config: {
                                    vignetteEnabled: true, scanlineEnabled: true, gridEnabled: true, bgAnimationsEnabled: true,
                                    lowResWallpaper: false, wallpaperAAEnabled: false, highQualityBlobs: true,
                                    cardTransparencyEnabled: true, cardBlurEnabled: true, cardOpacity: 0.7
                                }
                            },
                            { id: 'custom', label: t('system_tab.performance_custom'), config: null }
                        ].map(mode => {
                            const currentMode = (allGamesCategory as any).performanceMode || 'high';
                            const isActive = currentMode === mode.id;

                            return (
                                <button
                                    key={mode.id}
                                    onClick={() => onUpdateCategories(prev => prev.map(c => c.id === 'all' ? {
                                        ...c,
                                        performanceMode: mode.id as any,
                                        ...(mode.config || {}) // Apply preset config if not custom
                                    } : c))}
                                    className={`
                                        w-full py-3 px-2 border-2 text-[8px] lg:text-[9px] font-bold uppercase tracking-widest transition-all
                                        ${isActive
                                            ? 'text-black'
                                            : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white'
                                        }
                                    `}
                                    style={{
                                        backgroundColor: isActive ? activeAccent : undefined,
                                        borderColor: isActive ? activeAccent : undefined
                                    }}
                                >
                                    {mode.label}
                                </button>
                            );
                        })}
                    </div>
                    {(allGamesCategory as any).performanceMode === 'low' && (
                        <div className="text-[8px] text-emerald-400 font-mono mt-1 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                            {t('system_tab.performance_low_desc')}
                        </div>
                    )}
                    {(allGamesCategory as any).performanceMode === 'custom' && (
                        <div className="text-[8px] text-amber-400 font-mono mt-1 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                            {t('system_tab.performance_custom_desc')}
                        </div>
                    )}
                </div>
            </Subsection>

            <Subsection title={t('system_tab.system_maintenance')} accentColor={activeAccent}>
                <div className="flex flex-col gap-4 col-span-full">
                    <div className="flex items-center justify-between py-2 border-b border-white/5 w-full">
                        <label className="text-[9px] lg:text-[10px] opacity-60 uppercase tracking-[0.2em] text-white font-bold whitespace-nowrap">{t('system_tab.interface_refresh')}</label>
                        <button onClick={() => window.location.reload()} className="px-6 py-2 bg-transparent text-cyan-400 font-bold text-[8px] uppercase tracking-[0.2em] border-2 border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all active:scale-95 shadow-[0_0_10px_rgba(34,211,238,0.1)]">
                            {t('system_tab.reload_ui_btn')}
                        </button>
                    </div>
                </div>
            </Subsection>

            <Subsection title={t('system_tab.data_zone')} accentColor="#ef4444">
                <div className="lg:col-span-2 flex flex-col gap-5 p-6 lg:p-10 border border-red-600/50 bg-red-950/20 shadow-[0_0_50px_rgba(239,68,68,0.2)] relative overflow-hidden group/hazard">
                    {/* Hazard Stripes Background */}
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none rotate-45 translate-x-12 -translate-y-12"
                        style={{ background: 'repeating-linear-gradient(-45deg, #ef4444, #ef4444 10px, transparent 10px, transparent 20px)' }}></div>
                    <div className="absolute bottom-0 left-0 w-32 h-32 opacity-10 pointer-events-none rotate-45 -translate-x-12 translate-y-12"
                        style={{ background: 'repeating-linear-gradient(-45deg, #ef4444, #ef4444 10px, transparent 10px, transparent 20px)' }}></div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center border-2 border-red-500 animate-pulse bg-red-500/10">
                            <span className="text-red-500 font-bold text-xl">!</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h4 className="text-[12px] lg:text-[14px] font-['Press_Start_2P'] font-bold uppercase tracking-widest text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]">{t('system_tab.autodestruction_protocol')}</h4>
                            <span className="text-[7px] lg:text-[8px] font-mono text-red-400 opacity-60 uppercase tracking-[0.4em]">{t('system_tab.hazard_level')}</span>
                        </div>
                    </div>

                    <p className="text-[10px] lg:text-[11px] text-red-100/70 font-mono leading-relaxed max-w-2xl relative z-10">
                        {t('system_tab.factory_reset_warning')}
                    </p>

                    <div className="flex gap-4 mt-4 relative z-10">
                        <PanicResetButton handleAction={handleSystemFormat} t={t} />
                    </div>

                    {/* Danger Scanline */}
                    <div className="absolute inset-0 pointer-events-none animate-pulse opacity-10 bg-[linear-gradient(transparent_0%,rgba(239,68,68,0.2)_50%,transparent_100%)]" style={{ backgroundSize: '100% 10px' }}></div>
                </div>
            </Subsection>
        </div >
    );
};

export default SystemTab;
