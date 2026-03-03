
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Category, Game } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';

interface GameEditFormProps {
    game: Game | null;
    accentColor: string;
    categories: Category[];
    onSave: (formData: any) => void;
    onCancel: () => void;
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    triggerCloudBrowser: (target: string, type: string, initialQuery?: string) => void;
    resolveAsset: (path: string | undefined, width?: number) => string;
    sgdbKey: string;
    sgdbEnabled: boolean;
    onCommandUpdate: (
        command: any,
        execute?: (() => void) | null,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean,
        scrollProgress?: number | null,
        showScrollMarker?: boolean | null,
        onExecuteStart?: () => void,
        onExecuteEnd?: () => void
    ) => void;
    lastSelectedAsset?: { target: string; path: string; timestamp: number } | null;
    onClearLastAsset?: () => void;
    onDelete?: (gameId: string) => void;
    isActive: boolean;
}

const typeMap: Record<string, string> = { cover: 'grid', banner: 'banner', logo: 'logo', wallpaper: 'hero' };

const GameEditForm: React.FC<GameEditFormProps> = ({
    game, accentColor, categories, onSave, onCancel, triggerFileBrowser, triggerCloudBrowser, resolveAsset, sgdbKey, sgdbEnabled, onCommandUpdate, lastSelectedAsset, onClearLastAsset, onDelete, isActive
}) => {
    const { t } = useTranslation();

    const [formData, setFormData] = useState({
        title: game?.title || '',
        execPath: game?.execPath || '',
        execArgs: game?.execArgs || '',
        cover: game?.cover || '',
        banner: game?.banner || '',
        logo: game?.logo || '',
        wallpaper: game?.wallpaper || '',
        categoryIds: categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.games.some(g => g.id === game?.id)).map(c => c.id)
    });

    const [isDestructionActive, setIsDestructionActive] = useState(false);
    const [holdProgress, setHoldProgress] = useState(0);
    const holdTimerRef = useRef<any>(null);

    const handleDeleteStart = useCallback(() => {
        if (!isDestructionActive || !game) return;

        const startTime = Date.now();
        const duration = 3000;

        holdTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.min(100, (elapsed / duration) * 100);
            setHoldProgress(p);

            if (p >= 100) {
                clearInterval(holdTimerRef.current);
                if (onDelete) onDelete(game.id);
            }
        }, 30);
    }, [isDestructionActive, game, onDelete]);

    const handleDeleteEnd = useCallback(() => {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        setHoldProgress(0);
    }, []);

    useEffect(() => {
        if (!isActive) {
            setIsDestructionActive(false);
            onCommandUpdate(null, null, 0, false, false);
            return;
        }

        if (isDestructionActive) {
            onCommandUpdate(
                {
                    text: 'AUTODESTRUCTION_PROTOCOL',
                    desc: 'HOLD_EXECUTE_FOR_3_SECONDS_TO_TERMINATE_UNIT_DATA.'
                },
                null,
                holdProgress,
                false,
                true,
                null, null,
                handleDeleteStart,
                handleDeleteEnd
            );
        } else {
            onCommandUpdate(
                {
                    text: t('registry.command_commit'),
                    desc: t('registry.desc_commit')
                },
                () => onSave(formData),
                0, false,
                !!formData.title.trim() && !!formData.execPath.trim()
            );
        }
    }, [isDestructionActive, holdProgress, formData, onSave, onCommandUpdate, t, game, handleDeleteStart, handleDeleteEnd, isActive]);

    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearInterval(holdTimerRef.current);
            onCommandUpdate(null, null, 0, false, false);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const DestructionToggle: React.FC = () => {
        if (!game) return null;
        return (
            <div
                onClick={() => setIsDestructionActive(!isDestructionActive)}
                className="relative h-[48px] overflow-hidden cursor-pointer select-none border border-white/5 transition-all group active:scale-95"
                style={{
                    background: isDestructionActive ? 'rgba(239, 68, 68, 0.15)' : `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf`,
                    clipPath: clipCut
                }}
            >
                <div className="absolute inset-0 flex items-center justify-center gap-4">
                    <div
                        className={`w-1.5 h-1.5 rounded-full ${isDestructionActive ? 'bg-red-500 animate-pulse' : 'bg-white/20 group-hover:bg-white/40 transition-colors'}`}
                        style={{ boxShadow: isDestructionActive ? '0 0 10px #ef4444' : 'none' }}
                    />
                    <span
                        className={`text-[9px] font-black tracking-[0.4em] uppercase transition-colors ${isDestructionActive ? 'text-red-400' : 'text-white/30 group-hover:text-white/60'}`}
                    >
                        {isDestructionActive ? '[ DESTRUCTION_LINK_ESTABLISHED ]' : 'Erase_game_PROTOCOL'}
                    </span>
                    <div
                        className={`w-1.5 h-1.5 rounded-full ${isDestructionActive ? 'bg-red-500 animate-pulse' : 'bg-white/20 group-hover:bg-white/40 transition-colors'}`}
                        style={{ boxShadow: isDestructionActive ? '0 0 10px #ef4444' : 'none' }}
                    />
                </div>
            </div>
        );
    };

    // Handle explorer selection return
    useEffect(() => {
        if (lastSelectedAsset) {
            setFormData(prev => ({ ...prev, [lastSelectedAsset.target]: lastSelectedAsset.path }));
            if (onClearLastAsset) onClearLastAsset();
        }
    }, [lastSelectedAsset, onClearLastAsset]);

    const clipCut = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))';

    // Asset slot with dual mode (local/cloud) on hover
    const AssetSlot = ({ value, field, label, imgAspect }: { value: string, field: 'cover' | 'banner' | 'logo' | 'wallpaper', label: string, imgAspect?: string }) => (
        <div className="flex flex-col gap-1 w-full">
            <span className="text-[5px] font-black opacity-25 uppercase tracking-[0.25em] ml-0.5 shrink-0">{label}</span>
            <div className={`relative w-full bg-white/[0.02] border border-white/5 overflow-hidden hover:border-white/15 transition-colors ${imgAspect || ''}`} style={{ clipPath: clipCut }}>
                {value ? (
                    <img src={resolveAsset(value, 400)} className={`absolute inset-0 w-full h-full ${field === 'logo' ? 'object-contain p-2' : 'object-cover'} opacity-80 z-10`} loading="lazy" decoding="async" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center font-mono text-[5px] opacity-10 uppercase z-10">NO_DATA</div>
                )}
                {/* Hover actions overlay */}
                <div className="absolute inset-0 flex flex-col opacity-0 hover:opacity-100 transition-opacity duration-200 z-20">
                    <div className="flex-1 flex items-center justify-center cursor-pointer bg-black/60 hover:bg-black/70 transition-colors" onClick={() => triggerFileBrowser(field, 'image')}>
                        <span className="text-[6px] font-black uppercase tracking-[0.15em] text-white/80">[ LOCAL ]</span>
                    </div>
                    {sgdbEnabled && (
                        <div className="flex-1 min-w-0 flex items-center justify-center cursor-pointer bg-black/60 hover:bg-black/70 border-t border-white/10 transition-colors" onClick={() => {
                            triggerCloudBrowser(field, typeMap[field] || 'grid', formData.title);
                        }}>
                            <span className="text-[6px] font-black uppercase tracking-[0.15em]" style={{ color: accentColor }}>[ CLOUD ]</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const validCats = categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.id !== 'recent');

    return (
        <div className="flex flex-col h-full pl-[18px] pr-[52px] pt-[18px] gap-4 pb-6 overflow-y-auto custom-scrollbar">
            {/* Wallpaper bg layer */}
            {formData.wallpaper && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <img src={resolveAsset(formData.wallpaper)} className="w-full h-full object-cover opacity-8 blur-[16px] scale-110" />
                </div>
            )}

            {/* Row 1: Title input full width */}
            <div className="relative border border-white/8 px-5 py-3 z-10" style={{ clipPath: clipCut, background: `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf` }}>
                <label className="text-[5px] font-black opacity-20 uppercase tracking-[0.3em] block mb-0.5">Unit_Designation</label>
                <input
                    autoFocus
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-transparent border-none outline-none font-black text-sm text-white tracking-[0.15em] uppercase placeholder:opacity-5"
                    placeholder="ENTER_NAME..."
                />
            </div>

            {/* Main Content Area (Layout split) */}
            <div className="relative z-10 flex gap-4 min-h-0">
                {/* Left Column: Media + Logic */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Media Block */}
                    <div className="relative border border-white/5 p-4 overflow-hidden" style={{ clipPath: clipCut, background: formData.wallpaper ? `black` : `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf` }}>
                        {formData.wallpaper && (
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <img src={resolveAsset(formData.wallpaper)} className="w-full h-full object-cover blur-[6px] scale-[1.05] opacity-30" />
                                <div className="absolute inset-0" style={{ background: `linear-gradient(${accentColor}33, ${accentColor}11), rgba(0,0,0,0.6)` }} />
                            </div>
                        )}
                        <div className="relative z-10 flex gap-4 items-center">
                            {/* Cover */}
                            <div className="w-[150px] 2xl:w-[180px] shrink-0">
                                <AssetSlot value={formData.cover} field="cover" label="Grid" imgAspect="aspect-[2/3]" />
                            </div>
                            {/* Banner + Wallpaper Picker */}
                            <div className="flex-1 min-w-0 flex flex-col gap-2">
                                <div className="flex flex-col gap-1 w-full">
                                    <span className="text-[5px] font-black opacity-25 uppercase tracking-[0.25em] ml-0.5 shrink-0">Banner</span>
                                    <div className="relative w-full aspect-[460/215] border border-white/5 overflow-hidden hover:border-white/15 transition-colors" style={{ clipPath: clipCut }}>
                                        {formData.banner ? (
                                            <img src={resolveAsset(formData.banner, 400)} className="absolute inset-0 w-full h-full object-cover opacity-80" loading="lazy" decoding="async" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center font-mono text-[5px] opacity-10 uppercase">NO_DATA</div>
                                        )}
                                        <div className="absolute inset-0 flex flex-col opacity-0 hover:opacity-100 transition-opacity duration-200">
                                            <div className="flex-1 flex items-center justify-center cursor-pointer bg-black/60 hover:bg-black/70" onClick={() => triggerFileBrowser('banner', 'image')}>
                                                <span className="text-[6px] font-black uppercase tracking-[0.15em] text-white/80">[ LOCAL ]</span>
                                            </div>
                                            {sgdbEnabled && (
                                                <div className="flex-1 flex items-center justify-center cursor-pointer bg-black/60 hover:bg-black/70 border-t border-white/10" onClick={() => {
                                                    triggerCloudBrowser('banner', typeMap['banner'], formData.title);
                                                }}>
                                                    <span className="text-[6px] font-black uppercase tracking-[0.15em]" style={{ color: accentColor }}>[ CLOUD ]</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex shrink-0 border border-white/5 overflow-hidden h-6" style={{ clipPath: clipCut }}>
                                    <button onClick={() => triggerFileBrowser('wallpaper', 'image')} className="flex-1 h-full text-[6px] font-black uppercase tracking-[0.2em] text-white/25 hover:text-white hover:bg-white/5 transition-all">
                                        {formData.wallpaper ? '✓ Wallpaper_Set' : '[ Local_Wallpaper ]'}
                                    </button>
                                    {sgdbEnabled && (
                                        <>
                                            <div className="w-px bg-white/5 h-full" />
                                            <button onClick={() => {
                                                triggerCloudBrowser('wallpaper', typeMap['wallpaper'], formData.title);
                                            }} className="flex-1 h-full text-[6px] font-black uppercase tracking-[0.2em] hover:bg-white/5 transition-all" style={{ color: accentColor }}>[ Cloud_Sync ]</button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {/* Logo */}
                            <div className="w-[150px] 2xl:w-[180px] shrink-0">
                                <AssetSlot value={formData.logo} field="logo" label="Logo" imgAspect="aspect-[2/3]" />
                            </div>
                        </div>
                    </div>

                    {/* Logic Block (Paths + Parameters) */}
                    <div className="flex gap-4 border border-white/5 p-3" style={{ clipPath: clipCut, background: `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf` }}>
                        <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[5px] font-black opacity-20 uppercase tracking-[0.3em]">Execution_Path</label>
                            <div className="flex gap-1.5">
                                <div className="flex-1 border border-white/5 px-3 py-2" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 20px))' }}>
                                    <input value={formData.execPath} onChange={e => setFormData({ ...formData, execPath: e.target.value })} className="w-full bg-transparent border-none outline-none font-mono text-[7px] text-white/40 truncate" placeholder="C:\\PATH\\TARGET.EXE" />
                                </div>
                                <button onClick={() => triggerFileBrowser('execPath', 'exe')} className="w-10 border border-white/5 text-[6px] font-black flex items-center justify-center hover:bg-white/8 transition-all" style={{ color: accentColor, clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)' }}>[..]</button>
                            </div>
                        </div>
                        <div className="w-px bg-white/5 my-1" />
                        <div className="flex-1 flex flex-col gap-1">
                            <label className="text-[5px] font-black opacity-20 uppercase tracking-[0.3em]">Parameters</label>
                            <div className="border border-white/5 px-3 py-2" style={{ clipPath: clipCut }}>
                                <input value={formData.execArgs} onChange={e => setFormData({ ...formData, execArgs: e.target.value })} className="w-full bg-transparent border-none outline-none font-mono text-[7px] text-white/25" placeholder="-FULLSCREEN" />
                            </div>
                        </div>
                    </div>

                    {/* Destruction Protocol */}
                    {game && onDelete && (
                        <DestructionToggle />
                    )}
                </div>

                {/* Right Sidebar: Categories (Fixed Width, matches design boxes) */}
                <div className="w-[120px] shrink-0 flex flex-col gap-2 border border-white/5 p-3" style={{ clipPath: clipCut, background: `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf` }}>
                    <span className="text-[5px] font-black opacity-20 uppercase tracking-[0.2em] text-center">Nodes</span>
                    <div className="grid grid-cols-2 gap-2 flex-1 content-start">
                        {validCats.map(cat => {
                            const active = formData.categoryIds.includes(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setFormData(p => ({ ...p, categoryIds: active ? p.categoryIds.filter(id => id !== cat.id) : [...p.categoryIds, cat.id] }))}
                                    className="aspect-square flex items-center justify-center transition-all relative group"
                                    style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                                    title={cat.name}
                                >
                                    <div className="absolute inset-0" style={{ backgroundColor: active ? `${cat.color}33` : 'transparent' }} />
                                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 32" fill="none">
                                        <polygon points="0,0 24,0 32,8 32,32 8,32 0,24" stroke={active ? cat.color : 'rgba(255,255,255,0.08)'} strokeWidth={active ? '2' : '1'} fill="none" />
                                    </svg>
                                    <div
                                        className="w-[22px] h-[22px] relative z-10 transition-opacity"
                                        style={{
                                            backgroundColor: active ? cat.color : 'rgba(255,255,255,0.2)',
                                            maskImage: `url(${resolveAsset(cat.icon)})`,
                                            WebkitMaskImage: `url(${resolveAsset(cat.icon)})`,
                                            maskSize: 'contain',
                                            WebkitMaskSize: 'contain',
                                            maskPosition: 'center',
                                            maskRepeat: 'no-repeat',
                                        }}
                                    />
                                    <div className="absolute right-full mr-2 px-1.5 py-0.5 bg-black/90 border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap text-[5px] font-mono uppercase tracking-wider z-20 text-white/60">
                                        {cat.name}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameEditForm;
