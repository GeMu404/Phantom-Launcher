import React from 'react';
import Subsection from './Subsection';
import AssetInput from '../AssetInput';
import ModeSelector from './ModeSelector';
import { Category } from '../../types';

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
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    onResolveAsset: (path: string | undefined) => string;
    activeAccent: string;
}

const CategoryEditForm: React.FC<CategoryEditFormProps> = ({
    isFormOpen, setIsFormOpen, gameList, editingId,
    catForm, setCatForm, handleSaveCategoryData, handleMoveGameInCategory,
    triggerFileBrowser, onResolveAsset, activeAccent
}) => {
    if (!isFormOpen) {
        return (
            <button onClick={() => setIsFormOpen(true)} className="w-full py-10 border-2 border-dashed border-white/10 bg-black/20 hover:bg-white/5 hover:border-white/20 transition-all flex flex-col items-center justify-center gap-3 group/spawn">
                <div className="font-['Press_Start_2P'] text-[10px] text-white/40 group-hover/spawn:text-white transition-colors" style={{ textShadow: `0 0 10px ${activeAccent}44` }}>[ NODE_SPAWN ]</div>
                <span className="text-[7px] opacity-20 uppercase tracking-[0.4em]">Configure Neural Cluster</span>
            </button>
        );
    }

    return (
        <Subsection title="MODIFY_NODE_CONFIG" onSync={handleSaveCategoryData} syncLabel="COMMIT_NODE_STATE" accentColor={activeAccent}>
            <div className="col-span-full flex flex-col gap-4 w-full">
                {/* Identity Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">Node_Label</label>
                        <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="bg-black/40 border-2 border-white/10 p-2 lg:p-3 text-[10px] lg:text-[11px] outline-none uppercase font-mono focus:border-white focus:bg-white/5 transition-all" />
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">Accent_Matrix_Hex</label>
                        <div className="flex gap-2 lg:gap-4">
                            <input type="color" value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} className="h-10 w-24 bg-transparent border-2 border-white/10 cursor-pointer overflow-hidden" />
                            <input value={catForm.color} onChange={e => setCatForm({ ...catForm, color: e.target.value })} className="flex-1 bg-black/40 border-2 border-white/10 p-2 lg:p-3 text-[10px] lg:text-[11px] font-mono uppercase outline-none focus:border-white focus:bg-white/5 transition-all" />
                        </div>
                    </div>
                </div>

                {/* Icon + Status Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                    <AssetInput label="Icon" value={catForm.icon} onChange={v => setCatForm({ ...catForm, icon: v })} triggerFileBrowser={triggerFileBrowser} target="icon" previewType="icon" accentColor={activeAccent} onResolveAsset={onResolveAsset} />
                    <div className="flex flex-col gap-2">
                        <label className="text-[7px] lg:text-[8px] opacity-30 uppercase tracking-[0.2em] font-bold">Link_Status</label>
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
                            onMouseEnter={(e) => { if (catForm.enabled && editingId !== 'recent') { e.currentTarget.style.backgroundColor = activeAccent; e.currentTarget.style.color = '#000'; } }}
                            onMouseLeave={(e) => { if (catForm.enabled && editingId !== 'recent') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = activeAccent; } }}
                        >
                            {editingId === 'recent' ? '[ SYSTEM_LOCKED: ALWAYS_ONLINE ]' : (catForm.enabled ? '[ ONLINE_PROTOCOL ]' : '[ OFFLINE_ISOLATION ]')}
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t-2 border-white/5 pt-2 mt-1">
                    <span className="text-[7px] opacity-20 uppercase tracking-[0.4em] font-bold">Ambient_Protocol</span>
                </div>

                {/* Wallpaper */}
                <AssetInput label="Wallpaper Override" value={catForm.wallpaper || ''} onChange={v => setCatForm({ ...catForm, wallpaper: v })} triggerFileBrowser={triggerFileBrowser} target="wallpaper" previewType="wallpaper" accentColor={activeAccent} onResolveAsset={onResolveAsset} />

                {/* Mode + Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                    <ModeSelector label="Render_Sequence" value={catForm.wallpaperMode} onChange={v => setCatForm({ ...catForm, wallpaperMode: v })} />
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center"><label className="text-[7px] lg:text-[9px] opacity-30 uppercase tracking-[0.2em] font-bold">Mesh_Grid_Opacity</label><span className="text-[10px] lg:text-[11px] font-mono" style={{ color: activeAccent }}>{Math.round(catForm.gridOpacity * 100)}%</span></div>
                        <input type="range" min="0" max="0.5" step="0.01" value={catForm.gridOpacity} onChange={e => setCatForm({ ...catForm, gridOpacity: parseFloat(e.target.value) })} className="w-full h-1 bg-white/10 accent-white appearance-none cursor-pointer" />
                    </div>
                </div>

                {/* Registry if games exist */}
                {gameList.length > 0 && (
                    <>
                        <div className="border-t-2 border-white/5 pt-2 mt-1">
                            <span className="text-[7px] opacity-20 uppercase tracking-[0.4em] font-bold">Registry_Sequence</span>
                        </div>
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                            {gameList.map((g, idx) => (
                                <div key={g.id} className="flex items-center gap-3 p-2 bg-black/20 border-2 border-white/5 group/row hover:border-white/20 hover:bg-white/5 transition-colors relative">
                                    <div className="w-8 h-8 flex items-center justify-center font-mono text-[10px] bg-black/60 border-2 border-white/10 shrink-0 font-bold" style={{ color: activeAccent }}>{String(idx + 1).padStart(2, '0')}</div>
                                    <div className="flex-1 min-w-0">
                                        <span className="block text-[9px] font-bold text-white uppercase truncate tracking-wider">{g.title}</span>
                                        <span className="block text-[6px] text-white/20 font-mono truncate">{g.id}</span>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                                        {idx > 0 && (
                                            <button onClick={() => handleMoveGameInCategory(editingId!, g.id, 'up')} className="w-7 h-7 flex items-center justify-center border-2 border-white/10 hover:border-white text-[11px] text-white/40 hover:text-white transition-colors active:scale-95">↑</button>
                                        )}
                                        {idx < gameList.length - 1 && (
                                            <button onClick={() => handleMoveGameInCategory(editingId!, g.id, 'down')} className="w-7 h-7 flex items-center justify-center border-2 border-white/10 hover:border-white text-[11px] text-white/40 hover:text-white transition-colors active:scale-95">↓</button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <button onClick={() => setIsFormOpen(false)} className="text-[7px] opacity-20 hover:opacity-100 uppercase font-bold tracking-widest transition-opacity text-center mt-2">Collapse Matrix</button>
            </div>
        </Subsection>
    );
};

export default CategoryEditForm;
