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
    onExecuteStart?: () => void;
    onExecuteEnd?: () => void;
    progress?: number; // 0 to 100
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
    modalOpacity?: number;
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
    onExecuteStart,
    onExecuteEnd,
    progress = 0,
    isExecuting = false,
    isReady = false,
    scrollProgress,
    showScrollMarker,
    onScrollDrag,
    closeLabel,
    t,
    outerGlowEnabled = true,
    outlineEnabled = true,
    cardTransparencyEnabled = true,
    cardOpacity = 0.7,
    modalOpacity = 0.10
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<SVGRectElement>(null);
    const trackOverlayRef = useRef<HTMLDivElement>(null);
    const canScrollRef = useRef(false);
    const [dims, setDims] = useState({ w: 0, h: 0 });
    const [isDraggingScroll, setIsDraggingScroll] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            const data = e.detail;
            if (!data) return;

            const { show, progress } = data;
            canScrollRef.current = show;

            if (thumbRef.current) {
                thumbRef.current.setAttribute('opacity', show ? '1' : '0');
                if (show && dims.h > 0) {
                    const trackHeight = Math.max(0, dims.h - 208);
                    const thumbHeight = 40;
                    const maxPos = trackHeight - thumbHeight;
                    const y = 120 + (progress * maxPos);
                    thumbRef.current.setAttribute('y', y.toString());
                }
            }

            if (trackOverlayRef.current) {
                trackOverlayRef.current.style.display = show ? 'block' : 'none';
            }
        };
        window.addEventListener('phantom-scroll', handler);
        return () => window.removeEventListener('phantom-scroll', handler);
    }, [dims.h]);

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

    const progressClip = useMemo(() => {
        if (progress <= 0) return 'inset(0 100% 0 0)';
        if (progress >= 100) return 'none';
        return `inset(0 ${100 - progress}% 0 0)`;
    }, [progress]);

    // Handle interactive custom scrolling mapped exactly over the HUD Track
    const handleScrollPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!canScrollRef.current) return;
        setIsDraggingScroll(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        updateScrollFromEvent(e);
    };

    const handleScrollPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDraggingScroll || !canScrollRef.current) return;
        updateScrollFromEvent(e);
    };

    const handleScrollPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDraggingScroll(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const updateScrollFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
        const trackHeight = Math.max(0, dims.h - 208);
        const thumbHeight = 40;
        const maxScrollOffset = Math.max(1, trackHeight - thumbHeight);

        const rect = e.currentTarget.getBoundingClientRect();
        let offsetY = e.clientY - rect.top - (thumbHeight / 2);
        let p = offsetY / maxScrollOffset;
        p = Math.max(0, Math.min(1, p));

        window.dispatchEvent(new CustomEvent('phantom-scroll-set', { detail: p }));

        // Manual thumb feedback while dragging since we are bypassing React state
        if (thumbRef.current) {
            const y = 120 + (p * maxScrollOffset);
            thumbRef.current.setAttribute('y', y.toString());
        }

        if (onScrollDrag) onScrollDrag(p); // Optional prop mapping fallback
    };

    return (
        <div ref={containerRef} className={`relative flex flex-col ${className}`}
            style={{ width: size.width, height: size.height }}>

            {/* VECTOR BACKGROUND LAYER */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
                style={{ zIndex: 0 }}>
                {/* Frame Shell - Background Base */}
                <path
                    d={framePath}
                    fill="#080808"
                    fillOpacity={!cardTransparencyEnabled ? 1 : modalOpacity}
                    className="transition-all duration-500"
                />

                {/* Frame Stroke - Border and Glow */}
                <path
                    d={framePath}
                    fill="none"
                    stroke={accentColor}
                    strokeWidth={outlineEnabled ? "2" : (outerGlowEnabled ? "1" : "0")}
                    strokeLinejoin="miter"
                    style={{
                        filter: outerGlowEnabled ? `drop-shadow(0 0 14px ${accentColor})` : 'none',
                    }}
                    className="transition-all duration-500"
                />

                {/* Badge Shell */}
                <path
                    d={badgePath}
                    fill={accentColor}
                    fillOpacity={(onExecute || onExecuteStart) ? 0.26 : (cardTransparencyEnabled ? 0.05 : 0.15)}
                    className="transition-all duration-500"
                    stroke={accentColor}
                    strokeWidth={outlineEnabled ? "2" : (outerGlowEnabled ? "1" : "0")}
                    strokeLinejoin="miter"
                    style={{
                        filter: outerGlowEnabled ? `drop-shadow(0 0 12px ${accentColor})` : 'none',
                    }}
                />

                {/* Progress Fill Layer (Staged hold or real progress) */}
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
                <rect
                    ref={thumbRef}
                    x={dims.w - 32}
                    y="120"
                    width="12"
                    height="40"
                    fill={isDraggingScroll ? "#fff" : accentColor}
                    opacity="0"
                    style={{ filter: outerGlowEnabled ? `drop-shadow(0 0 10px ${accentColor})` : 'none' }}
                    className="transition-colors duration-100 ease-out pointer-events-none"
                />
            </svg>

            {/* INTERACTIVE SCROLL TRACK OVERLAY */}
            <div
                ref={trackOverlayRef}
                className="absolute z-50 cursor-ns-resize"
                style={{
                    display: 'none',
                    right: 20,
                    top: 120,
                    width: 24,
                    height: Math.max(0, dims.h - 208),
                }}
                onPointerDown={handleScrollPointerDown}
                onPointerMove={handleScrollPointerMove}
                onPointerUp={handleScrollPointerUp}
                onPointerCancel={handleScrollPointerUp}
            />

            {/* CONTENT LAYER */}
            <div className="relative z-10 flex-1 flex flex-col overflow-hidden transition-colors duration-300"
                style={{
                    clipPath: contentClip,
                    WebkitClipPath: contentClip,
                    backgroundColor: cardTransparencyEnabled
                        ? `${accentColor}14`
                        : 'transparent'
                }}>
                {children}
            </div>

            {/* COMMAND HUD OVERLAY (Bottom Left of content area) */}
            {
                (commandText || commandDesc) && (
                    <div className="absolute bottom-[10px] left-[241px] pointer-events-none z-50 flex flex-col gap-1 max-w-[600px]">
                        {commandText && (
                            <span className="font-['Space_Mono'] font-black text-[12px] uppercase tracking-[0.3em]" style={{ color: accentColor }}>
                                COMMAND : {commandText}
                            </span>
                        )}
                        <div className="min-h-[2.4em] flex flex-col justify-start">
                            {commandDesc && (
                                <span className="font-['Space_Mono'] text-[9px] uppercase tracking-wider opacity-60 text-white leading-[1.2em] line-clamp-2 overflow-hidden break-words">
                                    {commandDesc}
                                </span>
                            )}
                        </div>
                    </div>
                )
            }

            {/* BADGE CONTENT OVERLAY */}
            <div className="absolute bottom-0 right-0 z-[100] flex items-center justify-center pointer-events-none"
                style={{ width: bW, height: bH }}>
                <button
                    onClick={onExecute ? onExecute : undefined}
                    onPointerDown={(e) => {
                        if (e.button !== 0 && e.pointerType === 'mouse') return;
                        if (onExecuteStart) onExecuteStart();
                    }}
                    onPointerUp={(e) => {
                        if (e.button !== 0 && e.pointerType === 'mouse') return;
                        if (onExecuteEnd) onExecuteEnd();
                    }}
                    onPointerLeave={() => {
                        if (onExecuteEnd) onExecuteEnd();
                    }}
                    onPointerCancel={() => {
                        if (onExecuteEnd) onExecuteEnd();
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={isExecuting || (!onExecute && !onExecuteStart) || !isReady}
                    className={`flex items-center justify-center w-full h-full group/exec transition-all duration-300 disabled:opacity-40 disabled:pointer-events-none relative overflow-hidden select-none cursor-pointer touch-none`}
                    style={{
                        pointerEvents: ((onExecute || onExecuteStart) && !isExecuting && isReady) ? 'auto' : 'none',
                        clipPath: `polygon(0 ${bCut}px, ${bCut}px 0, 100% 0, 100% calc(100% - ${bCut}px), calc(100% - ${bCut}px) 100%, 0 100%, 0 ${bCut}px)`
                    }}>

                    {/* CLOSE LABEL OVERLAY (When DISCONNECT becomes BACK) */}
                    {closeLabel && (
                        <div className="absolute inset-x-0 top-[-24px] flex justify-center pointer-events-none">
                            <span className="font-['Space_Mono'] text-[8px] font-bold uppercase tracking-[0.4em] opacity-40 whitespace-nowrap" style={{ color: accentColor }}>
                                [ {closeLabel} ]
                            </span>
                        </div>
                    )}

                    {/* Redefine Progress Color for Destruction */}
                    {(() => {
                        const isDestruction = commandText?.includes('DESTRUCTION') || commandText?.includes('TERMINATE') || commandText?.includes('AUTODESTRUCT');
                        const barColor = isDestruction ? '#ef4444' : accentColor;

                        return (
                            <>
                                {/* Background / Filling Logic */}
                                <div
                                    className="absolute inset-0 transition-all duration-300"
                                    style={{
                                        backgroundColor: isExecuting ? `${accentColor}20` : (isReady ? `${accentColor}40` : 'transparent'),
                                        boxShadow: (isReady && !isExecuting && outerGlowEnabled) ? `inset 0 0 20px ${accentColor}44` : 'none',
                                        opacity: (onExecute || onExecuteStart) ? 1 : 0.4
                                    }}
                                />

                                {/* Real Progress Fill */}
                                {(isExecuting || progress > 0) && (
                                    <div
                                        className="absolute inset-0 transition-all duration-[16ms] ease-linear"
                                        style={{
                                            backgroundColor: barColor,
                                            clipPath: `inset(0 ${100 - progress}% 0 0)`,
                                            opacity: isDestruction ? 0.9 : 0.4,
                                            boxShadow: isDestruction && progress > 0 ? '0 0 30px rgba(239, 68, 68, 0.4)' : 'none'
                                        }}
                                    />
                                )}

                                <div className="relative z-20 flex items-center justify-center w-full h-full group">
                                    {/* Base Text (Always EXECUTE or SYNCING) */}
                                    <span className={`text-[12px] font-black tracking-[0.6em] whitespace-nowrap transition-all duration-500 ${isReady ? 'text-white' : 'text-white/40'}`}
                                        style={isReady && !isExecuting ? { textShadow: `0 0 15px ${accentColor}, 0 0 5px #fff` } : {}}>
                                        {isExecuting ? (t ? t('nav.syncing') + '...' : 'SYNCING...') : (closeLabel || 'EXECUTE')}
                                    </span>

                                    {/* High-Contrast Fill Text */}
                                    {(isExecuting || progress > 0) && (
                                        <div
                                            className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
                                            style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                                        >
                                            <span className={`text-[12px] font-black tracking-[0.6em] whitespace-nowrap ${isDestruction ? 'text-white' : 'text-black/90'}`}>
                                                {isExecuting ? (t ? t('nav.syncing') + '...' : 'SYNCING...') : (closeLabel || 'EXECUTE')}
                                            </span>
                                        </div>
                                    )}

                                    {isReady && !isExecuting && (
                                        <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                            <div className="w-1.5 h-1.5 bg-white rotate-45" style={{ boxShadow: `0 0 10px #fff` }} />
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })()}
                </button>
            </div>
        </div >
    );
};

export default ModularFrame;
