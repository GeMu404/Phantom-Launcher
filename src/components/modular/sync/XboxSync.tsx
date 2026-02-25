import React, { useState } from 'react';

interface XboxSyncProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    onCommandUpdate: (command: { text: string; desc: string } | null, onExecute?: () => void, progress?: number) => void;
    handleSyncXboxLibrary: (options?: { quiet?: boolean }) => Promise<void>;
}

const XboxSync: React.FC<XboxSyncProps> = ({ isActive, onActiveToggle, accentColor, onCommandUpdate, handleSyncXboxLibrary }) => {
    const [isExecuting, setIsExecuting] = useState(false);

    const handleExecuteSync = async () => {
        if (isExecuting) return;
        setIsExecuting(true);

        // Progress Simulation for visual feedback on the badge
        let prog = 0;
        onCommandUpdate(
            { text: 'XBOX_SYNC_PROTOCOL', desc: 'XBOX_LIVE_PROTOCOL_ST_002: AUTHENTICATING_AND_SYNCING_LICENSES' },
            undefined, 0
        );

        const interval = setInterval(() => {
            prog += 3 + Math.random() * 4;
            if (prog >= 98) {
                prog = 98;
                clearInterval(interval);
            }
            onCommandUpdate(
                { text: 'XBOX_SYNC_PROTOCOL', desc: 'XBOX_LIVE_PROTOCOL_ST_002: AUTHENTICATING_AND_SYNCING_LICENSES' },
                undefined,
                prog
            );
        }, 60);

        try {
            await handleSyncXboxLibrary({ quiet: true });
            clearInterval(interval);

            // 1. Force 100% progress immediately upon real sync finish
            onCommandUpdate(
                { text: 'XBOX_SYNC_PROTOCOL', desc: 'SYNC_PROTOCOL_COMPLETED: REGISTRY_UPDATED' },
                undefined,
                100
            );

            // 2. Hold 'EXECUTED' for 800ms before resetting
            setTimeout(() => {
                setIsExecuting(false);
                onActiveToggle(false);
                onCommandUpdate(null, undefined, 0);
            }, 800);

        } catch (error) {
            clearInterval(interval);
            setIsExecuting(false);
            onCommandUpdate({ text: 'SYNC_ERROR', desc: 'ST_PROTOCOL_FAILURE: CHECK_CONNECTION' }, handleExecuteSync, 0);
        }
    };

    const handleToggleActive = () => {
        if (isExecuting) return;
        const nextState = !isActive;
        onActiveToggle(nextState);
        if (nextState) {
            onCommandUpdate(
                {
                    text: 'XBOX_SYNC_PROTOCOL',
                    desc: 'ESTA FUNCIÓN SINCRONIZARÁ TUS JUEGOS ADQUIRIDOS DESDE LA TIENDA DE XBOX O XBOX GAMEPASS CON EL LANZADOR'
                },
                handleExecuteSync,
                0
            );
        } else {
            onCommandUpdate(null, undefined, 0);
        }
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
        <div className="w-full">
            {/* Main Interaction Card */}
            <div
                onClick={handleToggleActive}
                className={`w-full transition-all duration-300 group relative ${isExecuting ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                style={{
                    backgroundColor: isActive ? accentColor : 'transparent', // This is the outline color
                    clipPath: cardClip,
                    padding: '2px'
                }}
            >
                {/* Inner Body - Integrated with sidebar background depth */}
                <div
                    className="w-full h-[100px] flex items-center justify-between p-[20px] transition-all duration-300 relative"
                    style={{
                        clipPath: cardClip,
                        // Layered background: Opaque masking base when active vs transparent base
                        background: isActive ? 'rgba(10, 10, 10, 0.85)' : `${accentColor}26`,
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
                                XBOX_SYNC_PROTOCOL
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                                <span className="text-[8px] opacity-20 uppercase tracking-[0.2em] font-bold italic">
                                    READY_FOR_UPLINK
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Empty for symmetry or other usage */}
                    <div className="flex flex-col items-end gap-1 opacity-0">
                        {/* Redundant Badge Removed */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default XboxSync;
