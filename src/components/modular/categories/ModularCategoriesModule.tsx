import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Category } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';
import Subsection from './Subsection';
import AssetInput from '../../AssetInput';
import ModeSelector from './ModeSelector';
import CyberScrollbar from '../../CyberScrollbar';
import { getContrastColor } from '../../../utils/colors';

interface ModularCategoriesModuleProps {
    categories: Category[];
    activeAccent: string;
    onResolveAsset: (path: string | undefined) => string;
    handleCreateCategory: (setEditingId: (id: string | null) => void, setCatForm: (form: any) => void, scrollToForm: () => void) => void;
    handleDeleteCategory: (catId: string, editingId: string | null, setEditingId: (id: string | null) => void, requestConfirmation: (msg: string, onConfirm: () => void, isDanger?: boolean) => void) => void;
    handleMoveCategory: (catId: string, direction: 'up' | 'down') => void;
    handleMoveGameInCategory: (catId: string, gameId: string, direction: 'up' | 'down') => void;
    handleToggleGameInCategory: (catId: string, gameId: string) => void;
    handleFetchMissingAssets: (categoryId: string, onStatus?: (s: string) => void) => Promise<void>;
    triggerFileBrowser: (target: string, type: string) => void;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    requestConfirmation: (message: string, onConfirm: () => void, isDanger?: boolean) => void;
    onCommandUpdate: (command: any, execute?: () => void, progress?: number, isExecuting?: boolean, isReady?: boolean) => void;
}

const ModularCategoriesModule: React.FC<ModularCategoriesModuleProps> = ({
    categories,
    activeAccent,
    onResolveAsset,
    handleCreateCategory,
    handleDeleteCategory,
    handleMoveCategory,
    handleMoveGameInCategory,
    handleToggleGameInCategory,
    handleFetchMissingAssets,
    triggerFileBrowser,
    onUpdateCategories,
    requestConfirmation,
    onCommandUpdate
}) => {
    const { t } = useTranslation();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [catForm, setCatForm] = useState({
        name: '',
        icon: '',
        color: '#ffffff',
        wallpaper: '',
        wallpaperMode: 'cover' as 'fill' | 'contain' | 'cover' | 'center',
        gridOpacity: 0.15,
        enabled: true
    });

    const [isAddingGame, setIsAddingGame] = useState(false);
    const [selectionSearch, setSelectionSearch] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    const allGames = useMemo(() => {
        const allCat = categories.find(c => c.id === 'all');
        return allCat?.games || [];
    }, [categories]);

    const filteredGames = useMemo(() => {
        return allGames
            .filter(g => g.title.toLowerCase().includes(selectionSearch.toLowerCase()))
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [allGames, selectionSearch]);

    useEffect(() => {
        if (editingId) {
            const cat = categories.find(c => c.id === editingId);
            if (cat) {
                setCatForm({
                    name: cat.name,
                    icon: cat.icon || '',
                    color: cat.color || '#ffffff',
                    wallpaper: cat.wallpaper || '',
                    wallpaperMode: cat.wallpaperMode || 'cover',
                    gridOpacity: cat.gridOpacity || 0.15,
                    enabled: cat.enabled !== false
                });
                setIsFormOpen(true);
            }
        } else {
            setIsFormOpen(false);
        }
    }, [editingId, categories]);

    const handleSaveCategoryData = () => {
        if (!editingId) return;
        onUpdateCategories(prev => prev.map(c => c.id === editingId ? { ...c, ...catForm } : c));
    };

    useEffect(() => {
        if (editingId && isFormOpen) {
            onCommandUpdate(
                {
                    text: t('categories.command_commit'),
                    desc: t('categories.desc_commit')
                },
                handleSaveCategoryData,
                0,
                false,
                !!catForm.name.trim()
            );
        } else {
            onCommandUpdate(
                {
                    text: t('categories.node_monitor'),
                    desc: t('categories.active_nodes_indices')
                },
                undefined,
                0,
                false,
                false
            );
        }
    }, [editingId, isFormOpen, catForm.name, t, onCommandUpdate]);

    const scrollToForm = () => {
        setTimeout(() => {
            editorRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const editableCategories = categories.filter(c => c.id !== 'all' && c.id !== 'hidden');
    const displayCategories = categories.filter(c => c.id !== 'recent' && c.id !== 'all' && c.id !== 'hidden');

    if (editingId && isFormOpen) {
        const gameList = categories.find(c => c.id === editingId)?.games || [];

        return (
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div ref={scrollContainerRef} className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10">
                    <div className="flex flex-col gap-6 lg:gap-8">
                        <div className="flex justify-between items-center border-b-2 border-white/10 pb-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                                    {t('categories.node_configuration').replace('{{name}}', catForm.name)}
                                </h3>
                                <span className="text-[7px] text-white/30 tracking-[0.2em] font-mono">ID: {editingId}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleDeleteCategory(editingId!, editingId, setEditingId, requestConfirmation)}
                                    className="px-4 py-2 border-2 border-red-500/20 hover:border-red-500 text-red-500/80 hover:text-white hover:bg-red-600 text-[8px] font-bold uppercase tracking-widest transition-all"
                                >
                                    {t('categories.purge')}
                                </button>
                                <button
                                    onClick={() => setEditingId(null)}
                                    className="px-4 py-2 border-2 border-white/10 hover:border-white text-white/40 hover:text-white text-[8px] font-bold uppercase tracking-widest transition-all"
                                >
                                    {t('categories.back_to_grid')}
                                </button>
                            </div>
                        </div>

                        <Subsection title={t('categories.identity_matrix')} accentColor={catForm.color}>
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('categories.node_label')}</label>
                                    <input
                                        value={catForm.name}
                                        onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                                        className="bg-black/20 border-2 border-white/10 p-3 text-[10px] outline-none uppercase font-mono focus:border-white transition-all text-white"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('categories.accent_hex')}</label>
                                    <div className="flex gap-4">
                                        <input
                                            type="color"
                                            value={catForm.color}
                                            onChange={e => setCatForm({ ...catForm, color: e.target.value })}
                                            className="h-12 w-20 bg-transparent border-2 border-white/10 cursor-pointer overflow-hidden p-1"
                                        />
                                        <input
                                            value={catForm.color}
                                            onChange={e => setCatForm({ ...catForm, color: e.target.value })}
                                            className="flex-1 bg-black/20 border-2 border-white/10 p-3 text-[10px] font-mono uppercase outline-none focus:border-white transition-all text-white"
                                        />
                                    </div>
                                </div>
                                <AssetInput
                                    label={t('categories.terminal_icon')}
                                    value={catForm.icon}
                                    onChange={v => setCatForm({ ...catForm, icon: v })}
                                    triggerFileBrowser={triggerFileBrowser}
                                    target="icon"
                                    previewType="icon"
                                    accentColor={catForm.color}
                                    onResolveAsset={onResolveAsset}
                                />
                                <div className="flex flex-col gap-2">
                                    <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('categories.link_status')}</label>
                                    <button
                                        onClick={() => editingId !== 'recent' && setCatForm({ ...catForm, enabled: !catForm.enabled })}
                                        disabled={editingId === 'recent'}
                                        className={`h-12 px-6 text-[9px] font-bold uppercase border-2 transition-all ${editingId === 'recent'
                                            ? 'opacity-40 border-white/10 cursor-not-allowed'
                                            : catForm.enabled
                                                ? 'bg-white text-black border-white'
                                                : 'bg-red-600 border-red-500 text-white'
                                            }`}
                                    >
                                        {editingId === 'recent' ? t('categories.system_locked') : (catForm.enabled ? t('categories.online_protocol') : t('categories.offline_isolation'))}
                                    </button>
                                </div>
                            </div>
                        </Subsection>

                        <Subsection title={t('categories.ambience_engine')} accentColor={catForm.color}>
                            <div className="col-span-full flex flex-col gap-6">
                                <AssetInput
                                    label={t('categories.node_wallpaper')}
                                    value={catForm.wallpaper}
                                    onChange={v => setCatForm({ ...catForm, wallpaper: v })}
                                    triggerFileBrowser={triggerFileBrowser}
                                    target="wallpaper"
                                    previewType="wallpaper"
                                    accentColor={catForm.color}
                                    onResolveAsset={onResolveAsset}
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ModeSelector label={t('categories.render_sequence')} value={catForm.wallpaperMode} onChange={v => setCatForm({ ...catForm, wallpaperMode: v })} />
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('categories.mesh_grid_opacity')}</label>
                                            <span className="text-[10px] font-mono" style={{ color: catForm.color }}>{Math.round(catForm.gridOpacity * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="0.5"
                                            step="0.01"
                                            value={catForm.gridOpacity}
                                            onChange={e => setCatForm({ ...catForm, gridOpacity: parseFloat(e.target.value) })}
                                            className="w-full h-1 bg-white/10 accent-white appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </Subsection>

                        <Subsection title={t('categories.unit_registry_management')} accentColor={catForm.color}>
                            <div className="col-span-full flex flex-col gap-4">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <button
                                        onClick={() => setIsAddingGame(!isAddingGame)}
                                        className={`px-4 py-2 border-2 font-bold text-[8px] uppercase tracking-widest transition-all ${isAddingGame ? 'bg-white text-black' : 'border-white/10 text-white/40 hover:border-white/40 hover:text-white'}`}
                                    >
                                        {isAddingGame ? t('categories.close_selector') : t('categories.add_existing_unit')}
                                    </button>
                                    <button
                                        onClick={() => handleFetchMissingAssets(editingId)}
                                        className="px-4 py-2 border-2 border-white/10 text-white/40 hover:border-white hover:text-white font-bold text-[8px] uppercase tracking-widest transition-all"
                                    >
                                        {t('categories.rescan_metadata')}
                                    </button>
                                </div>

                                {isAddingGame && (
                                    <div className="p-4 bg-white/5 border-2 border-white/10 flex flex-col gap-4">
                                        <input
                                            autoFocus
                                            placeholder={t('categories.search_for_unit')}
                                            value={selectionSearch}
                                            onChange={e => setSelectionSearch(e.target.value)}
                                            className="bg-black/20 border-2 border-white/10 p-3 text-[10px] font-mono uppercase outline-none focus:border-white text-white"
                                        />
                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto no-scrollbar">
                                            {filteredGames.map(g => {
                                                const isAdded = gameList.some(gi => gi.id === g.id);
                                                return (
                                                    <div
                                                        key={g.id}
                                                        onClick={() => handleToggleGameInCategory(editingId!, g.id)}
                                                        className={`flex items-center gap-3 p-3 cursor-pointer border-2 transition-all ${isAdded ? 'bg-white text-black border-white' : 'bg-black/20 border-white/10 hover:border-white/40 text-white'}`}
                                                    >
                                                        <div className="w-4 h-4 shrink-0 bg-black/20 border border-current flex items-center justify-center text-[10px]">
                                                            {isAdded ? '✓' : ''}
                                                        </div>
                                                        <span className="text-[8px] font-bold truncate uppercase tracking-widest">{g.title}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2">
                                    {gameList.length === 0 && !isAddingGame && (
                                        <div className="py-12 text-center border-2 border-dashed border-white/5 text-[8px] opacity-20 uppercase tracking-[0.5em]">{t('categories.no_units_registered')}</div>
                                    )}
                                    {gameList.map((g, idx) => (
                                        <div key={g.id} className="flex items-center gap-3 p-3 bg-black/20 border-2 border-white/5 group/row hover:border-white/20 transition-all">
                                            <div className="w-10 h-10 flex items-center justify-center font-mono text-[10px] bg-black/40 border-2 border-white/10 shrink-0 font-bold" style={{ color: catForm.color }}>
                                                {String(idx + 1).padStart(2, '0')}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="block text-[9px] font-bold text-white uppercase truncate tracking-widest">{g.title}</span>
                                                <span className="block text-[6px] text-white/30 font-mono truncate">{g.id}</span>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                {idx > 0 && (
                                                    <button onClick={() => handleMoveGameInCategory(editingId!, g.id, 'up')} className="w-8 h-8 flex items-center justify-center border-2 border-white/10 hover:border-white text-white/40 hover:text-white transition-all text-xs">↑</button>
                                                )}
                                                {idx < gameList.length - 1 && (
                                                    <button onClick={() => handleMoveGameInCategory(editingId!, g.id, 'down')} className="w-8 h-8 flex items-center justify-center border-2 border-white/10 hover:border-white text-white/40 hover:text-white transition-all text-xs">↓</button>
                                                )}
                                                <button
                                                    onClick={() => handleToggleGameInCategory(editingId!, g.id)}
                                                    className="px-4 h-8 flex items-center justify-center border-2 border-red-500/20 hover:border-red-500 text-red-500/40 hover:text-red-500 text-[8px] font-bold uppercase transition-all"
                                                >
                                                    {t('categories.detach')}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Subsection>
                    </div>
                </div>
                <CyberScrollbar containerRef={scrollContainerRef} accentColor={catForm.color} />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div ref={scrollContainerRef} className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10">
                <div className="flex flex-col gap-8">
                    {/* Header Action */}
                    <div className="flex justify-between items-center border-b-2 border-white/10 pb-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">{t('categories.node_monitor')}</h3>
                            <span className="text-[7px] text-white/30 tracking-[0.2em] font-mono">{t('categories.active_nodes_indices')}</span>
                        </div>
                    </div>

                    {/* Fixed Nodes (ALL / RECENT) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...categories.filter(c => c.id === 'all'), ...categories.filter(c => c.id === 'recent')].map(cat => (
                            <div
                                key={cat.id}
                                onClick={() => setEditingId(cat.id)}
                                className="relative group cursor-pointer h-24 border-2 border-white/5 bg-black/30 transition-all hover:bg-white/5 active:scale-[0.98]"
                                style={{
                                    clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                                    borderTopColor: `${cat.color}aa`
                                }}
                            >
                                <div className="absolute top-0 right-0 w-16 h-16 flex items-center justify-center opacity-5 pointer-events-none">
                                    <img src={onResolveAsset(cat.icon)} className="w-full h-full object-contain grayscale invert" alt="" />
                                </div>
                                <div className="h-full flex items-center gap-6 px-6 relative z-10">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[20px] font-black text-white uppercase tracking-[0.3em] font-['Space_Mono']">{cat.name}</span>
                                        <span className="text-[7px] uppercase font-bold tracking-widest" style={{ color: cat.color }}>{cat.games.length} {t('categories.units_in_memory')}</span>
                                    </div>
                                    <div className="ml-auto w-12 h-12 flex-shrink-0 flex items-center justify-center opacity-60">
                                        <img src={onResolveAsset(cat.icon)} className="w-8 h-8 object-contain" alt="" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* User Nodes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {/* + Block */}
                        <div
                            onClick={() => handleCreateCategory(setEditingId, setCatForm, scrollToForm)}
                            className="relative group cursor-pointer aspect-square transition-all hover:bg-white/5 active:scale-[0.98] bg-black/20 flex flex-col items-center justify-center border-2 border-white/5 hover:border-white/20"
                            style={{
                                clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))'
                            }}
                        >
                            <span className="text-5xl font-light text-white/20 group-hover:text-white/60 transition-colors">+</span>
                        </div>

                        {/* Node Blocks */}
                        {displayCategories.map((cat, idx) => (
                            <div key={cat.id} className="relative group flex flex-col aspect-square">
                                {/* Top: UP */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleMoveCategory(cat.id, 'up'); }}
                                    disabled={idx === 0}
                                    className="h-7 w-full flex items-center justify-center bg-black/20 hover:bg-white/10 transition-all text-white/30 hover:text-white disabled:opacity-10 border border-white/5 hover:border-white/20 z-10"
                                    style={{
                                        clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 0 100%)',
                                        marginBottom: '2px'
                                    }}
                                >
                                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-current"></div>
                                </button>

                                {/* Middle: SELECT */}
                                <div
                                    onClick={() => setEditingId(cat.id)}
                                    className="flex-1 flex flex-col items-center justify-center gap-2 bg-black/20 hover:bg-white/5 transition-all cursor-pointer border border-white/5 hover:border-white/20 relative group/select overflow-hidden"
                                    style={{
                                        borderLeftColor: cat.color,
                                        borderLeftWidth: '2px'
                                    }}
                                >
                                    <div className="absolute top-0 right-0 w-16 h-16 flex items-center justify-center opacity-5 pointer-events-none -mr-4 -mt-4">
                                        <img src={onResolveAsset(cat.icon)} className="w-full h-full object-contain grayscale invert" alt="" />
                                    </div>
                                    <span className="absolute bottom-2 right-2 text-[6px] text-white/20 font-mono">{idx + 1}</span>

                                    <div className="w-10 h-10 flex items-center justify-center relative z-10 mb-1">
                                        <img src={onResolveAsset(cat.icon)} className="w-8 h-8 opacity-60 group-hover/select:opacity-100 transition-all group-hover/select:scale-110" style={{ filter: `drop-shadow(0 0 5px ${cat.color}88)` }} />
                                    </div>
                                    <span className="font-bold text-[9px] uppercase tracking-widest text-center truncate px-2 text-white w-full z-10">
                                        {cat.name}
                                    </span>
                                </div>

                                {/* Bottom: DOWN */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleMoveCategory(cat.id, 'down'); }}
                                    disabled={idx === displayCategories.length - 1}
                                    className="h-7 w-full flex items-center justify-center bg-black/20 hover:bg-white/10 transition-all text-white/30 hover:text-white disabled:opacity-10 border border-white/5 hover:border-white/20 z-10"
                                    style={{
                                        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 15px 100%, 0 calc(100% - 15px))',
                                        marginTop: '2px'
                                    }}
                                >
                                    <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-current"></div>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <CyberScrollbar containerRef={scrollContainerRef} accentColor={activeAccent} />
        </div>
    );
};

export default ModularCategoriesModule;
