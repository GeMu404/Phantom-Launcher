import { useCallback } from 'react';

// Shared instance to prevent AudioContext exhaustion
let sharedCtx: AudioContext | null = null;

export const useAudio = () => {
    const playSfx = useCallback((type: 'move' | 'select' | 'launch' | 'cancel' | 'close') => {
        const frequencies: { [key: string]: number } = { move: 320, select: 400, launch: 600, cancel: 150, close: 200 };
        try {
            if (!sharedCtx) {
                sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (sharedCtx.state === 'suspended') {
                sharedCtx.resume();
            }

            const osc = sharedCtx.createOscillator();
            const gain = sharedCtx.createGain();
            osc.type = 'sine';

            const startTime = sharedCtx.currentTime;

            const freq = frequencies[type] || 440; // Fallback to 440Hz if type is unknown

            osc.frequency.setValueAtTime(freq, startTime);
            osc.frequency.exponentialRampToValueAtTime(freq * (type === 'cancel' ? 0.8 : 0.3), startTime + 0.1);

            gain.gain.setValueAtTime(0.01, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

            osc.connect(gain);
            gain.connect(sharedCtx.destination);

            osc.start(startTime);
            osc.stop(startTime + 0.1);
        } catch (e) {
            console.warn("AudioContext playback error:", e);
        }
    }, []);

    return { playSfx };
};
