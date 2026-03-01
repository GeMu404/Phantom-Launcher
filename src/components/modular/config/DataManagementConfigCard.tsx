import React, { useState, useRef, useEffect } from 'react';
import { Category } from '../../../types';

interface DataManagementConfigCardProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    onCommandUpdate: (
        command: { text: string; desc: string } | null,
        onExecute?: () => void,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean,
        scrollProgress?: number | (() => void),
        showScrollMarker?: boolean | (() => void),
        execStart?: () => void,
        execEnd?: () => void
    ) => void;
    allGamesCategory: Category;
    onUpdateCategories: (updater: (prev: Category[]) => Category[]) => void;
}

const ConfigCardBorder = ({ color, isActive }: { color: string; isActive: boolean }) => {
    if (!isActive) return null;
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            <div className="absolute top-0 left-0 h-[2px]" style={{ right: '20px', backgroundColor: color }} />
            <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: color }} />
            <div className="absolute top-[20px] bottom-0 right-0 w-[2px]" style={{ backgroundColor: color }} />
            <div className="absolute top-0 bottom-0 left-0 w-[2px]" style={{ backgroundColor: color }} />

            <div className="absolute top-0 h-[2.5px]" style={{
                left: 'calc(100% - 20.5px)', width: '29.5px', backgroundColor: color,
                transformOrigin: 'top left', transform: 'rotate(45deg)'
            }} />
        </div>
    );
};

const ModeButton = ({
    label,
    isActive,
    onClick,
    accentColor,
    disabled,
    danger = false
}: {
    label: string,
    isActive: boolean,
    onClick: () => void,
    accentColor: string,
    disabled: boolean,
    danger?: boolean
}) => {
    const baseColor = danger ? '#ff3333' : accentColor;
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`px-4 py-3 w-full transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${disabled ? 'opacity-50' : 'active:scale-95'} ${danger && isActive ? 'animate-pulse' : ''}`}
            style={{
                clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                backgroundColor: isActive ? baseColor : 'rgba(255,255,255,0.05)',
                color: isActive ? '#000' : `${baseColor}cc`,
                border: 'none',
                minHeight: '40px'
            }}
        >
            {isActive ? `[ ${label}_ACTIVE ]` : `[ ${label} ]`}
        </button>
    );
};

const DataManagementConfigCard: React.FC<DataManagementConfigCardProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    onCommandUpdate,
    allGamesCategory,
    onUpdateCategories
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [selectedAction, setSelectedAction] = useState<'none' | 'restart' | 'autodestruct'>('none');
    const [holdProgress, setHoldProgress] = useState(0);

    const holdTimerRef = useRef<number | null>(null);
    const holdIntervalRef = useRef<number | null>(null);
    const isHoldingRef = useRef(false);

    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isActive) {
            setSelectedAction('none');
            setHoldProgress(0);
        }
    }, [isActive]);

    useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    // Handle Execute Action Binding
    useEffect(() => {
        if (isActive) {
            if (selectedAction === 'none') {
                onCommandUpdate(
                    {
                        text: 'DATA_MANAGEMENT_PROTOCOL',
                        desc: 'AWAITING_MAINTENANCE_DIRECTIVE. SELECT_A_PROTOCOL_TO_CONTINUE.'
                    },
                    null, 0, false, false, null, null,
                    null, null
                );
                onCommandUpdate(
                    {
                        text: 'RESTART_APP_PROTOCOL',
                        desc: 'THIS_ACTION_WILL_REBOOT_THE_HUD_AND_RELOAD_SERVICES.'
                    },
                    handleExecuteRestart,
                    0, isExecuting, true, null, null,
                    null, null
                );
            } else if (selectedAction === 'autodestruct') {
                onCommandUpdate(
                    {
                        text: 'PANIC_FACTORY_RESET',
                        desc: 'WARNING:_CRITICAL_ACTION._HOLD_FOR_5_SECONDS_TO_WIPE_ALL_DATA.'
                    },
                    null, // No direct click, must hold
                    holdProgress, isExecuting, true, null, null,
                    handleExecuteStart,
                    handleExecuteEnd
                );
            }
        }
    }, [isActive, isExecuting, selectedAction, holdProgress]);

    // Cleanup on unmount or Deactivation
    useEffect(() => {
        if (!isActive) {
            isHoldingRef.current = false;
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        }
        return () => {
            isHoldingRef.current = false;
            if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
            if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        };
    }, [isActive]);

    // Restart Handling
    const handleExecuteRestart = () => {
        if (isExecuting || selectedAction !== 'restart') return;
        setIsExecuting(true);
        let prog = 0;

        onCommandUpdate({ text: 'REBOOT_SEQUENCE_INITIATED', desc: 'FLUSHING_MEMORY_BUFFERS' }, undefined, 0, true, true);
        const interval = setInterval(() => {
            prog += 20;
            if (prog >= 100) {
                prog = 100;
                clearInterval(interval);
                window.location.reload();
            }
            onCommandUpdate({ text: 'REBOOT_SEQUENCE_INITIATED', desc: 'RELOADING_HUD_COMPONENTS' }, undefined, prog, true, true);
        }, 100);
    };

    // Autodestruct Handling
    const handleExecuteStart = () => {
        if (isExecuting || selectedAction !== 'autodestruct') return;
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        isHoldingRef.current = true;
        setHoldProgress(0);

        let elapsed = 0;
        const totalHoldTime = 5000;
        const intervalTime = 50;

        holdIntervalRef.current = window.setInterval(() => {
            if (!isHoldingRef.current) {
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
                return;
            }
            elapsed += intervalTime;
            const percentage = Math.min((elapsed / totalHoldTime) * 100, 100);
            setHoldProgress(percentage);

            if (elapsed >= totalHoldTime) {
                isHoldingRef.current = false;
                if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
                executeWipeProtocol();
            }
        }, intervalTime);
    };

    const handleExecuteEnd = () => {
        isHoldingRef.current = false;
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
        if (!isExecuting && holdProgress < 100) {
            setHoldProgress(0); // Cancelled
        }
    };

    const executeWipeProtocol = async () => {
        setIsExecuting(true);
        setHoldProgress(100);
        onCommandUpdate({ text: 'WIPE_PROTOCOL_ENGAGED', desc: 'PURGING_ALL_RECORDS...' }, undefined, 100, true, true);

        try {
            const res = await fetch('/api/assets/wipe', { method: 'POST' });
            if (!res.ok) throw new Error('Wipe failed');
            onCommandUpdate({ text: 'WIPE_COMPLETE', desc: 'SYSTEM_HAS_BEEN_RESET. REBOOTING_CORE...' }, undefined, 100, true, true);
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (e) {
            console.error('Wipe error', e);
            onCommandUpdate({ text: 'WIPE_FAILED', desc: 'ERROR_DURING_PURGE. ABORTED.' }, undefined, 0, false, false);
            setIsExecuting(false);
            setHoldProgress(0);
        }
    };

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        0 100%
    )`;

    const handleToggleActive = () => {
        if (isExecuting) return;
        const nextState = !isActive;
        onActiveToggle(nextState);
        if (!nextState) {
            onCommandUpdate(null, null, 0, false, false, null, null, null, null);
            setSelectedAction('none');
        }
    };

    return (
        <div ref={cardRef} className="w-full relative">
            <ConfigCardBorder color={selectedAction === 'autodestruct' ? '#ff3333' : accentColor} isActive={isActive} />

            <div
                onClick={handleToggleActive}
                className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'justify-center' : ''} ${isExecuting ? 'cursor-wait opacity-80' : 'cursor-pointer'} ${selectedAction === 'autodestruct' && isHoldingRef.current ? 'animate-pulse' : ''}`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: selectedAction === 'autodestruct' ? (holdProgress > 0 ? '#ff000022' : '#ff00000a') : `${accentColor}1A`,
                    minHeight: '100px'
                }}
            >
                {/* Header Row */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px] mb-4' : ''}`}>
                    <div className="flex items-center gap-[20px]">
                        <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-all duration-500 rounded-full border bg-black/40 ${selectedAction === 'autodestruct' ? 'border-red-500/50' : 'border-white/10'} ${isExecuting || (selectedAction === 'autodestruct' && holdProgress > 0) ? 'animate-pulse scale-110' : ''} ${isActive ? 'scale-110' : ''}`}>
                            <img
                                src="./res/ui/data.png"
                                alt="Data Management"
                                className={`w-10 h-10 object-contain opacity-90 transition-opacity ${selectedAction === 'autodestruct' ? 'hue-rotate-180 brightness-150 saturate-200' : ''}`}
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${selectedAction === 'autodestruct' ? 'text-red-500' : isActive ? 'text-white' : 'text-white/40'}`}>
                                DATA_MANAGEMENT_PROTOCOL
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedAction === 'autodestruct' ? '#ff3333' : isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                                <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic truncate max-w-[200px] transition-colors ${selectedAction === 'autodestruct' ? 'text-red-500/80 animate-pulse' : isActive ? 'text-white/60' : 'text-white/20'}`}>
                                    {isActive ? (selectedAction === 'autodestruct' && holdProgress > 0 ? 'WARNING_DELETION_IMMINENT' : selectedAction === 'autodestruct' ? 'HAZARD_LEVEL_MAXIMUM' : 'ACTIVE_MAINTENANCE_BAY') : 'STANDBY_MODE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Config Panel Content */}
                {isActive && (
                    <div className="flex flex-col gap-6 mt-4 pointer-events-auto" onClick={(e) => e.stopPropagation()}>

                        {/* Selected warning text for autodestruct */}
                        {selectedAction === 'autodestruct' && (
                            <div className="border border-red-500/30 bg-red-900/10 p-4 -mt-2">
                                <p className="text-[9px] text-red-400 font-['Space_Mono'] uppercase tracking-widest leading-relaxed">
                                    <span className="font-bold text-red-500">[!] WARNING:</span> SYSTEM-WIDE FACTORY RESET WILL TERMINATE ALL NODE REGISTRIES, CUSTOM IDENTIFIERS, AND LOCAL CONFIGURATIONS. THIS ACTION IS ABSOLUTE AND IRREVERSIBLE.
                                </p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <ModeButton
                                label="RESTART_APP"
                                isActive={selectedAction === 'restart'}
                                onClick={() => setSelectedAction('restart')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                            />

                            <ModeButton
                                label="AUTODESTRUCTION"
                                isActive={selectedAction === 'autodestruct'}
                                onClick={() => setSelectedAction('autodestruct')}
                                accentColor={accentColor}
                                disabled={isExecuting}
                                danger={true}
                            />
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default DataManagementConfigCard;
