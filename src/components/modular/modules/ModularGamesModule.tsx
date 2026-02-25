import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Category, Game } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';
import Subsection from '../../management/Subsection';
import AssetInput from '../../AssetInput';
import CyberScrollbar from '../../CyberScrollbar';
import { getContrastColor } from '../../../utils/colors';

interface ModularGamesModuleProps {
    categories: Category[];
    activeAccent: string;
    onResolveAsset: (path: string | undefined) => string;
    triggerFileBrowser: (target: string, type: string) => void;
    handleSaveGame: (gameForm: any, editingId: string | null, isSecret?: boolean) => Promise<string | undefined>;
    handleDeleteGame: (gameId: string, requestConfirmation: (msg: string, onConfirm: () => void, isDanger?: boolean) => void) => void;
    handleImportAsset: (sourcePath: string, gameId: string, assetType: string) => Promise<string>;
    requestConfirmation: (message: string, onConfirm: () => void, isDanger?: boolean) => void;
    onNotification: (msg: string | null) => void;
}

const ModularGamesModule: React.FC<ModularGamesModuleProps> = ({
    categories,
    activeAccent,
    onResolveAsset,
    triggerFileBrowser,
    handleSaveGame,
    handleDeleteGame,
    handleImportAsset,
    requestConfirmation,
    onNotification
}) => {
    const { t } = useTranslation();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [isVerifying, setIsVerifying] = useState(false);
    const [brokenIds, setBrokenIds] = useState<string[]>([]);

    const [gameForm, setGameForm] = useState({
        title: '',
        cover: '',
        banner: '',
        logo: '',
        execPath: '',
        execArgs: '',
        categoryIds: [] as string[],
        wallpaper: ''
    });

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const allGames = useMemo(() => categories.find(c => c.id === 'all')?.games || [], [categories]);
    const otherCategories = useMemo(() => categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.id !== 'recent'), [categories]);

    const filteredGames = useMemo(() => {
        let games = [...allGames];
        if (filterCategory !== 'all') {
            const targetCat = categories.find(c => c.id === filterCategory);
            if (targetCat) {
                const targetIds = new Set(targetCat.games.map(g => g.id));
                games = games.filter(g => targetIds.has(g.id));
            }
        }
        if (searchQuery) {
            games = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return games.sort((a, b) => a.title.localeCompare(b.title));
    }, [allGames, searchQuery, filterCategory, categories]);

    useEffect(() => {
        if (editingId) {
            const g = allGames.find(x => x.id === editingId);
            if (g) {
                setGameForm({
                    title: g.title,
                    cover: g.cover || '',
                    banner: g.banner || '',
                    logo: g.logo || '',
                    execPath: g.execPath || '',
                    execArgs: g.execArgs || '',
                    categoryIds: categories.filter(c => c.id !== 'all' && c.games.some(x => x.id === g.id)).map(c => c.id),
                    wallpaper: g.wallpaper || ''
                });
                setIsFormOpen(true);
            }
        } else {
            setGameForm({ title: '', cover: '', banner: '', logo: '', execPath: '', execArgs: '', categoryIds: [], wallpaper: '' });
            setIsFormOpen(false);
        }
    }, [editingId, allGames, categories]);

    const handleCommitGame = async () => {
        const newId = await handleSaveGame(gameForm, editingId);
        if (newId) {
            setEditingId(null);
            setIsFormOpen(false);
            onNotification('UNIT_REGISTRY_UPDATED');
            setTimeout(() => onNotification(null), 2000);
        }
    };

    const handleVerifyDatabase = async () => {
        setIsVerifying(true);
        try {
            const res = await fetch('/api/games/verify-integrity', { method: 'POST' });
            const data = await res.json();
            setBrokenIds(data.brokenIds || []);
            onNotification(data.brokenIds?.length > 0 ? `INTEGRITY_CHECK::${data.brokenIds.length}_ANOMALIES` : 'INTEGRITY_CHECK::NOMINAL');
            setTimeout(() => onNotification(null), 3000);
        } catch (e) {
            console.error("Verification failed", e);
        } finally {
            setIsVerifying(false);
        }
    };

    const handlePurgeBroken = () => {
        requestConfirmation(`PURGE_${brokenIds.length}_BROKEN_ENTRIES?`, async () => {
            for (const id of brokenIds) {
                handleDeleteGame(id, (msg, confirm) => confirm());
            }
            setBrokenIds([]);
            onNotification('PURGE_SEQUENCE_COMPLETE');
            setTimeout(() => onNotification(null), 2000);
        });
    };

    if (isFormOpen && editingId !== null || (isFormOpen && editingId === null)) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden relative">
                <div ref={scrollContainerRef} className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10">
                    <div className="flex flex-col gap-6 lg:gap-8">
                        <div className="flex justify-between items-center border-b-2 border-white/10 pb-4">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">
                                    {editingId ? `UNIT_CONFIGURATION: ${gameForm.title}` : 'INITIALIZE_NEW_UNIT'}
                                </h3>
                                <span className="text-[7px] text-white/30 tracking-[0.2em] font-mono">
                                    {editingId ? `REF: ${editingId}` : 'AWAITING_INITIALIZATION'}
                                </span>
                            </div>
                            <button
                                onClick={() => setEditingId(null)}
                                className="px-4 py-2 border-2 border-white/10 hover:border-white text-white/40 hover:text-white text-[8px] font-bold uppercase tracking-widest transition-all"
                            >
                                BACK_TO_INVENTORY
                            </button>
                        </div>

                        <Subsection title="UNIT_IDENTITY" onSync={handleCommitGame} syncLabel="COMMIT_UNIT_DATA" accentColor={activeAccent}>
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">UNIT_IDENTIFIER</label>
                                    <input
                                        value={gameForm.title}
                                        onChange={e => setGameForm({ ...gameForm, title: e.target.value })}
                                        className="bg-black/20 border-2 border-white/10 p-3 text-[10px] outline-none uppercase font-mono focus:border-white transition-all text-white"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">EXEC_PATH</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={gameForm.execPath}
                                            onChange={e => setGameForm({ ...gameForm, execPath: e.target.value })}
                                            placeholder="SOURCE_PATH"
                                            className="flex-1 bg-black/20 border-2 border-white/10 p-3 text-[10px] font-mono uppercase outline-none focus:border-white transition-all text-white truncate"
                                        />
                                        <button
                                            onClick={() => triggerFileBrowser('execPath', 'exe')}
                                            className="px-4 border-2 border-white/20 hover:border-white text-white font-bold text-[8px] uppercase tracking-widest"
                                        >
                                            BROWSE
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 col-span-full">
                                    <label className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">EXEC_PARAMETERS (ARGS)</label>
                                    <input
                                        value={gameForm.execArgs}
                                        onChange={e => setGameForm({ ...gameForm, execArgs: e.target.value })}
                                        placeholder="-fullscreen -dev -novid"
                                        className="bg-black/20 border-2 border-white/10 p-3 text-[10px] outline-none uppercase font-mono focus:border-white transition-all text-white"
                                    />
                                </div>
                            </div>
                        </Subsection>

                        <Subsection title="VISUAL_MATRIX" accentColor={activeAccent}>
                            <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-6">
                                <AssetInput
                                    label="VERTICAL_GRID"
                                    value={gameForm.cover}
                                    onChange={v => setGameForm({ ...gameForm, cover: v })}
                                    triggerFileBrowser={triggerFileBrowser}
                                    target="cover"
                                    previewType="cover"
                                    accentColor={activeAccent}
                                    onResolveAsset={onResolveAsset}
                                />
                                <AssetInput
                                    label="HORIZONTAL_HERO"
                                    value={gameForm.banner}
                                    onChange={v => setGameForm({ ...gameForm, banner: v })}
                                    triggerFileBrowser={triggerFileBrowser}
                                    target="banner"
                                    previewType="banner"
                                    accentColor={activeAccent}
                                    onResolveAsset={onResolveAsset}
                                />
                                <AssetInput
                                    label="LOGO_MARK"
                                    value={gameForm.logo}
                                    onChange={v => setGameForm({ ...gameForm, logo: v })}
                                    triggerFileBrowser={triggerFileBrowser}
                                    target="logo"
                                    previewType="logo"
                                    accentColor={activeAccent}
                                    onResolveAsset={onResolveAsset}
                                />
                                <div className="col-span-full">
                                    <AssetInput
                                        label="ENVIRONMENT_WALLPAPER"
                                        value={gameForm.wallpaper}
                                        onChange={v => setGameForm({ ...gameForm, wallpaper: v })}
                                        triggerFileBrowser={triggerFileBrowser}
                                        target="wallpaper"
                                        previewType="wallpaper"
                                        accentColor={activeAccent}
                                        onResolveAsset={onResolveAsset}
                                    />
                                </div>
                            </div>
                        </Subsection>

                        <Subsection title="NEURAL_NODE_ASSIGNMENT" accentColor={activeAccent}>
                            <div className="col-span-full flex flex-wrap gap-2">
                                {otherCategories.length > 0 ? (
                                    otherCategories.map(cat => {
                                        const isAssigned = gameForm.categoryIds.includes(cat.id);
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    const exists = gameForm.categoryIds.includes(cat.id);
                                                    setGameForm({ ...gameForm, categoryIds: exists ? gameForm.categoryIds.filter(id => id !== cat.id) : [...gameForm.categoryIds, cat.id] });
                                                }}
                                                className={`px-4 py-3 text-[8px] font-bold uppercase border-2 transition-all ${isAssigned ? 'text-black' : 'border-white/10 opacity-30 hover:opacity-100 hover:border-white/40'}`}
                                                style={{
                                                    backgroundColor: isAssigned ? cat.color : 'transparent',
                                                    borderColor: isAssigned ? cat.color : undefined,
                                                    color: isAssigned ? getContrastColor(cat.color) : undefined
                                                }}
                                            >
                                                {cat.name}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="flex flex-col gap-1 opacity-40 py-4">
                                        <span className="text-[8px] uppercase font-mono tracking-widest">No custom nodes detected.</span>
                                        <span className="text-[7px] uppercase font-mono tracking-widest opacity-70">Unit remains in "ALL_GAMES" until node creation.</span>
                                    </div>
                                )}
                            </div>
                        </Subsection>

                        <button
                            onClick={() => setEditingId(null)}
                            className="text-[7px] opacity-20 hover:opacity-100 uppercase font-bold tracking-[0.4em] transition-opacity text-center mt-4 border-t-2 border-white/5 pt-6"
                        >
                            COLLAPSE_UNIT_MATRIX
                        </button>
                    </div>
                </div>
                <CyberScrollbar containerRef={scrollContainerRef} accentColor={activeAccent} />
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div ref={scrollContainerRef} className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10">
                <div className="flex flex-col gap-8">
                    {/* Toolbar Section */}
                    <div className="flex flex-col gap-6">
                        <div className="flex justify-between items-center border-b-2 border-white/10 pb-6">
                            <div className="flex flex-col gap-1">
                                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">UNIT_STORAGE_INVENTORY</h3>
                                <span className="text-[7px] text-white/30 tracking-[0.2em] font-mono">ACTIVE_IDENTIFIERS: {allGames.length}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleVerifyDatabase}
                                    disabled={isVerifying}
                                    className={`px-6 py-3 border-2 font-bold text-[9px] uppercase tracking-widest transition-all ${isVerifying ? 'opacity-40' : 'hover:bg-white/5 border-white/20 hover:border-white'}`}
                                >
                                    {isVerifying ? 'SCANNING...' : 'VERIFY_INTEGRITY'}
                                </button>
                                {brokenIds.length > 0 && (
                                    <button
                                        onClick={handlePurgeBroken}
                                        className="px-6 py-3 bg-red-600 text-white font-black text-[9px] uppercase tracking-widest animate-pulse"
                                    >
                                        PURGE_ANOMALIES ({brokenIds.length})
                                    </button>
                                )}
                                <button
                                    onClick={() => { setEditingId(null); setIsFormOpen(true); }}
                                    className="bg-white text-black px-6 py-3 font-black text-[9px] uppercase tracking-[0.4em] hover:bg-white/90 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                                >
                                    MANUAL_REGISTRATION
                                </button>
                            </div>
                        </div>

                        {/* Search & Categories Ribbon */}
                        <div className="flex flex-col gap-4">
                            <div className="relative group">
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none text-xs text-white">⌇</div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="QUERY_STORAGE_SECTOR..."
                                    className="w-full bg-black/20 border-2 border-white/10 p-4 pl-10 text-[10px] outline-none uppercase font-mono focus:border-white/40 focus:bg-white/5 transition-all text-white"
                                />
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                <button
                                    onClick={() => setFilterCategory('all')}
                                    className={`px-4 py-2 text-[8px] font-bold uppercase transition-all border-2 ${filterCategory === 'all' ? 'bg-white text-black border-white' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                                >
                                    ALL_UNITS
                                </button>
                                {otherCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setFilterCategory(cat.id)}
                                        className={`px-4 py-2 text-[8px] font-bold uppercase transition-all border-2`}
                                        style={{
                                            backgroundColor: filterCategory === cat.id ? cat.color : 'transparent',
                                            color: filterCategory === cat.id ? getContrastColor(cat.color) : undefined,
                                            borderColor: filterCategory === cat.id ? cat.color : `${cat.color}33`
                                        }}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Games Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredGames.map((g, idx) => {
                            const isBroken = brokenIds.includes(g.id);
                            return (
                                <div
                                    key={g.id}
                                    className={`group relative flex flex-col border-2 transition-all ${isBroken ? 'border-red-500/40 bg-red-950/5' : 'border-white/5 hover:border-white/20 hover:bg-white/[0.02]'}`}
                                >
                                    {/* Slot Header */}
                                    <div className="p-1 px-3 border-b-2 border-white/5 flex justify-between items-center bg-black/20">
                                        <span className="text-[6px] font-mono opacity-20 uppercase tracking-widest">SLOT_{String(idx + 1).padStart(3, '0')}</span>
                                        <span className="text-[6px] font-mono opacity-20 uppercase tracking-widest">{g.source || 'LOCAL'}</span>
                                    </div>

                                    <div className="p-4 flex gap-4">
                                        <div className="w-16 h-24 shrink-0 bg-black/20 border-2 border-white/10 relative overflow-hidden group-hover:border-white/30 transition-colors">
                                            <img src={onResolveAsset(g.cover)} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt="" />
                                            {isBroken && (
                                                <div className="absolute inset-0 bg-red-600/60 backdrop-blur-sm flex items-center justify-center">
                                                    <span className="text-[8px] font-black text-white rotate-45 -mt-2">ANOMALY</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                            <span className={`text-[11px] font-black uppercase tracking-wider truncate ${isBroken ? 'text-red-500' : 'text-white'}`}>{g.title}</span>
                                            <span className="text-[6px] font-mono opacity-30 truncate uppercase tracking-widest">{g.id}</span>
                                            {isBroken && <span className="text-[5px] text-red-500/60 font-mono mt-1">BROKEN_EXEC_LINK</span>}
                                        </div>
                                    </div>

                                    {/* Action Reveal */}
                                    <div className="h-12 border-t-2 border-white/5 flex divide-x-2 divide-white/5 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => setEditingId(g.id)}
                                            className="flex-1 flex items-center justify-center hover:bg-white/5 text-white/40 hover:text-white font-bold text-[8px] uppercase tracking-widest transition-all"
                                        >
                                            EDIT
                                        </button>
                                        <button
                                            onClick={() => handleDeleteGame(g.id, requestConfirmation)}
                                            className="flex-1 flex items-center justify-center hover:bg-red-600 text-red-500 hover:text-white font-bold text-[8px] uppercase tracking-widest transition-all"
                                        >
                                            PURGE
                                        </button>
                                    </div>

                                    {/* Status Bar */}
                                    <div className="absolute bottom-0 left-0 w-full h-0.5 opacity-20" style={{ backgroundColor: isBroken ? '#ef4444' : activeAccent }}></div>
                                </div>
                            );
                        })}
                        {filteredGames.length === 0 && (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 opacity-20 font-mono text-[10px] uppercase tracking-widest">
                                NO_UNITS_DETECTED_IN_THIS_SECTOR
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <CyberScrollbar containerRef={scrollContainerRef} accentColor={activeAccent} />
        </div>
    );
};

export default ModularGamesModule;
