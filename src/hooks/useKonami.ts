import { useState, useEffect, useRef, useCallback } from 'react';

export function useKonami(onUnlock: () => void, playSfx: (sound: string) => void) {
    const [isSecretUnlocked, setIsSecretUnlocked] = useState(false);
    const konamiRef = useRef<string[]>([]);
    const sequence = useRef(['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']);

    const unlock = useCallback(() => {
        setIsSecretUnlocked(true);
        onUnlock();
        playSfx('select');
    }, [onUnlock, playSfx]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isSecretUnlocked) return;

            const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            konamiRef.current = [...konamiRef.current, key].slice(-sequence.current.length);

            if (JSON.stringify(konamiRef.current) === JSON.stringify(sequence.current)) {
                unlock();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSecretUnlocked, unlock]);

    return { isSecretUnlocked, setIsSecretUnlocked };
}
