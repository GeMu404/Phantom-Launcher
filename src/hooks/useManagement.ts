import React, { useCallback } from 'react';
import { Category, Game } from '../types';
import { ASSETS, CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { useTranslation } from './useTranslation';

const PLATFORM_NAMES: Record<string, string> = {
    '3ds': 'NINTENDO 3DS', 'n64': 'NINTENDO 64', 'nds': 'NINTENDO DS',
    'ngc': 'NINTENDO GAMECUBE', 'nsw': 'NINTENDO SWITCH', 'wii': 'NINTENDO WII',
    'wiu': 'NINTENDO WII U', 'ps1': 'PLAYSTATION 1', 'ps2': 'PLAYSTATION 2', 'ps3': 'PLAYSTATION 3',
    'ps4': 'PLAYSTATION 4', 'ps5': 'PLAYSTATION 5', 'psp': 'PLAYSTATION PORTABLE', 'psv': 'PLAYSTATION VITA',
    'xbox': 'XBOX', 'xbox360': 'XBOX 360', 'multi': 'RETROARCH'
};

const PLATFORM_COLORS: Record<string, string> = {
    '3ds': '#ce181e', 'n64': '#316231', 'nds': '#ffffff', 'ngc': '#6a5acd',
    'gc': '#6a5acd', 'gamecube': '#6a5acd', 'nsw': '#e60012', 'switch': '#e60012',
    'wii': '#ffffff', 'wiu': '#009ac7', 'ps1': '#003791', 'ps2': '#003791',
    'ps3': '#000000', 'ps4': '#003791', 'psp': '#000000', 'psv': '#201e1f',
    'xbox': '#107c10', 'steam': '#66c0f4', 'gb': '#8b9bb4', 'gbc': '#fb06d2',
    'gba': '#2d1b6b', 'nes': '#e4000f', 'snes': '#8265a1', 'genesis': '#000000',
    'dreamcast': '#ff4b00', 'ps5': '#0072ce', 'xbox_series': '#107c10',
    'wii_u': '#009ac7', 'nintendo_64': '#316231', 'game_boy': '#8b9bb4',
    'game_boy_color': '#fb06d2', 'game_boy_advance': '#2d1b6b',
    'nintendo_ds': '#ffffff', 'nintendo_3ds': '#ce181e', 'nintendo_switch': '#e60012',
    'playstation': '#003791', 'playstation_2': '#003791', 'playstation_3': '#000000',
    'playstation_4': '#003791', 'playstation_portable': '#000000',
    'playstation_vita': '#201e1f', 'sega_genesis': '#000000',
    'sega_dreamcast': '#ff4b00', 'pc': '#66c0f4', 'shadps4': '#003791',
    'multi': '#3fe0d0',
};

const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'unit';
};

const NEON_COLORS = ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff8800', '#ff0000', '#8800ff', '#0088ff'];

interface UseManagementParams {
    categories: Category[];
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    onUpdateTaskbarMargin: (val: number) => void;
    onUpdateUIScale: (val: number) => void;
    bumpAssetVersion: () => void;
    onNotification?: (msg: string | null) => void;
    onClose: () => void;
}

export function useManagement({
    categories, onUpdateCategories, onUpdateTaskbarMargin, onUpdateUIScale,
    bumpAssetVersion, onNotification, onClose
}: UseManagementParams) {
    const { t } = useTranslation();

    const handleSyncSteamLibrary = useCallback(async (steamOptions: { includeSoftware: boolean; includeAdultOnly: boolean; quiet?: boolean }) => {
        try {
            if (onNotification && !steamOptions.quiet) onNotification(`STEAM::${t('system.init_sync')}...`);
            onClose();

            const response = await fetch('/api/steam/sync', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ includeSoftware: steamOptions.includeSoftware, includeAdultOnly: steamOptions.includeAdultOnly })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (onNotification && !steamOptions.quiet) onNotification(`STEAM::${t('system.sync_success')} (${data.count || 0})`);
            bumpAssetVersion();
            if (!steamOptions.quiet) setTimeout(() => onNotification?.(null), 2000);
        } catch (e: any) {
            console.error("Steam sync failed", e);
            if (onNotification && !steamOptions.quiet) onNotification(`STEAM::${t('system.sync_failed')}::${e.message}`);
            if (!steamOptions.quiet) setTimeout(() => onNotification?.(null), 3000);
        }
    }, [onNotification, onClose, t, bumpAssetVersion]);

    const handleSyncXboxLibrary = useCallback(async (options?: { quiet?: boolean; includeAssets?: boolean }) => {
        try {
            if (onNotification && !options?.quiet) onNotification(`XBOX::${t('system.init_sync')}...`);
            onClose();

            const response = await fetch('/api/xbox/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ includeAssets: options?.includeAssets ?? true })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (onNotification && !options?.quiet) onNotification(`XBOX::${t('system.sync_success')} (${data.count || 0})`);

            if (data.games && data.games.length > 0 && (options?.includeAssets ?? true)) {
                await handleFetchAssets('xbox', data.games, s => {
                    if (onNotification && !options?.quiet) onNotification(`XBOX::${s}`);
                });
            }

            bumpAssetVersion();
            if (!options?.quiet) setTimeout(() => onNotification?.(null), 2000);
        } catch (e: any) {
            console.error("Xbox sync failed", e);
            if (onNotification && !options?.quiet) onNotification(`XBOX::${t('system.sync_failed')}::${e.message}`);
            if (!options?.quiet) setTimeout(() => onNotification?.(null), 3000);
        }
    }, [onNotification, onClose, t, bumpAssetVersion]);

    const handleFetchAssets = useCallback(async (categoryId: string, games: Game[], onStatus?: (s: string) => void, onProgress?: (p: number) => void) => {
        const gamesToFetch = games.filter(g =>
            (!g.logo || g.logo.includes('default') || g.logo === '') ||
            (!g.cover || g.cover.includes('default') || g.cover === '') ||
            (!g.banner || g.banner.includes('default') || g.banner === '')
        );
        if (gamesToFetch.length === 0) {
            if (onStatus) onStatus('SYNC_COMPLETE');
            if (onProgress) onProgress(100);
            return;
        }

        if (onStatus) onStatus('FETCHING_ASSETS');
        let processed = 0;

        for (const game of gamesToFetch) {
            const currentProgress = Math.floor((processed / gamesToFetch.length) * 100);
            if (onProgress) onProgress(currentProgress);

            try {
                if (onStatus) onStatus(`${t('system.syncing')}: (${processed + 1}/${gamesToFetch.length}) ${game.title.length > 20 ? game.title.substring(0, 17) + '...' : game.title}`);
                const searchRes = await fetch(`/api/sgdb/search/${encodeURIComponent(game.title)}`);
                const searchData = await searchRes.json();

                if (searchData.success && searchData.data && searchData.data.length > 0) {
                    const sgdbId = searchData.data[0].id;
                    const assetTypes = ['logo', 'cover', 'banner'] as const;
                    const newAssets: any = {};

                    for (const type of assetTypes) {
                        const existingAsset = type === 'logo' ? game.logo : (type === 'cover' ? game.cover : game.banner);
                        if (existingAsset && !existingAsset.includes('blob:')) continue;

                        const gridRes = await fetch(`/api/sgdb/grids/${sgdbId}/${type === 'cover' ? 'grid' : type}`);
                        const gridData = await gridRes.json();

                        if (gridData.success && gridData.data && gridData.data.length > 0) {
                            const remoteUrl = gridData.data[0].url;
                            const isEmulator = categoryId.startsWith('emu_');
                            const platformId = isEmulator ? categoryId.replace('emu_', '') : '';

                            const cleanGameId = slugify(game.id.replace('steam_', '').replace('xbox_', '').replace(`emu_${platformId}_`, ''));
                            const assetSubDir = isEmulator ? `emulator/${platformId}/${cleanGameId}` :
                                (categoryId === 'steam' ? `steam/${cleanGameId}` :
                                    (categoryId === 'xbox' ? `xbox/${cleanGameId}` : cleanGameId));

                            const importRes = await fetch('/api/assets/import', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sourcePath: remoteUrl, gameId: assetSubDir, assetType: type })
                            });
                            const importData = await importRes.json();
                            if (importData.path) newAssets[type] = importData.path;
                        }
                    }

                    if (Object.keys(newAssets).length > 0) {
                        const updatedGame = { ...game, ...newAssets };

                        // Update local UI state
                        onUpdateCategories(prev => prev.map(c => {
                            if (c.id === categoryId || c.id === 'all') {
                                return { ...c, games: c.games.map(g => g.id === game.id ? updatedGame : g) };
                            }
                            return c;
                        }));

                        // Persist metadata
                        await fetch('/api/games/update-assets', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ gameId: game.id, assets: newAssets })
                        });
                    }
                }
            } catch (e) {
                console.error(`[FetchAssets] Failed for ${game.title}:`, e);
            } finally {
                processed++;
            }
        }

        if (onStatus) onStatus('SYNC_COMPLETE');
        if (onProgress) onProgress(100);

        // CRITICAL: Only bump version ONCE at the end of the batch to avoid thundering herd of 404s/timeouts
        bumpAssetVersion();
    }, [t, onUpdateCategories, bumpAssetVersion]);


    const handleFetchMissingAssets = useCallback(async (categoryId: string, onStatus?: (s: string) => void, onProgress?: (p: number) => void) => {
        onClose();
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return;
        await handleFetchAssets(categoryId, cat.games, onStatus, onProgress);
        setTimeout(() => onNotification?.(null), 2000);
    }, [onClose, categories, handleFetchAssets, onNotification]);

    const handleSyncEmuLibrary = useCallback(async (
        platformId: string,
        romsDir: string,
        emuExe: string,
        customArgs?: string,
        customIcon?: string,
        extension?: string,
        onProgress?: (p: number) => void,
        includeAssets: boolean = true
    ) => {
        const statusHandler = (s: string) => {
            if (onNotification) onNotification(`${PLATFORM_NAMES[platformId] || platformId.toUpperCase()}::${t(`system.${s.toLowerCase()}`) || s}`);
        };

        try {
            onClose();
            statusHandler('DISCOVERING_METADATA');
            const response = await fetch('/api/emu/scan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platformId, romsDir, emuExe, execArgs: customArgs, extension })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `SERVER_ERROR_${response.status}` }));
                throw new Error(errorData.error || 'SCAN_FAILED');
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (data.games && data.games.length > 0) {
                statusHandler('FINALIZING_STRUCTURE');
                const catId = `emu_${platformId}`;

                const platformColor = PLATFORM_COLORS[platformId] || '#ffffff';
                const platformIcon = customIcon || `./res/external/${platformId}.png`;

                const nextCategories = await new Promise<Category[]>((resolve) => {
                    onUpdateCategories(prev => {
                        const existingCat = prev.find(c => c.id === catId);
                        const mergedCat: Category = {
                            id: catId,
                            name: (existingCat && existingCat.name !== catId.toUpperCase()) ? existingCat.name : (PLATFORM_NAMES[platformId] || platformId.toUpperCase()),
                            icon: (existingCat?.icon && existingCat.icon !== '') ? existingCat.icon : platformIcon,
                            color: (existingCat?.color && existingCat.color !== '#ffffff') ? existingCat.color : platformColor,
                            games: data.games,
                            enabled: true,
                            wallpaper: existingCat?.wallpaper || '',
                            wallpaperMode: existingCat?.wallpaperMode || 'cover',
                            gridOpacity: existingCat?.gridOpacity ?? 0.15,
                            cardOpacity: existingCat?.cardOpacity ?? 0.7,
                            cardBlurEnabled: existingCat?.cardBlurEnabled ?? true,
                            cardTransparencyEnabled: existingCat?.cardTransparencyEnabled ?? true,
                            innerGlowEnabled: existingCat?.innerGlowEnabled ?? true,
                            outerGlowEnabled: existingCat?.outerGlowEnabled ?? true,
                        };

                        const filtered = prev.filter(c => c.id !== catId);
                        const result = [...filtered, mergedCat];

                        const final = result.map(cat => {
                            if (cat.id === 'all') {
                                const otherGames = cat.games.filter(g =>
                                    g.platform !== platformId || g.source !== 'emu'
                                );
                                return { ...cat, games: [...otherGames, ...data.games] };
                            }
                            return cat;
                        });
                        resolve(final);
                        return final;
                    });
                });

                // PERSIST STEP 1
                await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(nextCategories)
                });

                if (onProgress) onProgress(10);
                statusHandler('SYNC_SUCCESS');

                // 2. FETCH ASSETS IN SECOND PASS
                if (includeAssets) {
                    await handleFetchAssets(catId, data.games, statusHandler, (p) => {
                        if (onProgress) onProgress(10 + (p * 0.9));
                    });
                } else {
                    if (onProgress) onProgress(100);
                }

                statusHandler('SYNC_COMPLETE');
                if (onProgress) onProgress(100);
                statusHandler(null);
            } else {
                statusHandler(null);
                if (onNotification) onNotification(`EMU_SYNC::${t('system.sync_success')} (0)`);
            }
        } catch (e: any) {
            console.error('[Emu] Sync error:', e);
            if (onNotification) onNotification(`EMU_SCAN_ERROR::${e.message}`);
            onNotification?.(null); // Clear notification after error shown
            statusHandler(null);
        } finally {
            bumpAssetVersion();
            setTimeout(() => onNotification?.(null), 2000);
        }
    }, [onNotification, t, onClose, onUpdateCategories, handleFetchAssets, bumpAssetVersion]);

    const handleDeleteGame = useCallback((
        gameId: string,
        requestConfirmation?: ((msg: string, onConfirm: () => void, isDanger?: boolean) => void) | null
    ) => {
        const executeDelete = async () => {
            // 1. Delete from Server/SQLite
            await fetch('/api/games/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId })
            });

            // 2. Update Frontend State: Remove from ALL categories
            onUpdateCategories(prev => prev.map(c => ({
                ...c,
                games: c.games.filter(g => g.id !== gameId)
            })));

            bumpAssetVersion();
        };

        if (requestConfirmation) {
            requestConfirmation(t('registry.purge_confirmation'), executeDelete);
        } else {
            executeDelete();
        }
    }, [t, onUpdateCategories, bumpAssetVersion]);

    const handleWipeMasterRegistry = useCallback((
        requestConfirmation?: ((msg: string, onConfirm: () => void, isDanger?: boolean) => void) | null
    ) => {
        const executeWipe = async () => {
            // 1. Wipe from Server/File system
            await fetch('/api/data/wipe', { method: 'POST' });

            // 2. Clear Frontend State: Revert to defaults
            onUpdateCategories(prev => {
                const hiddenCat = prev.find(c => c.id === 'hidden');
                const resetCats = INITIAL_CATEGORIES.map(c => ({
                    ...c,
                    color: '#ffffff',
                    gridOpacity: 0.15,
                    cardOpacity: 0.7,
                    bgAnimationsEnabled: true,
                    gridEnabled: true,
                    scanlineEnabled: false,
                    vignetteEnabled: true,
                    cardTransparencyEnabled: true,
                    outlineEnabled: true
                } as Category));
                return hiddenCat ? [...resetCats, hiddenCat] : resetCats;
            });
            onUpdateTaskbarMargin(0);
            onUpdateUIScale(1.0);
            bumpAssetVersion();
        };

        if (requestConfirmation) {
            requestConfirmation(t('registry.wipe_confirmation'), executeWipe);
        } else {
            executeWipe();
        }
    }, [t, onUpdateCategories, onUpdateTaskbarMargin, onUpdateUIScale, bumpAssetVersion]);

    const handleCreateCategory = useCallback(async (
        setEditingId: (id: string | null) => void,
        setCatForm: (form: any) => void,
        scrollToForm: () => void
    ) => {
        const newId = `new_node_${Date.now()}`;
        const nextColor = NEON_COLORS[categories.length % NEON_COLORS.length];

        setEditingId(newId);
        setCatForm({ name: '', icon: ASSETS.templates.icon, color: nextColor, wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15, enabled: true });
        scrollToForm();
    }, [categories.length]);

    const handleDeleteCategory = useCallback((
        catId: string,
        editingId: string | null,
        setEditingId: (id: string | null) => void,
        requestConfirmation?: ((msg: string, onConfirm: () => void, isDanger?: boolean) => void) | null
    ) => {
        if (catId === 'all') return;

        const executeDelete = async () => {
            try {
                // Determine new state FIRST
                let finalCategories: Category[] = [];
                onUpdateCategories(prev => {
                    const filtered = prev.filter(c => c.id !== catId);
                    finalCategories = filtered;
                    return filtered;
                });

                console.log(`[Management] Persisting deletion for category: ${catId}`);
                const res = await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalCategories)
                });

                if (res.ok) {
                    console.log(`[Management] Successfully persisted deletion on server.`);
                } else {
                    console.error(`[Management] Server failed to persist deletion: ${res.status}`);
                }
            } catch (e) {
                console.error(`[Management] Network error during category deletion:`, e);
            }

            if (editingId === catId) {
                console.log(`[Management] Closing editor for deleted category.`);
                setEditingId(null);
            }
        };

        if (requestConfirmation) {
            requestConfirmation(`PURGE_NODE_${catId}?`, executeDelete);
        } else {
            executeDelete();
        }
    }, [onUpdateCategories]);

    const handleMoveCategory = useCallback(async (catId: string, direction: 'up' | 'down') => {
        if (catId === 'all') return;
        const nextState = await new Promise<Category[]>((resolve) => {
            onUpdateCategories(prev => {
                const idx = prev.findIndex(c => c.id === catId);
                if (idx === -1) { resolve(prev); return prev; }
                const next = [...prev];
                const newIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (newIdx < 0 || newIdx >= prev.length) { resolve(prev); return prev; }
                [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
                resolve(next);
                return next;
            });
        });

        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextState)
        });
    }, [onUpdateCategories]);

    const handleMoveGameInCategory = useCallback(async (catId: string, gameId: string, direction: 'up' | 'down') => {
        const nextState = await new Promise<Category[]>((resolve) => {
            onUpdateCategories(prev => {
                const updated = prev.map(cat => {
                    if (cat.id !== catId) return cat;
                    const gIdx = cat.games.findIndex(g => g.id === gameId);
                    if (gIdx === -1) return cat;
                    const newIdx = direction === 'up' ? gIdx - 1 : gIdx + 1;
                    if (newIdx < 0 || newIdx >= cat.games.length) return cat;
                    const newGames = [...cat.games];
                    [newGames[gIdx], newGames[newIdx]] = [newGames[newIdx], newGames[gIdx]];
                    return { ...cat, games: newGames };
                });
                resolve(updated);
                return updated;
            });
        });

        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextState)
        });
    }, [onUpdateCategories]);

    const handleToggleGameInCategory = useCallback(async (catId: string, gameId: string) => {
        const nextState = await new Promise<Category[]>((resolve) => {
            onUpdateCategories(prev => {
                const isHiddenOrSecret = catId === 'hidden' || catId === 'secret';
                const gameToToggle = prev.flatMap(c => c.games).find(g => g.id === gameId);

                if (!gameToToggle) { resolve(prev); return prev; }

                const updated = prev.map(cat => {
                    // Special Rule: If adding to Hidden/Secret, REMOVE from 'all'
                    if (isHiddenOrSecret) {
                        if (cat.id === catId) {
                            const exists = cat.games.some(g => g.id === gameId);
                            if (exists) {
                                return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
                            } else {
                                return { ...cat, games: [...cat.games, gameToToggle] };
                            }
                        } else if (cat.id === 'all') {
                            const inTarget = prev.find(c => c.id === catId)?.games.some(g => g.id === gameId);
                            if (!inTarget) {
                                return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
                            } else {
                                return { ...cat, games: [...cat.games, gameToToggle] };
                            }
                        }
                        return cat;
                    }

                    if (cat.id !== catId) return cat;
                    const exists = cat.games.some(g => g.id === gameId);
                    if (exists) {
                        return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
                    } else {
                        return { ...cat, games: [...cat.games, gameToToggle] };
                    }
                });
                resolve(updated);
                return updated;
            });
        });

        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextState)
        });
    }, [onUpdateCategories]);

    const handleSaveGame = useCallback(async (
        gameForm: any,
        editingId: string | null,
    ) => {
        if (!gameForm.title.trim()) return;

        const slug = slugify(gameForm.title);
        let newId = editingId;

        // Find the existing game based on the *original* editingId, if any
        const existingGame = editingId ? categories.flatMap(c => c.games).find(g => g.id === editingId) : null;

        // If it's a new game OR the title of a manual game changed, regenerate ID to avoid collisions
        const isManual = !editingId || (existingGame && existingGame.source === 'manual');
        const titleChanged = existingGame && slugify(existingGame.title) !== slug;

        // Regenerate ID ONLY if it's a NEW manual game or title changed for a MANUAL game
        // For Steam/Xbox/Emu, we KEEP the original ID to avoid breaking registry metadata
        if (!newId || (isManual && titleChanged)) {
            let candidateId: string | null = isManual ? `manual_${slug}` : editingId;
            if (isManual) {
                let counter = 0;
                const idExists = (id: string) => categories.some(c => c.games.some(g => g.id === id)) && id !== editingId;
                while (idExists(candidateId!)) {
                    counter++;
                    candidateId = `manual_${slug}_${counter}`;
                }
            }
            newId = candidateId;
        }

        // Import any staged assets (both HTTP URLs and absolute local paths)
        const isExternalPath = (p: string) => {
            if (!p) return false;
            if (p.startsWith('http://') || p.startsWith('https://')) return true;
            if (p.startsWith('res/') || p.startsWith('./res/')) return false;
            // If it's already inside our assets directory, no need to import
            if (p.includes('Phantom_Data\\assets') || p.includes('Phantom_Data/assets')) return false;
            // Otherwise, it's a local file elsewhere on disk that needs importing
            return true;
        };

        const assetFields = ['cover', 'banner', 'logo', 'wallpaper'] as const;
        const resolvedAssets: Record<string, string> = {};

        for (const field of assetFields) {
            const val = gameForm[field] || '';
            if (isExternalPath(val)) {
                try {
                    const res = await fetch('/api/assets/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sourcePath: val, gameId: newId, assetType: field })
                    });
                    const data = await res.json();
                    resolvedAssets[field] = data.path || val;
                } catch (e) {
                    console.error(`Asset import failed for ${field}`, e);
                    resolvedAssets[field] = val;
                }
            } else {
                resolvedAssets[field] = val;
            }
        }

        // Process Execution Path as a "launch" asset proxy if needed
        let resolvedExecPath = gameForm.execPath || '';
        // If it's manual, external, and not already pointing to a our internal proxy shortcut
        if (isManual && resolvedExecPath && isExternalPath(resolvedExecPath) && !resolvedExecPath.includes('launch.lnk') && !resolvedExecPath.includes('launch.url')) {
            try {
                const res = await fetch('/api/assets/import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sourcePath: resolvedExecPath, gameId: newId, assetType: 'launch' })
                });
                const data = await res.json();
                if (data.path) {
                    resolvedExecPath = data.path;
                }
            } catch (e) {
                console.error(`ExecPath import failed`, e);
            }
        }

        const gameObj: Game = {
            id: newId!,
            title: gameForm.title,
            cover: resolvedAssets.cover,
            banner: resolvedAssets.banner,
            logo: resolvedAssets.logo,
            execPath: resolvedExecPath,
            execArgs: gameForm.execArgs,
            source: existingGame?.source || 'manual',
            sourceId: existingGame?.sourceId,
            platform: existingGame?.platform,
            category: existingGame?.category,
            lastPlayed: existingGame?.lastPlayed || '',
            lastUpdated: Date.now(),
            wallpaper: resolvedAssets.wallpaper,
            romPath: existingGame?.romPath
        };

        const nextCategories = categories.map(cat => {
            let isTarget = gameForm.categoryIds.includes(cat.id);
            const isHiddenOrSecretTarget = gameForm.categoryIds.includes('hidden') || gameForm.categoryIds.includes('secret');

            // CRITICAL: If a game is in 'hidden' or 'secret', it MUST NOT be in 'all'
            if (cat.id === 'all') {
                if (isHiddenOrSecretTarget) {
                    isTarget = false;
                } else {
                    isTarget = true;
                }
            }

            // Clean categories: remove old ID, then add/update new ID if targeted
            const otherGames = cat.games.filter(g => g.id !== editingId && g.id !== newId);
            if (isTarget) {
                return { ...cat, games: [...otherGames, gameObj] };
            }
            return { ...cat, games: otherGames };
        });

        // 1. Update Frontend State
        onUpdateCategories(nextCategories);

        // 2. EXPLICIT PERSISTENCE (ROBUST PROTOCOL)
        try {
            await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextCategories)
            });
        } catch (e) {
            console.error("[Registry] Persistence failed:", e);
        }

        bumpAssetVersion();
        return gameObj;
    }, [categories, onUpdateCategories, bumpAssetVersion]);

    const handleSaveCategoryData = useCallback(async (
        editingId: string | null,
        formGames: any[],
        pendingDeletes: string[],
        catForm: any,
        setEditingId: (id: string | null) => void
    ) => {
        if (!editingId) return;

        // Import any local/URL assets for the category (like custom icons or wallpaper)
        const isExternalPath = (p: string) => {
            if (!p) return false;
            if (p.startsWith('http://') || p.startsWith('https://')) return true;
            if (p.startsWith('res/') || p.startsWith('./res/')) return false;
            if (p.includes('Phantom_Data\\assets') || p.includes('Phantom_Data/assets')) return false;
            return true;
        };

        const finalEditingId = editingId.replace('new_', '');
        const assetFields = ['icon', 'wallpaper'] as const;
        const resolvedCatForm = { ...catForm };

        for (const field of assetFields) {
            const val = resolvedCatForm[field] || '';
            if (isExternalPath(val)) {
                try {
                    const res = await fetch('/api/assets/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sourcePath: val, gameId: `cat_${finalEditingId}`, assetType: field })
                    });
                    const data = await res.json();
                    resolvedCatForm[field] = data.path || val;
                } catch (e) {
                    console.error(`Asset import failed for category ${field}`, e);
                    resolvedCatForm[field] = val;
                }
            }
        }

        const nextState = await new Promise<Category[]>((resolve) => {
            onUpdateCategories(prev => {
                const exists = prev.some(c => c.id === finalEditingId);
                const savedGames = formGames.filter(g => !pendingDeletes.includes(g.id));

                let updated;
                if (exists) {
                    updated = prev.map(c => c.id === finalEditingId ? {
                        ...c, ...resolvedCatForm, games: savedGames
                    } : c);
                } else {
                    updated = [...prev, {
                        id: finalEditingId, ...resolvedCatForm, games: savedGames,
                        icon: resolvedCatForm.icon || ASSETS.templates.icon, color: resolvedCatForm.color || '#ffffff'
                    }];
                }
                resolve(updated);
                return updated;
            });
        });

        await fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nextState)
        });

        setEditingId(null);
    }, [onUpdateCategories]);

    const handleImportAsset = useCallback(async (sourcePath: string, gameId: string, assetType: string) => {
        try {
            const importRes = await fetch('/api/assets/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourcePath, gameId, assetType })
            });
            const importData = await importRes.json();
            if (importData.path) {
                bumpAssetVersion();
                return importData.path;
            }
            return sourcePath;
        } catch (e) {
            console.error("Asset import failed", e);
            return sourcePath;
        }
    }, [bumpAssetVersion]);

    return {
        PLATFORM_NAMES, PLATFORM_COLORS, NEON_COLORS,
        handleSyncSteamLibrary, handleSyncXboxLibrary, handleSyncEmuLibrary,
        handleFetchAssets, handleFetchMissingAssets, handleDeleteGame, handleWipeMasterRegistry,
        handleCreateCategory, handleDeleteCategory, handleMoveCategory,
        handleMoveGameInCategory, handleToggleGameInCategory,
        handleSaveGame, handleImportAsset, handleSaveCategoryData, slugify
    };
}
