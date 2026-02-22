import React from 'react';
import Subsection from './Subsection';
import AssetInput from '../AssetInput';
import ModeSelector from './ModeSelector';
import { useTranslation } from '../../hooks/useTranslation';
import { Category } from '../../types';
import { getContrastColor } from '../../utils/colors';

interface CategoryEditFormProps {
    isFormOpen: boolean;
    setIsFormOpen: (v: boolean) => void;
    gameList: { id: string; title: string; cover?: string }[];
    editingId: string | null;
    catForm: {
        name: string;
        icon: string;
        color: string;
        wallpaper: string;
        wallpaperMode: 'fill' | 'contain' | 'cover' | 'center';
        gridOpacity: number;
        enabled: boolean;
    };
    setCatForm: React.Dispatch<React.SetStateAction<{
        name: string;
        icon: string;
        color: string;
        wallpaper: string;
        wallpaperMode: 'fill' | 'contain' | 'cover' | 'center';
        gridOpacity: number;
        enabled: boolean;
    }>>;
    handleSaveCategoryData: () => void;
    handleMoveGameInCategory: (catId: string, gameId: string, direction: 'up' | 'down') => void;
    handleToggleGameInCategory: (catId: string, gameId: string) => void;
    onEditGame?: (gameId: string) => void;
    onDeleteGame?: (gameId: string) => void;
    onInitializeUnit?: () => void;
    onWipeRegistry?: () => void;
    allGames: { id: string; title: string; cover?: string }[];
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    onResolveAsset: (path: string | undefined) => string;
    onFetchMissingAssets?: () => void;
    activeAccent: string;
}

const PLATFORM_COLORS: Record<string, string> = {
    '3ds': '#ce181e',
    'n64': '#316231',
    'nds': '#ffffff',
    'ngc': '#6a5acd', // GameCube Purple
    'gamecube': '#6a5acd',
    'nsw': '#e60012', // Switch Red
    'switch': '#e60012',
    'wii': '#ffffff', // Wii White
    'wiu': '#009ac7',
    'ps2': '#003791',
    'ps3': '#000000',
    'ps4': '#003791',
    'psp': '#000000',
    'psv': '#201e1f',
    'xbox': '#107c10', // Xbox Green
    'steam': '#66c0f4', // Steam Blue
};

const CategoryEditForm: React.FC<CategoryEditFormProps> = ({
    isFormOpen, setIsFormOpen, gameList, editingId,
    catForm, setCatForm, handleSaveCategoryData, handleMoveGameInCategory, handleToggleGameInCategory,
    onEditGame, onDeleteGame, onInitializeUnit, onWipeRegistry, allGames, triggerFileBrowser, onResolveAsset, onFetchMissingAssets, activeAccent
}) => {
    const { t } = useTranslation();
    const [isAddingGame, setIsAddingGame] = React.useState(false);
    const [selectionSearch, setSelectionSearch] = React.useState('');

    const filteredGames = React.useMemo(() => {
        return allGames
            .filter(g => g.title.toLowerCase().includes(selectionSearch.toLowerCase()))
            .sort((a, b) => a.title.localeCompare(b.title));
    }, [allGames, selectionSearch]);

    // Auto-Color Logic
    React.useEffect(() => {
        if (editingId) return; // Only for new categories
        const searchName = catForm.name.toLowerCase().trim();
        for (const [key, color] of Object.entries(PLATFORM_COLORS)) {
            if (searchName.includes(key)) {
                setCatForm(prev => ({ ...prev, color }));
                break;
            }
        }
    }, [catForm.name, editingId]);

    if (!isFormOpen) {
        return (
            <button onClick={() => setIsFormOpen(true)} className="w-full py-10 border-2 border-dashed border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-3 group/spawn">
                <div className="font-['Press_Start_2P'] text-[10px] text-white/40 group-hover/spawn:text-white transition-colors" style={{ textShadow: `0 0 10px ${activeAccent}44` }}>{t('modal.node_spawn')}</div>
                <span className="text-[7px] opacity-20 uppercase tracking-[0.4em]">{t('modal.configure_neural_cluster')}</span>
            </button>
        );
    }

    return (
        <Subsection title={t('modal.modify_node_config')} onSync={handleSaveCategoryData} syncLabel={t('modal.commit_node_state')} accentColor={activeAccent}>
            <div className="col-span-full flex flex-col gap-4 w-full">
                {/* Identity Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('registry.node_label')}</label>
                        <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="bg-black/40 border-2 border-white/10 p-2 lg:p-3 text-[10px] lg:text-[11px] outline-none uppercase font-mono focus:border-white focus:bg-white/5 transition-all" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('registry.accent_matrix_hex')}</label>
                        <div className="flex gap-2 lg:gap-4">
                            <input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} className="h-10 w-24 bg-transparent border-2 border-white/10 cursor-pointer overflow-hidden" />
                            <input value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} className="flex-1 bg-black/40 border-2 border-white/10 p-2 lg:p-3 text-[10px] lg:text-[11px] font-mono uppercase outline-none focus:border-white focus:bg-white/5 transition-all" />
                        </div>
                    </div>
                </div>

                {/* Icon + Status Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <AssetInput label={t('system_tab.neural_terminal_icon')} value={catForm.icon} onChange={v => setCatForm({ ...catForm, icon: v })} triggerFileBrowser={triggerFileBrowser} target="icon" previewType="icon" accentColor={activeAccent} onResolveAsset={onResolveAsset} />
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('system.link_status')}</label>
                        <button
                            onClick={() => editingId !== 'recent' && setCatForm({ ...catForm, enabled: !catForm.enabled })}
                            disabled={editingId === 'recent'}
                            className={`h-10 px-6 text-[9px] font-bold uppercase border-2 transition-all ${editingId === 'recent'
                                ? 'bg-white/5 border-white/20 text-white/60 cursor-not-allowed'
                                : catForm.enabled
                                    ? 'bg-transparent text-white border-white active:scale-95'
                                    : 'bg-red-600 border-red-500 text-white active:scale-95'
                                }`}
                            style={{
                                color: catForm.enabled && editingId !== 'recent' ? activeAccent : undefined,
                                borderColor: catForm.enabled && editingId !== 'recent' ? activeAccent : undefined
                            }}
                            onMouseEnter={(e) => { if (catForm.enabled && editingId !== 'recent') { e.currentTarget.style.backgroundColor = activeAccent; e.currentTarget.style.color = getContrastColor(activeAccent); } }}
                            onMouseLeave={(e) => { if (catForm.enabled && editingId !== 'recent') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = activeAccent; } }}
                        >
                            {editingId === 'recent' ? t('registry.system_locked') : (catForm.enabled ? t('registry.online_protocol') : t('registry.offline_isolation'))}
                        </button>
                    </div>
                </div>

                {/* Ambient Settings */}
                <div className="border-t-2 border-white/5 pt-2 mt-1">
                    <span className="text-[7px] opacity-20 uppercase tracking-[0.4em] font-bold">{t('system_tab.ambience_protocol')}</span>
                </div>
                <AssetInput label={t('system_tab.icon_src')} value={catForm.wallpaper || ''} onChange={v => setCatForm({ ...catForm, wallpaper: v })} triggerFileBrowser={triggerFileBrowser} target="wallpaper" previewType="wallpaper" accentColor={activeAccent} onResolveAsset={onResolveAsset} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                    <ModeSelector label={t('registry.render_sequence')} value={catForm.wallpaperMode} onChange={v => setCatForm({ ...catForm, wallpaperMode: v })} />
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center"><label className="text-[7px] lg:text-[9px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('registry.mesh_grid_opacity')}</label><span className="text-[10px] lg:text-[11px] font-mono" style={{ color: activeAccent }}>{Math.round(catForm.gridOpacity * 100)}%</span></div>
                        <input type="range" min="0" max="0.5" step="0.01" value={catForm.gridOpacity} onChange={e => setCatForm({ ...catForm, gridOpacity: parseFloat(e.target.value) })} className="w-full h-1 bg-white/10 accent-white appearance-none cursor-pointer" />
                    </div>
                </div>

                {/* Registry Management */}
                <div className="border-t-2 border-white/5 pt-4 mt-2">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                        <div className="flex flex-col">
                            <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">{t('registry.registry_sequence')}</label>
                            <span className="text-[6px] text-white/20 font-mono uppercase mt-0.5">MANAGE_UNIT_RECORDS</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setIsAddingGame(!isAddingGame)}
                                className={`px-4 py-2 border-2 font-bold text-[8px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${isAddingGame ? 'bg-white text-black border-white' : 'border-white/10 text-white/40 hover:border-white/60 hover:text-white hover:bg-white/5'}`}
                            >
                                <span className="w-1.5 h-1.5 rotate-45 border border-current"></span>
                                {isAddingGame ? t('registry.close_selector') : t('registry.add_existing')}
                            </button>
                            {onFetchMissingAssets && (
                                <button
                                    onClick={onFetchMissingAssets}
                                    className="px-4 py-2 border-2 border-white/10 text-white/40 hover:border-white hover:text-white hover:bg-white/5 font-bold text-[8px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 group/fetch"
                                >
                                    <span className="text-[10px] leading-none opacity-40 group-hover/fetch:opacity-100">🔍</span>
                                    {t('registry.fetch_missing_assets')}
                                </button>
                            )}
                            {onInitializeUnit && (
                                <button
                                    onClick={onInitializeUnit}
                                    className="px-4 py-2 border-2 font-bold text-[8px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 group/init"
                                    style={{ borderColor: `${activeAccent}44`, color: `${activeAccent}cc` }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = activeAccent; e.currentTarget.style.color = activeAccent; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${activeAccent}44`; e.currentTarget.style.color = `${activeAccent}cc`; }}
                                >
                                    <div className="w-1.5 h-1.5 animate-pulse" style={{ backgroundColor: activeAccent }}></div>
                                    {t('registry.initialize_unit')}
                                </button>
                            )}
                            {onWipeRegistry && (
                                <button
                                    onClick={onWipeRegistry}
                                    className="ml-auto px-4 py-2 border-2 border-red-500/20 text-red-500/40 hover:border-red-500 hover:text-red-500 hover:bg-red-500/5 font-bold text-[8px] uppercase tracking-[0.2em] transition-all flex items-center gap-2 group/purge"
                                >
                                    <span className="text-[10px] leading-none opacity-40 group-hover/purge:opacity-100">⚠️</span>
                                    {t('registry.purge_master')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {isAddingGame && (
                    <div className="flex flex-col gap-3 bg-white/5 border-2 border-white/10 p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <input
                            autoFocus
                            placeholder={t('registry.search_for_unit')}
                            value={selectionSearch}
                            onChange={e => setSelectionSearch(e.target.value)}
                            className="bg-black/60 border-2 border-white/10 p-2 text-[10px] font-mono uppercase outline-none focus:border-white mb-2"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
                            {filteredGames.map(g => {
                                const isAdded = gameList.some(gi => gi.id === g.id);
                                return (
                                    <div
                                        key={g.id}
                                        onClick={() => handleToggleGameInCategory(editingId!, g.id)}
                                        className={`flex items-center gap-3 p-2 cursor-pointer border-2 transition-all ${isAdded ? 'bg-white text-black border-white' : 'bg-black/40 border-white/10 hover:border-white/40 text-white'}`}
                                    >
                                        <div className="w-6 h-6 shrink-0 bg-black/20 border border-white/10 flex items-center justify-center">
                                            {isAdded ? '✓' : ''}
                                        </div>
                                        <span className="text-[8px] font-bold truncate uppercase tracking-widest">{g.title}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                    {gameList.length === 0 && !isAddingGame && (
                        <div className="py-10 text-center border-2 border-dashed border-white/5 text-[8px] opacity-20 uppercase tracking-[0.5em]">{t('registry.no_units_registered')}</div>
                    )}
                    {gameList.map((g, idx) => (
                        <div key={g.id} className="flex items-center gap-3 p-2 bg-black/20 border-2 border-white/5 group/row hover:border-white/20 hover:bg-white/5 transition-colors relative">
                            <div className="w-8 h-8 flex items-center justify-center font-mono text-[10px] bg-black/60 border-2 border-white/10 shrink-0 font-bold" style={{ color: activeAccent }}>{String(idx + 1).padStart(2, '0')}</div>
                            <div className="flex-1 min-w-0">
                                <span className="block text-[9px] font-bold text-white uppercase truncate tracking-wider">{g.title}</span>
                                <span className="block text-[6px] text-white/20 font-mono truncate">{g.id}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0 bg-black/40 p-1 border border-white/10">
                                <button
                                    onClick={() => onEditGame?.(g.id)}
                                    className="px-3 h-7 flex items-center justify-center border-2 border-white/20 hover:border-white text-[8px] font-bold uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-white"
                                    title="EDIT_METADATA"
                                >
                                    EDIT
                                </button>
                                <div className="w-px h-6 bg-white/10 mx-1" />
                                {idx > 0 && (
                                    <button onClick={() => handleMoveGameInCategory(editingId!, g.id, 'up')} className="w-7 h-7 flex items-center justify-center border-2 border-white/10 hover:border-white text-[11px] text-white/40 hover:text-white transition-colors active:scale-95">↑</button>
                                )}
                                {idx < gameList.length - 1 && (
                                    <button onClick={() => handleMoveGameInCategory(editingId!, g.id, 'down')} className="w-7 h-7 flex items-center justify-center border-2 border-white/10 hover:border-white text-[11px] text-white/40 hover:text-white transition-colors active:scale-95">↓</button>
                                )}
                                <div className="w-px h-6 bg-white/10 mx-1" />
                                <button
                                    onClick={() => handleToggleGameInCategory(editingId!, g.id)}
                                    className="w-7 h-7 flex items-center justify-center border-2 border-red-500/20 hover:border-red-500/60 bg-red-950/10 text-red-500/40 hover:text-red-500 transition-colors active:scale-95 font-bold text-[10px]"
                                    title="REMOVE_FROM_NODE"
                                >
                                    ×
                                </button>
                                <button
                                    onClick={() => onDeleteGame?.(g.id)}
                                    className="w-7 h-7 flex items-center justify-center border-2 border-red-500/40 hover:border-red-500 bg-red-950/20 text-red-500 transition-colors active:scale-95 text-[10px]"
                                    title="PURGE_MASTER_REGISTRY"
                                >
                                    🗑
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <button onClick={() => setIsFormOpen(false)} className="text-[7px] opacity-20 hover:opacity-100 uppercase font-bold tracking-widest transition-opacity text-center mt-2">{t('modal.collapse_matrix')}</button>
            </div>
        </Subsection>
    );
};

export default CategoryEditForm;
