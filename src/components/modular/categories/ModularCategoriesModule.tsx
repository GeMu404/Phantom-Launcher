import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Category } from '../../../types';
import { useTranslation } from '../../../hooks/useTranslation';
import { ASSETS } from '../../../constants';
import CyberScrollbar from '../../CyberScrollbar';

interface ModularCategoriesModuleProps {
    categories: Category[];
    displayCategories: Category[];
    activeAccent: string;
    onResolveAsset: (path: string | undefined) => string;
    handleCreateCategory: (setEditingId: (id: string | null) => void, setCatForm: (form: any) => void, scrollToForm: () => void) => void;
    handleDeleteCategory: (catId: string, editingId: string | null, setEditingId: (id: string | null) => void, requestConfirmation: (msg: string, onConfirm: () => void, isDanger?: boolean) => void) => void;
    handleMoveCategory: (catId: string, direction: 'up' | 'down') => void;
    handleMoveGameInCategory: (catId: string, gameId: string, direction: 'up' | 'down') => void;
    handleToggleGameInCategory: (catId: string, gameId: string) => void;
    handleFetchMissingAssets: (categoryId: string, onStatus?: (s: string) => void) => Promise<void>;
    handleSaveCategoryData: (editingId: string | null, formGames: any[], pendingDeletes: string[], catForm: any, setEditingId: (id: string | null) => void) => void;
    triggerFileBrowser: (target: string, type: string) => void;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    requestConfirmation: (message: string, onConfirm: () => void, isDanger?: boolean) => void;
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
    registerGoBack?: (fn: () => boolean) => void;
    onCanGoBackChange?: (canGoBack: boolean) => void;
    isActive?: boolean;
    lastSelectedAsset?: { target: string; path: string; timestamp: number } | null;
    onClearLastAsset?: () => void;
}

const ModularCategoriesModule: React.FC<ModularCategoriesModuleProps> = ({
    categories,
    displayCategories,
    activeAccent,
    onResolveAsset,
    handleCreateCategory,
    handleDeleteCategory,
    handleMoveCategory,
    handleMoveGameInCategory,
    handleToggleGameInCategory,
    handleFetchMissingAssets,
    handleSaveCategoryData,
    triggerFileBrowser,
    onUpdateCategories,
    requestConfirmation,
    onCommandUpdate,
    registerGoBack,
    onCanGoBackChange,
    isActive,
    lastSelectedAsset,
    onClearLastAsset
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

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    const [formGames, setFormGames] = useState<any[]>([]);
    const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);

    const [holdProgress, setHoldProgress] = useState(0);
    const holdTimerRef = useRef<any>(null);
    const [fetchActive, setFetchActive] = useState(false);
    const [purgeActive, setPurgeActive] = useState(false);
    const purgeHoldRef = useRef(false);
    const purgeIntervalRef = useRef<any>(null);
    const [purgeProgress, setPurgeProgress] = useState(0);

    useEffect(() => {
        if (editingId) {
            const cat = displayCategories.find(c => c.id === editingId);
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
                setFormGames(cat.games || []);
                setPendingDeletes([]);
                setIsFormOpen(true);
            } else if (editingId.startsWith('new_')) {
                // It's a brand new category created by useManagement
                setFormGames([]);
                setPendingDeletes([]);
                setIsFormOpen(true);
            }
        } else {
            setIsFormOpen(false);
            setPurgeActive(false);
            setPurgeProgress(0);
            setFetchActive(false);
        }
    }, [editingId, displayCategories]);

    // Reset editing state when module becomes inactive
    // REFINED: We only reset if we are NOT in the explorer or assetSearch sub-modes
    // However, it's safer to let App.tsx handle the reset or just leave it.
    // For now, removing this because switching to 'explorer' (file picker) sets isActive=false
    /*
    useEffect(() => {
        if (isActive === false) {
            setEditingId(null);
        }
    }, [isActive]);
    */

    // Register go-back handler for parent DISCONNECT button
    const handleGoBack = useCallback((): boolean => {
        if (editingId && isFormOpen) {
            setEditingId(null);
            return true;
        }
        return false;
    }, [editingId, isFormOpen]);

    useEffect(() => {
        if (registerGoBack) registerGoBack(handleGoBack);
    }, [registerGoBack, handleGoBack]);

    // Report canGoBack state to parent for dynamic button label
    useEffect(() => {
        if (onCanGoBackChange) onCanGoBackChange(editingId !== null && isFormOpen);
    }, [editingId, isFormOpen, onCanGoBackChange]);

    useEffect(() => {
        if (isActive && lastSelectedAsset) {
            setCatForm(prev => ({ ...prev, [lastSelectedAsset.target]: lastSelectedAsset.path }));
            if (onClearLastAsset) onClearLastAsset();
        }
    }, [lastSelectedAsset, onClearLastAsset, isActive]);

    // Handled by prop now

    const handleCommitStart = useCallback(() => {
        if (pendingDeletes.length === 0) {
            handleSaveCategoryData(editingId, formGames, pendingDeletes, catForm, setEditingId);
            return;
        }

        const startTime = Date.now();
        const duration = 2000;

        holdTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const p = Math.min(100, (elapsed / duration) * 100);
            setHoldProgress(p);

            if (p >= 100) {
                clearInterval(holdTimerRef.current);
                handleSaveCategoryData(editingId, formGames, pendingDeletes, catForm, setEditingId);
                setHoldProgress(0);
            }
        }, 30);
    }, [pendingDeletes, editingId, formGames, catForm, handleSaveCategoryData, setEditingId]);

    const handleCommitEnd = useCallback(() => {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        setHoldProgress(0);
    }, []);

    const handlePurgeStart = useCallback(() => {
        purgeHoldRef.current = true;
        setPurgeProgress(0);
        let elapsed = 0;
        const total = 3000;
        const step = 50;
        if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
        purgeIntervalRef.current = setInterval(() => {
            if (!purgeHoldRef.current) {
                if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
                return;
            }
            elapsed += step;
            const pct = Math.min((elapsed / total) * 100, 100);
            setPurgeProgress(pct);
            if (elapsed >= total) {
                if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
                console.log(`[Purge] Successfully held for 3s. Executing delete for: ${editingId}`);

                // Clear command state immediately to prevent "fighting"
                onCommandUpdate(null, null, 0, false, false, null, null, null, null);

                handleDeleteCategory(editingId!, editingId, setEditingId, null);

                setPurgeActive(false);
                setPurgeProgress(0);
            }
        }, step);
    }, [editingId, handleDeleteCategory, setEditingId]);

    const handlePurgeEnd = useCallback(() => {
        purgeHoldRef.current = false;
        if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
        setPurgeProgress(0);
    }, []);

    // STABLE CALLBACK REFACTOR: Prevents re-render loops in App.tsx
    const catFormRef = useRef(catForm);
    const formGamesRef = useRef(formGames);
    const pendingDeletesRef = useRef(pendingDeletes);
    const editingIdRef = useRef(editingId);

    useEffect(() => { catFormRef.current = catForm; }, [catForm]);
    useEffect(() => { formGamesRef.current = formGames; }, [formGames]);
    useEffect(() => { pendingDeletesRef.current = pendingDeletes; }, [pendingDeletes]);
    useEffect(() => { editingIdRef.current = editingId; }, [editingId]);

    const stableSave = useCallback(() => {
        handleSaveCategoryData(
            editingIdRef.current,
            formGamesRef.current,
            pendingDeletesRef.current,
            catFormRef.current,
            setEditingId
        );
    }, [handleSaveCategoryData]);

    const fetchRef = useRef(handleFetchMissingAssets);
    useEffect(() => { fetchRef.current = handleFetchMissingAssets; }, [handleFetchMissingAssets]);
    const stableFetch = useCallback(() => {
        if (editingIdRef.current) fetchRef.current(editingIdRef.current);
        setFetchActive(false);
    }, []);

    const purgeStartRef = useRef(handlePurgeStart);
    const purgeEndRef = useRef(handlePurgeEnd);
    useEffect(() => { purgeStartRef.current = handlePurgeStart; }, [handlePurgeStart]);
    useEffect(() => { purgeEndRef.current = handlePurgeEnd; }, [handlePurgeEnd]);
    const stablePurgeStart = useCallback(() => purgeStartRef.current(), []);
    const stablePurgeEnd = useCallback(() => purgeEndRef.current(), []);

    const commitStartRef = useRef(handleCommitStart);
    const commitEndRef = useRef(handleCommitEnd);
    useEffect(() => { commitStartRef.current = handleCommitStart; }, [handleCommitStart]);
    useEffect(() => { commitEndRef.current = handleCommitEnd; }, [handleCommitEnd]);
    const stableCommitStart = useCallback(() => commitStartRef.current(), []);
    const stableCommitEnd = useCallback(() => commitEndRef.current(), []);


    const localToggleGame = (game: any) => {
        if (pendingDeletes.includes(game.id)) {
            setPendingDeletes(prev => prev.filter(id => id !== game.id));
        } else {
            setPendingDeletes(prev => [...prev, game.id]);
        }
    };

    const localMoveGame = (gameId: string, direction: 'up' | 'down') => {
        setFormGames(prev => {
            const idx = prev.findIndex(g => g.id === gameId);
            if (idx === -1) return prev;
            const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (nextIdx < 0 || nextIdx >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[nextIdx]] = [next[nextIdx], next[idx]];
            return next;
        });
    };

    useEffect(() => {
        if (isActive === false) return; // Ignore if inactive

        if (editingId && isFormOpen) {
            if (purgeActive) {
                onCommandUpdate(
                    {
                        text: 'AUTODESTRUCTION_PROTOCOL',
                        desc: 'HOLD_EXECUTE_FOR_3_SECONDS_TO_TERMINATE_UNIT_DATA.'
                    },
                    null,
                    purgeProgress,
                    false,
                    true,
                    null, null,
                    stablePurgeStart,
                    stablePurgeEnd
                );
            } else if (fetchActive) {
                onCommandUpdate(
                    {
                        text: 'STREAMS_FETCH_SCAN',
                        desc: 'EXECUTE_TO_RECOVER_MISSING_ASSETS_FOR_THIS_NODE.'
                    },
                    stableFetch,
                    0,
                    false,
                    true
                );
            } else {
                const requiresHold = pendingDeletes.length > 0;
                onCommandUpdate(
                    {
                        text: requiresHold ? 'DESTRUCTION_PROTOCOL' : (t('registry.command_commit') || 'COMMIT_CHANGES'),
                        desc: requiresHold ? 'HOLD_EXECUTE_FOR_2_SECONDS_TO_APPLY' : (t('registry.desc_commit') || 'APPLY_CHANGES_TO_REGISTRY')
                    },
                    requiresHold ? null : stableSave,
                    requiresHold ? holdProgress : 0,
                    false,
                    !!catForm.name.trim(),
                    null, null,
                    requiresHold ? stableCommitStart : null,
                    requiresHold ? stableCommitEnd : null
                );
            }
        } else {
            onCommandUpdate(
                {
                    text: t('categories.node_monitor'),
                    desc: t('categories.active_nodes_indices')
                },
                null,
                0,
                false,
                false
            );
        }
    }, [editingId, isFormOpen, catForm, t, onCommandUpdate, pendingDeletes.length, holdProgress, stableSave, stableCommitStart, stableCommitEnd, purgeActive, purgeProgress, stablePurgeStart, stablePurgeEnd, fetchActive, stableFetch, isActive]);

    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearInterval(holdTimerRef.current);
            if (purgeIntervalRef.current) clearInterval(purgeIntervalRef.current);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const scrollToForm = () => {
        setTimeout(() => {
            editorRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const userEditableCategories = displayCategories.filter(c => c.id !== 'all' && c.id !== 'hidden' && c.id !== 'recent' && c.id !== 'secret');

    const allCat = displayCategories.find(c => c.id === 'all');
    const recentCat = displayCategories.find(c => c.id === 'recent');
    const fixedNodes = [allCat, recentCat].filter(Boolean) as Category[];

    if (editingId && isFormOpen) {
        const isLockedList = editingId === 'all' || editingId === 'recent';

        return (
            <div className="flex-1 flex gap-6 overflow-hidden relative font-['Space_Mono'] h-full">
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
                            {formGames.map((g, idx) => {
                                const isDeleted = pendingDeletes.includes(g.id);
                                return (
                                    <div
                                        key={g.id}
                                        className="relative flex items-center gap-4 py-3 pl-3 pr-2 transition-all cursor-pointer group select-none hover:bg-white/5"
                                        onClick={() => !isLockedList && localToggleGame(g)}
                                        style={{
                                            backgroundColor: isDeleted ? 'rgba(239, 68, 68, 0.15)' : `${activeAccent}26`,
                                            clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))'
                                        }}
                                    >
                                        <div className="font-mono text-[9px] font-bold shrink-0 ml-1 transition-colors"
                                            style={{ color: isDeleted ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                                            {String(idx + 1)}
                                        </div>
                                        <div className="flex-1 min-w-0 pr-6">
                                            <span className={`block text-[8px] font-bold uppercase truncate tracking-[0.2em] transition-all ${isDeleted ? 'text-red-500' : 'text-white'}`}>{g.title}</span>
                                        </div>
                                        {!isLockedList && !isDeleted && (
                                            <div className="absolute right-2 top-0 bottom-0 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.stopPropagation(); localMoveGame(g.id, 'up'); }} className="text-white/30 hover:text-white transition-colors p-[2px] flex items-center justify-center disabled:opacity-0" disabled={idx === 0}>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); localMoveGame(g.id, 'down'); }} className="text-white/30 hover:text-white transition-colors p-[2px] flex items-center justify-center disabled:opacity-0" disabled={idx === formGames.length - 1}>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Configuration (Right) */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar pb-[100px] flex flex-col gap-4">

                    {/* Main 16:9 Config Card */}
                    <div
                        className="relative w-full aspect-video overflow-hidden mt-2"
                        style={{
                            backgroundColor: catForm.wallpaper ? 'black' : `${activeAccent}26`,
                            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
                        }}
                    >
                        {/* Wallpaper Background (like GameEditForm media block) */}
                        {catForm.wallpaper && (
                            <div className="absolute inset-0 z-0 pointer-events-none">
                                <img src={onResolveAsset(catForm.wallpaper)} className="w-full h-full object-cover blur-[6px] scale-[1.05] opacity-30" />
                                <div className="absolute inset-0" style={{ background: `linear-gradient(${catForm.color}33, ${catForm.color}11), rgba(0,0,0,0.6)` }} />
                            </div>
                        )}

                        {/* Card Contents */}
                        <div className="relative z-10 flex flex-col gap-3 p-4 h-full">
                            {/* Header: Icon (no bg) + Editable Name */}
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
                                    <div className="w-12 h-12 shrink-0 border border-dashed border-white/20" />
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

                            {/* Row: Icon Picker + Color Picker (same line) */}
                            <div className="grid grid-cols-2 gap-3">
                                {/* Icon Picker — bar(top-left cut) + button(top-right cut, folder icon) */}
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
                                {/* Color Picker — bar(top-left cut) + button(top-right cut, color swatch) */}
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

                            {/* Wallpaper Picker — bar(top-left cut) + button(top-right cut, landscape icon) */}
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

                            {/* Mode Selector (cut-corner rectangle buttons — uses activeAccent) */}
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

                            {/* Asset Fetch (toggleable — uses activeAccent) */}
                            <button
                                onClick={() => {
                                    const next = !fetchActive;
                                    setFetchActive(next);
                                    if (next) setPurgeActive(false);
                                }}
                                className="w-full py-2.5 text-[9px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center mt-auto"
                                style={{
                                    backgroundColor: fetchActive ? activeAccent : `${activeAccent}15`,
                                    color: fetchActive ? '#000' : activeAccent,
                                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)'
                                }}
                            >
                                {fetchActive ? '[ RECOVERY_READY ]' : `[ ${t('categories.fetch_assets') || 'FETCH_ASSETS'} ]`}
                            </button>
                        </div>
                    </div>

                    {/* Category Purge (toggleable, hold Execute to delete) */}
                    {!isLockedList && (
                        <button
                            onClick={() => {
                                const next = !purgeActive;
                                setPurgeActive(next);
                                if (next) setFetchActive(false);
                                setPurgeProgress(0);
                            }}
                            className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 relative overflow-hidden active:scale-95 cursor-pointer"
                            style={{
                                backgroundColor: purgeActive ? activeAccent : `${activeAccent}26`,
                                color: purgeActive ? '#000' : activeAccent,
                                clipPath: 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))',
                                border: `1px solid ${purgeActive ? activeAccent : `${activeAccent}44`}`
                            }}
                        >
                            {/* Subtle Highlight */}
                            {purgeActive && (
                                <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none" />
                            )}
                            <span className="relative z-10">{purgeActive ? `[ ${t('categories.purge_ready') || 'PURGE_READY'} ]` : `[ ${t('categories.purge_protocol') || 'PURGE_PROTOCOL'} ]`}</span>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 w-full flex flex-col gap-[16px] pb-[100px]">
                {/* Fixed Nodes (ALL / RECENT) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {fixedNodes.map(cat => (
                        <div
                            key={cat.id}
                            onClick={() => setEditingId(cat.id)}
                            className="relative group cursor-pointer h-[42px] transition-all hover:bg-white/5 active:scale-[0.98]"
                            style={{
                                backgroundColor: `${activeAccent}22`,
                                background: `linear-gradient(${activeAccent}22, ${activeAccent}22), #080808bf`,
                                clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))'
                            }}
                        >
                            <div className="h-full flex items-center gap-4 px-6 relative z-10">
                                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center opacity-90">
                                    <div
                                        className="w-full h-full"
                                        style={{
                                            backgroundColor: '#000000',
                                            WebkitMaskImage: `url(${onResolveAsset(cat.icon || ASSETS.templates.icon)})`,
                                            WebkitMaskSize: 'contain',
                                            WebkitMaskRepeat: 'no-repeat',
                                            WebkitMaskPosition: 'center',
                                            maskImage: `url(${onResolveAsset(cat.icon || ASSETS.templates.icon)})`,
                                            maskSize: 'contain',
                                            maskRepeat: 'no-repeat',
                                            maskPosition: 'center'
                                        }}
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[12px] font-black text-white uppercase tracking-[0.2em] font-['Space_Mono'] truncate">{cat.name}</span>
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                        <span className="text-[7px] uppercase font-bold tracking-widest italic text-white/50">{cat.games?.length || 0} {t('module.categories.units_in_memory')}</span>
                                    </div>
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
                        className="relative group cursor-pointer aspect-square transition-all hover:bg-white/10 active:scale-[0.98] flex flex-col items-center justify-center"
                        style={{
                            backgroundColor: `${activeAccent}26`,
                            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
                        }}
                    >
                        <span className="text-5xl font-light text-white/20 group-hover:text-white/60 transition-colors">+</span>
                    </div>

                    {/* Node Blocks */}
                    {userEditableCategories.map((cat, idx) => (
                        <div
                            key={cat.id}
                            className="relative group flex flex-col aspect-square transition-all cursor-pointer overflow-hidden"
                            style={{
                                backgroundColor: `${activeAccent}26`,
                                clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))'
                            }}
                        >
                            <span className="absolute bottom-3 right-3 text-[10px] font-bold text-white/40 font-mono z-10">{idx + 1}</span>

                            {/* Top: UP */}
                            <div
                                onClick={(e) => { e.stopPropagation(); handleMoveCategory(cat.id, 'up'); }}
                                className={`h-7 w-full flex items-center justify-center hover:bg-white/10 transition-all z-20 ${idx === 0 ? 'opacity-0 pointer-events-none' : 'text-white/20 hover:text-white'}`}
                            >
                                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-current"></div>
                            </div>

                            {/* Middle: SELECT */}
                            <div
                                onClick={() => setEditingId(cat.id)}
                                className="flex-1 flex flex-col items-center justify-center gap-2 relative z-10"
                            >
                                <div className="w-16 h-16 flex items-center justify-center relative mb-1 group-hover:scale-110 transition-transform">
                                    <div
                                        className="w-14 h-14 opacity-90 group-hover:opacity-100 transition-opacity"
                                        style={{
                                            backgroundColor: cat.color,
                                            WebkitMaskImage: `url(${onResolveAsset(cat.icon)})`,
                                            WebkitMaskSize: 'contain',
                                            WebkitMaskRepeat: 'no-repeat',
                                            WebkitMaskPosition: 'center',
                                            maskImage: `url(${onResolveAsset(cat.icon)})`,
                                            maskSize: 'contain',
                                            maskRepeat: 'no-repeat',
                                            maskPosition: 'center',
                                            filter: `drop-shadow(0 0 8px ${cat.color}66)`
                                        }}
                                    />
                                </div>
                                <span className="font-bold text-[8px] sm:text-[9px] uppercase tracking-widest text-center truncate px-2 text-white w-full">
                                    {cat.name}
                                </span>
                            </div>

                            {/* Bottom: DOWN */}
                            <div
                                onClick={(e) => { e.stopPropagation(); handleMoveCategory(cat.id, 'down'); }}
                                className={`h-7 w-full flex items-center justify-center hover:bg-white/10 transition-all z-20 ${idx === userEditableCategories.length - 1 ? 'opacity-0 pointer-events-none' : 'text-white/20 hover:text-white'}`}
                            >
                                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[6px] border-t-current"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ModularCategoriesModule;
