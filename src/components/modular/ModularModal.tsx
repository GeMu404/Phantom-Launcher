
import React from 'react';
import ModularFrame from './ModularFrame';

interface ModularModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    accentColor: string;
    size?: { width: string; height: string };
    className?: string;
    zIndex?: number;
    commandText?: string;
    commandDesc?: string;
    onExecute?: () => void;
    progress?: number;
    scrollProgress?: number;
    showScrollMarker?: boolean;
}

/**
 * ModularModal is a high-level wrapper that includes a backdrop
 * and a ModularFrame. It replaces the boiler-plate modal logic.
 */
const ModularModal: React.FC<ModularModalProps> = ({
    isOpen,
    onClose,
    children,
    accentColor,
    size,
    className = "",
    zIndex = 1000,
    commandText,
    commandDesc,
    onExecute,
    progress,
    scrollProgress,
    showScrollMarker
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 lg:p-8 z-[2000]" style={{ zIndex }}>
            {/* Simple Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Modular Frame */}
            <ModularFrame
                accentColor={accentColor}
                size={size}
                className={className}
                commandText={commandText}
                commandDesc={commandDesc}
                onExecute={onExecute}
                progress={progress}
                scrollProgress={scrollProgress}
                showScrollMarker={showScrollMarker}
            >
                {children}
            </ModularFrame>
        </div>
    );
};

export default ModularModal;
