import React, { useState, useEffect, useCallback } from 'react';

interface ModularAssetSearchModuleProps {
    accentColor: string;
    initialQuery: string;
    assetType: 'grid' | 'hero' | 'logo' | 'banner' | 'icon';
    onSelect: (url: string | null) => void;
    onCancel: () => void;
    registerGoBack?: (fn: () => boolean) => void;
    onCanGoBackChange?: (canGoBack: boolean) => void;
}

const ModularAssetSearchModule: React.FC<ModularAssetSearchModuleProps> = ({
    accentColor,
    initialQuery,
    assetType,
    onSelect,
    onCancel,
    registerGoBack,
    onCanGoBackChange
}) => {
    const [step, setStep] = useState<'search' | 'results'>('search');
    const [query, setQuery] = useState(initialQuery);
    const [games, setGames] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (initialQuery) {
            setQuery(initialQuery);
            handleSearch(initialQuery);
        }
    }, [initialQuery]);

    const handleSearch = async (q: string) => {
        if (!q.trim()) return;
        setLoading(true); setGames([]); setStep('search'); setSelectedGameId(null); setError(null);
        try {
            const r = await fetch(`/api/sgdb/search/${encodeURIComponent(q)}`);
            const data = await r.json();
            if (data.success && data.data) {
                setGames(data.data);
            } else if (data.error) {
                let msg = `${data.error}: ${data.detail || ''}`;
                if (r.status === 401) msg = "UNAUTHORIZED: PLEASE_SET_VALID_SGDB_KEY_IN_ASSET_CORE";
                setError(msg);
                console.error("SGDB Search Error:", data.error, data.detail);
            }
        } catch (e: any) {
            setError(e.message);
            console.error(e);
        }
        setLoading(false);
    };

    const handleGameSelect = async (gameId: number) => {
        setSelectedGameId(gameId);
        setLoading(true); setAssets([]); setStep('results');
        try {
            const r = await fetch(`/api/sgdb/grids/${gameId}/${assetType}`);
            const data = await r.json();
            if (data.success && data.data) {
                setAssets(data.data.slice(0, 50));
            } else if (data.error) {
                console.error("SGDB Grids Error:", data.error, data.detail);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleGoBack = useCallback((): boolean => {
        if (step === 'results') {
            setStep('search');
            setSelectedGameId(null);
            setAssets([]);
            return true;
        }
        return false;
    }, [step]);

    useEffect(() => {
        if (registerGoBack) registerGoBack(handleGoBack);
    }, [registerGoBack, handleGoBack]);

    useEffect(() => {
        if (onCanGoBackChange) onCanGoBackChange(step === 'results');
    }, [step, onCanGoBackChange]);

    const hardwareClip = `polygon(0 0, 100% 0, 100% 100%, 20px 100%, 0 calc(100% - 20px))`;
    const reverseHardwareClip = `polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)`;
    const dualClip = `polygon(0 10px, 10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)`;

    const isWide = assetType === 'banner' || assetType === 'hero';

    return (
        <div className="flex flex-col w-full h-full overflow-hidden">
            {/* Address Bar */}
            <div className="h-[44px] shrink-0 w-full relative mb-8 flex items-center px-1">
                <div className="flex-1 h-full relative" style={{ clipPath: dualClip, backgroundColor: `${accentColor}26`, padding: '1px' }}>
                    <div className="w-full h-full relative" style={{ clipPath: dualClip, backgroundColor: `${accentColor}1a` }}>
                        {step === 'search' ? (
                            <input
                                autoFocus
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                                className="w-full h-full bg-transparent border-none outline-none px-6 font-['Space_Mono'] font-bold text-[11px] text-white tracking-[0.2em] uppercase placeholder:text-white/10 placeholder:font-black focus:text-white transition-colors"
                                placeholder="ENTER_INTEL_NAME_FOR_DEEP_SCAN..."
                            />
                        ) : (
                            <div className="w-full h-full flex items-center px-6">
                                <span className="text-[11px] font-['Space_Mono'] text-white/50 uppercase tracking-[0.5em] truncate font-black" style={{ textShadow: `0 0 20px ${accentColor}44` }}>
                                    TARGET_LOCK :: {assetType.toUpperCase()}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
                        <div className="w-8 h-8 rounded-full border-b-2 animate-spin" style={{ borderColor: accentColor }}></div>
                        <span className="text-[10px] font-mono uppercase tracking-[0.5em]">SYNCHRONIZING_BUFFERS...</span>
                    </div>
                ) : step === 'search' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-[80px]">
                        {error && (
                            <div className="col-span-full text-center py-20 border-2 border-red-500/20 bg-red-500/5">
                                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500 font-black">[ {error} ]</span>
                            </div>
                        )}
                        {games.length === 0 && !loading && query && !error && (
                            <div className="col-span-full text-center py-20 opacity-30 text-[10px] font-mono uppercase tracking-[0.5em]">NO_RESULTS_FOUND</div>
                        )}
                        {games.map(game => (
                            <div
                                key={game.id}
                                onClick={() => handleGameSelect(game.id)}
                                className="relative group transition-all cursor-pointer"
                            >
                                <div style={{ clipPath: dualClip, backgroundColor: `${accentColor}26`, padding: '1px' }} className="group-hover:bg-white/10 transition-colors">
                                    <div style={{ clipPath: dualClip, backgroundColor: `${accentColor}1a` }} className="p-4 flex flex-col gap-2">
                                        <span className="text-[6px] font-mono text-white/20 uppercase tracking-[0.2em]">ID::{game.id}</span>
                                        <span className="text-[10px] font-black text-white/70 uppercase tracking-[0.1em] group-hover:text-white transition-colors truncate">
                                            {game.name}
                                        </span>
                                        <div className="flex items-center justify-between mt-2 border-t border-white/5 pt-2">
                                            <span className="text-[7px] font-mono text-white/20 uppercase">SELECT_NODE</span>
                                            <span className="text-[8px] text-white/10 group-hover:text-white transition-colors">→</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 pb-[80px]">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {assets.length === 0 && !loading && (
                                <div className="col-span-full text-center py-20 opacity-30 text-[10px] font-mono uppercase tracking-[0.5em]">NO_ASSETS_FOUND</div>
                            )}
                            {assets.map((asset, idx) => {
                                const isVertical = assetType === 'grid';
                                const isLogo = assetType === 'logo';
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => onSelect(asset.url)}
                                        className={`${isVertical ? 'aspect-[2/3]' : 'aspect-video'} relative cursor-pointer group`}
                                    >
                                        <div style={{ clipPath: dualClip, backgroundColor: `${accentColor}26`, padding: '1px' }} className="w-full h-full group-hover:bg-white/10 transition-colors">
                                            <div style={{ clipPath: dualClip, backgroundColor: `${accentColor}1a` }} className="w-full h-full overflow-hidden relative">
                                                <img
                                                    src={asset.thumb || asset.url}
                                                    className={`w-full h-full ${isLogo ? 'object-contain p-4' : 'object-cover'} opacity-60 group-hover:opacity-100 transition-opacity duration-300`}
                                                    loading="lazy"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 p-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center pointer-events-none">
                                                    <span className="text-[5px] font-black text-white/40 uppercase">{asset.width}X{asset.height}</span>
                                                    <span className="text-[5px] font-bold text-white/20 uppercase truncate max-w-[60px]">{asset.author?.name || 'USER'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ModularAssetSearchModule;
