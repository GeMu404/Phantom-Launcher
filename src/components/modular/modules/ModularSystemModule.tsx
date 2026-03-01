import React, { useRef } from 'react';
import CyberScrollbar from '../../CyberScrollbar';
import SystemTab from '../../management/SystemTab';
import { Category } from '../../../types';

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

const ModularSystemModule: React.FC<ModularSystemModuleProps> = (props) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="flex-1 flex flex-col overflow-hidden relative">
            <div ref={scrollContainerRef} className="flex-1 p-6 lg:p-10 overflow-y-auto no-scrollbar font-['Space_Mono'] pb-10">
                <SystemTab {...props} />
            </div>
            <CyberScrollbar containerRef={scrollContainerRef} accentColor={props.activeAccent} />
        </div>
    );
};

export default ModularSystemModule;
