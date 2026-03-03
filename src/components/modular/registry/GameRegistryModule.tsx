
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Category, Game } from '../../../types';
import { ASSETS } from '../../../constants';
import { useTranslation } from '../../../hooks/useTranslation';
import GameEditForm from './GameEditForm';


interface GameRegistryModuleProps {
    isActive: boolean;
    isSubModuleOpen?: boolean;
    accentColor: string;
    categories: Category[];
    allGamesCategory: Category;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    onCommandUpdate: (command: any, execute?: () => void, progress?: number, isExecuting?: boolean, isReady?: boolean) => void;
    resolveAsset: (path: string | undefined, width?: number) => string;
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    triggerCloudBrowser: (target: string, type: string, initialQuery?: string) => void;
    handleSaveGame: (formData: any, editingId: string | null) => Promise<string | undefined>;
    handleDeleteGame: (gameId: string, requestConfirmation: any) => void;
    sgdbKey: string;
    sgdbEnabled: boolean;
    registerGoBack?: (fn: () => boolean) => void;
    onCanGoBackChange?: (canGoBack: boolean) => void;
    lastSelectedAsset?: { target: string; path: string; timestamp: number } | null;
    onClearLastAsset?: () => void;
}

const SyncCardBorder = ({ color, isActive }: { color: string; isActive: boolean }) => {
    if (!isActive) return null;
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {/* Straight Edges */}
            <div className="absolute top-0 left-0 h-[2px]" style={{ right: '20px', backgroundColor: color }} />
            <div className="absolute bottom-0 right-0 h-[2px]" style={{ left: '20px', backgroundColor: color }} />
            <div className="absolute top-[20px] bottom-0 right-0 w-[2px]" style={{ backgroundColor: color }} />
            <div className="absolute top-0 bottom-[20px] left-0 w-[2px]" style={{ backgroundColor: color }} />

            {/* Top-right diagonal corner */}
            <svg className="absolute top-0 right-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
            {/* Bottom-left diagonal corner */}
            <svg className="absolute bottom-0 left-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
        </div>
    );
};

const GameRegistryModule: React.FC<GameRegistryModuleProps> = ({
    isActive, isSubModuleOpen, accentColor, categories, allGamesCategory, onUpdateCategories, onCommandUpdate, resolveAsset,
    triggerFileBrowser,
    triggerCloudBrowser,
    handleSaveGame, handleDeleteGame, sgdbKey, sgdbEnabled, registerGoBack, onCanGoBackChange, lastSelectedAsset, onClearLastAsset
}) => {
    const [view, setView] = useState<'list' | 'edit'>('list');
    const [editingGame, setEditingGame] = useState<Game | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isDiscoveryOpen, setIsDiscoveryOpen] = useState(false);

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

    // Report canGoBack state to parent for dynamic button label
    useEffect(() => {
        if (onCanGoBackChange) onCanGoBackChange(view === 'edit' || isDiscoveryOpen);
    }, [view, isDiscoveryOpen, onCanGoBackChange]);

    useEffect(() => {
        if (!isActive && !isSubModuleOpen) {
            setView('list');
            setEditingGame(null);
            setIsDiscoveryOpen(false);
        }
    }, [isActive, isSubModuleOpen]);

    // Staged states for "Execute" pattern
    const [stagedSearchQuery, setStagedSearchQuery] = useState('');
    const [stagedFilterCategory, setStagedFilterCategory] = useState<string>('all');

    const sortedGames = useMemo(() => {
        let games = [...allGamesCategory.games];
        if (filterCategory !== 'all') {
            const cat = categories.find(c => c.id === filterCategory);
            if (cat) {
                const ids = new Set(cat.games.map(g => g.id));
                games = games.filter(g => ids.has(g.id));
            }
        }
        if (searchQuery) {
            games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return games.sort((a, b) => a.title.localeCompare(b.title));
    }, [allGamesCategory.games, searchQuery, filterCategory, categories]);

    const handleApplyScan = () => {
        setSearchQuery(stagedSearchQuery);
        setFilterCategory(stagedFilterCategory);
        setIsDiscoveryOpen(false);
    };

    const { t } = useTranslation();

    useEffect(() => {
        if (view === 'list') {
            if (isDiscoveryOpen) {
                onCommandUpdate(
                    {
                        text: t('registry.command_discovery'),
                        desc: t('registry.desc_discovery')
                    },
                    handleApplyScan,
                    0,
                    false,
                    true // isReady: true to make the EXECUTE badge glow
                );
            } else {
                onCommandUpdate(
                    {
                        text: t('registry.command_monitor'),
                        desc: t('registry.desc_monitor')
                    },
                    undefined,
                    0,
                    false,
                    false
                );
            }
        }
    }, [view, isDiscoveryOpen, stagedSearchQuery, stagedFilterCategory, onCommandUpdate, t]);

    const handleEditStart = (game: Game | null) => {
        setEditingGame(game);
        setView('edit');
    };

    const handleSave = async (formData: any) => {
        const id = await handleSaveGame(formData, editingGame?.id || null);
        if (id) {
            setView('list');
        }
    };

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
                            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                            background: `${accentColor}26`,
                        }}
                    >
                        <SyncCardBorder color={accentColor} isActive={false} /> {/* Hidden but ready */}
                        <div
                            className="py-3 px-8 flex items-center justify-between group-hover:bg-white/5 transition-colors"
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
                            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                            backgroundColor: `${accentColor}26`,
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

                                <div className="w-px h-4 bg-white/10 mx-0.5 shrink-0" />

                                {categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.id !== 'recent').map(cat => {
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
            <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {/* Add New Unit Card */}
                    <div
                        onClick={() => handleEditStart(null)}
                        className="aspect-[2/3] group relative cursor-pointer overflow-hidden transition-all hover:scale-[1.02] active:scale-95"
                        style={{ clipPath: cardClip }}
                    >
                        <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 border-2 border-dashed border-white/10 transition-colors" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <span className="text-[40px] font-thin text-white/20 group-hover:text-white transition-colors">+</span>
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-white transition-colors">Add_New_Unit</span>
                        </div>
                    </div>

                    {/* Game Cards */}
                    {sortedGames.map(game => (
                        <div
                            key={game.id}
                            onClick={() => handleEditStart(game)}
                            className="aspect-[2/3] group relative cursor-pointer overflow-hidden transition-all hover:scale-[1.02]"
                            style={{ clipPath: cardClip }}
                        >
                            <div className="absolute inset-0 bg-black/40" />
                            <img
                                src={resolveAsset(game.cover || ASSETS.templates.cover, 400)}
                                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-500"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                    const target = e.currentTarget;
                                    if (target.getAttribute('data-fallback') === 'true') return;
                                    target.setAttribute('data-fallback', 'true');
                                    target.src = ASSETS.templates.cover;
                                }}
                            />

                            {/* Vertical Title Strip - Right Side */}
                            <div className="absolute top-0 right-0 bottom-0 w-[22px] bg-gradient-to-l from-black/80 via-black/60 to-transparent group-hover:from-black/90 transition-colors flex items-center justify-center">
                                <span
                                    className="text-[7px] font-black uppercase tracking-[0.25em] text-white/70 group-hover:text-white transition-colors whitespace-nowrap"
                                    style={{
                                        writingMode: 'vertical-rl',
                                        textOrientation: 'mixed',
                                        transform: 'rotate(180deg)',
                                        maxHeight: 'calc(100% - 12px)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {game.title}
                                </span>
                            </div>

                            {/* Hover ID Badge */}
                            <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[5px] font-mono opacity-40 uppercase tracking-tighter">REF_::_{game.id.substring(0, 12)}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {sortedGames.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20 gap-4">
                        <div className="w-12 h-px bg-white/20" />
                        <span className="text-[9px] font-mono uppercase tracking-[0.5em]">No_Matching_Signals_Found</span>
                        <div className="w-12 h-px bg-white/20" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameRegistryModule;
