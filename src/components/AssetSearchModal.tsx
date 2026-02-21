import React, { useState, useEffect, useRef } from 'react';
import CyberScrollbar from './CyberScrollbar';

interface AssetSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (url: string) => void;
    initialQuery: string;
    type: 'grid' | 'hero' | 'logo';
    accentColor: string;
}

const AssetSearchModal: React.FC<AssetSearchModalProps> = ({ isOpen, onClose, onSelect, initialQuery, type, accentColor }) => {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'search' | 'results'>('search');
    const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery(initialQuery);
            setStep('search');
            setResults([]);
            if (initialQuery) handleSearch(initialQuery);
        }
    }, [isOpen]);

    const handleSearch = async (q: string) => {
        if (!q.trim()) return;
        setLoading(true);
        console.log(`[SGDB] Searching for: ${q}`);
        setResults([]);
        try {
            const res = await fetch(`/api/sgdb/search/${encodeURIComponent(q)}`);
            const data = await res.json();
            console.log(`[SGDB] Search results:`, data);
            if (data.data) {
                setResults(data.data);
                setStep('search');
            } else {
                setResults([]);
            }
        } catch (e) {
            console.error("[SGDB] Search error:", e);
            setResults([]);
        }
        setLoading(false);
    };

    const handleGameSelect = async (gameId: number) => {
        setSelectedGameId(gameId);
        setLoading(true);
        console.log(`[SGDB] Fetching assets for gameId: ${gameId}, type: ${type}`);
        setResults([]);
        try {
            const res = await fetch(`/api/sgdb/grids/${gameId}/${type}`);
            const data = await res.json();
            console.log(`[SGDB] Asset results:`, data);
            if (data.data) {
                setResults(data.data);
                setStep('results');
            }
        } catch (e) {
            console.error("[SGDB] Asset fetch error:", e);
        }
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 lg:p-10 bg-black/90 backdrop-blur-xl animate-in fade-in duration-500 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.6)_100%)]"></div>

            <div className="relative flex flex-col bg-[#020202]/85 border-none shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-500"
                style={{
                    width: 'min(1100px, 95vw)',
                    height: 'min(850px, 90vh)',
                    clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)',
                    boxShadow: `0 0 50px ${accentColor}22`
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
                {/* Header Subsystem */}
                <div className="flex justify-between items-center p-6 lg:p-10 border-b-2 border-white/10 bg-black/60 shrink-0 relative z-[100]">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-[9px] lg:text-[11px] font-bold font-['Press_Start_2P'] uppercase tracking-tighter" style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}aa` }}>
                            [ CLOUD_QUERY_ENGINE.SYS ] // <span className="opacity-40">{type.toUpperCase()}</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-[7px] font-mono text-white/40 uppercase tracking-[0.5em]">REMOTE_NEURAL_LINK_INDEX</span>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="px-6 py-2 font-bold text-[8px] uppercase tracking-widest transition-all border-2 active:scale-95"
                        style={{ borderColor: accentColor, color: accentColor }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = accentColor; e.currentTarget.style.color = '#000'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = accentColor; }}
                    >
                        [ CEASE_QUERY ]
                    </button>
                </div>

                {/* Content Stream */}
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {loading && (
                        <div className="absolute inset-0 bg-black/90 z-30 flex items-center justify-center backdrop-blur-md transition-all">
                            <div className="flex flex-col items-center gap-6">
                                <div className="w-12 h-12 border-2 border-t-white border-white/10 animate-spin rounded-full" style={{ borderColor: `${accentColor} transparent transparent transparent` }}></div>
                                <span className="text-[10px] font-mono animate-pulse uppercase tracking-[0.4em] text-white">ACCESSING_NEURAL_NETWORK...</span>
                            </div>
                        </div>
                    )}

                    {step === 'search' && (
                        <div className="flex flex-col h-full bg-black/40">
                            <div className="p-6 bg-black/60 border-b-2 border-white/10 flex gap-4">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
                                    className="flex-1 bg-black/60 border-2 border-white/10 p-4 text-[12px] uppercase font-mono text-white outline-none focus:border-white transition-all placeholder-white/10"
                                    placeholder="ENTER_UNIT_IDENTIFIER..."
                                    autoFocus
                                />
                                <button
                                    onClick={() => handleSearch(query)}
                                    className="px-10 font-bold text-[10px] uppercase tracking-widest transition-all border-2 active:scale-95"
                                    style={{ borderColor: accentColor, color: accentColor }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = accentColor; e.currentTarget.style.color = '#000'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = accentColor; }}
                                >
                                    EXECUTE_QUERY
                                </button>
                            </div>
                            <div ref={searchRef} className="flex-1 overflow-y-auto p-6 lg:p-10 no-scrollbar relative">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {results.map((game: any) => (
                                        <div
                                            key={game.id}
                                            onClick={() => handleGameSelect(game.id)}
                                            className="flex items-center justify-between p-4 bg-black/40 border-2 border-white/5 cursor-pointer hover:border-white/20 transition-all group relative overflow-hidden active:scale-[0.98]"
                                        >
                                            <div className="absolute left-0 top-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: accentColor }}></div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-[10px] font-bold text-white group-hover:text-white uppercase tracking-wider transition-colors font-['Space_Mono'] truncate">{game.name}</span>
                                                <span className="text-[7px] text-white/20 font-mono tracking-tighter">SECTOR_ID: {game.id}</span>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className="text-[12px] opacity-20 group-hover:opacity-100 text-white transition-opacity">→</span>
                                            </div>
                                        </div>
                                    ))}
                                    {results.length === 0 && !loading && (
                                        <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4 opacity-10">
                                            <span className="text-[40px]">∅</span>
                                            <span className="text-[9px] uppercase tracking-[0.4em] font-mono">DATABASE_EMPTY // ENTER_VALID_QUERY</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'results' && (
                        <div className="flex flex-col h-full bg-black/20">
                            <div className="p-4 border-b-2 border-white/10 flex items-center justify-between bg-black/60">
                                <button
                                    onClick={() => { setStep('search'); handleSearch(query); }}
                                    className="px-6 py-2 text-[9px] uppercase font-bold text-white/40 hover:text-white flex items-center gap-3 transition-all active:scale-95"
                                >
                                    ← REVERT_TO_SEARCH_INDEX
                                </button>
                                <span className="text-[8px] opacity-40 uppercase tracking-[0.4em] font-mono">SELECT_UNIT_FOR_DEPLOYMENT</span>
                            </div>
                            <div ref={resultsRef} className="flex-1 overflow-y-auto p-8 lg:p-10 no-scrollbar relative">
                                <div className={`grid gap-6 ${type === 'hero' ? 'grid-cols-1 md:grid-cols-2' :
                                    type === 'logo' ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-5' :
                                        'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
                                    }`}>
                                    {results.map((asset: any) => (
                                        <div
                                            key={asset.id}
                                            onClick={() => onSelect(asset.url)}
                                            className="relative group cursor-pointer border-2 border-white/5 hover:border-white/30 transition-all overflow-hidden bg-black/40 flex flex-col shadow-2xl active:scale-95"
                                        >
                                            <div className={`relative overflow-hidden bg-black ${type === 'logo' ? 'aspect-square flex items-center justify-center p-6' : type === 'hero' ? 'aspect-[920/430]' : 'aspect-[2/3]'}`}>
                                                <img
                                                    src={asset.thumb}
                                                    className={`${type === 'logo' ? 'max-w-full max-h-full object-contain filter brightness-75 group-hover:brightness-100' : 'w-full h-full object-cover opacity-50'} group-hover:opacity-100 transition-all duration-700 group-hover:scale-110`}
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 group-hover:opacity-20 transition-opacity"></div>
                                            </div>
                                            <div className="bg-black/90 p-4 border-t-2 border-white/5 backdrop-blur-md">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] block text-white/80 font-mono font-bold tracking-tighter">{asset.width}x{asset.height}</span>
                                                        <span className="text-[7px] block text-white/20 font-mono truncate max-w-[100px] uppercase">{asset.author.name}</span>
                                                    </div>
                                                    <span
                                                        className="text-[8px] font-bold uppercase tracking-widest px-3 py-1.5 border-2 transition-all"
                                                        style={{ borderColor: accentColor, color: accentColor }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = accentColor; e.currentTarget.style.color = '#000'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = accentColor; }}
                                                    >
                                                        DEPLOY
                                                    </span>
                                                </div>
                                            </div>
                                            {asset.style && <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/90 border-2 border-white/20 text-[6px] uppercase font-bold text-white/40">{asset.style}</div>}
                                        </div>
                                    ))}
                                    {results.length === 0 && !loading && (
                                        <div className="col-span-full h-64 flex flex-col items-center justify-center gap-4 opacity-10">
                                            <span className="text-[40px]">∅</span>
                                            <span className="text-[10px] uppercase tracking-[0.3em]">NO_CONTENT_MAP_DETECTED</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {step === 'search' && <CyberScrollbar containerRef={searchRef} accentColor={accentColor} top="190px" bottom="20px" right="2px" />}
                {step === 'results' && <CyberScrollbar containerRef={resultsRef} accentColor={accentColor} top="140px" bottom="20px" right="2px" />}
            </div>
        </div>
    );
};

export default AssetSearchModal;
