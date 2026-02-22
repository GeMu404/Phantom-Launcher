import { useMemo } from 'react';
import { Category } from '../types';
import { ASSETS } from '../constants';

export function useLibrary(categories: Category[], isSecretUnlocked: boolean, t: (key: string) => string) {
    const displayCategories = useMemo(() => {
        // 1. Get all hidden game IDs to exclude them from recent
        const hiddenGameIds = new Set(
            categories
                .filter(c => c.id === 'hidden')
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
            icon: storedRecent?.icon || ASSETS.templates.icon,
            color: storedRecent?.color || '#00ffcc',
            games: recentGames,
            enabled: storedRecent?.enabled ?? true,
            wallpaper: storedRecent?.wallpaper || '',
            wallpaperMode: storedRecent?.wallpaperMode || 'cover',
            gridOpacity: storedRecent?.gridOpacity ?? 0.15,
            cardOpacity: storedRecent?.cardOpacity ?? 0.7
        };

        if (recentGames.length === 0) {
            recentCategory.games = [{
                id: 'placeholder_recent',
                title: t('app.no_recent_activity'),
                cover: ASSETS.templates.icon,
                banner: '',
                logo: '',
                execPath: '',
                source: 'manual'
            } as any];
        }

        const newCats = categories.filter(c => c.id !== 'recent' && c.id !== 'hidden');
        const allIndex = newCats.findIndex(c => c.id === 'all');

        // Final Assembly in strict order: [All, Recent, Hidden, ...others]
        const finalCats: Category[] = [];
        const allCat = newCats.find(c => c.id === 'all');
        if (allCat) finalCats.push(allCat);
        finalCats.push(recentCategory as any);

        if (isSecretUnlocked) {
            const hiddenCat = categories.find(c => c.id === 'hidden');
            if (hiddenCat) finalCats.push(hiddenCat);
        }

        const remainingCats = newCats.filter(c => c.id !== 'all');
        finalCats.push(...remainingCats);

        return finalCats.filter(c => c.enabled !== false);
    }, [categories, isSecretUnlocked, t]);

    return { displayCategories };
}
