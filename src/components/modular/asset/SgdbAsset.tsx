import React, { useState, useEffect } from 'react';

interface SgdbAssetProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    sgdbKey: string;
    onKeyUpdate: (key: string) => void;
    sgdbEnabled: boolean;
    onToggleSgdb: (enabled: boolean) => void;
    onCommandUpdate?: (
        command: { text: string; desc: string } | null,
        onExecute?: () => void,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean
    ) => void;
}

const SgdbAsset: React.FC<SgdbAssetProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    sgdbKey,
    onKeyUpdate,
    sgdbEnabled,
    onToggleSgdb,
    onCommandUpdate
}) => {
    const isReady = !!sgdbKey.trim();

    useEffect(() => {
        if (isActive && onCommandUpdate) {
            onCommandUpdate(
                {
                    text: `STEAMGRIDDB_PROTOCOL : ${sgdbEnabled ? 'DEACTIVATE' : 'ACTIVATE'}`,
                    desc: 'ESTA CONEXIÓN PERMITE OBTENER PORTADAS, LOGOS Y FONDOS AUTOMÁTICAMENTE PARA TUS JUEGOS DESDE LA BASE DE DATOS DE STEAMGRIDDB.'
                },
                () => onToggleSgdb(!sgdbEnabled),
                0,
                false,
                isReady
            );
        }
    }, [isActive, sgdbKey, isReady, sgdbEnabled, onToggleSgdb]);

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;

    const handleToggleActive = () => {
        const nextState = !isActive;
        onActiveToggle(nextState);
        if (!nextState) {
            onCommandUpdate(null, undefined, 0, false, false);
        }
    };

    return (
        <div className="w-full">
            {/* Main Interaction Card */}
            <div
                onClick={handleToggleActive}
                className="w-full transition-all duration-300 group relative cursor-pointer"
                style={{
                    backgroundColor: isActive ? accentColor : 'transparent',
                    clipPath: cardClip,
                    padding: '2px'
                }}
            >
                {/* Inner Body */}
                <div
                    className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'h-[100px] justify-center' : ''}`}
                    style={{
                        clipPath: cardClip,
                        background: isActive ? 'rgba(10, 10, 10, 0.85)' : `${accentColor}26`,
                    }}
                >
                    {/* Header Row */}
                    <div className="flex items-center justify-between w-full shrink-0">
                        {/* Left Side: Icon + Title/Status */}
                        <div className="flex items-center gap-[20px]">
                            <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-transform duration-500 ${isActive ? 'scale-110' : ''}`}>
                                <img
                                    src="./res/external/sgdb.png"
                                    className="w-14 h-14 object-contain opacity-90"
                                    alt="SGDB"
                                    onError={(e) => { e.currentTarget.src = './res/external/steam.png'; }} // Fallback if icon missing
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                    {isActive ? `STEAMGRIDDB_PROTOCOL : ${sgdbEnabled ? 'DEACTIVATE' : 'ACTIVATE'}` : 'STEAMGRIDDB_PROTOCOL'}
                                </span>
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${sgdbEnabled ? 'animate-pulse' : ''}`}
                                        style={{
                                            backgroundColor: sgdbEnabled ? '#00ff00' : 'white',
                                            opacity: sgdbEnabled ? 1 : 0.2,
                                            boxShadow: sgdbEnabled ? '0 0 8px #00ff00' : 'none'
                                        }}
                                    />
                                    <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic transition-colors ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                                        {sgdbEnabled ? 'LINK_ESTABLISHED' : 'OFFLINE'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Status Indicator Area (Empty) */}
                        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                            {/* The "DEACTIVATED" badge was here, now removed per user request */}
                        </div>
                    </div>

                    {/* Expandable Content */}
                    {isActive && (
                        <div className="flex flex-col gap-4 mt-6 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col gap-2">
                                <span className="text-[7px] font-black font-['Space_Mono'] uppercase tracking-[0.2em] opacity-30 ml-2">AUTHENTICATION_VOORHEES</span>
                                <div className="flex bg-black/40 border border-white/5 px-4 h-12 items-center overflow-hidden"
                                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}>
                                    <input
                                        type="password"
                                        value={sgdbKey}
                                        onChange={(e) => onKeyUpdate(e.target.value)}
                                        placeholder="ENTER_SGDB_API_KEY"
                                        className="w-full bg-transparent border-none outline-none font-['Space_Mono'] text-[11px] text-white tracking-[0.1em] placeholder:opacity-20"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mt-2 px-2">
                                <div className="w-1 h-1 bg-white/20 rotate-45"></div>
                                <span className="text-[7px] text-white/30 uppercase tracking-[0.1em]">
                                    SECURE_ENCRYPTION_ENABLED // STORAGE: LOCAL_VAULT
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SgdbAsset;
