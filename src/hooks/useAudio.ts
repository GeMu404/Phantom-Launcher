import { useCallback } from 'react';

export const useAudio = () => {
    const playSfx = useCallback((type: 'move' | 'select' | 'launch' | 'cancel') => {
        const frequencies: { [key: string]: number } = { move: 320, select: 400, launch: 600, cancel: 150 };
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequencies[type], ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(frequencies[type] * (type === 'cancel' ? 0.8 : 0.3), ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.01, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) { }
    }, []);

    return { playSfx };
};
