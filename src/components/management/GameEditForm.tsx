import React from 'react';
import Subsection from './Subsection';
import AssetInput from '../AssetInput';
import { Category } from '../../types';

interface GameEditFormProps {
    isFormOpen: boolean;
    setIsFormOpen: (v: boolean) => void;
    editingId: string | null;
    activeAccent: string;
    gameForm: {
        title: string;
        cover: string;
        banner: string;
        logo: string;
        execPath: string;
        execArgs: string;
        categoryIds: string[];
        wallpaper: string;
    };
    setGameForm: React.Dispatch<React.SetStateAction<{
        title: string;
        cover: string;
        banner: string;
        logo: string;
        execPath: string;
        execArgs: string;
        categoryIds: string[];
        wallpaper: string;
    }>>;
    handleSaveGame: () => void;
    handleSyncWithGemini: () => void;
    isSyncingGemini: boolean;
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    onResolveAsset: (path: string | undefined) => string;
    otherCategories: Category[];
    sgdbKey: string;
    sgdbEnabled: boolean;
    setSearchModal: React.Dispatch<React.SetStateAction<{ isOpen: boolean; type: 'grid' | 'hero' | 'logo'; targetField: 'cover' | 'banner' | 'logo' | 'icon' }>>;
}

const GameEditForm: React.FC<GameEditFormProps> = ({
    isFormOpen, setIsFormOpen, editingId, activeAccent,
    gameForm, setGameForm, handleSaveGame, handleSyncWithGemini, isSyncingGemini,
    triggerFileBrowser, onResolveAsset, otherCategories, sgdbKey, sgdbEnabled,
    setSearchModal
}) => {
    if (!isFormOpen) {
        return (
            <button onClick={() => setIsFormOpen(true)} className="w-full py-10 border border-dashed border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-3 group/hatch">
                <div className="font-['Press_Start_2P'] text-[10px] text-white/40 group-hover/hatch:text-white transition-colors" style={{ textShadow: `0 0 10px ${activeAccent}44` }}>[ ASSET_HATCH ]</div>
                <span className="text-[7px] opacity-20 uppercase tracking-[0.4em]">Initialize New Project Entry</span>
            </button>
        );
    }

    return (
        <Subsection title={editingId ? 'MODIFY_UNIT_REGISTRY' : 'INITIALIZE_NEW_UNIT'} onSync={handleSaveGame} syncLabel="COMMIT_CHANGES" accentColor={activeAccent}>
            <div className="col-span-full flex flex-col gap-6 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">Unit_Identifier</label>
                        <div className="flex gap-2">
                            <input value={gameForm.title} onChange={e => setGameForm({ ...gameForm, title: e.target.value })} className="flex-1 bg-black/40 border-2 border-white/10 p-2 lg:p-3 text-[10px] lg:text-[11px] outline-none uppercase font-mono focus:border-white focus:bg-white/5 transition-all" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">EXEC_PATH</label>
                        <div className="flex gap-2">
                            <input value={gameForm.execPath} onChange={e => setGameForm({ ...gameForm, execPath: e.target.value })} placeholder="EXEC_PATH_SOURCE" className="flex-1 bg-black/40 border-2 border-white/10 p-2 lg:p-3 text-[10px] lg:text-[11px] font-mono uppercase truncate outline-none focus:border-white focus:bg-white/5 transition-all" />
                            <button
                                onClick={() => triggerFileBrowser('execPath', 'exe')}
                                className="px-5 font-bold text-[8px] uppercase tracking-widest border-2 transition-all active:scale-95"
                                style={{ borderColor: activeAccent, color: activeAccent }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = activeAccent; e.currentTarget.style.color = '#000'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = activeAccent; }}
                            >
                                BROWSE
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">Execution_Parameters (Args)</label>
                    <input
                        value={gameForm.execArgs}
                        onChange={e => setGameForm({ ...gameForm, execArgs: e.target.value })}
                        placeholder="-fullscreen -dev -novid"
                        className="w-full bg-black/40 border-2 border-white/10 p-2 lg:p-3 text-[10px] lg:text-[11px] font-mono uppercase outline-none focus:border-white focus:bg-white/5 transition-all"
                    />
                </div>

                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-1 bg-black/20 border-2 border-white/5">
                        {/* Vertical Cover */}
                        <div className="flex flex-col">
                            <AssetInput
                                label="Vertical_Grid"
                                value={gameForm.cover}
                                onChange={v => setGameForm({ ...gameForm, cover: v })}
                                triggerFileBrowser={triggerFileBrowser}
                                target="cover"
                                previewType="cover"
                                accentColor={activeAccent}
                                onResolveAsset={onResolveAsset}
                                sgdbEnabled={sgdbEnabled && !!sgdbKey}
                                onCloudSearch={() => setSearchModal({ isOpen: true, type: 'grid', targetField: 'cover' })}
                            />
                        </div>

                        {/* Horizontal Banner */}
                        <div className="flex flex-col">
                            <AssetInput
                                label="Horizontal_Hero"
                                value={gameForm.banner}
                                onChange={v => setGameForm({ ...gameForm, banner: v })}
                                triggerFileBrowser={triggerFileBrowser}
                                target="banner"
                                previewType="banner"
                                accentColor={activeAccent}
                                onResolveAsset={onResolveAsset}
                                sgdbEnabled={sgdbEnabled && !!sgdbKey}
                                onCloudSearch={() => setSearchModal({ isOpen: true, type: 'hero', targetField: 'banner' })}
                            />
                        </div>

                        {/* Logo Mark */}
                        <div className="flex flex-col">
                            <AssetInput
                                label="Logo_Mark"
                                value={gameForm.logo}
                                onChange={v => setGameForm({ ...gameForm, logo: v })}
                                triggerFileBrowser={triggerFileBrowser}
                                target="logo"
                                previewType="logo"
                                accentColor={activeAccent}
                                onResolveAsset={onResolveAsset}
                                sgdbEnabled={sgdbEnabled && !!sgdbKey}
                                onCloudSearch={() => setSearchModal({ isOpen: true, type: 'logo', targetField: 'logo' })}
                            />
                        </div>
                    </div>

                    <div className="p-1 bg-black/20 border-2 border-white/5">
                        <AssetInput
                            label="Environment_Wallpaper"
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

                <div className="flex flex-col gap-4 mt-8">
                    <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">Neural_Node_Assignment</label>
                    <div className="flex flex-wrap gap-2">
                        {otherCategories.length > 0 ? (
                            otherCategories.map(cat => (
                                <button key={cat.id} onClick={() => {
                                    const exists = gameForm.categoryIds.includes(cat.id);
                                    setGameForm({ ...gameForm, categoryIds: exists ? gameForm.categoryIds.filter(id => id !== cat.id) : [...gameForm.categoryIds, cat.id] });
                                }}
                                    className={`px-3 py-2 text-[7px] font-bold uppercase border-2 transition-all ${gameForm.categoryIds.includes(cat.id) ? 'text-black' : 'border-white/10 opacity-30 hover:opacity-100 hover:border-white/40'}`}
                                    style={{
                                        backgroundColor: gameForm.categoryIds.includes(cat.id) ? activeAccent : 'transparent',
                                        borderColor: gameForm.categoryIds.includes(cat.id) ? activeAccent : undefined,
                                        color: gameForm.categoryIds.includes(cat.id) ? '#000' : undefined
                                    }}
                                >{cat.name}</button>
                            ))
                        ) : (
                            <div className="flex flex-col gap-1 opacity-40">
                                <span className="text-[7px] uppercase font-mono tracking-tighter">No custom nodes detected.</span>
                                <span className="text-[6px] uppercase font-mono tracking-tighter opacity-70">Game will live in "ALL GAMES" until you create a node in the Categories tab.</span>
                            </div>
                        )}
                    </div>
                </div>

                <button onClick={() => setIsFormOpen(false)} className="w-full mt-10 py-4 text-[7px] opacity-20 hover:opacity-100 uppercase font-bold tracking-widest transition-all border-t-2 border-white/5 hover:bg-white/5">DISCONNECT_REGISTRY_INTERFACE</button>
            </div>
        </Subsection>
    );
};

export default GameEditForm;
