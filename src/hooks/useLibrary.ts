import { useMemo } from 'react';
import { Category } from '../types';
import { ASSETS } from '../constants';

export function useLibrary(categories: Category[], isSecretUnlocked: boolean, isBackendOnline: boolean | 'checking', t: (key: string) => string) {
    const displayCategories = useMemo(() => {
        // 1. Get all hidden/secret game IDs to exclude them from recent
        const hiddenGameIds = new Set(
            categories
                .filter(c => c.id === 'hidden' || c.id === 'secret')
                .flatMap(c => c.games.map(g => g.id))
        );

        // 2. Get all unique games that have been played (excluding hidden)
        const allGamesMap = new Map();
        categories.forEach(c => {
            if ((c.id === 'hidden' || c.id === 'secret') && !isSecretUnlocked) return;
            if (c.id === 'recent') return;

            c.games.forEach(g => {
                if (g.lastPlayed && !hiddenGameIds.has(g.id)) {
                    allGamesMap.set(g.id, g);
                }
            });
        });

        const recentGames = Array.from(allGamesMap.values())
            .sort((a, b) => new Date(b.lastPlayed).getTime() - new Date(a.lastPlayed).getTime())
            .slice(0, 10);

        // 2. Find if 'recent' category exists in state
        const storedRecent = categories.find(c => c.id === 'recent');

        const recentCategory = {
            ...storedRecent,
            id: 'recent',
            name: storedRecent?.name || t('app.recent'),
            icon: storedRecent?.icon || './res/ui/recent.png',
            color: storedRecent?.color || '#00ffcc',
            games: recentGames,
            enabled: storedRecent?.enabled ?? true,
            wallpaper: storedRecent?.wallpaper || '', // EXPLICIT OVERRIDE
            wallpaperMode: storedRecent?.wallpaperMode || 'cover',
            gridOpacity: storedRecent?.gridOpacity ?? 0.15,
            cardOpacity: storedRecent?.cardOpacity ?? 0.7
        };

        const newCats = categories.filter(c => c.id !== 'recent' && c.id !== 'hidden' && c.id !== 'secret');

        // Final Assembly in strict order: [All, Recent, Hidden, ...others]
        const finalCats: Category[] = [];
        let allCat = newCats.find(c => c.id === 'all');
        if (!allCat) {
            allCat = {
                id: 'all',
                name: 'ALL GAMES',
                icon: ASSETS.templates.icon,
                color: '#ffffff',
                games: [],
                enabled: true,
                wallpaper: '', // DEFAULT
                wallpaperMode: 'cover',
                gridOpacity: 0.15
            };
        } else {
            // Ensure even if found, we maintain its specific wallpaper or none
            allCat = { ...allCat, wallpaper: allCat.wallpaper || '' };
        }
        finalCats.push({ ...allCat, enabled: true });
        finalCats.push({ ...recentCategory, enabled: true } as any);

        if (isSecretUnlocked) {
            const hiddenCat = categories.find(c => c.id === 'hidden');
            if (hiddenCat) finalCats.push(hiddenCat);

            let secretCat = categories.find(c => c.id === 'secret');
            if (!secretCat) {
                secretCat = {
                    id: 'secret',
                    name: 'SECRET_CORE',
                    icon: ASSETS.external.hidden,
                    color: '#b829da',
                    games: [],
                    enabled: true,
                    wallpaper: '',
                    wallpaperMode: 'cover',
                    gridOpacity: 0.15
                };
            }
            finalCats.push(secretCat);
        }

        const remainingCats = newCats.filter(c => c.id !== 'all');
        finalCats.push(...remainingCats);

        return finalCats.filter(c => c.enabled !== false);
    }, [categories, isSecretUnlocked, isBackendOnline, t]);

    return { displayCategories };
}
