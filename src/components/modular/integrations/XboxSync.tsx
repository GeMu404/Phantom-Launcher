import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';

interface XboxSyncProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    onCommandUpdate: (
        command: { text: string; desc: string } | null,
        onExecute?: (() => void) | null,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean,
        _scrollProgress?: number | null,
        _showScrollMarker?: boolean | null,
        execStart?: (() => void) | null,
        execEnd?: (() => void) | null
    ) => void;
    handleSyncXboxLibrary: (options?: { quiet?: boolean; includeAssets?: boolean }) => Promise<void>;
    includeAssets: boolean;
    setIncludeAssets: (v: boolean) => void;
    sgdbEnabled?: boolean;
}

const SyncCardBorder = ({ color, isActive }: { color: string; isActive: boolean }) => {
    if (!isActive) return null;
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            {/* Straight Edges */}
            <div className="absolute top-0 left-0 h-[2px]" style={{ right: '20px', backgroundColor: color }} />
            <div className="absolute bottom-0 right-0 h-[2px]" style={{ left: '20px', backgroundColor: color }} />
            <div className="absolute top-[20px] bottom-0 right-0 w-[2px]" style={{ backgroundColor: color }} />
            <div className="absolute top-0 bottom-[20px] left-0 w-[2px]" style={{ backgroundColor: color }} />

            {/* Top-right diagonal corner */}
            <svg className="absolute top-0 right-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
            {/* Bottom-left diagonal corner */}
            <svg className="absolute bottom-0 left-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
        </div>
    );
};

const XboxSync: React.FC<XboxSyncProps> = ({ isActive, onActiveToggle, accentColor, onCommandUpdate, handleSyncXboxLibrary, includeAssets, setIncludeAssets, sgdbEnabled }) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    const [holdProgress, setHoldProgress] = useState(0);
    const holdTimerRef = useRef<any>(null);

    React.useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    const handleExecuteSync = useCallback(async () => {
        if (isExecuting) return;
        setIsExecuting(true);

        // Progress Simulation for visual feedback on the badge
        let prog = 0;
        onCommandUpdate(
            { text: t('xbox.command_sync'), desc: t('xbox.syncing') },
            undefined, 0, true, true
        );

        const interval = setInterval(() => {
            prog += 3 + Math.random() * 4;
            if (prog >= 98) {
                prog = 98;
                clearInterval(interval);
            }
            onCommandUpdate(
                { text: t('xbox.command_sync'), desc: t('xbox.syncing') },
                undefined,
                prog,
                true,
                true
            );
        }, 60);

        try {
            await handleSyncXboxLibrary({ quiet: false, includeAssets });
            clearInterval(interval);

            // 1. Force 100% progress immediately upon real sync finish
            onCommandUpdate(
                { text: t('xbox.command_sync'), desc: t('xbox.complete') },
                undefined,
                100,
                true,
                true
            );

            // 2. Hold 'EXECUTED' for 800ms before resetting
            setTimeout(() => {
                setIsExecuting(false);
                onActiveToggle(false);
            }, 800);

        } catch (error) {
            clearInterval(interval);
            setIsExecuting(false);
            onCommandUpdate({ text: 'SYNC_ERROR', desc: 'ST_PROTOCOL_FAILURE: CHECK_CONNECTION' }, handleExecuteSync, 0, false, true);
        }
    }, [isExecuting, onCommandUpdate, t, handleSyncXboxLibrary, includeAssets, onActiveToggle]);

    const handleHoldStart = useCallback(() => {
        if (isExecuting) return;
        setHoldProgress(0);
        const start = Date.now();
        const duration = 1000;
        holdTimerRef.current = setInterval(() => {
            const elapsed = Date.now() - start;
            const p = Math.min(100, (elapsed / duration) * 100);
            setHoldProgress(p);
            if (p >= 100) {
                clearInterval(holdTimerRef.current);
                handleExecuteSync();
                setHoldProgress(0);
            }
        }, 30);
    }, [isExecuting, handleExecuteSync]);

    const handleHoldEnd = useCallback(() => {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        setHoldProgress(0);
    }, []);

    const executeRef = useRef(handleExecuteSync);
    useEffect(() => { executeRef.current = handleExecuteSync; }, [handleExecuteSync]);

    const holdStartRef = useRef(handleHoldStart);
    const holdEndRef = useRef(handleHoldEnd);
    useEffect(() => { holdStartRef.current = handleHoldStart; }, [handleHoldStart]);
    useEffect(() => { holdEndRef.current = handleHoldEnd; }, [handleHoldEnd]);

    const stableStart = useCallback(() => holdStartRef.current(), []);
    const stableEnd = useCallback(() => holdEndRef.current(), []);

    useEffect(() => {
        return () => {
            if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        };
    }, []);

    React.useEffect(() => {
        if (isActive) {
            onCommandUpdate(
                {
                    text: 'STREAMS_SYNC_PROTOCOL',
                    desc: t('xbox.desc_sync')
                },
                null,
                holdProgress,
                isExecuting,
                true,
                null,
                null,
                stableStart,
                stableEnd
            );
        }
    }, [isActive, isExecuting, holdProgress, stableStart, stableEnd, onCommandUpdate, t]);

    const handleToggleActive = () => {
        if (isExecuting) return;
        onActiveToggle(!isActive);
    };

    // Industrial Bevel Path - Double notch (Top-Right and Bottom-Left)
    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;

    return (
        <div ref={cardRef} className="w-full relative">
            {/* The Active Border Layer */}
            <SyncCardBorder color={accentColor} isActive={isActive} />

            {/* Main Interaction Card */}
            <div
                onClick={handleToggleActive}
                className={`w-full flex items-center justify-between p-[20px] transition-all duration-300 relative ${isExecuting ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: `${accentColor}26`,
                    minHeight: '100px'
                }}
            >
                {/* Left: Protocol Identity */}
                <div className="flex items-center gap-[20px]">
                    <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-transform duration-500 ${isExecuting ? 'animate-pulse' : ''} ${isActive ? 'scale-110' : ''}`}>
                        <img
                            src="./res/external/xbox.png"
                            alt="Xbox"
                            className="w-14 h-14 object-contain opacity-90 transition-opacity"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                            {t('xbox.command_sync')}
                        </span>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                            <span className="text-[8px] opacity-20 uppercase tracking-[0.2em] font-bold italic">
                                READY_FOR_UPLINK
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Action Toggle */}
                <div className="flex flex-col items-end gap-1 min-w-[210px]" onClick={(e) => e.stopPropagation()}>
                    {isActive && sgdbEnabled && (
                        <button
                            onClick={() => !isExecuting && setIncludeAssets(!includeAssets)}
                            disabled={isExecuting}
                            className={`px-4 py-2 w-full transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${isExecuting ? 'opacity-50' : 'active:scale-95'}`}
                            style={{
                                clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                                backgroundColor: includeAssets ? accentColor : 'rgba(255,255,255,0.05)',
                                color: includeAssets ? '#000' : `${accentColor}cc`,
                                border: 'none'
                            }}
                        >
                            {isExecuting ? t('integrations.syncing') : (includeAssets ? t('integrations.fetch_assets_active') : t('integrations.fetch_assets_inactive'))}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default XboxSync;
