import { useMemo, useCallback } from 'react';
import { Category } from '../types';

const MONO_COLOR = '#888';

export const useColor = (categories: Category[]) => {
    const isMonochrome = useMemo(() => {
        const allCat = categories.find(c => c.id === 'all');
        return !!(allCat as any)?.monochromeModeEnabled;
    }, [categories]);

    const resolve = useCallback(
        (rawColor: string): string => (isMonochrome ? MONO_COLOR : rawColor),
        [isMonochrome]
    );

    return { resolve, isMonochrome };
};
