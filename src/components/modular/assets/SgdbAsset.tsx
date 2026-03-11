import React, { useState, useEffect, useRef, useCallback } from 'react';

const ConfigCardBorder = ({ color, isActive }: { color: string; isActive: boolean }) => {
    if (!isActive) return null;
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
            <div className="absolute top-0 left-0 h-[2px]" style={{ right: '20px', backgroundColor: color }} />
            <div className="absolute bottom-0 right-0 h-[2px]" style={{ left: '20px', backgroundColor: color }} />
            <div className="absolute top-[20px] bottom-0 right-0 w-[2px]" style={{ backgroundColor: color }} />
            <div className="absolute top-0 bottom-[20px] left-0 w-[2px]" style={{ backgroundColor: color }} />

            <svg className="absolute top-0 right-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
            <svg className="absolute bottom-0 left-0 w-[21px] h-[21px]" viewBox="0 0 21 21" fill="none">
                <line x1="0" y1="0" x2="21" y2="21" stroke={color} strokeWidth="2.5" />
            </svg>
        </div>
    );
};

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

    const toggleRef = useRef(() => onToggleSgdb(!sgdbEnabled));
    useEffect(() => { toggleRef.current = () => onToggleSgdb(!sgdbEnabled); }, [onToggleSgdb, sgdbEnabled]);
    const stableToggle = useCallback(() => toggleRef.current(), []);

    useEffect(() => {
        if (isActive && onCommandUpdate) {
            onCommandUpdate(
                {
                    text: `ASSET_SET_PROTOCOL : ${sgdbEnabled ? 'OFFLINE' : 'ONLINE'}`,
                    desc: 'ESTA CONEXIÓN PERMITE OBTENER PORTADAS, LOGOS Y FONDOS AUTOMÁTICAMENTE PARA TUS JUEGOS DESDE LA BASE DE DATOS DE STEAMGRIDDB.'
                },
                stableToggle,
                0,
                false,
                true
            );
        }
    }, [isActive, stableToggle, sgdbEnabled, onCommandUpdate]);

    const cardClip = `polygon(
        0 0, 
        calc(100% - 20px) 0, 
        100% 20px, 
        100% 100%, 
        20px 100%, 
        0 calc(100% - 20px)
    )`;

    const handleToggleActive = () => {
        onActiveToggle(!isActive);
    };

    return (
        <div className="w-full relative">
            <ConfigCardBorder color={accentColor} isActive={isActive} />

            {/* Main Interaction Card */}
            <div
                onClick={handleToggleActive}
                className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'justify-center' : ''} cursor-pointer`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: `${accentColor}26`,
                    minHeight: '100px'
                }}
            >
                {/* Header Row */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px] mb-4' : ''}`}>
                    <div className="flex items-center gap-[20px]">
                        <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-transform duration-500 ${isActive ? 'scale-110' : ''}`}>
                            <img
                                src="./res/external/sgdb.png"
                                className="w-14 h-14 object-contain opacity-90"
                                alt="SGDB"
                                onError={(e) => { e.currentTarget.src = './res/external/steam.png'; }}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                STEAMGRIDDB_SET_PROTOCOL
                            </span>
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${sgdbEnabled ? 'animate-pulse' : ''}`}
                                    style={{
                                        backgroundColor: sgdbEnabled ? accentColor : 'white',
                                        opacity: sgdbEnabled ? 1 : 0.2,
                                        boxShadow: sgdbEnabled ? `0 0 8px ${accentColor}` : 'none'
                                    }}
                                />
                                <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic transition-colors ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                                    {sgdbEnabled ? 'LINK_ESTABLISHED' : 'OFFLINE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expandable Content */}
                {isActive && (
                    <div className="flex flex-col gap-4 mt-6 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                            <span className="text-[7px] opacity-30 uppercase tracking-[0.2em] font-bold">AUTHENTICATION_VOORHEES</span>
                            <div className="flex gap-[3px] h-10">
                                <div className="flex items-center flex-1 min-w-0 px-3 bg-black/30"
                                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 8px 100%, 0 calc(100% - 8px))' }}>
                                    <input
                                        type="password"
                                        value={sgdbKey}
                                        onChange={(e) => onKeyUpdate(e.target.value)}
                                        placeholder="ENTER_SGDB_API_KEY"
                                        className="w-full bg-transparent border-none outline-none font-mono text-[9px] text-white/40 tracking-[0.1em] placeholder:opacity-20"
                                    />
                                </div>
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
    );
};

export default SgdbAsset;
