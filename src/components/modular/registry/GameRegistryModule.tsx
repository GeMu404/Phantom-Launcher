
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Category, Game } from '../../../types';
import { ASSETS } from '../../../constants';
import { useTranslation } from '../../../hooks/useTranslation';
import GameEditForm from './GameEditForm';
import ScrollIndicator from '../../ui/ScrollIndicator';


interface GameRegistryModuleProps {
    isActive: boolean;
    isSubModuleOpen?: boolean;
    accentColor: string;
    categories: Category[];
    allGamesCategory: Category;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
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
    resolveAsset: (path: string | undefined, width?: number) => string;
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    triggerCloudBrowser: (target: string, type: string, initialQuery?: string) => void;
    handleSaveGame: (formData: any, editingId: string | null) => Promise<Game | undefined>;
    handleDeleteGame: (gameId: string, requestConfirmation?: ((msg: string, onConfirm: () => void, isDanger?: boolean) => void) | null) => void;
    sgdbKey: string;
    sgdbEnabled: boolean;
    registerGoBack?: (fn: () => boolean) => void;
    onCanGoBackChange?: (canGoBack: boolean) => void;
    lastSelectedAsset?: { target: string; path: string; timestamp: number } | null;
    onClearLastAsset?: () => void;
    assetVersion?: number;
}

const SyncCardBorder = ({ color, isActive }: { color: string; isActive: boolean }) => {
    if (!isActive) return null;
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {/* Straight Edges */}
            <div className="absolute top-0 left-0 h-[2px]" style={{ right: '10px', backgroundColor: color }} />
            <div className="absolute bottom-0 right-0 h-[2px]" style={{ left: '10px', backgroundColor: color }} />
            <div className="absolute top-[10px] bottom-0 right-0 w-[2px]" style={{ backgroundColor: color }} />
            <div className="absolute top-0 bottom-[10px] left-0 w-[2px]" style={{ backgroundColor: color }} />

            {/* Top-right diagonal corner */}
            <svg className="absolute top-0 right-0 w-[11px] h-[11px]" viewBox="0 0 11 11" fill="none">
                <line x1="0" y1="0" x2="11" y2="11" stroke={color} strokeWidth="2.5" />
            </svg>
            {/* Bottom-left diagonal corner */}
            <svg className="absolute bottom-0 left-0 w-[11px] h-[11px]" viewBox="0 0 11 11" fill="none">
                <line x1="0" y1="0" x2="11" y2="11" stroke={color} strokeWidth="2.5" />
            </svg>
        </div>
    );
};

const GameRegistryModule: React.FC<GameRegistryModuleProps> = ({
    isActive, isSubModuleOpen, accentColor, categories, allGamesCategory, onUpdateCategories, onCommandUpdate, resolveAsset,
    triggerFileBrowser,
    triggerCloudBrowser,
    handleSaveGame, handleDeleteGame, sgdbKey, sgdbEnabled, registerGoBack, onCanGoBackChange, lastSelectedAsset, onClearLastAsset,
    assetVersion = 0
}) => {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [editingGame, setEditingGame] = useState<Game | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);
    const [backendGames, setBackendGames] = useState<Game[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // Staged states for "Execute" pattern
    const [stagedSearchQuery, setStagedSearchQuery] = useState('');
    const [stagedFilterCategory, setStagedFilterCategory] = useState<string>('all');

    // Virtualization: progressive loading
    const BATCH_SIZE = 24;
    const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Register go-back handler for parent DISCONNECT button
    const handleGoBack = useCallback((): boolean => {
        if (view === 'edit') {
            setView('list');
            setEditingGame(null);
            return true;
        }
        if (isDiscoveryOpen) {
            setIsDiscoveryOpen(false);
            return true;
        }
        return false;
    }, [view, isDiscoveryOpen]);

    useEffect(() => {
        if (registerGoBack) registerGoBack(handleGoBack);
    }, [registerGoBack, handleGoBack]);

    useEffect(() => {
        if (onCanGoBackChange) onCanGoBackChange(view === 'edit' || isDiscoveryOpen);
    }, [view, isDiscoveryOpen, onCanGoBackChange]);

    useEffect(() => {
        if (!isActive && !isSubModuleOpen) {
            setView('list');
            setEditingGame(null);
            setIsDiscoveryOpen(false);
            setBackendGames(null);
        }
    }, [isActive, isSubModuleOpen]);


    const sortedGames = useMemo(() => {
        // If we have specific results from a backend discovery/search, use them
        if (backendGames !== null) {
            // Filter out ghost games that were deleted/wiped in another session
            const validDbIds = new Set((allGamesCategory?.games || []).map(g => g.id));
            const liveBackend = backendGames.filter(bg => {
                // Keep if present in our live database map
                if (validDbIds.has(bg.id)) return true;
                // Keep recovered orphans from filesystems (these don't have a DB timestamp yet)
                if ((bg as any).lastUpdated === undefined) return true;
                // Otherwise, it's a ghost from a past search, drop it.
                return false;
            });
            return liveBackend.sort((a, b) => a.title.localeCompare(b.title));
        }

        let games = [...(allGamesCategory?.games || [])];

        // 1. Exclude games in the 'secret' category from registry search/list
        const secretCat = categories.find(c => c.id === 'secret');
        if (secretCat) {
            const secretIds = new Set((secretCat.games || []).map(g => g.id));
            games = games.filter(g => !secretIds.has(g.id));
        }

        // 2. Real-time Category Filtering
        const currentCategoryFilter = filterCategory; 
        if (currentCategoryFilter === 'orphaned') {
            const categorizedIds = new Set<string>();
            categories.forEach(cat => {
                // If it's a real home (folders, steam, xbox, etc), mark games as categorized
                if (cat.id !== 'all' && cat.id !== 'recent' && cat.id !== 'orphaned') {
                    if (Array.isArray(cat.games)) {
                        cat.games.forEach(g => categorizedIds.add(g.id));
                    }
                }
            });
            // Result is games in 'all' but not in any real category
            games = games.filter(g => !categorizedIds.has(g.id));
        } else if (currentCategoryFilter !== 'all') {
            const cat = categories.find(c => c.id === currentCategoryFilter);
            if (cat) {
                const ids = new Set((cat.games || []).map(g => g.id));
                games = games.filter(g => ids.has(g.id));
            }
        }

        // 3. Filter by title (Applied query)
        if (searchQuery) {
            games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return games.sort((a, b) => a.title.localeCompare(b.title));
    }, [allGamesCategory?.games, searchQuery, filterCategory, categories, backendGames]);

    const visibleGames = useMemo(() => sortedGames.slice(0, visibleCount), [sortedGames, visibleCount]);

    const handleApplyScan = useCallback(async () => {
        setIsSearching(true);
        try {
            const response = await fetch(`/api/games/search?q=${encodeURIComponent(stagedSearchQuery)}&cat=${stagedFilterCategory}`);
            const data = await response.json();
            const results = data.games || [];

            setBackendGames(results);
            setSearchQuery(stagedSearchQuery);
            setFilterCategory(stagedFilterCategory);
            setIsDiscoveryOpen(false);
        } catch (e) {
            console.error('[Registry] Discovery failed:', e);
        } finally {
            setIsSearching(false);
        }
    }, [stagedSearchQuery, stagedFilterCategory]);

    // STABLE CALLBACK REFACTOR: Prevents re-render loops in App.tsx during typing
    const scanRef = useRef(handleApplyScan);
    useEffect(() => { scanRef.current = handleApplyScan; }, [handleApplyScan]);
    const stableApplyScan = useCallback(() => scanRef.current(), []);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(BATCH_SIZE);
    }, [searchQuery, filterCategory, backendGames]);

    // PRE-FLIGHT: Initial All Games Scan
    useEffect(() => {
        if (isActive && backendGames === null && !isSearching) {
            handleApplyScan();
        }
    }, [isActive, backendGames, isSearching, handleApplyScan]);

    // IntersectionObserver for progressive loading
    useEffect(() => {
        if (!sentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount(prev => Math.min(prev + BATCH_SIZE, sortedGames.length));
                }
            },
            { root: scrollContainerRef.current, rootMargin: '200px' }
        );
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [sortedGames.length]);

    const { t } = useTranslation();

    useEffect(() => {
        if (!isActive) return;
        if (view === 'list') {
            if (isDiscoveryOpen) {
                onCommandUpdate(
                    {
                        text: t('registry.command_discovery'),
                        desc: t('registry.desc_discovery')
                    },
                    stableApplyScan,
                    0,
                    isSearching,
                    true
                );
            } else {
                onCommandUpdate(
                    {
                        text: t('registry.command_monitor'),
                        desc: t('registry.desc_monitor')
                    },
                    null,
                    0,
                    false,
                    false
                );
            }
        }
    }, [view, isDiscoveryOpen, onCommandUpdate, t, stableApplyScan, isSearching, isActive]);

    const handleEditStart = (game: Game | null) => {
        setEditingGame(game);
        setView('edit');
    };

    const handleSave = useCallback(async (formData: any) => {
        const savedGame = await handleSaveGame(formData, editingGame?.id || null);
        if (savedGame) {
            if (backendGames) {
                setBackendGames(prev => {
                    if (!prev) return null;
                    const filtered = prev.filter(g => g.id !== (editingGame?.id || null) && g.id !== (savedGame as any).id);
                    return [...filtered, savedGame as any];
                });
            }
            setView('list');
        }
    }, [handleSaveGame, editingGame?.id, backendGames]);

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;

    if (view === 'edit') {
        return (
            <GameEditForm
                game={editingGame}
                accentColor={accentColor}
                categories={categories}
                onSave={handleSave}
                onCancel={() => setView('list')}
                triggerFileBrowser={triggerFileBrowser}
                triggerCloudBrowser={triggerCloudBrowser}
                resolveAsset={resolveAsset}
                sgdbKey={sgdbKey}
                sgdbEnabled={sgdbEnabled}
                onCommandUpdate={onCommandUpdate}
                lastSelectedAsset={lastSelectedAsset}
                onClearLastAsset={onClearLastAsset}
                onDelete={editingGame ? (id) => {
                    handleDeleteGame(id, null);
                    if (backendGames) {
                        setBackendGames(prev => prev ? prev.filter(g => g.id !== id) : null);
                    }
                    setView('list');
                    setEditingGame(null);
                } : undefined}
                isActive={isActive}
            />
        );
    }


    return (
        <div className="flex flex-col h-full pl-[18px] pr-[52px] pt-[18px] gap-4">
            <div className="flex flex-col gap-4">
                {!isDiscoveryOpen ? (
                    /* Collapsed State - Industrial Style Bar */
                    <div
                        onClick={() => {
                            setStagedSearchQuery(searchQuery);
                            setStagedFilterCategory(filterCategory);
                            setIsDiscoveryOpen(true);
                        }}
                        className="relative group cursor-pointer transition-all hover:scale-[1.005] active:scale-[0.995]"
                        style={{
                            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                            background: `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf`,
                        }}
                    >
                        <SyncCardBorder color={accentColor} isActive={false} /> {/* Hidden but ready */}
                        <div
                            className="h-[42px] px-5 flex items-center justify-between group-hover:bg-white/5 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor, boxShadow: `0 0 10px ${accentColor}` }} />
                                <span className="text-[10px] font-black tracking-[0.5em] text-white/90 uppercase">Game_Discovery_Protocol</span>
                            </div>
                            <div className="flex items-center gap-6">
                                {(searchQuery || filterCategory !== 'all') && (
                                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10" style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}>
                                        <span className="text-[6px] font-mono opacity-50 uppercase">Active_Filters_::</span>
                                        <span className="text-[6px] font-bold" style={{ color: accentColor }}>{filterCategory.toUpperCase()} {searchQuery ? `+ "${searchQuery}"` : ''}</span>
                                    </div>
                                )}
                                <span className="text-[7px] font-mono text-white/10 tracking-[0.3em] uppercase">Click_To_Configure_Sectors_::</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Expanded State - Dual Row Hardware Module */
                    <div
                        className="relative transition-all"
                        style={{
                            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
                            background: `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf`,
                        }}
                    >
                        <SyncCardBorder color={accentColor} isActive={true} />

                        <div className="flex flex-col px-7 py-3 gap-2">
                            {/* Top Row: Identification & Search */}
                            <div className="flex items-center gap-5">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: accentColor, boxShadow: `0 0 12px ${accentColor}` }} />

                                <div className="flex-1 relative group">
                                    <input
                                        autoFocus
                                        value={stagedSearchQuery}
                                        onChange={e => setStagedSearchQuery(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === 'Enter' && handleApplyScan()}
                                        placeholder="QUERY_DATABASE_::"
                                        className="w-full bg-transparent border-none px-0 py-1 text-[11px] font-black text-white/95 tracking-[0.4em] placeholder:text-white/30 uppercase outline-none"
                                    />
                                    <div className="absolute bottom-[-1px] left-0 w-full h-[1px] bg-white/10 group-focus-within:bg-white/40 transition-all" />
                                </div>
                            </div>

                            {/* Bottom Row: Sectors */}
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setStagedFilterCategory('all')}
                                    className={`w-8 h-8 flex items-center justify-center transition-all relative shrink-0 ${stagedFilterCategory === 'all' ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
                                    style={{
                                        backgroundColor: stagedFilterCategory === 'all' ? accentColor : 'rgba(255,255,255,0.03)',
                                        clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)'
                                    }}
                                >
                                    <div className="grid grid-cols-2 gap-0.5">
                                        {[1, 2, 3, 4].map(i => <div key={i} className={`w-[3px] h-[3px] rounded-full ${stagedFilterCategory === 'all' ? 'bg-black' : 'bg-white'}`} />)}
                                    </div>
                                </button>

                                {/* Orphaned Games Category (Ghost/Broken Signal Icon) */}
                                <button
                                    onClick={() => setStagedFilterCategory('orphaned')}
                                    className={`w-8 h-8 flex items-center justify-center transition-all relative shrink-0 ${stagedFilterCategory === 'orphaned' ? 'text-black' : 'text-white/40 hover:text-white/70'}`}
                                    style={{
                                        backgroundColor: stagedFilterCategory === 'orphaned' ? accentColor : 'rgba(255,255,255,0.03)',
                                        clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)'
                                    }}
                                    title="ORPHANED_UNITS"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                    </svg>
                                </button>

                                <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

                                {categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.id !== 'recent' && c.id !== 'secret').map(cat => {
                                    const isSelected = stagedFilterCategory === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            onClick={() => setStagedFilterCategory(cat.id)}
                                            className={`w-8 h-8 flex items-center justify-center transition-all relative shrink-0 ${isSelected ? 'opacity-100' : 'opacity-20 hover:opacity-100'}`}
                                            title={cat.name}
                                            style={{
                                                clipPath: 'polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)'
                                            }}
                                        >
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    backgroundColor: isSelected ? `${cat.color}44` : 'transparent',
                                                }}
                                            />
                                            {/* Border overlay using SVG to avoid clip issues */}
                                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 32 32" fill="none">
                                                <polygon points="5,0 32,0 32,27 27,32 0,32 0,5" stroke={isSelected ? cat.color : 'rgba(255,255,255,0.08)'} strokeWidth={isSelected ? '2' : '1'} fill="none" />
                                            </svg>
                                            <div
                                                className="w-[18px] h-[18px] relative z-10"
                                                style={{
                                                    backgroundColor: cat.color,
                                                    maskImage: `url(${resolveAsset(cat.icon)})`,
                                                    WebkitMaskImage: `url(${resolveAsset(cat.icon)})`,
                                                    maskSize: 'contain',
                                                    WebkitMaskSize: 'contain',
                                                    maskPosition: 'center',
                                                    maskRepeat: 'no-repeat'
                                                }}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Game Grid */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar pb-10 relative">
                <ScrollIndicator scrollRef={scrollContainerRef} color={accentColor} />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {/* Add New Unit Card */}
                    <div
                        onClick={() => handleEditStart(null)}
                        className="aspect-square group relative cursor-pointer overflow-hidden transition-transform duration-300 ease-out hover:scale-[1.02] active:scale-95"
                        style={{ clipPath: cardClip }}
                    >
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 border-2 border-dashed border-white/10 transition-colors" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <span className="text-[36px] font-thin text-white/20 group-hover:text-white transition-colors">+</span>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-white transition-colors">New_Entry</span>
                        </div>
                    </div>

                    {/* Game Cards - Virtualized */}
                    {visibleGames.map(game => (
                        <div
                            key={game.id}
                            onClick={() => handleEditStart(game)}
                            className="aspect-square group relative cursor-pointer overflow-hidden"
                            style={{ clipPath: cardClip }}
                        >
                            {/* Optimized Cover Background - 32x32 Low Res Tech Background */}
                            <img
                                src={`/api/assets/optimized-bg/${game.id}${assetVersion > 0 ? `?v=${assetVersion}` : ''}`}
                                className="absolute inset-0 w-full h-full object-cover opacity-60 transition-[opacity,transform] duration-500 scale-100 group-hover:scale-110"
                                style={{ transform: 'translateZ(0)' }}
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.getAttribute('data-fallback') === 'true') return;
                                    target.setAttribute('data-fallback', 'true');
                                    target.src = ASSETS.templates.cover;
                                }}
                            />
                            <div className="absolute inset-0 bg-black/30" />

                            {/* Logo or Title Fallback - Centered */}
                            <div className="absolute inset-0 flex items-center justify-center p-4" style={{ transform: 'translateZ(0)' }}>
                                {game.logo ? (
                                    <img
                                        src={resolveAsset(game.logo, 400)}
                                        className="max-w-[85%] max-h-[70%] object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] transition-transform duration-300 group-hover:scale-110"
                                        style={{ willChange: 'transform' }}
                                        loading="lazy"
                                        decoding="async"
                                        alt={game.title}
                                        onError={(e) => {
                                            // If logo fails to load, hide it so title fallback shows
                                            e.currentTarget.style.display = 'none';
                                            const fallback = e.currentTarget.parentElement?.querySelector('[data-title-fallback]') as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div
                                    data-title-fallback
                                    className="flex items-center justify-center text-center px-3"
                                    style={{ display: game.logo ? 'none' : 'flex' }}
                                >
                                    <span className="text-[13px] font-black uppercase tracking-[0.15em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] leading-tight">
                                        {game.title}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>


                {/* Sentinel for infinite scroll */}
                {visibleCount < sortedGames.length && (
                    <div ref={sentinelRef} className="w-full flex items-center justify-center py-6">
                        <span className="text-[7px] font-mono uppercase tracking-[0.5em] text-white/20 animate-pulse">Loading_Units...</span>
                    </div>
                )}

                {sortedGames.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20 gap-4">
                        <div className="w-12 h-px bg-white/20" />
                        <span className="text-[9px] font-mono uppercase tracking-[0.5em]">No_Matching_Signals_Found</span>
                        <div className="w-12 h-px bg-white/20" />
                    </div>
                )}
            </div>
        </div >
    );
};

export default GameRegistryModule;
