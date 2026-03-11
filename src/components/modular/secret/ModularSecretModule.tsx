import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Category, Game } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';
import GameEditForm from '../registry/GameEditForm';
import { ASSETS } from '../../../constants';

interface ModularSecretModuleProps {
    categories: Category[];
    activeAccent: string;
    onResolveAsset: (path: string | undefined) => string;
    triggerFileBrowser: (target: string, type: string) => void;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    onCommandUpdate: (
        command: any,
        execute?: (() => void) | null,
        progress?: number | undefined,
        isExecuting?: boolean | undefined,
        isReady?: boolean | undefined,
        _scrollProgress?: number | (() => void) | null,
        _showScrollMarker?: boolean | (() => void) | null,
        execStart?: (() => void) | null,
        execEnd?: (() => void) | null
    ) => void;
    handleFetchMissingAssets: (categoryId: string, onStatus?: (s: string) => void) => Promise<void>;
    handleSaveGame: (formData: any, editingId: string | null) => Promise<Game | undefined>;
    handleDeleteGame: (gameId: string, requestConfirmation: any) => void;
    triggerCloudBrowser: (target: string, type: string, initialQuery?: string) => void;
    sgdbKey: string;
    sgdbEnabled: boolean;
    lastSelectedAsset?: { target: string; path: string; timestamp: number } | null;
    onClearLastAsset?: () => void;
    registerGoBack?: (fn: () => boolean) => void;
    onCanGoBackChange?: (canGoBack: boolean) => void;
    isActive?: boolean;
    assetVersion?: number;
}

const ModularSecretModule: React.FC<ModularSecretModuleProps> = ({
    categories,
    activeAccent,
    onResolveAsset,
    triggerFileBrowser,
    onUpdateCategories,
    onCommandUpdate,
    handleFetchMissingAssets,
    handleSaveGame,
    handleDeleteGame,
    triggerCloudBrowser,
    sgdbKey,
    sgdbEnabled,
    lastSelectedAsset,
    onClearLastAsset,
    registerGoBack,
    onCanGoBackChange,
    isActive,
    assetVersion = 0
}) => {
    const { t } = useTranslation();
    const editingId = 'secret';
    const [view, setView] = useState<'list' | 'edit' | 'import'>('list');
    const [editingGame, setEditingGame] = useState<any>(null);
    const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());

    const [catForm, setCatForm] = useState({
        name: 'SECRET',
        icon: ASSETS.external.hidden,
        color: '#b829da',
        wallpaper: '',
        wallpaperMode: 'cover' as 'fill' | 'contain' | 'cover' | 'center',
        gridOpacity: 0.15,
        enabled: true
    });

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [formGames, setFormGames] = useState<any[]>([]);
    const [fetchActive, setFetchActive] = useState(false);

    useEffect(() => {
        const cat = categories.find(c => c.id === editingId);
        if (cat) {
            setCatForm({
                name: cat.name || 'SECRET',
                icon: cat.icon || ASSETS.external.hidden,
                color: cat.color || '#b829da',
                wallpaper: cat.wallpaper || '',
                wallpaperMode: cat.wallpaperMode || 'cover',
                gridOpacity: cat.gridOpacity || 0.15,
                enabled: cat.enabled !== false
            });
            setFormGames(cat.games || []);
        }
    }, [categories]);

    const handleSaveCategoryData = useCallback(() => {
        onUpdateCategories(prev => {
            const exists = prev.some(c => c.id === editingId);
            if (exists) {
                return prev.map(c => c.id === editingId ? { ...c, ...catForm, games: formGames } : c);
            } else {
                return [...prev, { id: editingId, ...catForm, games: formGames }];
            }
        });
    }, [formGames, onUpdateCategories, catForm]);

    const localMoveGame = (gameId: string, direction: 'up' | 'down') => {
        const idx = formGames.findIndex(g => g.id === gameId);
        if (idx < 0) return;
        const newArr = [...formGames];
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= newArr.length) return;
        const temp = newArr[idx];
        newArr[idx] = newArr[swapIdx];
        newArr[swapIdx] = temp;
        setFormGames(newArr);
    };

    const executeImport = useCallback(() => {
        onUpdateCategories(prev => {
            let updatedCats = [...prev];
            const selectedIdsArray = Array.from(selectedImports);

            if (!updatedCats.some(c => c.id === 'secret')) {
                updatedCats.push({
                    id: 'secret', name: 'SECRET_CORE', icon: '', color: '#ff0000',
                    games: [], enabled: true, wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15
                });
            }

            const gamesToImport: any[] = [];
            const allCatGames = updatedCats.find(c => c.id === 'all')?.games || [];
            for (const id of selectedIdsArray) {
                const game = allCatGames.find(g => g.id === id);
                if (game) gamesToImport.push(game);
            }

            return updatedCats.map(cat => {
                if (cat.id === 'secret') {
                    return { ...cat, games: [...cat.games, ...gamesToImport.filter(g => !cat.games.some(cg => cg.id === g.id))] };
                }
                return {
                    ...cat,
                    games: cat.games.filter(g => !selectedIdsArray.includes(g.id))
                };
            });
        });

        setView('list');
        setSelectedImports(new Set());
    }, [selectedImports, onUpdateCategories]);

    const importHoldRef = useRef(false);
    const importIntervalRef = useRef<any>(null);
    const [holdProgress, setHoldProgress] = useState(0);

    const saveRef = useRef(handleSaveCategoryData);
    const importRef = useRef(executeImport);
    useEffect(() => { saveRef.current = handleSaveCategoryData; }, [handleSaveCategoryData]);
    useEffect(() => { importRef.current = executeImport; }, [executeImport]);

    const stableSave = useCallback(() => saveRef.current(), []);
    const stableImport = useCallback(() => importRef.current(), []);

    const handleImportStart = useCallback(() => {
        importHoldRef.current = true;
        setHoldProgress(0);
        let elapsed = 0;
        const total = 2000;
        const step = 50;
        importIntervalRef.current = setInterval(() => {
            if (!importHoldRef.current) {
                clearInterval(importIntervalRef.current);
                return;
            }
            elapsed += step;
            const pct = Math.min((elapsed / total) * 100, 100);
            setHoldProgress(pct);
            if (elapsed >= total) {
                clearInterval(importIntervalRef.current);
                importHoldRef.current = false;
                stableImport();
                setHoldProgress(0);
            }
        }, step);
    }, [stableImport]);

    const handleImportEnd = useCallback(() => {
        importHoldRef.current = false;
        if (importIntervalRef.current) clearInterval(importIntervalRef.current);
        setHoldProgress(0);
    }, []);

    const startRef = useRef(handleImportStart);
    const endRef = useRef(handleImportEnd);
    useEffect(() => { startRef.current = handleImportStart; }, [handleImportStart]);
    useEffect(() => { endRef.current = handleImportEnd; }, [handleImportEnd]);

    const stableStart = useCallback(() => startRef.current(), []);
    const stableEnd = useCallback(() => endRef.current(), []);

    useEffect(() => {
        if (!isActive) return;

        if (view === 'list') {
            onCommandUpdate(
                { text: t('categories.command_commit'), desc: t('categories.desc_commit') },
                stableSave,
                0, false, !!catForm.name.trim(), null, null, null, null
            );
        } else if (view === 'import') {
            if (selectedImports.size > 0) {
                onCommandUpdate(
                    { text: 'IMPORT_PROTOCOL', desc: holdProgress > 0 ? 'MIGRATING_UNITS...' : 'HOLD_EXECUTE_2_SECONDS_TO_MIGRATE' },
                    null, holdProgress, false, true, null, null,
                    stableStart,
                    stableEnd
                );
            } else {
                onCommandUpdate({ text: 'IMPORT_PROTOCOL', desc: 'SELECT_UNITS_TO_MIGRATE' }, null, 0, false, false, null, null, null, null);
            }
        }
    }, [catForm.name, t, onCommandUpdate, stableSave, isActive, view, selectedImports, holdProgress, stableStart, stableEnd]);

    useEffect(() => {
        return () => {
            if (importIntervalRef.current) clearInterval(importIntervalRef.current);
        };
    }, []);

    const handleEditStart = (game: any) => {
        setEditingGame(game);
        setView('edit');
    };

    const handleSave = async (formData: any) => {
        // Enforce secret category
        if (!formData.categoryIds.includes('secret')) {
            formData.categoryIds.push('secret');
        }
        const savedGame = await handleSaveGame(formData, editingGame?.id || null);
        if (savedGame) {
            setFormGames(prev => {
                const filtered = prev.filter(g => g.id !== (editingGame?.id || null) && g.id !== savedGame.id);
                return [...filtered, savedGame];
            });
            setView('list');
        }
    };

    const handleDelete = (id: string) => {
        handleDeleteGame(id, null);
        setFormGames(prev => prev.filter(g => g.id !== id));
        setView('list');
    };

    const handleGoBack = useCallback((): boolean => {
        if (view === 'edit') {
            setView('list');
            setEditingGame(null);
            return true;
        }
        if (view === 'import') {
            setView('list');
            setSelectedImports(new Set());
            return true;
        }
        return false;
    }, [view]);

    useEffect(() => {
        if (registerGoBack) registerGoBack(handleGoBack);
    }, [registerGoBack, handleGoBack]);

    useEffect(() => {
        if (onCanGoBackChange) onCanGoBackChange(view === 'edit' || view === 'import');
    }, [view, onCanGoBackChange]);

    return (
        <div className="flex-1 flex gap-6 overflow-hidden relative font-['Space_Mono'] h-full">
            {view === 'import' ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 p-4 h-full relative z-10 w-full">
                    <div className="flex gap-3 items-center mb-0 shrink-0 mt-2">
                        <div className="w-12 h-12 shrink-0 border border-dashed border-white/20 flex items-center justify-center bg-black/50 overflow-hidden" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </div>
                        <div className="flex flex-col gap-0 flex-1 min-w-0">
                            <span className="text-lg font-black uppercase tracking-[0.2em] text-white">
                                IMPORT_UNITS
                            </span>
                            <span className="text-[6px] text-white/25 tracking-[0.2em] font-mono uppercase">SELECT_UNITS_TO_MIGRATE_TO_SECRET_CORE</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 content-start px-2 pb-[80px]">
                        {(() => {
                            const allCategory = categories.find(c => c.id === 'all');
                            const allGames = allCategory ? allCategory.games : [];
                            const secretGamesIdSet = new Set(formGames.map(g => g.id));
                            const importableGames = allGames.filter(g => !secretGamesIdSet.has(g.id));

                            if (importableGames.length === 0) {
                                return <div className="col-span-full py-12 text-center text-white/20 font-mono text-[10px] uppercase tracking-widest border border-dashed border-white/10 bg-black/20">NO_UNITS_AVAILABLE_FOR_IMPORT</div>;
                            }

                            return importableGames.map(game => {
                                const isSelected = selectedImports.has(game.id);
                                return (
                                    <div
                                        key={game.id}
                                        onClick={() => {
                                            const newSet = new Set(selectedImports);
                                            if (isSelected) newSet.delete(game.id);
                                            else newSet.add(game.id);
                                            setSelectedImports(newSet);
                                        }}
                                        className="aspect-square group relative cursor-pointer overflow-hidden transition-all hover:scale-[1.02]"
                                        style={{
                                            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
                                        }}
                                    >
                                        <img
                                            src={`/api/assets/optimized-bg/${game.id}${assetVersion > 0 ? `?v=${assetVersion}` : ''}`}
                                            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 scale-110 ${isSelected ? 'opacity-80' : 'opacity-40 group-hover:opacity-60'}`}
                                            onError={(e) => {
                                                const target = e.currentTarget;
                                                if (target.getAttribute('data-fallback') === 'true') return;
                                                target.setAttribute('data-fallback', 'true');
                                                target.src = onResolveAsset(game.cover || '/res/templates/cover.png');
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-black/30" />
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-black/40" />
                                        )}
                                        <div className="absolute inset-0 flex items-center justify-center p-4">
                                            {game.logo ? (
                                                <img
                                                    src={onResolveAsset(game.logo)}
                                                    className="max-w-[85%] max-h-[70%] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                                                    {game.title}
                                                </span>
                                            )}
                                        </div>
                                        {isSelected && (
                                            <>
                                                <div className="absolute inset-0 z-20 pointer-events-none">
                                                    <svg className="absolute top-0 right-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                                                        <line x1="0" y1="0" x2="21" y2="21" stroke={activeAccent} strokeWidth="4" />
                                                    </svg>
                                                    <svg className="absolute bottom-0 left-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                                                        <line x1="0" y1="0" x2="21" y2="21" stroke={activeAccent} strokeWidth="4" />
                                                    </svg>
                                                    <div className="absolute top-0 left-0 h-[3px]" style={{ right: '20px', backgroundColor: activeAccent }} />
                                                    <div className="absolute bottom-0 right-0 h-[3px]" style={{ left: '20px', backgroundColor: activeAccent }} />
                                                    <div className="absolute top-[20px] bottom-0 right-0 w-[3px]" style={{ backgroundColor: activeAccent }} />
                                                    <div className="absolute top-0 bottom-[20px] left-0 w-[3px]" style={{ backgroundColor: activeAccent }} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            ) : view === 'edit' ? (
                <div className="flex-1 h-full w-full">
                    <GameEditForm
                        game={editingGame}
                        accentColor={activeAccent}
                        categories={categories.filter(c => c.id === 'secret')}
                        onSave={handleSave}
                        onCancel={() => setView('list')}
                        triggerFileBrowser={triggerFileBrowser}
                        triggerCloudBrowser={triggerCloudBrowser}
                        resolveAsset={onResolveAsset}
                        sgdbKey={sgdbKey}
                        sgdbEnabled={sgdbEnabled}
                        onCommandUpdate={onCommandUpdate}
                        lastSelectedAsset={lastSelectedAsset}
                        onClearLastAsset={onClearLastAsset}
                        onDelete={editingGame ? handleDelete : undefined}
                        isActive={isActive}
                    />
                </div>
            ) : (
                <>
                    {/* Games Sidebar (Left) */}
                    <div className="w-[30%] min-w-[280px] flex-shrink-0 flex flex-col border-r-2 border-white/5 pr-4 gap-4 overflow-y-auto no-scrollbar pb-[100px] h-full">
                        <div className="flex flex-col gap-1">
                            <div
                                className="relative flex items-center justify-center py-[6px] select-none"
                                style={{
                                    backgroundColor: `${activeAccent}26`,
                                    clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))'
                                }}
                            >
                                <h3 className="text-[8px] font-bold uppercase tracking-[0.3em] text-white/50">
                                    {String(t('categories.unit_registry_management')).includes('MANAGEMENT') ? String(t('categories.unit_registry_management')).replace('_MANAGEMENT', '') : 'UNIT_REGISTRY'}
                                </h3>
                            </div>
                            <div className="flex flex-col gap-[6px] mt-1">
                                {formGames.length === 0 && (
                                    <div className="py-8 text-center border-2 border-dashed border-white/5 text-[7px] opacity-20 uppercase tracking-[0.5em]">{t('categories.no_units_registered')}</div>
                                )}
                                {formGames.map((g, idx) => (
                                    <div
                                        key={g.id}
                                        onClick={() => handleEditStart(g)}
                                        className="relative flex items-center gap-4 py-3 pl-3 pr-2 transition-all cursor-pointer group select-none hover:bg-white/5"
                                        style={{
                                            backgroundColor: `${activeAccent}26`,
                                            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'
                                        }}
                                    >
                                        <div className="font-mono text-[9px] font-bold shrink-0 ml-1 transition-colors group-hover:text-white"
                                            style={{ color: 'rgba(255,255,255,0.4)' }}>
                                            {String(idx + 1)}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-6">
                                            <span className={`block text-[8px] font-bold uppercase truncate tracking-[0.2em] transition-all text-white`}>{g.title}</span>
                                        </div>
                                        <div className="absolute right-2 top-0 bottom-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); localMoveGame(g.id, 'up'); }} className="text-white/30 hover:text-white transition-colors p-[2px] flex items-center justify-center disabled:opacity-0" disabled={idx === 0}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); localMoveGame(g.id, 'down'); }} className="text-white/30 hover:text-white transition-colors p-[2px] flex items-center justify-center disabled:opacity-0" disabled={idx === formGames.length - 1}>
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6 pb-[100px]">
                        {/* Main 16:9 Config Card (Matches ModularCategoriesModule) */}
                        <div
                            className="relative w-full aspect-video overflow-hidden shrink-0 mt-2"
                            style={{
                                backgroundColor: catForm.wallpaper ? 'black' : `${activeAccent}26`,
                                clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
                            }}
                        >
                            {/* Wallpaper Background */}
                            {catForm.wallpaper && (
                                <div className="absolute inset-0 z-0 pointer-events-none">
                                    <img src={onResolveAsset(catForm.wallpaper)} className="w-full h-full object-cover blur-[6px] scale-[1.05] opacity-30" />
                                    <div className="absolute inset-0" style={{ background: `linear-gradient(${catForm.color}33, ${catForm.color}11), rgba(0,0,0,0.6)` }} />
                                </div>
                            )}

                            {/* Card Contents */}
                            <div className="relative z-10 flex flex-col gap-3 p-4 h-full">
                                {/* Header: Icon + Name */}
                                <div className="flex gap-3 items-center">
                                    {catForm.icon ? (
                                        <div
                                            className="w-12 h-12 shrink-0"
                                            style={{
                                                backgroundColor: catForm.color,
                                                WebkitMaskImage: `url(${onResolveAsset(catForm.icon)})`,
                                                WebkitMaskSize: 'contain',
                                                WebkitMaskRepeat: 'no-repeat',
                                                WebkitMaskPosition: 'center',
                                                maskImage: `url(${onResolveAsset(catForm.icon)})`,
                                                maskSize: 'contain',
                                                maskRepeat: 'no-repeat',
                                                maskPosition: 'center',
                                                filter: `drop-shadow(0 0 6px ${catForm.color}88)`
                                            }}
                                        />
                                    ) : (
                                        <div className="w-12 h-12 shrink-0 border border-dashed border-white/20 flex items-center justify-center">
                                            <span className="text-[10px] opacity-30 text-white font-mono uppercase tracking-[0.2em]">[S]</span>
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-0 flex-1 min-w-0">
                                        <input
                                            value={catForm.name}
                                            onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                                            className="bg-transparent border-none outline-none text-lg font-black uppercase tracking-[0.2em] text-white truncate w-full"
                                            placeholder="NODE_NAME..."
                                            style={{ textShadow: `0 0 10px ${catForm.color}66` }}
                                        />
                                        <span className="text-[6px] text-white/25 tracking-[0.2em] font-mono uppercase">Node ID: {editingId}</span>
                                    </div>
                                </div>

                                {/* Row: Icon Picker + Color Picker */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('categories.terminal_icon')}</label>
                                        <div className="flex gap-[3px] h-10">
                                            <div className="flex items-center flex-1 min-w-0 px-3 bg-black/30"
                                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                                <span className="text-[9px] font-mono text-white/40 truncate">{catForm.icon || 'not_set'}</span>
                                            </div>
                                            <button
                                                onClick={() => triggerFileBrowser('icon', 'image')}
                                                className="w-10 h-full shrink-0 flex items-center justify-center bg-black/30 hover:bg-white/10 transition-all"
                                                style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('categories.accent_hex')}</label>
                                        <div className="flex gap-[3px] h-10">
                                            <input
                                                value={catForm.color}
                                                onChange={e => setCatForm({ ...catForm, color: e.target.value })}
                                                className="flex-1 min-w-0 bg-black/30 px-3 text-[10px] font-mono uppercase outline-none text-white/60 focus:text-white transition-colors"
                                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}
                                            />
                                            <label
                                                className="w-10 h-full shrink-0 flex items-center justify-center cursor-pointer relative overflow-hidden"
                                                style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                                            >
                                                <div className="w-full h-full" style={{ backgroundColor: catForm.color }} />
                                                <input
                                                    type="color"
                                                    value={catForm.color}
                                                    onChange={e => setCatForm({ ...catForm, color: e.target.value })}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Wallpaper Picker */}
                                <div className="flex gap-[3px] h-10">
                                    <div className="flex items-center justify-center flex-1 min-w-0 px-3 bg-black/30"
                                        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-white/25">
                                            {catForm.wallpaper ? '✓ WALLPAPER_SET' : `[ ${t('categories.unit_browser')} ]`}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => triggerFileBrowser('wallpaper', 'image')}
                                        className="w-10 h-full shrink-0 flex items-center justify-center bg-black/30 hover:bg-white/10 transition-all"
                                        style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Mode Selector */}
                                <div className="flex flex-col gap-1">
                                    <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('categories.render_sequence')}</label>
                                    <div className="flex gap-1">
                                        {[{ id: 'fill', label: 'Stretch' }, { id: 'contain', label: 'Fit' }, { id: 'cover', label: 'Zoom' }, { id: 'center', label: 'Mid' }].map(mode => {
                                            const isActive = catForm.wallpaperMode === mode.id;
                                            return (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => setCatForm({ ...catForm, wallpaperMode: mode.id as 'fill' | 'contain' | 'cover' | 'center' })}
                                                    className="flex-1 py-2 text-[7px] font-bold uppercase tracking-widest transition-all active:scale-95"
                                                    style={{
                                                        backgroundColor: isActive ? activeAccent : `${activeAccent}15`,
                                                        color: isActive ? '#000' : `${activeAccent}99`,
                                                        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)'
                                                    }}
                                                >
                                                    {mode.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Game Grid (Matches GameRegistryModule style) */}
                        <div className="w-full relative">
                            <div className="grid grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                                {/* ADD_UNIT Card (Split) */}
                                <div
                                    className="aspect-square relative overflow-hidden flex flex-col"
                                    style={{ clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))' }}
                                >
                                    <div className="absolute inset-0 bg-white/5 border-2 border-dashed border-white/10 pointer-events-none z-0" />
                                    {/* Top: ADD NEW */}
                                    <div
                                        onClick={() => handleEditStart(null)}
                                        className="flex-1 group relative cursor-pointer overflow-hidden transition-all hover:bg-white/10 active:bg-white/20 flex items-center justify-center border-b-[1px] border-white/10 z-10"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                                            <span className="text-[24px] leading-none font-thin text-white/20 group-hover:text-white transition-colors mb-0.5">+</span>
                                            <span className="text-[7px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-white transition-colors">ADD_ENTRY</span>
                                        </div>
                                    </div>

                                    {/* Bottom: IMPORT */}
                                    <div
                                        onClick={() => {
                                            setSelectedImports(new Set());
                                            setView('import');
                                        }}
                                        className="flex-1 group relative cursor-pointer overflow-hidden transition-all hover:bg-white/10 active:bg-white/20 flex items-center justify-center border-t-[1px] border-white/10 z-10"
                                    >
                                        <div className="flex flex-col items-center justify-center gap-1 pointer-events-none">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 group-hover:text-white transition-colors mb-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                            <span className="text-[7px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-white transition-colors">IMPORT</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Secret Games Grid */}
                                {formGames.map(game => (
                                    <div
                                        key={game.id}
                                        onClick={() => handleEditStart(game)}
                                        className="aspect-square group relative cursor-pointer overflow-hidden transition-all hover:scale-[1.02]"
                                        style={{ clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))' }}
                                    >
                                        <img
                                            src={`/api/assets/optimized-bg/${game.id}${assetVersion > 0 ? `?v=${assetVersion}` : ''}`}
                                            className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity duration-500 scale-110"
                                            onError={(e) => {
                                                const target = e.currentTarget;
                                                if (target.getAttribute('data-fallback') === 'true') return;
                                                target.setAttribute('data-fallback', 'true');
                                                target.src = onResolveAsset(game.cover || '/res/templates/cover.png');
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-black/30" />
                                        <div className="absolute inset-0 flex items-center justify-center p-4">
                                            {game.logo ? (
                                                <img
                                                    src={onResolveAsset(game.logo)}
                                                    className="max-w-[85%] max-h-[70%] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] group-hover:scale-105 transition-transform duration-300"
                                                />
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-white text-center drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
                                                    {game.title}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ModularSecretModule;
