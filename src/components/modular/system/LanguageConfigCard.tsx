import React, { useState, useRef, useEffect, useCallback } from 'react';

interface LanguageConfigCardProps {
    isActive: boolean;
    onActiveToggle: (active: boolean) => void;
    accentColor: string;
    onCommandUpdate: (
        command: { text: string; desc: string } | null,
        onExecute?: () => void,
        progress?: number,
        isExecuting?: boolean,
        isReady?: boolean
    ) => void;
    currentLanguage: string;
    setLanguage: (lang: string) => void;
    cardTransparencyEnabled: boolean;
    outerGlowEnabled: boolean;
}

const ConfigCardBorder = ({ color, isActive, outerGlowEnabled }: { color: string; isActive: boolean; outerGlowEnabled: boolean }) => {
    if (!isActive) return null;
    const glowStyle = outerGlowEnabled ? { filter: `drop-shadow(0 0 6px ${color})`, boxShadow: `0 0 10px ${color}33` } : {};
    return (
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10, ...glowStyle }}>
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

const LanguageConfigCard: React.FC<LanguageConfigCardProps> = ({
    isActive,
    onActiveToggle,
    accentColor,
    onCommandUpdate,
    currentLanguage,
    setLanguage,
    cardTransparencyEnabled,
    outerGlowEnabled
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [pendingLanguage, setPendingLanguage] = useState(currentLanguage);
    const cardRef = useRef<HTMLDivElement>(null);

    // Sync from props
    useEffect(() => {
        if (!isActive) {
            setPendingLanguage(currentLanguage);
        }
    }, [currentLanguage, isActive]);

    useEffect(() => {
        if (isActive && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 300);
        }
    }, [isActive]);

    const handleExecute = () => {
        if (isExecuting) return;
        setIsExecuting(true);

        let prog = 0;
        onCommandUpdate(
            { text: 'LANGUAGE_SET_PROTOCOL', desc: 'UPDATING_ROOT_LANGUAGE_DICTIONARIES' },
            undefined, 0, true, true
        );

        const interval = setInterval(() => {
            prog += 5 + Math.random() * 5;
            if (prog >= 98) {
                prog = 98;
                clearInterval(interval);
            }
            onCommandUpdate(
                { text: 'LANGUAGE_SET_PROTOCOL', desc: 'RELOADING_INTERFACE_MODULES' },
                undefined,
                prog,
                true,
                true
            );
        }, 30);

        setTimeout(() => {
            clearInterval(interval);
            setLanguage(pendingLanguage);

            onCommandUpdate(
                { text: 'LANGUAGE_SET_PROTOCOL', desc: 'LANGUAGE_SUCCESSFULLY_UPDATED' },
                undefined,
                100,
                true,
                true
            );

            setTimeout(() => {
                setIsExecuting(false);
                onActiveToggle(false);
            }, 800);
        }, 600);
    };

    const executeRef = useRef(handleExecute);
    useEffect(() => { executeRef.current = handleExecute; }, [handleExecute]);
    const stableExecute = useCallback(() => executeRef.current(), []);

    useEffect(() => {
        if (isActive) {
            // Re-evaluate if it's "ready" based on if pending is different, or maybe always ready
            onCommandUpdate(
                {
                    text: 'LANGUAGE_SET_PROTOCOL',
                    desc: 'THIS PROTOCOL WILL RECONFIGURE THE ROOT SYSTEM LANGUAGE AND RE-INITIALIZE THE INTERFACE.'
                },
                stableExecute,
                0,
                isExecuting,
                true
            );
        }
    }, [isActive, isExecuting, stableExecute, onCommandUpdate]);

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
            setPendingLanguage(currentLanguage); // reset
        }
    };

    return (
        <div ref={cardRef} className="w-full relative">
            <ConfigCardBorder color={accentColor} isActive={isActive} outerGlowEnabled={outerGlowEnabled} />

            <div
                onClick={handleToggleActive}
                className={`w-full flex flex-col p-[20px] transition-all duration-300 relative overflow-hidden ${!isActive ? 'justify-center' : ''} ${isExecuting ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                style={{
                    clipPath: cardClip,
                    backgroundColor: cardTransparencyEnabled ? `${accentColor}1F` : `${accentColor}26`,
                    minHeight: '100px'
                }}
            >
                {/* Header Row */}
                <div className={`flex items-center justify-between w-full shrink-0 transition-all ${isActive ? 'h-[50px]' : ''}`}>
                    <div className="flex items-center gap-[20px]">
                        <div className={`w-16 h-16 flex items-center justify-center shrink-0 transition-transform duration-500 ${isExecuting ? 'animate-pulse' : ''} ${isActive ? 'scale-110' : ''}`}>
                            <img
                                src="./res/ui/lang.png"
                                alt="Language"
                                className="w-14 h-14 object-contain opacity-90 transition-opacity"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <span className={`text-[12px] font-black tracking-[0.2em] uppercase transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                                LANGUAGE_SET_PROTOCOL
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? accentColor : 'white', opacity: isActive ? 1 : 0.3 }}></div>
                                <span className={`text-[8px] uppercase tracking-[0.2em] font-bold italic truncate max-w-[200px] transition-colors ${isActive ? 'text-white/60' : 'text-white/20'}`}>
                                    {isActive ? 'READY_FOR_EXECUTION' : 'STANDBY_MODE'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Config Panel Content */}
                {isActive && (
                    <div className="flex flex-col gap-4 mt-6 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[7px] font-black tracking-[0.2em] opacity-30 px-2 uppercase text-white/50">SYSTEM_LANGUAGE_PREFERENCE</span>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => !isExecuting && setPendingLanguage('en')}
                                disabled={isExecuting}
                                className={`px-4 py-3 w-full transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${isExecuting ? 'opacity-50' : 'active:scale-95'}`}
                                style={{
                                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                                    backgroundColor: pendingLanguage === 'en' ? accentColor : 'rgba(255,255,255,0.05)',
                                    color: pendingLanguage === 'en' ? '#000' : `${accentColor}cc`,
                                    border: 'none'
                                }}
                            >
                                {pendingLanguage === 'en' ? '[ ENGLISH_ACTIVE ]' : '[ ENGLISH ]'}
                            </button>
                            <button
                                onClick={() => !isExecuting && setPendingLanguage('es')}
                                disabled={isExecuting}
                                className={`px-4 py-3 w-full transition-all text-[9px] font-bold tracking-[0.2em] uppercase text-center relative overflow-hidden ${isExecuting ? 'opacity-50' : 'active:scale-95'}`}
                                style={{
                                    clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
                                    backgroundColor: pendingLanguage === 'es' ? accentColor : 'rgba(255,255,255,0.05)',
                                    color: pendingLanguage === 'es' ? '#000' : `${accentColor}cc`,
                                    border: 'none'
                                }}
                            >
                                {pendingLanguage === 'es' ? '[ ESPAÑOL_ACTIVE ]' : '[ ESPAÑOL ]'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LanguageConfigCard;
