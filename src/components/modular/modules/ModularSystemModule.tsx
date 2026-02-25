
import React, { useRef } from 'react';
import Subsection from '../../management/Subsection';
import AssetInput from '../../AssetInput';
import CyberScrollbar from '../../CyberScrollbar';
import { useTranslation } from '../../../hooks/useTranslation';
import { Category } from '../../../types';
import { getContrastColor } from '../../../utils/colors';

interface ModularSystemModuleProps {
    activeAccent: string;
    allGamesCategory: Category;
    onUpdateCategories: React.Dispatch<React.SetStateAction<Category[]>>;
    taskbarMargin: number;
    onUpdateTaskbarMargin: (val: number) => void;
    uiScale: number;
    onUpdateUIScale: (val: number) => void;
    triggerFileBrowser: (target: string, type: 'exe' | 'image' | 'any') => void;
    onResolveAsset: (path: string | undefined) => string;
    handleSystemFormat: () => void;
    resolveColor: (raw: string) => string;
}

const PanicResetButton: React.FC<{ handleAction: () => void; t: any }> = ({ handleAction, t }) => {
    const [clicks, setClicks] = React.useState(0);
    const [isBreaking, setIsBreaking] = React.useState(false);

    const handleClick = () => {
        if (clicks < 3) {
            setClicks(prev => prev + 1);
            setIsBreaking(true);
            setTimeout(() => setIsBreaking(false), 200);
        } else {
            handleAction();
            setClicks(0);
            setIsBreaking(false);
        }
    };

    const glitchStyle = isBreaking ? {
        transform: `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`,
        filter: 'hue-rotate(90deg) contrast(150%)',
    } : {};

    const damageLevels = [
        'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]',
        'shadow-[0_0_30px_rgba(239,68,68,0.5)] border-red-500/80 scale-[0.99] text-red-400',
        'shadow-[0_0_50px_rgba(239,68,68,0.7)] border-red-400 scale-[0.98] rotate-[0.5deg] text-red-300 animate-pulse',
        'shadow-[0_0_80px_rgba(255,0,0,0.9)] border-red-300 scale-[0.95] -rotate-[1deg] text-white bg-red-600 animate-[ping_0.2s_infinite]'
    ];

    const messages = [
        t('system_tab.panic_factory_reset'),
        '[ ! CAUTION_SYSTEM_INTERRUPT ! ]',
        '[ !! KERNEL_PANIC_IMMUTABLE !! ]',
        '[ !!! VOID_PROTOCOL_ACTIVE !!! ]'
    ];

    return (
        <button
            onClick={handleClick}
            style={glitchStyle}
            className={`
                w-full py-4 bg-transparent font-bold text-[10px] uppercase tracking-[0.5em] border-2 transition-all active:scale-90 relative overflow-hidden
                ${damageLevels[clicks] || damageLevels[0]}
            `}
        >
            {messages[clicks] || messages[0]}
            {isBreaking && (
                <div className="absolute inset-0 bg-white/20 animate-pulse pointer-events-none"></div>
            )}
        </button>
    );
};

const ModularSystemModule: React.FC<ModularSystemModuleProps> = ({
    activeAccent, allGamesCategory, onUpdateCategories,
    taskbarMargin, onUpdateTaskbarMargin, uiScale, onUpdateUIScale, triggerFileBrowser, onResolveAsset, handleSystemFormat, resolveColor
}) => {
    const { t, language, setLanguage } = useTranslation();
    const [localScale, setLocalScale] = React.useState(uiScale);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setLocalScale(uiScale);
    }, [uiScale]);

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div ref={scrollContainerRef} className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10">
                <div className="flex flex-col gap-6 lg:gap-8">
                    {/* [CLEAN SHELL AREA] - AWAITING GUIDED MIGRATION */}
                    <div className="flex-1 flex items-center justify-center opacity-10 border-2 border-dashed border-white/10 h-[400px]">
                        <span className="text-[10px] uppercase tracking-[0.5em] font-black">
                            [ AWAITING_PIECE_MIGRATION_PROTOCOL ]
                        </span>
                    </div>
                </div>
            </div>
            <CyberScrollbar containerRef={scrollContainerRef} accentColor={activeAccent} />
        </div>
    );
};

export default ModularSystemModule;
