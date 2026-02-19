import React from 'react';
import Subsection from './Subsection';
import { useTranslation } from '../../hooks/useTranslation';

interface IntegrationsTabProps {
    activeAccent: string;
    handleSyncSteamLibrary: () => void;
    handleSyncXboxLibrary: () => void;
    sgdbKey: string;
    handleUpdateSgdbKey: (key: string) => void;
    sgdbEnabled: boolean;
    handleToggleSgdb: (enabled: boolean) => void;
    steamOptions: { includeHidden: boolean; includeSoftware: boolean };
    setSteamOptions: React.Dispatch<React.SetStateAction<{ includeHidden: boolean; includeSoftware: boolean }>>;
}

const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    activeAccent, handleSyncSteamLibrary, handleSyncXboxLibrary,
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
                            onClick={() => setSteamOptions(prev => ({ ...prev, includeHidden: !prev.includeHidden }))}
                            className={`px-4 py-2 text-[8px] font-bold uppercase tracking-widest border-2 transition-all active:scale-95 ${steamOptions.includeHidden ? 'text-black' : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white/80'}`}
                            style={steamOptions.includeHidden ? { backgroundColor: activeAccent, borderColor: activeAccent } : {}}
                        >
                            INCLUDE_HIDDEN_ASSETS
                        </button>
                        <button
                            onClick={() => setSteamOptions(prev => ({ ...prev, includeSoftware: !prev.includeSoftware }))}
                            className={`px-4 py-2 text-[8px] font-bold uppercase tracking-widest border-2 transition-all active:scale-95 ${steamOptions.includeSoftware ? 'text-black' : 'bg-transparent text-white/40 border-white/10 hover:border-white/30 hover:text-white/80'}`}
                            style={steamOptions.includeSoftware ? { backgroundColor: activeAccent, borderColor: activeAccent } : {}}
                        >
                            INCLUDE_SOFTWARE
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

export default IntegrationsTab;
