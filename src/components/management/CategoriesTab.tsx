import React from 'react';
import { Category } from '../../types';
import CategoryEditForm from './CategoryEditForm';
import { useTranslation } from '../../hooks/useTranslation';

interface CategoriesTabProps {
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    handleCreateCategory: () => void;
    categories: Category[];
    editableCategories: Category[];
    onResolveAsset: (path: string | undefined) => string;
    handleMoveCategory: (id: string, dir: 'up' | 'down') => void;
    handleDeleteCategory: (id: string) => void;
    isFormOpen: boolean;
    setIsFormOpen: (open: boolean) => void;
    catForm: any;
    setCatForm: React.Dispatch<React.SetStateAction<any>>;
    handleSaveCategoryData: () => void;
    handleMoveGameInCategory: (catId: string, gameId: string, dir: 'up' | 'down') => void;
    triggerFileBrowser: (target: string, type: string) => void;
    activeAccent: string;
    scrollToForm: () => void;
}

const CategoriesTab: React.FC<CategoriesTabProps> = ({
    editingId, setEditingId, handleCreateCategory, categories, editableCategories,
    onResolveAsset, handleMoveCategory, handleDeleteCategory, isFormOpen, setIsFormOpen,
    catForm, setCatForm, handleSaveCategoryData, handleMoveGameInCategory,
    triggerFileBrowser, activeAccent, scrollToForm
}) => {
    const { t } = useTranslation();

    if (!editingId) {
        return (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 mb-4">
                    <div onClick={handleCreateCategory} className="relative group cursor-pointer min-h-[80px]" style={{ clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)' }}>
                        <div className="absolute inset-0 bg-white/10 group-hover:bg-white/30 transition-all" />
                        <div className="absolute inset-[2px] bg-black/40 flex flex-row items-center justify-center gap-3 px-4" style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}>
                            <div className="w-7 h-7 flex items-center justify-center border-2 border-white/10 text-white/20 group-hover:text-white group-hover:border-white transition-all text-lg font-light">+</div>
                            <span className="text-[9px] font-bold text-white uppercase tracking-[0.3em] opacity-40 group-hover:opacity-100">INITIALIZE_NODE</span>
                        </div>
                    </div>
                    {[...categories.filter(c => c.id === 'all'), ...editableCategories.filter(c => c.id === 'recent')].map(cat => (
                        <div key={cat.id} onClick={() => { setEditingId(cat.id); scrollToForm(); }} className="relative group cursor-pointer min-h-[80px]" style={{ clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)' }}>
                            <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: cat.color }} />
                            <div className="absolute inset-[2px] bg-[#080808] flex flex-row items-center gap-4 px-5 group/inner" style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}>
                                <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
                                    {cat.icon ? <img src={onResolveAsset(cat.icon)} className="w-full h-full object-contain opacity-80 group-hover/inner:opacity-100 transition-opacity" alt="" /> : <div className="w-8 h-8 bg-white/10" />}
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-bold text-white uppercase tracking-[0.3em]">{cat.name}</span>
                                    <span className="text-[7px] font-bold uppercase tracking-tighter" style={{ color: cat.color }}>{cat.games.length} UNITS</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                    {categories.filter(c => c.id !== 'recent' && c.id !== 'all' && c.id !== 'hidden').map((c, idx) => {
                        const displayIdx = idx;
                        const sourceList = categories.filter(x => x.id !== 'recent' && x.id !== 'all' && x.id !== 'hidden');
                        return (
                            <div key={c.id} className="relative group min-h-[120px] lg:min-h-[150px]" style={{ clipPath: 'polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)' }}>
                                <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: c.color }} />
                                <div className="absolute inset-[2px] bg-[#080808] flex flex-col overflow-hidden group/inner" style={{ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }}>
                                    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 cursor-pointer relative group/inner" onClick={() => { setEditingId(c.id); scrollToForm(); }}>
                                        <div className="absolute top-0 right-0 p-3 opacity-30 font-mono text-[24px] font-bold" style={{ color: c.color }}>{String(displayIdx + 1).padStart(2, '0')}</div>
                                        <div className="w-12 h-12 flex items-center justify-center transform group-hover/inner:scale-110 transition-transform">
                                            {c.icon ? <img src={onResolveAsset(c.icon)} className="w-full h-full object-contain opacity-80 group-hover/inner:opacity-100 transition-opacity" alt="" /> : <div className="w-10 h-10 border-2 border-white/10 flex items-center justify-center text-white/20">?</div>}
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-white uppercase tracking-[0.3em]">{c.name}</span>
                                            <span className="text-[7px] font-bold uppercase" style={{ color: c.color }}>{c.games.length} UNITS</span>
                                        </div>
                                    </div>
                                    <div className="h-10 border-t-2 border-white/5 bg-white/[0.02] flex divide-x-2 divide-white/5 opacity-60 group-hover:opacity-100 transition-all">
                                        <button onClick={(e) => { e.stopPropagation(); displayIdx > 0 && handleMoveCategory(c.id, 'up'); }} disabled={displayIdx <= 0} className="flex-1 hover:bg-white/10 text-white/60 text-[10px]">▲</button>
                                        <button onClick={(e) => { e.stopPropagation(); displayIdx < sourceList.length - 1 && handleMoveCategory(c.id, 'down'); }} disabled={displayIdx >= sourceList.length - 1} className="flex-1 hover:bg-white/10 text-white/60 text-[10px]">▼</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); }} className="flex-[1.5] bg-red-900/10 hover:bg-red-600 text-red-500 hover:text-white text-[8px] font-bold uppercase tracking-widest">PURGE</button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-10">
            <div className="flex justify-between items-center border-b-2 border-white/5 pb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white">Node: {catForm.name}</h3>
                <button onClick={() => { setEditingId(null); setIsFormOpen(false); }} className="text-[9px] opacity-40 hover:opacity-100 uppercase font-bold text-white">Back</button>
            </div>
            <CategoryEditForm
                isFormOpen={isFormOpen}
                setIsFormOpen={setIsFormOpen}
                gameList={categories.find(c => c.id === editingId)?.games || []}
                editingId={editingId}
                catForm={catForm}
                setCatForm={setCatForm}
                handleSaveCategoryData={handleSaveCategoryData}
                handleMoveGameInCategory={handleMoveGameInCategory}
                triggerFileBrowser={triggerFileBrowser}
                onResolveAsset={onResolveAsset}
                activeAccent={activeAccent}
            />
        </div>
    );
};

export default CategoriesTab;
