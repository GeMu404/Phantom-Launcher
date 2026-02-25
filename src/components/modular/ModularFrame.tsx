import React, { useMemo, useState, useEffect, useRef } from 'react';

interface ModularFrameProps {
    children: React.ReactNode;
    accentColor: string;
    className?: string;
    size?: { width: string; height: string };
    onClose?: () => void;
    commandText?: string;
    commandDesc?: string;
    onExecute?: () => void;
    progress?: number; // 0 to 100
    scrollProgress?: number; // 0 to 1
    showScrollMarker?: boolean;
}

/**
 * ModularFrame - Industrial Vector Geometry.
 * Uses a single SVG with a stroke for perfectly consistent 2px outlines.
 * Handles the "Frame" and "Badge" as synchronized mathematical paths.
 */
const ModularFrame: React.FC<ModularFrameProps> = ({
    children,
    accentColor,
    className = "",
    size = { width: 'min(1200px, 95vw)', height: 'min(900px, 92vh)' },
    onClose,
    commandText,
    commandDesc,
    onExecute,
    progress = 0,
    scrollProgress = 0,
    showScrollMarker = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    // Geometric Constants
    const cut = 48;              // Top-left bevel
    const bW = 240;              // Badge Width
    const bH = 56;               // Badge Height
    const bCut = 24;             // Badge bevel
    const vG = 12;               // Gap

    useEffect(() => {
        if (!containerRef.current) return;
        const obs = new ResizeObserver((entries) => {
            for (let entry of entries) {
                setDims({
                    w: entry.contentRect.width,
                    h: entry.contentRect.height
                });
            }
        });
        obs.observe(containerRef.current);
        return () => obs.disconnect();
    }, []);

    const { framePath, badgePath, contentClip, bx, by } = useMemo(() => {
        const { w, h } = dims;
        if (w === 0 || h === 0) return { framePath: '', badgePath: '', contentClip: '', bx: 0, by: 0 };

        const offset = 1;
        const iW = w - offset;
        const iH = h - offset;

        const delta = 4.97;
        const bx_ = iW - bW;
        const by_ = iH - bH;

        // FRAME PATH
        const fp = [
            `M ${cut},${offset}`,
            `H ${iW}`,
            `V ${by_ - vG}`,
            `H ${bx_ + bCut - delta}`,
            `L ${bx_ - vG} ${by_ + bCut - delta}`,
            `V ${iH}`,
            `H ${offset}`,
            `V ${cut}`,
            `Z`
        ].join(' ');

        // BADGE PATH
        const bp = [
            `M ${bx_ + bCut},${by_}`,
            `H ${iW}`,
            `V ${iH - bCut}`,
            `L ${iW - bCut} ${iH}`,
            `H ${bx_}`,
            `V ${by_ + bCut}`,
            `Z`
        ].join(' ');

        // CONTENT CLIP-PATH
        const b = 2;
        const cA = bCut + delta + 0.5;
        const clip = `polygon(
            ${cut - 1}px ${b}px, 
            calc(100% - ${b}px) ${b}px, 
            calc(100% - ${b}px) calc(100% - ${bH + vG - b}px), 
            calc(100% - ${bW + vG - cA}px) calc(100% - ${bH + vG - b}px), 
            calc(100% - ${bW + vG - b}px) calc(100% - ${bH + vG - cA}px), 
            calc(100% - ${bW + vG - b}px) calc(100% - ${b}px), 
            ${b}px calc(100% - ${b}px), 
            ${b}px ${cut - 1}px
        )`;

        return { framePath: fp, badgePath: bp, contentClip: clip, bx: bx_, by: by_ };
    }, [dims, cut, bW, bH, bCut, vG]);

    // Calculate progress clip-path for the badge
    const progressClip = useMemo(() => {
        if (progress <= 0) return 'inset(0 100% 0 0)';
        if (progress >= 100) return 'none';
        return `inset(0 ${100 - progress}% 0 0)`;
    }, [progress]);

    return (
        <div ref={containerRef} className={`relative flex flex-col ${className}`}
            style={{ width: size.width, height: size.height }}>

            {/* VECTOR BACKGROUND LAYER */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                style={{ zIndex: 0 }}>
                {/* Frame Shell */}
                <path
                    d={framePath}
                    fill="transparent"
                    stroke={accentColor}
                    strokeWidth="2"
                    strokeLinejoin="miter"
                />

                {/* Badge Shell */}
                <path
                    d={badgePath}
                    fill={onExecute ? accentColor : "transparent"}
                    fillOpacity={onExecute ? 0.26 : 1}
                    className="transition-colors duration-300"
                    stroke={accentColor}
                    strokeWidth="2"
                    strokeLinejoin="miter"
                />

                {/* Progress Fill Layer */}
                {progress > 0 && (
                    <path
                        d={badgePath}
                        fill={accentColor}
                        opacity="0.3"
                        style={{ clipPath: progressClip }}
                    />
                )}

                {/* Vertical Decorative Strip - Industrial HUD Style */}
                <g opacity="0.4">
                    <rect
                        x={dims.w - 32}
                        y="120"
                        width="12"
                        height={Math.max(0, dims.h - 208)}
                        fill="transparent"
                        stroke={accentColor}
                        strokeWidth="2"
                    />
                    <rect
                        x={dims.w - 30}
                        y="130"
                        width="8"
                        height={Math.max(0, dims.h - 228)}
                        fill={accentColor}
                        opacity="0.3"
                    />
                </g>

                {/* SCROLL MARKER / THUMB - Outside group for 100% opacity */}
                {showScrollMarker && (
                    <rect
                        x={dims.w - 32}
                        y={120 + (scrollProgress * (Math.max(0, dims.h - 208) - 40))}
                        width="12"
                        height="40"
                        fill={accentColor}
                        opacity="1"
                        style={{ filter: `drop-shadow(0 0 10px ${accentColor})` }}
                        className="transition-all duration-100 ease-out"
                    />
                )}
            </svg>

            {/* CONTENT LAYER */}
            <div className="relative z-10 flex-1 flex flex-col overflow-hidden"
                style={{
                    clipPath: contentClip,
                    WebkitClipPath: contentClip
                }}>
                {children}
            </div>

            {/* COMMAND HUD OVERLAY (Bottom Left of content area) */}
            {(commandText || commandDesc) && (
                <div className="absolute bottom-[10px] left-[241px] pointer-events-none z-50 flex flex-col gap-1 max-w-[600px]">
                    {commandText && (
                        <span className="font-['Space_Mono'] font-black text-[12px] uppercase tracking-[0.3em]" style={{ color: accentColor }}>
                            COMMAND : {commandText}
                        </span>
                    )}
                    <div className="min-h-[2.4em] flex flex-col justify-start">
                        {commandDesc && (
                            <span className="font-['Space_Mono'] text-[9px] uppercase tracking-wider opacity-40 text-white leading-[1.2em] line-clamp-2 overflow-hidden break-words">
                                {commandDesc}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* BADGE CONTENT OVERLAY */}
            <div className="absolute bottom-0 right-0 z-[100] flex items-center justify-center pointer-events-none"
                style={{ width: bW, height: bH }}>
                <button
                    onClick={onExecute}
                    className="flex items-center justify-center w-full h-full group/exec active:scale-95 transition-transform disabled:opacity-20 disabled:pointer-events-none relative overflow-hidden"
                    style={{
                        pointerEvents: onExecute ? 'auto' : 'none',
                        clipPath: `polygon(0 ${bCut}px, ${bCut}px 0, 100% 0, 100% calc(100% - ${bCut}px), calc(100% - ${bCut}px) 100%, 0 100%, 0 ${bCut}px)`
                    }}>

                    {/* Interior Progress Bar Background */}
                    {progress > 0 && (
                        <div
                            className="absolute inset-0 transition-all duration-300 ease-out"
                            style={{
                                backgroundColor: accentColor,
                                opacity: 0.1,
                                width: `${progress}%`
                            }}
                        />
                    )}

                    {/* Tip Glow / Spark */}
                    {progress > 0 && progress < 100 && (
                        <div
                            className="absolute top-0 bottom-0 transition-all duration-300 ease-out"
                            style={{
                                left: `${progress}%`,
                                width: '2px',
                                backgroundColor: '#fff',
                                boxShadow: `0 0 15px 2px ${accentColor}`,
                                zIndex: 20
                            }}
                        />
                    )}

                    {/* Scanline Progress Effect */}
                    {progress > 0 && progress < 100 && (
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{ width: `${progress}%`, overflow: 'hidden' }}
                        >
                            <div className="w-[200%] h-full animate-[scanline_2s_linear_infinite] opacity-50"
                                style={{
                                    background: `linear-gradient(90deg, transparent 0%, ${accentColor} 50%, transparent 100%)`,
                                    backgroundSize: '50% 100%'
                                }}
                            />
                        </div>
                    )}

                    <span
                        className={`relative z-10 font-['Space_Mono'] font-black text-[14px] uppercase tracking-[1em] transition-colors duration-300 mr-[-1em] ${onExecute ? 'text-white/90 drop-shadow-md group-hover/exec:text-white' : 'text-white/20'}`}
                        style={onExecute ? { textShadow: `0 0 10px ${accentColor}44` } : {}}>
                        {progress > 0 && progress < 100 ? `${Math.round(progress)}%` :
                            progress === 100 ? 'EXECUTED' : 'EXECUTE'}
                    </span>
                </button>
            </div>
        </div>
    );
};

export default ModularFrame;
