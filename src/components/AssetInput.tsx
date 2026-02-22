import React from 'react';
import { getContrastColor } from '../utils/colors';

interface AssetInputProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    triggerFileBrowser: (t: string, type: 'icon' | 'banner' | 'logo' | 'exe' | 'wallpaper') => void;
    target: string;
    previewType: 'cover' | 'banner' | 'logo' | 'icon' | 'wallpaper';
    accentColor?: string;
    onResolveAsset: (path: string | undefined) => string;
    sgdbEnabled?: boolean;
    onCloudSearch?: () => void;
}

const AssetInput: React.FC<AssetInputProps> = React.memo(({
    label, value, onChange, triggerFileBrowser, target, previewType, accentColor = "#fff", onResolveAsset,
    sgdbEnabled = false, onCloudSearch
}) => {
    // Standardized dimensions for the preview box.
    // Widths vary to maintain relative scale, but row height will be consistent.
    const dims = {
        cover: 'w-16 h-24',
        banner: 'w-24 h-12',
        wallpaper: 'w-24 h-14',
        logo: 'w-16 h-16',
        icon: 'w-12 h-12'
    }[previewType] || 'w-14 h-14';

    return (
        <div className="flex flex-col w-full group/asset" style={{ contain: 'layout paint' }}>
            {/* Minimal Header */}
            <div className="flex justify-between items-end px-1 mb-0.5">
                <span className="text-[6.5px] font-black uppercase tracking-[0.2em] opacity-40 whitespace-nowrap">{label}</span>
                {value && <button onClick={() => onChange('')} className="text-[5px] opacity-20 hover:opacity-100 hover:text-red-500 font-bold">[ CLEAR ]</button>}
            </div>

            {/* Main Row - Standardizing min-height for better button balance */}
            <div className="flex gap-4 items-stretch bg-black/40 border-2 border-white/10 p-2 min-h-[95px] group-hover/asset:border-white/20 transition-all">
                {/* Preview Container - Solid 2px Outline, Geometric Cut */}
                <div
                    className={`flex-shrink-0 bg-transparent relative p-[2px] ${dims}`}
                    style={{
                        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
                        background: accentColor
                    }}
                >
                    <div
                        className="w-full h-full bg-[#050505] overflow-hidden relative flex items-center justify-center"
                        style={{ clipPath: 'polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 0 100%)' }}
                    >
                        {value ? (
                            <AssetImagePreview src={onResolveAsset(value)} alt={label} type={previewType} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center opacity-10 bg-white/5">
                                <span className="font-mono text-[8px] tracking-tighter">EMPTY_UNIT</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Integrated Action Column */}
                <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex flex-col gap-1.5 h-full justify-center">
                        <button
                            onClick={() => triggerFileBrowser(target, previewType === 'all' ? 'any' : (previewType as any))}
                            className="w-full py-2 font-bold text-[8px] uppercase tracking-[0.2em] transition-all active:scale-95 border-2"
                            style={{
                                borderColor: accentColor,
                                color: accentColor,
                                backgroundColor: 'transparent'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = accentColor;
                                e.currentTarget.style.color = getContrastColor(accentColor);
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = accentColor;
                            }}
                        >
                            [ UNIT_BROWSER ]
                        </button>

                        {sgdbEnabled && onCloudSearch && (
                            <button
                                onClick={onCloudSearch}
                                className="w-full py-2 bg-blue-600/20 text-blue-400 border-2 border-blue-500/40 font-bold text-[8px] uppercase tracking-[0.2em] hover:bg-blue-600 hover:text-white transition-all active:scale-95"
                            >
                                [ CLOUD_QUERY ]
                            </button>
                        )}
                    </div>

                    {/* Integrated Path Input */}
                    <div className="relative mt-2 border-t border-white/5 pt-1">
                        <input
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            placeholder="UNRESOLVED_PATH"
                            className="w-full bg-transparent text-[8px] outline-none font-mono uppercase text-white/30 focus:text-white/80 transition-all truncate"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

export default AssetInput;

// Internal component to handle image state and flushing
const AssetImagePreview: React.FC<{ src: string, alt: string, type: string }> = ({ src, alt, type }) => {
    const [displaySrc, setDisplaySrc] = React.useState<string | null>(null);

    React.useEffect(() => {
        setDisplaySrc(null); // FLASH CLEAR
        const timer = setTimeout(() => {
            // Append timestamp to force refresh if it's a local file re-write
            const isLocal = !src.startsWith('http');
            if (isLocal) {
                const separator = src.includes('?') ? '&' : '?';
                setDisplaySrc(`${src}${separator}t=${Date.now()}`);
            } else {
                setDisplaySrc(src);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [src]);

    if (!displaySrc) return <div className="w-full h-full bg-white/5 animate-pulse" />;

    return (
        <img
            src={displaySrc}
            alt={alt}
            className={`w-full h-full transition-all duration-700 animate-in fade-in zoom-in-95 duration-300 ${type === 'logo' || type === 'icon' ? 'object-contain p-2' : 'object-cover group-hover/asset:scale-110'}`}
        />
    );
};
