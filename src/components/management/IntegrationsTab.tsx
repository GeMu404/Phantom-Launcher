import React from 'react';
import Subsection from './Subsection';
import { useTranslation } from '../../hooks/useTranslation';
import { getContrastColor } from '../../utils/colors';

interface IntegrationsTabProps {
    activeAccent: string;
    handleSyncSteamLibrary: () => void;
    handleSyncXboxLibrary: () => void;
    handleSyncEmuLibrary: (platformId: string, romsDir: string, emuExe: string) => Promise<void>;
    emuPath: string;
    setEmuPath: (v: string) => void;
    romsDir: string;
    setRomsDir: (v: string) => void;
    triggerFileBrowser: (target: string, type: string) => void;
    sgdbKey: string;
    handleUpdateSgdbKey: (key: string) => void;
    sgdbEnabled: boolean;
    handleToggleSgdb: (enabled: boolean) => void;
    steamOptions: { includeSoftware: boolean; includeAdultOnly: boolean };
    setSteamOptions: React.Dispatch<React.SetStateAction<{ includeSoftware: boolean; includeAdultOnly: boolean }>>;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    activeAccent, handleSyncSteamLibrary, handleSyncXboxLibrary, handleSyncEmuLibrary,
    emuPath, setEmuPath, romsDir, setRomsDir, triggerFileBrowser,
    sgdbKey, handleUpdateSgdbKey, sgdbEnabled, handleToggleSgdb,
    steamOptions, setSteamOptions
}) => {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-6">
            <Subsection title="Sync_Protocol: Steam" onSync={handleSyncSteamLibrary} syncLabel="INIT_SYNC" accentColor={activeAccent}>
                <div className="flex items-center gap-4 p-4 bg-white/[0.01] border-2 border-white/5 col-span-2">
                    <img src="./res/external/steam_icon.png" className="w-8 h-8 opacity-80" alt="Steam" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Valve_Master_System</span>
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
            <Subsection title="Xbox" onSync={handleSyncXboxLibrary} syncLabel="INIT_SYNC" accentColor={activeAccent}>
                <div className="flex items-center gap-4 p-4 bg-white/[0.01] border-2 border-white/5 col-span-2">
                    <img src="./res/external/xbox.png" className="w-8 h-8 opacity-80" alt="Xbox" />
                    <span className="text-[9px] font-bold text-white uppercase tracking-widest">Xbox_Game_Pass</span>
                </div>
            </Subsection>

            <Subsection title="Sync_Protocol: Emulators" accentColor={activeAccent}>
                <EmuSyncForm
                    activeAccent={activeAccent}
                    onSync={handleSyncEmuLibrary}
                    emuPath={emuPath}
                    romsDir={romsDir}
                    triggerFileBrowser={triggerFileBrowser}
                />
            </Subsection>

            <Subsection title="API_Link: SteamGridDB" accentColor={activeAccent}>
                <div className="flex flex-col gap-4 col-span-2">
                    <div className="flex items-center gap-4">
                        <input
                            type="text"
                            value={sgdbKey}
                            onChange={(e) => handleUpdateSgdbKey(e.target.value)}
                            placeholder="ENTER_SGDB_API_KEY"
                            className="flex-1 bg-black/20 border-2 border-white/10 p-3 text-[10px] font-mono text-white outline-none focus:border-white/40 transition-colors"
                        />
                        <button
                            onClick={() => handleToggleSgdb(!sgdbEnabled)}
                            className={`px-6 py-3 font-bold text-[9px] uppercase tracking-widest border-2 transition-all ${sgdbEnabled ? 'bg-white text-black border-white' : 'text-white/40 border-white/10 hover:border-white/40'}`}
                        >
                            {sgdbEnabled ? 'ACTIVE' : 'DISABLED'}
                        </button>
                    </div>
                    <div className="flex items-center gap-2 text-[8px] text-white/40 font-mono">
                        <span>STATUS:</span>
                        <span style={{ color: sgdbEnabled ? '#00ff00' : '#ff0000' }}>{sgdbEnabled ? 'LINK_ESTABLISHED' : 'OFFLINE'}</span>
                    </div>
                </div>
            </Subsection>
        </div>
    );
};

const EmuSyncForm: React.FC<{
    activeAccent: string,
    onSync: (platformId: string, romsDir: string, emuExe: string) => Promise<void>,
    emuPath: string,
    romsDir: string,
    triggerFileBrowser: (t: string, type: string) => void
}> = ({ activeAccent, onSync, emuPath, romsDir, triggerFileBrowser }) => {
    const [platform, setPlatform] = React.useState('n64');
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
        await onSync(platform, romsDir, emuPath);
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
                        className="bg-black/60 border-2 border-white/10 p-2 text-[10px] text-white outline-none focus:border-white/30 appearance-none cursor-pointer font-mono"
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
                            className="flex-1 bg-black/60 border-2 border-white/10 p-2 text-[9px] text-white/60 truncate font-mono"
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
                        className="flex-1 bg-black/60 border-2 border-white/10 p-2 text-[9px] text-white/60 truncate font-mono"
                    />
                    <button
                        onClick={pickFolder}
                        className={`${btnBaseClass} border-white/20 text-white/60 hover:border-white hover:text-white hover:bg-white/5`}
                    >
                        BROWSE
                    </button>
                </div>
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

export default IntegrationsTab;
