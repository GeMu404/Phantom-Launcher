
import React from 'react';
import { APP_VERSION } from '../../constants';

interface ModularHeaderProps {
    title: string;
    subtitle?: string;
    accentColor: string;
    onClose: () => void;
    closeLabel?: string;
    t: (key: string) => string;
    style?: React.CSSProperties;
}

const ModularHeader: React.FC<ModularHeaderProps> = ({
    title,
    subtitle = `SYSTEM://PHANTOM_SHELL_V${APP_VERSION}.PROTO`,
    accentColor,
    onClose,
    closeLabel,
    t,
    style
}) => {
    return (
        <div
            className="flex justify-between items-center pl-10 pr-10 h-[100px] bg-transparent shrink-0 relative z-[150] border-b-2 border-white/[0.08]"
            style={style}
        >
            {/* Removed middle line */}

            <div className="flex flex-col gap-1.5 min-w-0 relative z-10">
                <h2 className="font-['Press_Start_2P'] text-[10px] uppercase tracking-tighter truncate" style={{ color: accentColor }}>
                    [ {title} ]
                </h2>
                <span className="text-[7px] font-['Space_Mono'] opacity-60 uppercase tracking-[0.4em] text-white truncate">
                    {subtitle}
                </span>
            </div>

            <button
                onClick={onClose}
                className="px-8 h-[40px] border-2 transition-all active:scale-95 hover:bg-white/5 active:bg-white/10 shrink-0 relative z-10"
                style={{
                    borderColor: accentColor,
                    backgroundColor: 'rgba(0,0,0,0.5)'
                }}>
                <span className="font-black text-[9px] uppercase tracking-[0.4em]" style={{ color: accentColor }}>
                    {closeLabel || t('nav.disconnect')}
                </span>
            </button>
        </div>
    );
};

export default ModularHeader;
