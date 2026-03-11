import { useState, useEffect, useCallback } from 'react';
import { Category } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';

export const usePersistence = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [taskbarMargin, setTaskbarMargin] = useState<number>(0);
    const [uiScale, setUIScale] = useState<number>(1.0);
    const [isBackendOnline, setIsBackendOnline] = useState<boolean | 'checking'>('checking');

    const refreshData = useCallback(async () => {
        try {
            const response = await fetch('/api/data');
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data)) {
                    setCategories(data);
                }
            }
        } catch (e) {
            console.error("[Persistence] Refresh failed", e);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        const loadSettings = () => {
            const margin = localStorage.getItem('phantom_launcher_margin');
            if (margin) setTaskbarMargin(parseInt(margin, 10));
            const scale = localStorage.getItem('phantom_launcher_ui_scale');
            if (scale) setUIScale(parseFloat(scale));
        };

        refreshData().then(() => {
            setIsDataLoaded(true);
        });
        loadSettings();
    }, []);

    // Sync Margin & UI Scale
    useEffect(() => {
        localStorage.setItem('phantom_launcher_margin', taskbarMargin.toString());
        localStorage.setItem('phantom_launcher_ui_scale', uiScale.toString());
    }, [taskbarMargin, uiScale]);

    // Backend Health Poll
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch('/api/health');
                setIsBackendOnline(res.ok);
            } catch (e) { setIsBackendOnline(false); }
        };
        checkHealth();
        const interval = setInterval(checkHealth, 5000);
        return () => clearInterval(interval);
    }, []);

    return { categories, setCategories, isDataLoaded, taskbarMargin, setTaskbarMargin, uiScale, setUIScale, isBackendOnline, refreshData };
};
