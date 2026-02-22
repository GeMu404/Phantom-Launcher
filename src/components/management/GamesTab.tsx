import React from 'react';
import { Category, Game } from '../../types';
import GameEditForm from './GameEditForm';
import { useTranslation } from '../../hooks/useTranslation';

interface GamesTabProps {
    isFormOpen: boolean;
    setIsFormOpen: (open: boolean) => void;
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    activeAccent: string;
    gameForm: any;
    setGameForm: React.Dispatch<React.SetStateAction<any>>;
    handleSaveGame: () => void;
    triggerFileBrowser: (target: string, type: string) => void;
    onResolveAsset: (path: string | undefined) => string;
    otherCategories: Category[];
    sgdbKey: string;
    sgdbEnabled: boolean;
    setSearchModal: (state: any) => void;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    handleWipeMasterRegistry: () => void;
    filterCategory: string;
    setFilterCategory: (catId: string) => void;
    categories: Category[];
    sortedGames: Game[];
    handleDeleteGame: (id: string) => void;
    scrollToForm: () => void;
}

const GamesTab: React.FC<GamesTabProps> = ({
    isFormOpen, setIsFormOpen, editingId, setEditingId, activeAccent, gameForm, setGameForm,
    handleSaveGame, triggerFileBrowser, onResolveAsset, otherCategories, sgdbKey, sgdbEnabled,
    setSearchModal, searchQuery, setSearchQuery, handleWipeMasterRegistry, filterCategory,
    setFilterCategory, categories, sortedGames, handleDeleteGame, scrollToForm
}) => {
    const { t } = useTranslation();
    const formRef = React.useRef<HTMLDivElement>(null);
    const [brokenIds, setBrokenIds] = React.useState<string[]>([]);
    const [isVerifying, setIsVerifying] = React.useState(false);

    const handleVerifyDatabase = async () => {
        setIsVerifying(true);
        try {
            const res = await fetch('/api/games/verify-integrity', { method: 'POST' });
            const data = await res.json();
            setBrokenIds(data.brokenIds || []);
        } catch (e) {
            console.error("Verification failed", e);
        } finally {
            setIsVerifying(false);
        }
    };

    const handlePurgeBroken = async () => {
        if (confirm("PURGE_ALL_BROKEN_LINKS?")) {
            for (const id of brokenIds) {
                await handleDeleteGame(id);
            }
            setBrokenIds([]);
        }
    };

    return (
        <div className="flex flex-col gap-10">
            <div ref={formRef}>
                <GameEditForm
                    isFormOpen={isFormOpen}
                    setIsFormOpen={setIsFormOpen}
                    editingId={editingId}
                    activeAccent={activeAccent}
                    gameForm={gameForm}
                    setGameForm={setGameForm}
                    handleSaveGame={handleSaveGame}
                    triggerFileBrowser={triggerFileBrowser}
                    onResolveAsset={onResolveAsset}
                    otherCategories={otherCategories}
                    sgdbKey={sgdbKey}
                    sgdbEnabled={sgdbEnabled}
                    setSearchModal={setSearchModal}
                />
            </div>
            <div className="flex flex-col gap-6 lg:gap-8">
                <div className="flex flex-col gap-6">
                    {/* Level 1: Meta & Maintenance */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-white/5 pb-4 gap-6">
                        <div className="flex flex-col gap-1">
                            <h4 className="text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.4em] text-white flex items-center gap-3">
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeAccent, boxShadow: `0 0 10px ${activeAccent}` }} />
                                {t('registry.storage_inventory')}
                            </h4>
                            <span className="text-[6px] lg:text-[7px] font-mono opacity-20 uppercase tracking-[0.2em] ml-4.5">Active_Deployment_Sector</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
                            <button
                                onClick={handleVerifyDatabase}
                                disabled={isVerifying}
                                className={`px-4 lg:px-6 py-2 border-2 font-bold text-[8px] uppercase transition-all whitespace-nowrap ${isVerifying ? 'border-white/10 text-white/20' : 'hover:bg-white/5'}`}
                                style={{ borderColor: isVerifying ? undefined : activeAccent, color: isVerifying ? undefined : activeAccent }}
                            >
                                {isVerifying ? 'SCANN_INIT...' : 'VERIFY_DATABASE'}
                            </button>
                            {brokenIds.length > 0 && (
                                <button onClick={handlePurgeBroken} className="px-4 lg:px-6 py-2 border-2 border-red-500 bg-red-500 text-black font-bold text-[8px] uppercase animate-pulse whitespace-nowrap shadow-[0_0_20px_rgba(239,68,68,0.4)]">PURGE_BROKEN ({brokenIds.length})</button>
                            )}
                            <div className="w-px h-6 bg-white/10 hidden lg:block" />
                            <button onClick={handleWipeMasterRegistry} className="px-4 lg:px-6 py-2 border-2 border-red-500/30 text-red-500/60 hover:border-red-500 hover:text-red-500 font-bold text-[8px] uppercase transition-all whitespace-nowrap">
                                [ {t('registry.erase_registry')} ]
                            </button>
                        </div>
                    </div>

                    {/* Level 2: Search Toolbar */}
                    <div className="flex items-center gap-4 bg-white/5 p-2 lg:p-3 border-2 border-white/10 shadow-inner group/toolbar" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}>
                        <div className="relative flex-1">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none text-[10px]">⌇</div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={t('registry.query_placeholder')}
                                className="w-full bg-black/40 text-[10px] border-2 border-white/5 p-2.5 pl-8 outline-none uppercase font-mono focus:border-white/30 focus:bg-black/60 transition-all placeholder:opacity-20"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        <button onClick={() => setFilterCategory('all')} className={`px-3 py-1 text-[8px] font-bold uppercase border ${filterCategory === 'all' ? 'bg-white text-black border-white' : 'text-white/40 border-white/10'}`}>{t('nav.all_units')}</button>
                        {categories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.id !== 'recent').map(cat => (
                            <button key={cat.id} onClick={() => setFilterCategory(cat.id)} className={`px-3 py-1 text-[8px] font-bold uppercase border`} style={{ backgroundColor: filterCategory === cat.id ? cat.color : 'transparent', color: filterCategory === cat.id ? '#000' : '#fff', borderColor: cat.color }}>{cat.name}</button>
                        ))}
                    </div>
                    <div className="flex flex-col gap-2">
                        {sortedGames.map(g => {
                            const isBroken = brokenIds.includes(g.id);
                            return (
                                <div key={g.id} className="relative group/row min-h-[80px]" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
                                    <div className="absolute inset-0 pointer-events-none transition-colors" style={{ backgroundColor: isBroken ? '#ef444433' : `${activeAccent}33` }} />
                                    <div className="absolute inset-[2px] bg-[#050505] flex items-center justify-between p-3 lg:p-5 hover:bg-white/5 transition-all" style={{ clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)' }}>
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <img src={onResolveAsset(g.cover)} className={`w-8 h-12 lg:w-10 lg:h-14 object-cover opacity-80 border-2 ${isBroken ? 'border-red-500 shadow-[0_0_10px_#ef4444]' : 'border-white/10'}`} alt="" />
                                                {isBroken && <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[6px] font-bold text-center py-0.5">BROKEN</div>}
                                            </div>
                                            <div className="flex flex-col truncate">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] lg:text-[11px] font-bold uppercase tracking-[0.15em] ${isBroken ? 'text-red-500' : 'text-white'}`}>{g.title}</span>
                                                    {isBroken && <span className="text-[6px] px-1 border border-red-500 text-red-500 font-mono animate-pulse">BROKEN_LINK</span>}
                                                </div>
                                                <span className="text-[6px] opacity-40 uppercase font-mono">{`REF::${g.id.substring(0, 8)}`}</span>
                                                {isBroken && <span className="text-[6px] text-red-400/60 font-mono truncate max-w-[200px]">{g.execPath}</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-3 opacity-0 group-hover/row:opacity-100 transition-all">
                                            <button onClick={() => { setEditingId(g.id); setGameForm({ ...g, categoryIds: categories.filter(c => c.id !== 'all' && c.games.some(x => x.id === g.id)).map(c => c.id), wallpaper: g.wallpaper || '' }); scrollToForm(); }} className="px-5 py-2 text-[9px] font-bold uppercase border-2 hover:bg-white/10 transition-colors" style={{ borderColor: activeAccent, color: activeAccent }}>EDIT</button>
                                            <button onClick={() => handleDeleteGame(g.id)} className="px-5 py-2 text-[9px] font-bold border-2 border-red-500 text-red-500 hover:bg-red-500/10 transition-colors">PURGE</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {sortedGames.length === 0 && (
                            <div className="py-10 text-center opacity-20 font-mono text-[10px] uppercase tracking-widest">NO_UNITS_FOUND_IN_SECTOR</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GamesTab;
