import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Category, Game, AppState } from '../types';
import { ASSETS } from '../constants';

export const useAtmosphere = (categories: Category[], currentCategory: Category | undefined, activeGame: Game | undefined, isManagementOpen: boolean = false, assetVersion: number = 0) => {
    // Helper: Resource Resolution
    const resolveAsset = useCallback((path: string | undefined, width?: number): string => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
        if (path.startsWith('./res') || path.startsWith('res/') || path.startsWith('/res/')) return path;

        const isLikelyPath = path.includes('.') || path.includes('/') || path.includes('\\') || path.match(/^[a-zA-Z]:/);
        if (!isLikelyPath) return path;

        let url = `/api/proxy-image?path=${encodeURIComponent(path)}`;
        if (width) url += `&width=${width}`;
        if (assetVersion > 0) url += `&v=${assetVersion}`;
        return url;
    }, [assetVersion]);

    const atmosphereSettings = useMemo(() => {
        if (categories.length === 0) return { wallpaper: ASSETS.ui.wallpaper };
        const allCat = categories.find(c => c.id === 'all');
        const globalWallpaper = allCat?.wallpaper || ASSETS.ui.wallpaper;
        const globalWallpaperMode = allCat?.wallpaperMode || 'cover';
        const globalGridOpacity = allCat?.gridOpacity ?? 0.15;
        const globalCardOpacity = allCat?.cardOpacity ?? 1.0;
        const globalBgAnim = allCat?.bgAnimationsEnabled ?? true;
        const globalCardBlur = allCat?.cardBlurEnabled ?? true;
        const globalGridEnabled = allCat?.gridEnabled ?? true;
        const globalLowRes = allCat?.lowResWallpaper ?? (allCat?.performanceMode === 'low');
        const globalAA = allCat?.wallpaperAAEnabled ?? (allCat?.performanceMode === 'low');
        const globalHighQualityBlobs = allCat?.highQualityBlobs ?? (allCat?.performanceMode === 'high');
        const globalCardTransparency = allCat?.cardTransparencyEnabled ?? true;
        const globalScanlineEnabled = allCat?.scanlineEnabled ?? true;
        const globalVignetteEnabled = allCat?.vignetteEnabled ?? true;
        const globalPerformanceMode = allCat?.performanceMode || 'high';
        const finalWidth = globalLowRes ? 960 : 1920;

        const catWallpaper = currentCategory?.wallpaper;
        const catWallpaperMode = currentCategory?.wallpaperMode;
        const catGridOpacity = currentCategory?.gridOpacity;

        // DIRECT SYNC: Use game wallpaper immediately with no debounce logic
        const gameWallpaper = activeGame?.wallpaper;

        // Priority logic: Modal > GameSync > Category > Global
        const finalWallpaper = (isManagementOpen ? (catWallpaper || globalWallpaper) : (gameWallpaper || catWallpaper || globalWallpaper));
        const finalMode = (gameWallpaper || catWallpaper) ? (catWallpaperMode || 'cover') : globalWallpaperMode;
        const finalGrid = catGridOpacity !== undefined ? catGridOpacity : globalGridOpacity;

        return {
            wallpaper: resolveAsset(finalWallpaper, finalWidth),
            mode: finalMode as any,
            gridOpacity: finalGrid,
            cardOpacity: globalCardOpacity,
            cardBlurEnabled: globalCardBlur,
            cardTransparencyEnabled: globalCardTransparency,
            lowResWallpaper: globalLowRes,
            wallpaperAAEnabled: globalAA,
            highQualityBlobs: globalHighQualityBlobs,
            bgAnimationsEnabled: globalBgAnim,
            gridEnabled: globalGridEnabled,
            scanlineEnabled: globalScanlineEnabled,
            vignetteEnabled: globalVignetteEnabled,
            performanceMode: globalPerformanceMode
        };
    }, [currentCategory, categories, resolveAsset, activeGame?.wallpaper, isManagementOpen]);

    return { atmosphereSettings, resolveAsset };
};
