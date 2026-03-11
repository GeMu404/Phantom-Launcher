import React, { useState, useEffect, useRef } from 'react';
import ScrollIndicator from '../../ui/ScrollIndicator';
import { useTranslation } from '../../../hooks/useTranslation';

interface FileItem {
    name: string;
    path: string;
    isDir: boolean;
    size: number;
    ext: string;
}

interface ModularExplorerModuleProps {
    accentColor: string;
    currentPath: string;
    onPathChange: (path: string) => void;
    mode?: 'browse' | 'select-file' | 'select-folder' | 'select-image';
    onSelect?: (path: string | null) => void;
    selectedPath?: string | null;
}

const ModularExplorerModule: React.FC<ModularExplorerModuleProps> = ({
    accentColor,
    currentPath,
    onPathChange,
    mode = 'browse',
    onSelect,
    selectedPath = null
}) => {
    const { t } = useTranslation();
    const [contents, setContents] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const explorerContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchContents = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/files/list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dirPath: currentPath })
                });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                setContents(data.contents || []);
            } catch (e: any) {
                console.error(e);
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchContents();
    }, [currentPath]);

    const handleBack = () => {
        const parts = currentPath.split(/[\\/]/).filter(Boolean);
        if (parts.length <= 1) {
            onPathChange(parts[0] + '\\'); // Root
            return;
        }
        parts.pop();
        onPathChange(parts.join('\\') + '\\');
    };

    // Asymmetrical Bevel Paths (Inverted: Top-Right cut for Preview, Bottom-Left cut for Label)
    const previewClip = `polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%)`;
    const labelClip = `polygon(0 0, 100% 0, 100% 100%, 16px 100%, 0 calc(100% - 16px))`;

    const isImage = (ext: string) => ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext.toLowerCase());

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Address Bar (Standardized) */}
            <div className="h-[42px] shrink-0 w-full relative mb-[15px] flex items-center overflow-hidden">
                <div className="w-full flex items-center gap-2">
                    {/* BACK BUTTON */}
                    <button
                        onClick={handleBack}
                        className="h-[42px] px-5 flex items-center justify-center font-['Space_Mono'] font-black text-[10px] uppercase tracking-widest text-white hover:brightness-125 active:scale-95 transition-all shrink-0"
                        style={{
                            clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))',
                            background: `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf`,
                            border: `1px solid ${accentColor}55`
                        }}
                    >
                        {t('nav.go_back')}
                    </button>

                    {/* PATH BAR */}
                    <div
                        className="flex-1 h-[42px] flex items-center px-5 overflow-hidden"
                        style={{
                            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                            background: `linear-gradient(${accentColor}22, ${accentColor}22), #080808bf`,
                        }}
                    >
                        <span className="text-[10px] font-['Space_Mono'] text-white/80 uppercase tracking-[0.4em] truncate font-black"
                            style={{ textShadow: `0 0 15px ${accentColor}` }}>
                            {currentPath}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content Area with Custom Scrollbar */}
            <div ref={explorerContentRef} className="flex-1 w-full overflow-y-scroll custom-scrollbar pb-[100px] relative">
                <ScrollIndicator scrollRef={explorerContentRef} color={accentColor} />

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-70">
                        <div className="w-8 h-8 border-2 border-white/10 border-t-white animate-spin"></div>
                        <span className="text-[8px] font-['Space_Mono'] uppercase tracking-[0.5em] text-white">{t('explorer.mounting')}</span>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-red-500 font-['Space_Mono'] uppercase">
                        <div className="w-12 h-12 border-2 border-red-500/30 flex items-center justify-center text-2xl animate-pulse">!</div>
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-[9px] font-black tracking-[0.2em]">{t('explorer.access_denied')}</span>
                            <span className="text-[7px] opacity-40 tracking-widest">{error}</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-[20px]">
                        {/* Virtual 'USE THIS FOLDER' action card for folder selection mode */}
                        {mode === 'select-folder' && (
                            <div
                                onClick={() => onSelect?.(currentPath)}
                                className={`aspect-square group relative cursor-pointer active:scale-95 flex flex-col gap-[8px]`}
                            >
                                <div className="flex-1 w-full relative"
                                    style={{
                                        clipPath: previewClip,
                                        backgroundColor: selectedPath === currentPath ? accentColor : `${accentColor}26`,
                                        padding: '1.5px'
                                    }}>
                                    <div className="w-full h-full flex items-center justify-center"
                                        style={{
                                            clipPath: previewClip,
                                            backgroundColor: selectedPath === currentPath ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.03)'
                                        }}>
                                        <span className={`text-[10px] font-black font-['Space_Mono'] uppercase tracking-widest px-2 text-center transition-colors ${selectedPath === currentPath ? 'text-white' : 'text-white/40 group-hover:text-white'}`}>
                                            {t('explorer.confirm_directory')}
                                        </span>
                                    </div>
                                </div>
                                <div className="h-[26px] shrink-0 w-full relative overflow-hidden"
                                    style={{
                                        clipPath: labelClip,
                                        backgroundColor: selectedPath === currentPath ? accentColor : `${accentColor}26`,
                                        padding: '1.5px'
                                    }}>
                                    <div className="w-full h-full flex items-center pl-[22px] overflow-hidden"
                                        style={{
                                            clipPath: labelClip,
                                            backgroundColor: selectedPath === currentPath ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.03)'
                                        }}>
                                        <div className={`marquee-led-content ${selectedPath === currentPath ? 'marquee-led-active' : ''}`}>
                                            <span className={`text-[7px] font-black font-['Space_Mono'] uppercase tracking-[0.2em] ${selectedPath === currentPath ? 'text-white' : 'text-white/30 group-hover:text-white'}`}>
                                                {t('explorer.empty_node')}
                                            </span>
                                            {/* Duplicate for infinite loop */}
                                            <span className={`text-[7px] font-black font-['Space_Mono'] uppercase tracking-[0.2em] ${selectedPath === currentPath ? 'text-white' : 'text-white/30 group-hover:text-white'}`}>
                                                {t('explorer.empty_node')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {contents.map((item, idx) => {
                            const isImg = isImage(item.ext);
                            const isSelected = selectedPath === item.path;

                            const handleItemClick = () => {
                                if (item.isDir) {
                                    onPathChange(item.path);
                                    if (mode === 'select-folder') {
                                        onSelect?.(item.path);
                                    }
                                } else if (mode !== 'browse') {
                                    onSelect?.(item.path);
                                }
                            };

                            return (
                                <div
                                    key={idx}
                                    onClick={handleItemClick}
                                    className={`aspect-square group relative cursor-pointer active:scale-95 flex flex-col gap-[8px]`}
                                >
                                    {/* Top Preview Section */}
                                    <div
                                        className="flex-1 w-full relative"
                                        style={{
                                            clipPath: previewClip,
                                            backgroundColor: isSelected ? accentColor : `${accentColor}26`,
                                            padding: '1.5px'
                                        }}
                                    >
                                        <div className="w-full h-full relative flex items-center justify-center overflow-hidden"
                                            style={{
                                                clipPath: previewClip,
                                                backgroundColor: isSelected ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.03)'
                                            }}>
                                            {item.isDir ? (
                                                <span className={`text-[14px] font-black font-['Space_Mono'] transition-opacity tracking-wider ${isSelected ? 'text-white opacity-100' : 'text-white opacity-40 group-hover:opacity-100'}`}>DIR</span>
                                            ) : isImg ? (
                                                <img
                                                    src={`/api/proxy-image?path=${encodeURIComponent(item.path)}`}
                                                    className={`max-w-[70%] max-h-[70%] object-contain transition-opacity ${isSelected ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}
                                                    alt={item.name}
                                                />
                                            ) : (
                                                <span
                                                    className={`text-[14px] font-black font-['Space_Mono'] transition-opacity uppercase tracking-wider ${isSelected ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
                                                    style={{ color: ['.exe', '.bat', '.lnk', '.url'].includes(item.ext.toLowerCase()) ? accentColor : '#ffffff' }}
                                                >
                                                    {item.ext.replace('.', '') || 'FILE'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bottom Info Section */}
                                    <div
                                        className="h-[26px] shrink-0 w-full relative overflow-hidden"
                                        style={{
                                            clipPath: labelClip,
                                            backgroundColor: isSelected ? accentColor : `${accentColor}26`,
                                            padding: '1.5px'
                                        }}
                                    >
                                        <div className="w-full h-full relative flex items-center pl-[22px] overflow-hidden"
                                            style={{
                                                clipPath: labelClip,
                                                backgroundColor: isSelected ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.03)'
                                            }}>
                                            <div className={`marquee-led-content ${isSelected ? 'marquee-led-active' : ''}`}>
                                                <span className={`text-[9px] font-black font-['Space_Mono'] uppercase tracking-[0.2em] ${isSelected ? 'text-white' : 'text-white/60 group-hover:text-white'}`}>
                                                    {item.name}
                                                </span>
                                                <span className="text-[6px] opacity-30 uppercase font-mono tracking-widest leading-none mx-2">
                                                    :: {item.isDir ? t('explorer.directory_node') : t('explorer.data_sector')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {contents.length === 0 && (
                            <div className="col-span-full h-48 flex items-center justify-center opacity-10">
                                <span className="text-[10px] font-['Space_Mono'] uppercase tracking-[1em]">{t('explorer.registry_empty')}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModularExplorerModule;
