import React, { useCallback } from 'react';
import { Category, Game } from '../types';
import { ASSETS, CATEGORIES as INITIAL_CATEGORIES } from '../constants';
import { useTranslation } from './useTranslation';

const PLATFORM_NAMES: Record<string, string> = {
    '3ds': 'NINTENDO 3DS', 'n64': 'NINTENDO 64', 'nds': 'NINTENDO DS',
    'ngc': 'NINTENDO GAMECUBE', 'nsw': 'NINTENDO SWITCH', 'wii': 'NINTENDO WII',
    'wiu': 'NINTENDO WII U', 'ps2': 'PLAYSTATION 2', 'ps3': 'PLAYSTATION 3',
    'ps4': 'PLAYSTATION 4', 'psp': 'PLAYSTATION PORTABLE', 'psv': 'PLAYSTATION VITA',
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
    'sega_dreamcast': '#ff4b00', 'pc': '#66c0f4',
};

const slugify = (text: string): string => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
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
            onUpdateCategories(prev => prev.map(cat => (cat.id === 'steam' || cat.id === 'all') ? { ...cat, games: cat.games.filter(g => g.source !== 'steam') } : cat));
            if (onNotification && !steamOptions.quiet) onNotification(`STEAM::${t('system.init_sync')}...`);
            onClose();

            const response = await fetch('/api/steam/scan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ includeSoftware: steamOptions.includeSoftware, includeAdultOnly: steamOptions.includeAdultOnly })
            });
            const { games: steamGames } = await response.json();
            onUpdateCategories(prev => {
                const steamCatIndex = prev.findIndex(c => c.id === 'steam');
                let newCategories = [...prev];
                if (steamCatIndex === -1 && steamGames.length > 0) {
                    newCategories.push({
                        id: 'steam', name: 'STEAM',
                        icon: (ASSETS as any).external?.steam || './res/external/steam_icon.png',
                        color: PLATFORM_COLORS['steam'], games: [], enabled: true,
                        wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15
                    });
                }
                return newCategories.map(cat => {
                    if (cat.id === 'all' || cat.id === 'steam') {
                        const existingIds = new Set(cat.games.map(g => g.id));
                        const uniqueNew = steamGames.filter((g: Game) => !existingIds.has(g.id));
                        return { ...cat, games: [...cat.games, ...uniqueNew] };
                    }
                    return cat;
                });
            });
            if (onNotification && !steamOptions.quiet) onNotification(`STEAM::${t('system.sync_success')}`);
            bumpAssetVersion();
            if (!steamOptions.quiet) setTimeout(() => onNotification?.(null), 2000);
        } catch (e: any) {
            console.error("Steam sync failed", e);
            if (onNotification && !steamOptions.quiet) onNotification(`STEAM::${t('system.sync_failed')}::${e.message}`);
            if (!steamOptions.quiet) setTimeout(() => onNotification?.(null), 3000);
        }
    }, [onUpdateCategories, onNotification, onClose, t, bumpAssetVersion]);

    const handleSyncXboxLibrary = useCallback(async (options?: { quiet?: boolean }) => {
        try {
            onUpdateCategories(prev => prev.map(cat => (cat.id === 'xbox' || cat.id === 'all') ? { ...cat, games: cat.games.filter(g => g.source !== 'xbox') } : cat));
            if (onNotification && !options?.quiet) onNotification(`XBOX::${t('system.init_sync')}...`);
            onClose();
            const response = await fetch('/api/xbox/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            const { games: xboxGames } = await response.json();
            onUpdateCategories(prev => {
                const xboxCatIndex = prev.findIndex(c => c.id === 'xbox');
                let newCategories = [...prev];
                if (xboxCatIndex === -1 && xboxGames.length > 0) {
                    newCategories.push({
                        id: 'xbox', name: 'XBOX', icon: './res/external/xbox.png',
                        color: PLATFORM_COLORS['xbox'], games: [], enabled: true,
                        wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15
                    });
                }
                return newCategories.map(cat => {
                    if (cat.id === 'all' || cat.id === 'xbox') {
                        const existingIds = new Set(cat.games.map(g => g.id));
                        const uniqueNew = xboxGames.filter((g: Game) => !existingIds.has(g.id));
                        return { ...cat, games: [...cat.games, ...uniqueNew] };
                    }
                    return cat;
                });
            });
            if (onNotification && !options?.quiet) onNotification(`XBOX::${t('system.sync_success')}`);
            bumpAssetVersion();
            if (!options?.quiet) setTimeout(() => onNotification?.(null), 2000);
        } catch (e: any) {
            console.error("Xbox sync failed", e);
            if (onNotification && !options?.quiet) onNotification(`XBOX::${t('system.sync_failed')}::${e.message}`);
            if (!options?.quiet) setTimeout(() => onNotification?.(null), 3000);
        }
    }, [onUpdateCategories, onNotification, onClose, t, bumpAssetVersion]);

    const handleFetchMissingAssets = useCallback(async (categoryId: string, onStatus?: (s: string) => void) => {
        onClose();
        const cat = categories.find(c => c.id === categoryId);
        if (!cat) return;

        const gamesToFetch = cat.games.filter(g => !g.logo || !g.cover || !g.banner);
        if (gamesToFetch.length === 0) {
            if (onStatus) onStatus('SYNC_COMPLETE');
            return;
        }

        if (onStatus) onStatus('FETCHING_ASSETS');
        let processed = 0;
        const updatedGames = [...cat.games];

        for (let i = 0; i < updatedGames.length; i++) {
            const game = updatedGames[i];
            if (game.logo && game.cover && game.banner) continue;

            try {
                if (onStatus) onStatus(`${t('system.syncing')}: (${processed + 1}/${gamesToFetch.length}) ${game.title.length > 20 ? game.title.substring(0, 17) + '...' : game.title}`);
                const searchRes = await fetch(`/api/sgdb/search/${encodeURIComponent(game.title)}`);
                const searchData = await searchRes.json();
                if (searchData.success && searchData.data && searchData.data.length > 0) {
                    const sgdbId = searchData.data[0].id;
                    const assetTypes = ['logo', 'cover', 'banner'] as const;
                    const newAssets: any = {};

                    for (const type of assetTypes) {
                        if ((type === 'logo' && game.logo) || (type === 'cover' && game.cover) || (type === 'banner' && game.banner)) continue;
                        const gridRes = await fetch(`/api/sgdb/grids/${sgdbId}/${type === 'cover' ? 'grid' : type}`);
                        const gridData = await gridRes.json();
                        if (gridData.success && gridData.data && gridData.data.length > 0) {
                            const remoteUrl = gridData.data[0].url;
                            const isEmulator = categoryId.startsWith('emu_');
                            const platformId = isEmulator ? categoryId.replace('emu_', '') : '';
                            const assetSubDir = isEmulator ? `emulator/${platformId}/${game.id.replace(`emu_${platformId}_`, '')}` :
                                (categoryId === 'steam' ? `steam/${game.id.replace('steam_', '')}` :
                                    (categoryId === 'xbox' ? `xbox/${game.id.replace('xbox_', '')}` : game.id));
                            const importRes = await fetch('/api/assets/import', {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ sourcePath: remoteUrl, gameId: assetSubDir, assetType: type })
                            });
                            const importData = await importRes.json();
                            if (importData.path) newAssets[type] = importData.path;
                        }
                    }

                    if (Object.keys(newAssets).length > 0) {
                        onUpdateCategories(prev => prev.map(c => c.id === categoryId ? {
                            ...c, games: c.games.map(g => g.id === game.id ? { ...g, ...newAssets } : g)
                        } : c));
                        bumpAssetVersion();
                    }
                }
                processed++;
            } catch (e) {
                console.error(`[Fetch] Failed to fetch assets for ${game.title}:`, e);
                processed++;
            }
        }

        if (onStatus) onStatus('SYNC_COMPLETE');
        bumpAssetVersion();
        setTimeout(() => onNotification?.(null), 2000);
    }, [onClose, categories, t, onUpdateCategories, bumpAssetVersion, onNotification]);

    const handleSyncEmuLibrary = useCallback(async (
        platformId: string, romsDir: string, emuExe: string, customArgs?: string, customIcon?: string
    ) => {
        const statusHandler = (s: string) => {
            if (onNotification) onNotification(`${PLATFORM_NAMES[platformId] || platformId.toUpperCase()}::${t(`system.${s.toLowerCase()}`) || s}`);
        };

        try {
            onClose();
            statusHandler('DISCOVERING_METADATA');
            const response = await fetch('/api/emu/scan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platformId, romsDir, emuExe, execArgs: customArgs })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (data.games && data.games.length > 0) {
                statusHandler('FINALIZING_STRUCTURE');
                const catId = `emu_${platformId}`;

                const newCat: Category = {
                    id: catId,
                    name: PLATFORM_NAMES[platformId] || platformId.toUpperCase(),
                    icon: customIcon || `./res/external/${platformId}.png`,
                    color: customIcon ? '#ffffff' : (PLATFORM_COLORS[platformId] || '#ffffff'),
                    games: data.games, enabled: true,
                    wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15
                };

                onUpdateCategories(prev => {
                    const filtered = prev.filter(c => c.id !== catId);
                    return [...filtered, newCat];
                });

                await handleFetchMissingAssets(catId, statusHandler);
                statusHandler('SYNC_SUCCESS');
                bumpAssetVersion();
                setTimeout(() => onNotification?.(null), 2000);
            }
        } catch (e: any) {
            console.error('[EmuSync] Error:', e);
            if (onNotification) onNotification(`${t('system.sync_failed')}::${e.message}`);
            setTimeout(() => onNotification?.(null), 3000);
        }
    }, [onNotification, t, onClose, onUpdateCategories, handleFetchMissingAssets, bumpAssetVersion]);

    const handleDeleteGame = useCallback((
        gameId: string,
        requestConfirmation: (msg: string, onConfirm: () => void, isDanger?: boolean) => void
    ) => {
        requestConfirmation(t('registry.purge_confirmation'), async () => {
            await fetch('/api/games/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) });
            onUpdateCategories(prev => prev.map(c => ({ ...c, games: c.games.filter(g => g.id !== gameId) })));
            bumpAssetVersion();
        });
    }, [t, onUpdateCategories, bumpAssetVersion]);

    const handleWipeMasterRegistry = useCallback((
        requestConfirmation: (msg: string, onConfirm: () => void, isDanger?: boolean) => void
    ) => {
        requestConfirmation(t('registry.wipe_confirmation'), async () => {
            await fetch('/api/data/wipe', { method: 'POST' });
            onUpdateCategories(prev => {
                const hiddenCat = prev.find(c => c.id === 'hidden');
                const resetCats = INITIAL_CATEGORIES.map(c => ({
                    ...c, color: '#ffffff', assetColor: '#00ffff', nodeColor: '#ff00ff',
                    syncColor: '#ffff00', coreColor: '#00ff00', gridOpacity: 0.15,
                    cardOpacity: 0.7, performanceMode: 'balanced' as const, bgAnimationsEnabled: true,
                    gridEnabled: true, scanlineEnabled: false, vignetteEnabled: true,
                    highQualityBlobs: false, cardTransparencyEnabled: true, cardBlurEnabled: false,
                    innerGlowEnabled: true, outerGlowEnabled: false
                } as Category));
                return hiddenCat ? [...resetCats, hiddenCat] : resetCats;
            });
            onUpdateTaskbarMargin(0);
            onUpdateUIScale(1.0);
            bumpAssetVersion();
        });
    }, [t, onUpdateCategories, onUpdateTaskbarMargin, onUpdateUIScale, bumpAssetVersion]);

    const handleCreateCategory = useCallback((
        setEditingId: (id: string | null) => void,
        setCatForm: (form: any) => void,
        scrollToForm: () => void
    ) => {
        const newId = `node_${Date.now()}`;
        const nextColor = NEON_COLORS[categories.length % NEON_COLORS.length];
        const newCat = { id: newId, name: 'NEW_NODE', icon: ASSETS.templates.icon, color: nextColor, games: [], enabled: true };
        onUpdateCategories(prev => [...prev, newCat as any]);
        setEditingId(newId);
        setCatForm({ name: 'NEW_NODE', icon: ASSETS.templates.icon, color: nextColor, wallpaper: '', wallpaperMode: 'cover', gridOpacity: 0.15, enabled: true });
        scrollToForm();
    }, [categories.length, onUpdateCategories]);

    const handleDeleteCategory = useCallback((
        catId: string,
        editingId: string | null,
        setEditingId: (id: string | null) => void,
        requestConfirmation: (msg: string, onConfirm: () => void, isDanger?: boolean) => void
    ) => {
        if (catId === 'all') return;
        requestConfirmation(`PURGE_NODE_${catId}?`, () => {
            onUpdateCategories(prev => prev.filter(c => c.id !== catId));
            if (editingId === catId) setEditingId(null);
        });
    }, [onUpdateCategories]);

    const handleMoveCategory = useCallback((catId: string, direction: 'up' | 'down') => {
        if (catId === 'all') return;
        onUpdateCategories(prev => {
            const idx = prev.findIndex(c => c.id === catId);
            if (idx === -1) return prev;
            const newIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 1 || newIdx >= prev.length) return prev;
            const newCats = [...prev];
            [newCats[idx], newCats[newIdx]] = [newCats[newIdx], newCats[idx]];
            return newCats;
        });
    }, [onUpdateCategories]);

    const handleMoveGameInCategory = useCallback((catId: string, gameId: string, direction: 'up' | 'down') => {
        onUpdateCategories(prev => prev.map(cat => {
            if (cat.id !== catId) return cat;
            const gIdx = cat.games.findIndex(g => g.id === gameId);
            if (gIdx === -1) return cat;
            const newIdx = direction === 'up' ? gIdx - 1 : gIdx + 1;
            if (newIdx < 0 || newIdx >= cat.games.length) return cat;
            const newGames = [...cat.games];
            [newGames[gIdx], newGames[newIdx]] = [newGames[newIdx], newGames[gIdx]];
            return { ...cat, games: newGames };
        }));
    }, [onUpdateCategories]);

    const handleToggleGameInCategory = useCallback((catId: string, gameId: string) => {
        onUpdateCategories(prev => {
            let isRemovingFromHidden = false;
            let isAddingToHidden = false;

            if (catId === 'hidden') {
                const hiddenCat = prev.find(c => c.id === 'hidden');
                if (hiddenCat?.games.some(g => g.id === gameId)) {
                    isRemovingFromHidden = true;
                } else {
                    isAddingToHidden = true;
                }
            }

            return prev.map(cat => {
                if (isAddingToHidden) {
                    if (cat.id === 'hidden') {
                        const game = prev.flatMap(c => c.games).find(g => g.id === gameId);
                        return game ? { ...cat, games: [...cat.games, game] } : cat;
                    } else {
                        return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
                    }
                }
                if (isRemovingFromHidden) {
                    if (cat.id === 'hidden') {
                        return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
                    } else if (cat.id === 'all') {
                        const game = prev.find(c => c.id === 'hidden')?.games.find(g => g.id === gameId);
                        return game ? { ...cat, games: [...cat.games, game] } : cat;
                    }
                    return cat;
                }
                if (cat.id !== catId) return cat;
                const exists = cat.games.some(g => g.id === gameId);
                if (exists) {
                    return { ...cat, games: cat.games.filter(g => g.id !== gameId) };
                } else {
                    const game = prev.flatMap(c => c.games).find(g => g.id === gameId);
                    return game ? { ...cat, games: [...cat.games, game] } : cat;
                }
            });
        });
    }, [onUpdateCategories]);

    const handleSaveGame = useCallback(async (
        gameForm: any,
        editingId: string | null,
    ) => {
        if (!gameForm.title.trim()) return;

        const slug = slugify(gameForm.title);
        let newId = editingId;

        if (!newId) {
            let candidateId = `manual_${slug}`;
            let counter = 0;
            const idExists = (id: string) => categories.some(c => c.games.some(g => g.id === id));
            while (idExists(candidateId)) {
                counter++;
                candidateId = `manual_${slug}-${counter}`;
            }
            newId = candidateId;
        }

        const existingGame = categories.flatMap(c => c.games).find(g => g.id === newId);

        const gameObj: Game = {
            ...existingGame!,
            id: newId!,
            title: gameForm.title,
            cover: gameForm.cover,
            banner: gameForm.banner,
            logo: gameForm.logo,
            execPath: gameForm.execPath,
            execArgs: gameForm.execArgs,
            source: existingGame?.source || 'manual',
            wallpaper: gameForm.wallpaper
        };

        onUpdateCategories(prev => prev.map(cat => {
            let isTarget = cat.id === 'all' || gameForm.categoryIds.includes(cat.id);
            if (cat.id === 'all' && gameForm.categoryIds.includes('hidden')) isTarget = false;
            const exists = cat.games.some(g => g.id === newId);
            if (isTarget) return exists ? { ...cat, games: cat.games.map(g => g.id === newId ? gameObj : g) } : { ...cat, games: [...cat.games, gameObj] };
            return { ...cat, games: cat.games.filter(g => g.id !== newId) };
        }));

        bumpAssetVersion();
        return newId;
    }, [categories, onUpdateCategories, bumpAssetVersion]);

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
        handleFetchMissingAssets, handleDeleteGame, handleWipeMasterRegistry,
        handleCreateCategory, handleDeleteCategory, handleMoveCategory,
        handleMoveGameInCategory, handleToggleGameInCategory,
        handleSaveGame, handleImportAsset, slugify
    };
}
