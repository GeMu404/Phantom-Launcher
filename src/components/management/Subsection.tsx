import React, { useState } from 'react';

interface SubsectionProps {
    title: string;
    children?: React.ReactNode;
    onSync?: () => void | Promise<any>;
    syncLabel?: string;
    accentColor?: string;
}

const Subsection = React.memo(({ title, children, onSync, syncLabel = "COMMIT_CHANGES", accentColor = "#fff" }: SubsectionProps) => {
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done'>('idle');

    const handleSync = async () => {
        if (!onSync || syncStatus !== 'idle') return;
        setSyncStatus('syncing');

        try {
            await onSync();
            await new Promise(r => setTimeout(r, 600));
            setSyncStatus('done');
            setTimeout(() => setSyncStatus('idle'), 2000);
        } catch (e) {
            setSyncStatus('idle');
        }
    };

    // Solid geometric cut paths
    const polyOuter = 'polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px))';
    const polyInner = 'polygon(0 0, calc(100% - 13.5px) 0, 100% 13.5px, 100% 100%, 13.5px 100%, 0 calc(100% - 13.5px))';

    return (
        <div className="relative group transition-all" style={{ clipPath: polyOuter, background: `${accentColor}44`, padding: '2px', contain: 'layout paint' }}>
            <div className="flex flex-col gap-4 p-4 lg:p-5 bg-black/95 relative" style={{ clipPath: polyInner }}>
                <div className="flex justify-between items-center mb-1 relative z-10 border-b border-white/5 pb-3">
                    <h4 className="text-[10px] lg:text-[12px] font-bold uppercase tracking-[0.5em] text-white/90" style={{ textShadow: `0 0 15px ${accentColor}88` }}>{title}</h4>
                    {onSync && (
                        <button
                            onClick={handleSync}
                            disabled={syncStatus !== 'idle'}
                            className={`px-6 py-2 text-[9px] font-bold uppercase tracking-[0.2em] transition-all border-2 active:scale-95 ${syncStatus === 'done' ? 'bg-emerald-500 border-emerald-400 text-white' :
                                    syncStatus === 'syncing' ? 'bg-white/10 border-white/20 text-white/40 cursor-wait' :
                                        `bg-transparent border-[${accentColor}] text-[${accentColor}] hover:bg-[${accentColor}] hover:text-black`
                                }`}
                            style={{
                                borderColor: syncStatus === 'idle' ? accentColor : undefined,
                                color: syncStatus === 'idle' ? accentColor : undefined,
                                backgroundColor: syncStatus === 'idle' ? 'transparent' : undefined
                            }}
                            onMouseEnter={(e) => {
                                if (syncStatus === 'idle') {
                                    e.currentTarget.style.backgroundColor = accentColor;
                                    e.currentTarget.style.color = '#000';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (syncStatus === 'idle') {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = accentColor;
                                }
                            }}
                        >
                            {syncStatus === 'done' ? 'UNIT_SAVED' : syncStatus === 'syncing' ? '...' : syncLabel}
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-y-6 gap-x-12 relative z-10">
                    {children}
                </div>
            </div>
        </div>
    );
});

export default Subsection;
