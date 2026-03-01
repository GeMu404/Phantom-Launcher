import React, { useState } from 'react';

interface SteamSyncProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    onCommandUpdate: (command: { text: string; desc: string } | null, onExecute?: () => void, progress?: number, isExecuting?: boolean, isReady?: boolean) => void;
    handleSyncSteamLibrary: (options: { includeSoftware: boolean; includeAdultOnly: boolean; quiet?: boolean }) => Promise<void>;
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

            {/* Diagonal Corners */}
            <div className="absolute top-0 h-[2.5px]" style={{
                left: 'calc(100% - 20.5px)', width: '29.5px', backgroundColor: color,
                transformOrigin: 'top left', transform: 'rotate(45deg)'
            }} />
            <div className="absolute left-0 h-[2.5px]" style={{
                top: 'calc(100% - 20.5px)', width: '29.5px', backgroundColor: color,
                transformOrigin: 'top left', transform: 'rotate(45deg)'
            }} />
        </div>
    );
};

const SteamSync: React.FC<SteamSyncProps> = ({ isActive, onActiveToggle, accentColor, onCommandUpdate, handleSyncSteamLibrary }) => {
    const [software, setSoftware] = useState(false);
    const [adult, setAdult] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    React.useEffect(() => {
        if (isActive) {
            onCommandUpdate(
                {
                    text: 'VALVE_SYNC_PROTOCOL',
                    desc: 'ESTA FUNCIÓN SINCRONIZARÁ TUS JUEGOS DE STEAM CON EL LANZADOR, PUEDES ELEGIR SI INCLUIR TAMBIÉN EL SOFTWARE Y CONTENIDO NO APROPIADO PARA TODAS LAS EDADES'
                },
                handleExecuteSync,
                0,
                isExecuting,
                true
            );
        }
    }, [isActive, isExecuting, software, adult]);

    const handleExecuteSync = async () => {
        if (isExecuting) return;
        setIsExecuting(true);

        // Progress Simulation for visual feedback on the badge
        let prog = 0;
        onCommandUpdate(
            { text: 'VALVE_SYNC_PROTOCOL', desc: 'VALVE_PROTOCOL_ST_001: INDEXING_REMOTE_ASSETS_AND_LICENSES' },
            undefined, 0, true, true
        );

        const interval = setInterval(() => {
            prog += 3 + Math.random() * 4;
            if (prog >= 98) {
                prog = 98;
                clearInterval(interval);
            }
            onCommandUpdate(
                { text: 'VALVE_SYNC_PROTOCOL', desc: 'VALVE_PROTOCOL_ST_001: INDEXING_REMOTE_ASSETS_AND_LICENSES' },
                undefined,
                prog,
                true,
                true
            );
        }, 60);

        try {
            await handleSyncSteamLibrary({ includeSoftware: software, includeAdultOnly: adult, quiet: true });
            clearInterval(interval);

            // 1. Force 100% progress immediately upon real sync finish
            onCommandUpdate(
                { text: 'VALVE_SYNC_PROTOCOL', desc: 'SYNC_PROTOCOL_COMPLETED: REGISTRY_UPDATED' },
                undefined,
                100,
                true,
                true
            );

            // 2. Hold 'EXECUTED' for 500ms before resetting
            setTimeout(() => {
                setIsExecuting(false);
                onActiveToggle(false);
                onCommandUpdate(null, undefined, 0, false, false); // Reset progress to 0 and close command HUD
            }, 800); // 800ms total (extra 300ms for transition feel)

        } catch (error) {
            clearInterval(interval);
            setIsExecuting(false);
            onCommandUpdate({ text: 'SYNC_ERROR', desc: 'ST_PROTOCOL_FAILURE: CHECK_CONNECTION' }, handleExecuteSync, 0, false, true);
        }
    };

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;

    const handleToggleActive = () => {
        if (isExecuting) return;
        const nextState = !isActive;
        onActiveToggle(nextState);
        if (!nextState) {
            onCommandUpdate(null, undefined, 0, false, false);
        }
    };

    return (
        <div ref={cardRef} className="w-full relative">
            {/* The Active Border Layer (Fully transparent center natively) */}
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
                            src="./res/external/steam.png"
                            alt="Steam"
                            className="w-14 h-14 object-contain opacity-90 transition-opacity"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                            VALVE_SYNC_PROTOCOL
                        </span>
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                            <span className="text-[8px] opacity-20 uppercase tracking-[0.2em] font-bold italic">
                                READY_FOR_UPLINK
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right: Sharp Action Buttons */}
                <div className="flex flex-col gap-1 min-w-[210px]" onClick={(e) => e.stopPropagation()}>
                    {isActive && (
                        <>
                            <button
                                onClick={() => !isExecuting && setSoftware(!software)}
                                disabled={isExecuting}
                                className={`px-4 py-1.5 transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${isExecuting ? 'opacity-50' : 'active:scale-95'}`}
                                style={{
                                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                                    backgroundColor: software ? accentColor : 'rgba(255,255,255,0.05)',
                                    color: software ? '#000' : `${accentColor}cc`,
                                    border: 'none'
                                }}
                            >
                                {software ? '[ SOFTWARE_INCLUDED ]' : 'INCLUDE_SOFTWARE'}
                            </button>
                            <button
                                onClick={() => !isExecuting && setAdult(!adult)}
                                disabled={isExecuting}
                                className={`px-4 py-1.5 transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${isExecuting ? 'opacity-50' : 'active:scale-95'}`}
                                style={{
                                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                                    backgroundColor: adult ? accentColor : 'rgba(255,255,255,0.05)',
                                    color: adult ? '#000' : `${accentColor}cc`,
                                    border: 'none'
                                }}
                            >
                                {adult ? '[ ADULT_ONLY_ON ]' : 'INCLUDE_ADULT_ONLY'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SteamSync;
