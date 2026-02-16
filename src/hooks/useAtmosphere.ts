import { useState, useEffect, useMemo, useCallback } from 'react';
import { Category, Game, AppState } from '../types';
import { ASSETS } from '../constants';

export const useAtmosphere = (categories: Category[], currentCategory: Category | undefined, activeGame: Game | undefined) => {
    // Helper: Resource Resolution
    const resolveAsset = useCallback((path: string | undefined): string => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
        if (path.startsWith('./res') || path.startsWith('res/') || path.startsWith('/res/')) return path;
        // Proxy local path via backend
        return `/api/proxy-image?path=${encodeURIComponent(path)}`;
    }, []);

    // DEBOUNCE LOGIC: Only apply game wallpaper if user lingers for 600ms
    const [debouncedGameWallpaper, setDebouncedGameWallpaper] = useState<string | undefined>(undefined);

    useEffect(() => {
        // Wait for the banner animation (starts fast, visually ready around 300ms) to finish.
        const timer = setTimeout(() => {
            setDebouncedGameWallpaper(activeGame?.wallpaper);
        }, 300);

        return () => clearTimeout(timer);
    }, [activeGame?.id, activeGame?.wallpaper]);

    const atmosphereSettings = useMemo(() => {
        if (categories.length === 0) return { wallpaper: ASSETS.ui.wallpaper };
        const allCat = categories.find(c => c.id === 'all');
        const globalWallpaper = allCat?.wallpaper || ASSETS.ui.wallpaper;
        const globalWallpaperMode = allCat?.wallpaperMode || 'cover';
        const globalGridOpacity = allCat?.gridOpacity ?? 0.15;
        const globalCardOpacity = allCat?.cardOpacity ?? 1.0;
        const globalBgAnim = allCat?.bgAnimationsEnabled ?? true;
        const globalGridEnabled = allCat?.gridEnabled ?? true;
        const globalScanlineEnabled = allCat?.scanlineEnabled ?? true;
        const globalVignetteEnabled = allCat?.vignetteEnabled ?? true;

        const catWallpaper = currentCategory?.wallpaper;
        const catWallpaperMode = currentCategory?.wallpaperMode;
        const catGridOpacity = currentCategory?.gridOpacity;

        // Priority: Debounced Game > Category > Global
        const finalWallpaper = debouncedGameWallpaper || catWallpaper || globalWallpaper;
        const finalMode = (debouncedGameWallpaper || catWallpaper) ? (catWallpaperMode || 'cover') : globalWallpaperMode;
        const finalGrid = catGridOpacity !== undefined ? catGridOpacity : globalGridOpacity;

        return {
            wallpaper: resolveAsset(finalWallpaper),
            mode: finalMode as any,
            gridOpacity: finalGrid,
            cardOpacity: globalCardOpacity,
            bgAnimationsEnabled: globalBgAnim,
            gridEnabled: globalGridEnabled,
            scanlineEnabled: globalScanlineEnabled,
            vignetteEnabled: globalVignetteEnabled
        };
    }, [currentCategory, categories, resolveAsset, debouncedGameWallpaper]);

    return { atmosphereSettings, resolveAsset };
};
