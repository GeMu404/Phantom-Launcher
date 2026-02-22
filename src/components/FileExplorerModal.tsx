
import React, { useState, useEffect, useRef } from 'react';
import { ASSETS } from '../constants';
import CyberScrollbar from './CyberScrollbar';

interface FileItem {
    name: string;
    path: string;
    isDir: boolean;
    size: number;
    ext: string;
}

interface FileExplorerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (path: string) => void;
    filter?: 'exe' | 'image' | 'video' | 'folder' | 'any';
    accentColor: string;
    initialPath?: string;
}

const FileExplorerModal: React.FC<FileExplorerModalProps> = ({ isOpen, onClose, onSelect, filter = 'any', accentColor, initialPath }) => {
    const [libraries, setLibraries] = useState<{ name: string, path: string }[]>([]);
    const [drives, setDrives] = useState<string[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');
    const [contents, setContents] = useState<FileItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            fetchDrives();
        }
    }, [isOpen]);

    const fetchDrives = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/files/drives');
            const data = await res.json();
            setDrives(data.drives || []);
            setLibraries(data.libraries || []);

            console.log('[FileExplorer] Libraries:', data.libraries);
            console.log('[FileExplorer] Initial Request:', initialPath);

            let startPath = null;

            if (initialPath === 'DESKTOP') {
                const lib = data.libraries?.find((l: any) => l.name.toLowerCase() === 'desktop');
                if (lib) startPath = lib.path;
            } else if (initialPath === 'PICTURES') {
                const lib = data.libraries?.find((l: any) => l.name.toLowerCase() === 'pictures' || l.name.toLowerCase() === 'mypictures' || l.name.toLowerCase() === 'imágenes');
                if (lib) startPath = lib.path;
            } else if (initialPath) {
                startPath = initialPath;
            }

            if (startPath) {
                console.log('[FileExplorer] Browsing start:', startPath);
                browse(startPath);
            } else if (data.drives?.length > 0) {
                browse(data.drives[0]);
            }
        } catch (e) {
            console.error('[FileExplorer] Error fetching drives:', e);
            setError('Failed to fetch drives');
        } finally {
            setLoading(false);
        }
    };

    const browse = async (path: string) => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/files/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dirPath: path })
            });
            const data = await res.json();
            if (data.error) {
                if (data.error === 'ACCESS_DENIED') {
                    throw new Error('ACCESS_DENIED: You do not have permission to view this directory.');
                }
                throw new Error(data.error);
            }

            setCurrentPath(data.path);
            setContents(data.contents || []);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        const parts = currentPath.split(/[\\/]/).filter(Boolean);
        if (parts.length <= 1) {
            browse(parts[0] + '\\'); // Root
            return;
        }
        parts.pop();
        browse(parts.join('\\') + '\\');
    };

    const isFiltered = (item: FileItem) => {
        if (item.isDir) return true;
        if (filter === 'folder') return false; // In folder mode, we only show directories in the grid if they should be navigable
        if (filter === 'any') return true;
        if (filter === 'exe') return item.ext === '.exe' || item.ext === '.lnk' || item.ext === '.bat' || item.ext === '.url';
        if (filter === 'image') return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(item.ext);
        if (filter === 'video') return ['.mp4', '.webm', '.mov'].includes(item.ext);
        return true;
    };

    if (!isOpen) return null;

    const breadcrumbs = currentPath.split(/[\\/]/).filter(Boolean);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 lg:p-8 bg-black/50 backdrop-blur-md animate-in fade-in duration-300">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="relative flex flex-col bg-[#020202]/85 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] group/modal"
                style={{
                    width: 'min(1100px, 95vw)',
                    height: 'min(850px, 90vh)',
                    clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
                    transform: 'translateZ(0)',
                    contain: 'layout paint'
                }}>

                {/* Architect Frame */}
                <div className="absolute inset-0 pointer-events-none z-[90] opacity-30 transition-all duration-700"
                    style={{
                        clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
                        background: accentColor,
                        padding: '2.5px'
                    }}>
                    <div className="w-full h-full bg-[#050505] opacity-80"
                        style={{
                            clipPath: 'polygon(27.5px 0, 100% 0, 100% calc(100% - 27.5px), calc(100% - 27.5px) 100%, 0 100%, 0 27.5px)',
                            boxShadow: `inset 0 0 40px ${accentColor}66`
                        }}></div>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between p-6 lg:p-10 border-b border-white/10 bg-black/60 shrink-0 relative z-[100]">
                    <div className="flex flex-col gap-0.5">
                        <h2 className="text-[9px] lg:text-[11px] font-bold font-['Press_Start_2P'] uppercase tracking-tighter animate-pulse" style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}, 0 0 5px #fff` }}>
                            [ INTERNAL_FS_EXPLORER.EXE ]
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[7px] font-mono text-white/40 uppercase tracking-[0.5em]">Protocol: Direct_IO_V3</span>
                            <div className="flex gap-1">
                                <div className="w-1 h-1 rounded-full animate-ping" style={{ backgroundColor: accentColor }}></div>
                                <div className="w-1 h-1 rounded-full opacity-40" style={{ backgroundColor: accentColor }}></div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-5 lg:px-8 py-2 lg:py-3 text-[7px] lg:text-[8px] font-['Press_Start_2P'] opacity-60 hover:opacity-100 transition-all border-2 border-white/20 hover:border-white/50 hover:bg-white/5 active:scale-95 relative z-[110]">DISCONNECT</button>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    {/* Sidebar: Drives & Libraries */}
                    <div ref={sidebarRef} className="w-56 border-r border-white/5 bg-black/40 p-4 flex flex-col gap-2 overflow-y-auto no-scrollbar relative">
                        <label className="text-[7px] opacity-40 uppercase tracking-widest mb-1 mt-2">System_Folders</label>
                        {libraries.map(lib => (
                            <button
                                key={lib.path}
                                onClick={() => browse(lib.path)}
                                className={`p-2 py-1.5 text-[9px] font-mono text-left transition-all border-2 ${currentPath === lib.path ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-white/40 hover:text-white/60'}`}
                            >
                                {lib.name}
                            </button>
                        ))}

                        <div className="h-4" />
                        <label className="text-[7px] opacity-40 uppercase tracking-widest mb-1">Logical_Volumes</label>
                        {drives.map(drive => (
                            <button
                                key={drive}
                                onClick={() => browse(drive)}
                                className={`p-2 py-1.5 text-[9px] font-mono text-left transition-all border-2 ${currentPath.startsWith(drive) ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-white/40 hover:text-white/60'}`}
                            >
                                DISK::{drive}
                            </button>
                        ))}
                    </div>

                    {/* Main Area */}
                    <div className="flex-1 flex flex-col min-w-0">
                        {/* Breadcrumbs */}
                        <div className="p-4 bg-white/2 border-b border-white/5 flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <button onClick={handleBack} className="flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 border-white/10 hover:bg-white/10">
                                <span className="opacity-60 text-xs">←</span>
                            </button>
                            <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider">
                                {breadcrumbs.map((part, i) => (
                                    <React.Fragment key={i}>
                                        <span className="opacity-30">/</span>
                                        <button
                                            onClick={() => browse(breadcrumbs.slice(0, i + 1).join('\\') + '\\')}
                                            className="hover:text-white transition-colors px-1"
                                        >
                                            {part}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        <div ref={listRef} className="flex-1 overflow-y-auto p-4 no-scrollbar relative">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center gap-4 opacity-40">
                                    <div className="w-8 h-8 border-2 border-white/20 border-t-white animate-spin rounded-full"></div>
                                    <span className="text-[8px] font-mono uppercase tracking-[0.4em]">Mounting_Sector...</span>
                                </div>
                            ) : error ? (
                                <div className="h-full flex flex-col items-center justify-center gap-6 text-red-500/80 font-mono text-[10px] uppercase p-8 border border-red-500/10 bg-red-500/5">
                                    <div className="w-12 h-12 flex items-center justify-center border-2 border-500/40 animate-pulse">
                                        <span className="text-xl">!</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <span className="font-bold tracking-[0.2em]">{error.startsWith('ACCESS_DENIED') ? 'STATUS::ACCESS_RESTRICTED' : 'STATUS::SYSTEM_ERROR'}</span>
                                        <p className="max-w-xs opacity-60 leading-relaxed lowercase">{error}</p>
                                    </div>
                                    <button
                                        onClick={handleBack}
                                        className="px-8 py-3 bg-red-500/20 border border-red-500/40 hover:bg-red-500 hover:text-white transition-all tracking-[0.3em] font-bold"
                                    >
                                        RETURN_TO_SAFETY
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 h-auto col-span-full">
                                    {contents.filter(isFiltered).map((item, i) => {
                                        const isMatch = !item.isDir && filter !== 'any' && (
                                            (filter === 'exe' && (item.ext === '.exe' || item.ext === '.lnk' || item.ext === '.bat' || item.ext === '.url')) ||
                                            (filter === 'image' && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(item.ext)) ||
                                            (filter === 'video' && ['.mp4', '.webm', '.mov'].includes(item.ext))
                                        );

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => item.isDir ? browse(item.path) : onSelect(item.path)}
                                                className={`group flex flex-col items-center p-4 border-2 transition-all text-center gap-3 relative overflow-hidden ${isMatch ? 'bg-black/40 hover:bg-white/5' : 'border-white/5 hover:border-white/20 hover:bg-white/5'
                                                    }`}
                                                style={{ borderColor: isMatch ? `${accentColor}44` : undefined }}
                                            >
                                                {/* Bevel Corner */}
                                                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                                                <div className="w-10 h-10 flex items-center justify-center relative">
                                                    {item.isDir ? (
                                                        <div className="w-10 h-8 bg-white/10 relative rounded-sm" style={{ clipPath: 'polygon(0 0, 40% 0, 50% 20%, 100% 20%, 100% 100%, 0 100%)' }}>
                                                            <div className="absolute inset-0 border" style={{ borderColor: `${accentColor}33` }} />
                                                        </div>
                                                    ) : (
                                                        <div className={`w-8 h-10 border-2 relative rounded-sm group-hover:bg-white/10 transition-colors flex items-center justify-center overflow-hidden`} style={{ borderColor: isMatch ? accentColor : 'rgba(255,255,255,0.2)' }}>
                                                            {['.jpg', '.jpeg', '.png', '.webp'].includes(item.ext) ? (
                                                                <img src={`/api/proxy-image?path=${encodeURIComponent(item.path)}`} className={`w-full h-full object-cover transition-opacity ${isMatch ? 'opacity-90 group-hover:opacity-100' : 'opacity-50 group-hover:opacity-100'}`} />
                                                            ) : (
                                                                <span className={`text-[6px] font-bold ${isMatch ? 'opacity-100 uppercase' : 'opacity-40'}`} style={{ color: isMatch ? accentColor : undefined }}>{item.ext || 'FILE'}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[9px] font-mono truncate w-full px-2 transition-colors ${isMatch ? 'text-white font-bold' : 'text-white/60 group-hover:text-white'}`} title={item.name}>
                                                    {item.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {contents.filter(isFiltered).length === 0 && (
                                        <div className="col-span-full h-32 flex items-center justify-center opacity-20 font-mono text-[9px] uppercase tracking-widest">
                                            Node_Registry_Empty
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-black/60 flex justify-between items-center px-8">
                    <div className="flex gap-6 items-center">
                        <div className="flex flex-col gap-1">
                            <span className="text-[7px] opacity-40 uppercase tracking-widest">Status</span>
                            <span className="text-[9px] font-mono" style={{ color: accentColor }}>CHANNEL_SECURE</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[7px] opacity-40 uppercase tracking-widest">Path</span>
                            <span className="text-[9px] font-mono text-white/50 truncate max-w-[400px]" title={currentPath}>{currentPath}</span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {filter === 'folder' && (
                            <button
                                onClick={() => onSelect(currentPath)}
                                className="px-6 py-2 border-2 text-[9px] font-mono uppercase tracking-widest transition-all bg-white text-black border-white hover:bg-white/80"
                                style={{ backgroundColor: accentColor, borderColor: accentColor, color: '#000' }}
                            >
                                SELECT_CURRENT_DIRECTORY
                            </button>
                        )}
                        <button onClick={onClose} className="px-6 py-2 border-2 border-white/10 text-[9px] font-mono uppercase tracking-widest hover:bg-white/5 transition-all">ABORT_PROTOCOL</button>
                    </div>
                </div>
                {/* Fixed Scrollbars */}
                <CyberScrollbar containerRef={sidebarRef} accentColor={accentColor} top="160px" bottom="80px" right="auto" left="212px" width="12px" />
                <CyberScrollbar containerRef={listRef} accentColor={accentColor} top="215px" bottom="80px" right="2px" />
            </div>
        </div>
    );
};

export default FileExplorerModal;
