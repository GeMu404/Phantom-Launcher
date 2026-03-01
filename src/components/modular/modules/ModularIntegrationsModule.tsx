import React, { useState, useEffect } from 'react';
import Subsection from '../../management/Subsection';
import { useTranslation } from '../../../hooks/useTranslation';
import { getContrastColor } from '../../../utils/colors';
import CyberScrollbar from '../../CyberScrollbar';
import SgdbAsset from '../asset/SgdbAsset';

interface ModularIntegrationsModuleProps {
    activeAccent: string;
    handleSyncSteamLibrary: (options: { includeSoftware: boolean; includeAdultOnly: boolean }) => Promise<void>;
    handleSyncXboxLibrary: () => Promise<void>;
    handleSyncEmuLibrary: (platformId: string, romsDir: string, emuExe: string, customArgs: string, customIcon?: string, extension?: string, onProgress?: (p: number) => void) => Promise<void>;
    triggerFileBrowser: (target: string, type: string) => void;
    emuPath: string;
    romsDir: string;
    onResolveAsset: (path: string | undefined) => string;
}

const ModularIntegrationsModule: React.FC<ModularIntegrationsModuleProps> = ({
    activeAccent,
    handleSyncSteamLibrary,
    handleSyncXboxLibrary,
    handleSyncEmuLibrary,
    triggerFileBrowser,
    emuPath,
    romsDir,
    onResolveAsset
}) => {
    const { t } = useTranslation();
    const [steamOptions, setSteamOptions] = useState({ includeSoftware: false, includeAdultOnly: false });
    const [sgdbKey, setSgdbKey] = useState('');
    const [sgdbEnabled, setSgdbEnabled] = useState(false);
    const [activeSgdb, setActiveSgdb] = useState(false);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetch('/api/sgdb/key').then(r => r.json()).then(d => {
            setSgdbKey(d.key);
            setSgdbEnabled(d.enabled);
        });
    }, []);

    const handleUpdateSgdbKey = (key: string) => {
        setSgdbKey(key);
        fetch('/api/sgdb/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, enabled: sgdbEnabled })
        });
    };

    const handleToggleSgdb = (enabled: boolean) => {
        if (enabled && !sgdbKey.trim()) return;
        setSgdbEnabled(enabled);
        fetch('/api/sgdb/key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: sgdbKey, enabled })
        });
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div ref={scrollContainerRef} className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10">
                <div className="flex flex-col gap-6 lg:gap-8">
                    {/* Steam Integration */}
                    <Subsection
                        title="Sync_Protocol: Steam"
                        onSync={() => handleSyncSteamLibrary(steamOptions)}
                        syncLabel="INIT_SYNC"
                        accentColor={activeAccent}
                    >
                        <div className="flex items-center gap-4 p-4 bg-white/[0.01] border-2 border-white/5 col-span-2">
                            <img src={onResolveAsset('./res/external/steam_icon.png')} className="w-8 h-8 opacity-80" alt="Steam" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-white uppercase tracking-widest">Valve_Master_System</span>
                                <span className="text-[6px] text-white/30 uppercase tracking-[0.2em]">External_Library_Sync</span>
                            </div>
                            <div className="ml-auto flex flex-col gap-2">
                                <button
                                    onClick={() => setSteamOptions(prev => ({ ...prev, includeSoftware: !prev.includeSoftware }))}
                                    className={`px-4 py-2 text-[8px] font-bold uppercase tracking-widest border-2 transition-all active:scale-95 ${steamOptions.includeSoftware ? '' : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white/80'}`}
                                    style={steamOptions.includeSoftware ? { backgroundColor: activeAccent, borderColor: activeAccent, color: getContrastColor(activeAccent) } : {}}
                                >
                                    INCLUDE_SOFTWARE
                                </button>
                                <button
                                    onClick={() => setSteamOptions(prev => ({ ...prev, includeAdultOnly: !prev.includeAdultOnly }))}
                                    className={`px-4 py-2 text-[8px] font-bold uppercase tracking-widest border-2 transition-all active:scale-95 ${steamOptions.includeAdultOnly ? '' : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white/80'}`}
                                    style={steamOptions.includeAdultOnly ? { backgroundColor: activeAccent, borderColor: activeAccent, color: getContrastColor(activeAccent) } : {}}
                                >
                                    INCLUDE_ADULT_ONLY
                                </button>
                            </div>
                        </div>
                    </Subsection>

                    {/* Xbox Integration */}
                    <Subsection
                        title="Xbox"
                        onSync={handleSyncXboxLibrary}
                        syncLabel="INIT_SYNC"
                        accentColor={activeAccent}
                    >
                        <div className="flex items-center gap-4 p-4 bg-white/[0.01] border-2 border-white/5 col-span-2">
                            <img src={onResolveAsset('./res/external/xbox.png')} className="w-8 h-8 opacity-80" alt="Xbox" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-white uppercase tracking-widest">Xbox_Game_Pass</span>
                                <span className="text-[6px] text-white/30 uppercase tracking-[0.2em]">UWP_Registry_Scan</span>
                            </div>
                        </div>
                    </Subsection>

                    {/* Emulator Integration */}
                    <Subsection title="Sync_Protocol: Emulators" accentColor={activeAccent}>
                        <EmuSyncForm
                            activeAccent={activeAccent}
                            onSync={handleSyncEmuLibrary}
                            emuPath={emuPath}
                            romsDir={romsDir}
                            triggerFileBrowser={triggerFileBrowser}
                        />
                    </Subsection>

                    <SgdbAsset
                        isActive={activeSgdb}
                        onActiveToggle={setActiveSgdb}
                        accentColor={activeAccent}
                        sgdbKey={sgdbKey}
                        onKeyUpdate={handleUpdateSgdbKey}
                        sgdbEnabled={sgdbEnabled}
                        onToggleSgdb={handleToggleSgdb}
                    />
                </div>
            </div>
            <CyberScrollbar containerRef={scrollContainerRef} accentColor={activeAccent} />
        </div>
    );
};

const EmuSyncForm: React.FC<{
    activeAccent: string,
    onSync: (platformId: string, romsDir: string, emuExe: string, customArgs: string) => Promise<void>,
    emuPath: string,
    romsDir: string,
    triggerFileBrowser: (t: string, type: string) => void
}> = ({ activeAccent, onSync, emuPath, romsDir, triggerFileBrowser }) => {
    const [platform, setPlatform] = React.useState('n64');
    const [customArgs, setCustomArgs] = React.useState('');
    const [isScanning, setIsScanning] = React.useState(false);

    const platforms = [
        { id: '3ds', name: 'NINTENDO 3DS' },
        { id: 'n64', name: 'NINTENDO 64' },
        { id: 'nds', name: 'NINTENDO DS' },
        { id: 'ngc', name: 'NINTENDO GAMECUBE' },
        { id: 'nsw', name: 'NINTENDO SWITCH' },
        { id: 'wii', name: 'NINTENDO WII' },
        { id: 'wiu', name: 'NINTENDO WII U' },
        { id: 'ps2', name: 'PLAYSTATION 2' },
        { id: 'ps3', name: 'PLAYSTATION 3' },
        { id: 'ps4', name: 'PLAYSTATION 4' },
        { id: 'psp', name: 'PLAYSTATION PORTABLE' },
        { id: 'psv', name: 'PLAYSTATION VITA' },
    ];

    const pickFile = () => triggerFileBrowser('emuPath', 'exe');
    const pickFolder = () => triggerFileBrowser('romsDir', 'folder');

    const handleSync = async () => {
        if (!emuPath || !romsDir) return;
        setIsScanning(true);
        await onSync(platform, romsDir, emuPath, customArgs);
        setIsScanning(false);
    };

    const btnBaseClass = "px-4 py-2 border-2 font-bold text-[8px] uppercase tracking-widest transition-all active:scale-95";

    return (
        <div className="flex flex-col gap-4 p-4 bg-white/[0.01] border-2 border-white/5 col-span-2 relative">
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                    <label className="text-[7px] text-white/30 uppercase font-black tracking-[0.2em]">Platform_Module</label>
                    <select
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        className="bg-black/20 border-2 border-white/10 p-2 text-[10px] text-white outline-none focus:border-white/30 appearance-none cursor-pointer font-mono"
                        style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 100%)' }}
                    >
                        {platforms.map(p => <option key={p.id} value={p.id} className="bg-black text-white">{p.name}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-2">
                    <label className="text-[7px] text-white/30 uppercase font-black tracking-[0.2em]">Emulator_Binary</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={emuPath}
                            readOnly
                            placeholder="NOT_CONFIGURED"
                            className="flex-1 bg-black/20 border-2 border-white/10 p-2 text-[9px] text-white/60 truncate font-mono"
                        />
                        <button
                            onClick={pickFile}
                            className={`${btnBaseClass} border-white/20 text-white/60 hover:border-white hover:text-white hover:bg-white/5`}
                        >
                            BROWSE
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-[7px] text-white/30 uppercase font-black tracking-[0.2em]">Storage_Sector (ROMs)</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={romsDir}
                        readOnly
                        placeholder="NOT_CONFIGURED"
                        className="flex-1 bg-black/20 border-2 border-white/10 p-2 text-[9px] text-white/60 truncate font-mono"
                    />
                    <button
                        onClick={pickFolder}
                        className={`${btnBaseClass} border-white/20 text-white/60 hover:border-white hover:text-white hover:bg-white/5`}
                    >
                        BROWSE
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <label className="text-[7px] text-white/30 uppercase font-black tracking-[0.2em]">Custom_Arguments (Optional)</label>
                <input
                    type="text"
                    value={customArgs}
                    onChange={(e) => setCustomArgs(e.target.value)}
                    placeholder="e.g. -f --no-gui -args..."
                    className="w-full bg-black/20 border-2 border-white/10 p-2 text-[9px] text-white/80 font-mono outline-none focus:border-white/30"
                />
            </div>

            <button
                onClick={handleSync}
                disabled={!emuPath || !romsDir || isScanning}
                className={`w-full py-4 mt-2 font-black text-[10px] uppercase tracking-[0.4em] border-2 transition-all relative overflow-hidden group/sync ${isScanning ? 'opacity-50 cursor-wait' : 'active:scale-95'}`}
                style={{
                    backgroundColor: emuPath && romsDir ? activeAccent : 'transparent',
                    borderColor: emuPath && romsDir ? activeAccent : 'rgba(255,255,255,0.1)',
                    color: emuPath && romsDir ? getContrastColor(activeAccent) : 'rgba(255,255,255,0.2)'
                }}
            >
                {/* Scanline Effect */}
                <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/sync:translate-x-full transition-transform duration-1000"></div>
                {isScanning ? 'SCAN_IN_PROGRESS...' : `IMPORT_${platform.toUpperCase()}_LIBRARY`}
            </button>
        </div>
    );
};

export default ModularIntegrationsModule;
