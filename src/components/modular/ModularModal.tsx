
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
    onExecuteStart?: () => void;
    onExecuteEnd?: () => void;
    progress?: number;
    isExecuting?: boolean;
    isReady?: boolean;
    scrollProgress?: number | (() => void) | null;
    showScrollMarker?: boolean | (() => void) | null;
    onScrollDrag?: (progress: number) => void;
    closeLabel?: string;
    t?: any;
    outerGlowEnabled?: boolean;
    outlineEnabled?: boolean;
    cardTransparencyEnabled?: boolean;
    cardOpacity?: number;
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
    onExecuteStart,
    onExecuteEnd,
    progress,
    isExecuting,
    isReady,
    scrollProgress,
    showScrollMarker,
    onScrollDrag,
    closeLabel,
    t,
    outerGlowEnabled,
    outlineEnabled,
    cardTransparencyEnabled,
    cardOpacity
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 flex items-center justify-center p-4 lg:p-8 z-[2000]" style={{ zIndex }}>
            {/* Simple Backdrop */}
            <div
                className={`absolute inset-0 transition-all duration-300 ${cardTransparencyEnabled ? 'bg-black/5 backdrop-blur-sm' : 'bg-black/60 backdrop-blur-md'}`}
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
                onExecuteStart={onExecuteStart}
                onExecuteEnd={onExecuteEnd}
                progress={progress}
                isExecuting={isExecuting}
                isReady={isReady}
                scrollProgress={scrollProgress}
                showScrollMarker={showScrollMarker}
                onScrollDrag={onScrollDrag}
                closeLabel={closeLabel}
                t={t}
                outerGlowEnabled={outerGlowEnabled}
                outlineEnabled={outlineEnabled}
                cardTransparencyEnabled={cardTransparencyEnabled}
                cardOpacity={cardOpacity}
            >
                {children}
            </ModularFrame>
        </div>
    );
};

export default ModularModal;
