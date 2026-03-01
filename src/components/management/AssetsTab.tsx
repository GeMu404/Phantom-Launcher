import React from 'react';
import SgdbAsset from '../modular/asset/SgdbAsset';

interface AssetsTabProps {
    activeAccent: string;
    sgdbKey: string;
    handleUpdateSgdbKey: (key: string) => void;
    sgdbEnabled: boolean;
    handleToggleSgdb: (enabled: boolean) => void;
}

const AssetsTab: React.FC<AssetsTabProps> = ({
    activeAccent,
    sgdbKey,
    handleUpdateSgdbKey,
    sgdbEnabled,
    handleToggleSgdb
}) => {
    const [activeSgdb, setActiveSgdb] = React.useState(false);

    return (
        <div className="flex flex-col gap-6">
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
    );
};

export default AssetsTab;
