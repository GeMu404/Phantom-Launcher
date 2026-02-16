import { useState, useEffect } from 'react';
import { Category } from '../types';
import { CATEGORIES as INITIAL_CATEGORIES } from '../constants';

export const usePersistence = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [taskbarMargin, setTaskbarMargin] = useState<number>(0);
    const [isBackendOnline, setIsBackendOnline] = useState<boolean | 'checking'>('checking');

    // Initial Load
    useEffect(() => {
        const loadData = async () => {
            try {
                const response = await fetch('/api/data');
                if (response.ok) {
                    const data = await response.json();
                    // data is now specifically the CATEGORIES array from the server
                    if (data && Array.isArray(data) && data.length > 0) {
                        setCategories(data);
                    } else {
                        setCategories(INITIAL_CATEGORIES);
                    }
                }
            } catch (e) {
                console.error("Backend unreachable", e);
                setCategories(INITIAL_CATEGORIES);
            } finally {
                setIsDataLoaded(true);
            }
        };

        const loadSettings = () => {
            const margin = localStorage.getItem('phantom_launcher_margin');
            if (margin) setTaskbarMargin(parseInt(margin, 10));
        };

        loadData();
        loadSettings();
    }, []);

    // Sync Change to Backend
    useEffect(() => {
        if (!isDataLoaded) return;

        const saveData = async () => {
            try {
                await fetch('/api/data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(categories)
                });
            } catch (e) { console.error("Sync failed", e); }
        };

        const timeout = setTimeout(saveData, 500); // Shorter debounce for snappier feel
        return () => {
            // DO NOT use clearTimeout(timeout) here if we want to ensure last change sticks on F5
            // Actually, for immediate persistence on F5, we should avoid cancellation or use a beacon
            // But browsers usually cancel pending fetches on refresh. 
            // The best way is to have shorter debounce and maybe a "beforeunload" listener for emergency sync.
            clearTimeout(timeout);
            saveData(); // Final sync on unmount to catch the last change!
        };
    }, [categories, isDataLoaded]);

    // Sync Margin
    useEffect(() => {
        localStorage.setItem('phantom_launcher_margin', taskbarMargin.toString());
    }, [taskbarMargin]);

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

    return { categories, setCategories, isDataLoaded, taskbarMargin, setTaskbarMargin, isBackendOnline };
};
