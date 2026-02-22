import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Game, AppState } from '../types';
import { ASSETS } from '../constants';
import anime from 'animejs';
import { getContrastColor } from '../utils/colors';

interface GameTrackProps {
  games: Game[];
  activeIdx: number;
  color: string;
  appState: AppState;
  cardOpacity?: number;
  cardBlurEnabled?: boolean;
  cardTransparencyEnabled?: boolean;
  onResolveAsset: (path: string | undefined) => string;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
  innerGlowEnabled?: boolean;
  outerGlowEnabled?: boolean;
  slimModeEnabled?: boolean;
  primingAnimation?: 'waterfill' | 'scanline' | 'ignition' | 'charge' | 'shockwave' | 'glow_pulse';
}

const GameTrack: React.FC<GameTrackProps> = React.memo(({
  games, activeIdx, color: rawColor, appState, cardOpacity = 0.7, cardBlurEnabled = true, cardTransparencyEnabled = true,
  onSelect, onLaunch, onResolveAsset, performanceMode = 'balanced', innerGlowEnabled = true, outerGlowEnabled = true,
  slimModeEnabled = false, primingAnimation = 'waterfill'
}) => {
  const color = rawColor;
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({
    height: 200,
    widthActive: 440,
    widthInactive: 140,
    gap: 12
  });

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight / 100;
      const vw = window.innerWidth / 100;

      const h = Math.max(120, Math.min(20 * vh, 240));

      setDimensions({
        height: h,
        widthActive: h * 2.3,
        widthInactive: h * 0.7,
        gap: Math.max(8, 1.2 * vh)
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  const { height, widthActive, widthInactive, gap } = dimensions;
  const BAR_H_VAL = Math.max(24, height * 0.16);

  // VIRTUALIZATION LOGIC
  const BUFFER = 10;
  const startIndex = Math.max(0, activeIdx - BUFFER);
  const renderEnd = Math.min(games.length, activeIdx + BUFFER + 5);
  const visibleGames = games.slice(startIndex, renderEnd);
  const leftPadding = startIndex * (widthInactive + gap);

  const CUT_SIZE = useMemo(() => Math.max(15, height * 0.12), [height]);
  const extClip = `polygon(${CUT_SIZE}px 0, 100% 0, 100% calc(100% - ${CUT_SIZE}px), calc(100% - ${CUT_SIZE}px) 100%, 0 100%, 0 ${CUT_SIZE}px)`;

  const lastVisibilityRun = useRef(0);

  const calculateVisibility = useCallback(() => {
    if (!trackRef.current) return;

    const screenWidth = window.innerWidth;
    const blurStart = screenWidth - 100;
    const fadeEnd = screenWidth + 200;

    // Use current anime value or fallback to computed target
    const currentTranslateX = anime.get(trackRef.current, 'translateX') as number;

    const items = Array.from(trackRef.current.children) as HTMLElement[];
    items.forEach((item, loopIdx) => {
      const realIdx = loopIdx + startIndex;
      const isActive = realIdx === activeIdx;

      // MATH BASED POSITION (No Layout Reads!)
      // cardLeft = padding + offset from previous cards + current container transform
      let offsetFromStart = 0;
      for (let j = 0; j < loopIdx; j++) {
        const itemIdx = startIndex + j;
        offsetFromStart += (itemIdx === activeIdx ? widthActive : widthInactive) + gap;
      }
      const cardLeft = leftPadding + offsetFromStart + currentTranslateX;
      const currentWidth = isActive ? widthActive : widthInactive;
      const cardRight = cardLeft + currentWidth;

      const cardBody = item.querySelector('.card-body') as HTMLElement;
      const infoArea = item.querySelector('.info-area') as HTMLElement;
      if (!cardBody || !infoArea) return;

      if (cardRight > blurStart) {
        const factor = Math.min(Math.max((cardRight - blurStart) / (fadeEnd - blurStart), 0), 1);
        item.style.opacity = cardRight > fadeEnd ? '0' : (1 - factor).toString();
      } else {
        item.style.filter = 'none';
        item.style.opacity = '1';
      }

      cardBody.style.opacity = isActive ? '1' : cardOpacity.toString();
      infoArea.style.opacity = isActive ? '1' : '0';
      item.style.visibility = cardLeft > screenWidth + 200 ? 'hidden' : 'visible';
    });
  }, [activeIdx, cardOpacity, startIndex, widthActive, widthInactive, gap, leftPadding]);

  // Duplicate block removed

  useEffect(() => {
    if (!trackRef.current) return;
    (anime as any).remove(trackRef.current);

    // The visual position is: - (activeIdx * (width + gap)) + leftPadding
    // Because the track is shifted left by the full amount of ALL previous items, 
    // but we only render starting from startIndex. The CSS transform moves the CONTAINER.
    // The padding pushes the content inside the container to the right.
    // Net result: The rendered items align exactly where they should be.
    const targetTranslateX = -(activeIdx * (widthInactive + gap));

    if (appState === 'transitioning') {
      trackRef.current.style.transform = `translateX(${targetTranslateX}px)`;
      calculateVisibility();
    } else {
      (anime as any)({
        targets: trackRef.current,
        translateX: targetTranslateX,
        easing: 'easeOutExpo',
        duration: 600,
        update: calculateVisibility,
        complete: calculateVisibility
      });
    }
  }, [activeIdx, dimensions, calculateVisibility, appState, widthInactive, gap, startIndex]);

  // CARD MORPH ANIMATION — physically grow/shrink cards when switching
  const prevActiveIdx = useRef(activeIdx);
  useLayoutEffect(() => {
    if (prevActiveIdx.current === activeIdx) return;
    const oldIdx = prevActiveIdx.current;
    prevActiveIdx.current = activeIdx;
    if (!trackRef.current) return;

    // NEWLY ACTIVE CARD — grow from cover to banner
    const activeCard = trackRef.current.querySelector(`[data-game-idx="${activeIdx}"]`) as HTMLElement;
    if (activeCard) {
      // Cancel any ongoing animations on this card
      (anime as any).remove(activeCard);

      // Set starting dimensions (cover size) BEFORE paint
      activeCard.style.width = `${widthInactive}px`;
      activeCard.style.height = `${height}px`;

      // Animate to banner dimensions
      (anime as any)({
        targets: activeCard,
        width: widthActive,
        height: height + BAR_H_VAL,
        easing: 'easeOutExpo',
        duration: 600,
      });

      // Title bar slides up from below
      const titleBar = activeCard.querySelector('.title-bar') as HTMLElement;
      if (titleBar) {
        (anime as any)({
          targets: titleBar,
          translateY: [BAR_H_VAL, 0],
          opacity: [0, 1],
          easing: 'easeOutExpo',
          duration: 500,
          delay: 150,
        });
      }

      // Glows scale in
      const glowSvgs = activeCard.querySelectorAll('.glow-svg');
      if (glowSvgs.length) {
        (anime as any)({
          targets: glowSvgs,
          opacity: [0, 1],
          scale: [0.95, 1],
          easing: 'easeOutQuad',
          duration: 400,
          delay: 200,
        });
      }

      // Inner glow blooms in
      const innerGlow = activeCard.querySelector('.inner-glow') as HTMLElement;
      if (innerGlow) {
        (anime as any)({
          targets: innerGlow,
          opacity: [0, 1],
          easing: 'easeOutQuad',
          duration: 500,
          delay: 250,
        });
      }
    }

    // PREVIOUSLY ACTIVE CARD — shrink from banner to cover
    const oldCard = trackRef.current.querySelector(`[data-game-idx="${oldIdx}"]`) as HTMLElement;
    if (oldCard) {
      (anime as any).remove(oldCard);

      // Set starting dimensions (banner size) BEFORE paint
      oldCard.style.width = `${widthActive}px`;
      oldCard.style.height = `${height + BAR_H_VAL}px`;

      // Animate to cover dimensions
      (anime as any)({
        targets: oldCard,
        width: widthInactive,
        height: height,
        easing: 'easeOutExpo',
        duration: 600,
      });
    }
  }, [activeIdx, widthActive, widthInactive, height]);

  useEffect(() => {
    if (appState === 'priming') {
      // Animation is handled purely by CSS overlays now
    } else {
      // Cleanup handled by React conditional rendering
    }
  }, [appState]);

  return (
    <div ref={containerRef} className="w-full relative overflow-visible" style={{ height: `${height + 110}px` }}>
      <div
        ref={trackRef}
        className="flex items-start will-change-transform relative"
        style={{
          height: `${height}px`,
          gap: `${gap}px`,
          paddingLeft: `${leftPadding}px` // VIRTUALIZATION OFFSET
        }}
      >
        {/* RADIANT NEON DEFINITION */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <filter id="neon-shadow" x="-50%" y="-50%" width="200%" height="200%">
              {/* Expand the shape slightly to create a clean 'halo' edge */}
              <feMorphology in="SourceAlpha" result="expanded" operator="dilate" radius="1.5" />
              <feGaussianBlur in="expanded" result="blur" stdDeviation="3.5" />
              <feFlood flood-color={color} result="glowColor" />
              <feComposite in="glowColor" in2="blur" operator="in" result="softGlow" />
              <feMerge>
                <feMergeNode in="softGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        </svg>

        {visibleGames.map((game, i) => {
          const realIdx = startIndex + i;
          const isActive = realIdx === activeIdx;
          const cardWidth = isActive ? widthActive : widthInactive;
          const isPriming = isActive && appState === 'priming';
          const totalHeight = isActive ? height + BAR_H_VAL : height;

          // SVG border points for the full shape
          const points = isActive
            ? [
              `${CUT_SIZE},0`,
              `${cardWidth},0`,
              `${cardWidth},${totalHeight - CUT_SIZE}`,
              `${cardWidth - CUT_SIZE},${totalHeight}`,
              `0,${totalHeight}`,
              `0,${CUT_SIZE}`
            ].join(' ')
            : [
              `${CUT_SIZE},0`,
              `${cardWidth},0`,
              `${cardWidth},${height - CUT_SIZE}`,
              `${cardWidth - CUT_SIZE},${height}`,
              `0,${height}`,
              `0,${CUT_SIZE}`
            ].join(' ');

          const rawImg = isActive ? (game.banner || ASSETS.templates.banner) : (game.cover || ASSETS.templates.cover);
          const imgSrc = (() => {
            const original = onResolveAsset(rawImg);
            if (original.includes('/api/proxy-image')) {
              const targetWidth = isActive ? 800 : 300;
              return `${original}&width=${targetWidth}`;
            }
            return original;
          })();

          return (
            <div
              key={`${game.id}-${realIdx}`}
              onClick={(e) => {
                e.stopPropagation();
                if (isActive) onLaunch();
                else onSelect(realIdx);
              }}
              className={`game-card relative overflow-visible flex-shrink-0 cursor-pointer will-change-transform ${isActive ? 'active' : ''}`}
              data-game-idx={realIdx}
              style={{
                width: `${cardWidth}px`,
                height: `${totalHeight}px`,
                zIndex: isActive ? 30 : 10,
              }}
            >
              {/* BACK GLOW (OUTER GLOW ONLY) - Placed under the opaque card body so inward bleed is hidden */}
              {isActive && (
                <svg className="glow-svg absolute inset-0 w-full h-full z-0 pointer-events-none overflow-visible" viewBox={`0 0 ${cardWidth} ${totalHeight}`} preserveAspectRatio="none">
                  <polygon
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth={isPriming ? "8" : "6"}
                    style={{
                      filter: outerGlowEnabled && !slimModeEnabled ? 'url(#neon-shadow)' : 'none',
                      opacity: slimModeEnabled ? 0 : 0.8
                    }}
                  />
                </svg>
              )}

              {/* INTEGRATED DESIGN CONTAINER */}
              <div
                className="card-body w-full h-full relative overflow-hidden z-10"
                style={{
                  clipPath: extClip,
                  WebkitClipPath: extClip,
                  backgroundColor: '#050505'
                }}
              >
                {/* Image area - RESTORED with 1px overflow to avoid sub-pixel gaps at edges */}
                <div
                  className="absolute left-0 right-0 bg-black"
                  style={{
                    top: '-1px',
                    height: isActive ? `${height + 2}px` : 'calc(100% + 2px)',
                    zIndex: 1,
                    // Interface clip: Only needs to handle the notch where it meets the title bar
                    clipPath: isActive ? `polygon(0 0, 100% 0, 100% calc(100% - ${CUT_SIZE}px), calc(100% - ${CUT_SIZE}px) 100%, 0 100%)` : 'none'
                  }}
                >
                  <img
                    src={imgSrc}
                    alt={game.title}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.getAttribute('data-fallback') === 'true') return;
                      target.setAttribute('data-fallback', 'true');
                      target.src = isActive ? ASSETS.templates.banner : ASSETS.templates.cover;
                    }}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
                    style={{
                      transform: isPriming ? 'scale(1.1)' : 'scale(1)',
                      opacity: isActive ? 1 : cardOpacity,
                    }}
                  />
                  {!isActive && <div className="absolute inset-0 bg-black/15" />}

                  {/* LOCALIZED INNER GLOW OVERLAY - Strictly for the image area art */}
                  {isActive && innerGlowEnabled && !slimModeEnabled && (
                    <svg
                      className="inner-glow absolute pointer-events-none"
                      style={{
                        top: '1px',
                        left: 0,
                        width: '100%',
                        height: `${height}px`,
                        zIndex: 2,
                      }}
                    >
                      <defs>
                        <clipPath id={`inner-glow-clip-${game.id}`}>
                          <polygon
                            points={[
                              `${CUT_SIZE},0`,
                              `${cardWidth},0`,
                              `${cardWidth},${height - CUT_SIZE}`,
                              `${cardWidth - CUT_SIZE},${height}`,
                              `0,${height}`,
                              `0,${CUT_SIZE}`
                            ].join(' ')}
                          />
                        </clipPath>
                      </defs>
                      <polygon
                        points={[
                          `${CUT_SIZE},0`,
                          `${cardWidth},0`,
                          `${cardWidth},${height - CUT_SIZE}`,
                          `${cardWidth - CUT_SIZE},${height}`,
                          `0,${height}`,
                          `0,${CUT_SIZE}`
                        ].join(' ')}
                        fill="none"
                        stroke={color}
                        strokeWidth="30"
                        filter="blur(15px)"
                        clipPath={`url(#inner-glow-clip-${game.id})`}
                        opacity="0.5"
                      />
                      {/* Crisp inner neon core */}
                      <polygon
                        points={[
                          `${CUT_SIZE},0`,
                          `${cardWidth},0`,
                          `${cardWidth},${height - CUT_SIZE}`,
                          `${cardWidth - CUT_SIZE},${height}`,
                          `0,${height}`,
                          `0,${CUT_SIZE}`
                        ].join(' ')}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        clipPath={`url(#inner-glow-clip-${game.id})`}
                        opacity="0.3"
                      />
                    </svg>
                  )}
                </div>

                {/* Title bar - Single element with integrated notch to avoid overlap/glow bugs */}
                {isActive && (
                  <div
                    className="title-bar absolute bottom-0 left-0 right-0 flex items-center px-4"
                    style={{
                      height: `${BAR_H_VAL + CUT_SIZE}px`,
                      backgroundColor: color || '#fff',
                      // Simplificamos: El padre ya recorta el exterior. Solo recortamos la "mordida" superior.
                      clipPath: `polygon(0 ${CUT_SIZE}px, calc(100% - ${CUT_SIZE}px) ${CUT_SIZE}px, 100% 0, 100% 100%, 0 100%)`,
                      WebkitClipPath: `polygon(0 ${CUT_SIZE}px, calc(100% - ${CUT_SIZE}px) ${CUT_SIZE}px, 100% 0, 100% 100%, 0 100%)`,
                      zIndex: 3
                    }}
                  >
                    <span
                      className="uppercase font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full"
                      style={{
                        fontFamily: "'Space Mono', Consolas, monospace",
                        fontSize: `${Math.min(14, Math.max(10, height * 0.065))}px`,
                        letterSpacing: '0.15em',
                        color: getContrastColor(color || '#fff'),
                        textShadow: '0 0 10px rgba(0,0,0,0.5)',
                        // Accurate vertical positioning in the solid bar area
                        marginTop: `${CUT_SIZE}px`
                      }}
                    >
                      {game.title}
                    </span>
                  </div>
                )}
              </div>

              {isActive && (
                <svg className="glow-svg absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible" viewBox={`0 0 ${cardWidth} ${totalHeight}`} preserveAspectRatio="none">
                  <polygon
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth={isPriming ? "4" : "2.5"}
                  />
                </svg>
              )}

              {/* PRIMING ANIMATION OVERLAY */}
              {isPriming && (() => {
                const animStyle: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 25, pointerEvents: 'none', overflow: 'hidden', clipPath: extClip, WebkitClipPath: extClip };
                switch (primingAnimation) {
                  case 'waterfill':
                    return (
                      <div style={animStyle}>
                        <div style={{
                          position: 'absolute', bottom: 0, left: '-20%', width: '140%', height: '100%',
                          background: `linear-gradient(35deg, ${color}cc 0%, ${color}44 40%, transparent 60%)`,
                          animation: 'waterfill-rise 1.5s ease-in-out forwards',
                        }} />
                        <style>{`@keyframes waterfill-rise { from { transform: translateY(100%); } to { transform: translateY(0%); } }`}</style>
                      </div>
                    );
                  case 'scanline':
                    return (
                      <div style={animStyle}>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '200%', height: '200%',
                          background: `repeating-linear-gradient(135deg, transparent, transparent 10px, ${color}33 10px, ${color}33 12px)`,
                          animation: 'scanline-sweep 1s linear infinite',
                        }} />
                        <div style={{
                          position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%',
                          background: `linear-gradient(135deg, transparent 0%, ${color}aa 50%, transparent 100%)`,
                          animation: 'scanline-beam 1.5s ease-in-out infinite',
                        }} />
                        <style>{`
                          @keyframes scanline-sweep { from { transform: translate(-12px, -12px); } to { transform: translate(0, 0); } }
                          @keyframes scanline-beam { 0% { transform: translateX(0%) translateY(0%); } 100% { transform: translateX(400%) translateY(200%); } }
                        `}</style>
                      </div>
                    );
                  case 'ignition':
                    return (
                      <div style={animStyle}>
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          background: `radial-gradient(circle at 0% 0%, ${color}88 0%, transparent 0%)`,
                          animation: 'ignition-tl 1.5s ease-out forwards',
                        }} />
                        <div style={{
                          position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                          background: `radial-gradient(circle at 100% 100%, ${color}88 0%, transparent 0%)`,
                          animation: 'ignition-br 1.5s ease-out 0.2s forwards',
                        }} />
                        <style>{`
                          @keyframes ignition-tl { to { background: radial-gradient(circle at 0% 0%, ${color}88 70%, transparent 70%); } }
                          @keyframes ignition-br { to { background: radial-gradient(circle at 100% 100%, ${color}88 70%, transparent 70%); } }
                        `}</style>
                      </div>
                    );
                  case 'charge':
                    return (
                      <div style={{ ...animStyle, top: 'auto', bottom: 0, height: `${BAR_H_VAL + CUT_SIZE}px` }}>
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, height: '100%', width: '0%',
                          background: `linear-gradient(90deg, ${color}00, ${color}99, white)`,
                          animation: 'charge-fill 1.5s ease-in-out forwards',
                          boxShadow: `0 0 20px ${color}, 0 0 40px ${color}88`,
                        }} />
                        <style>{`@keyframes charge-fill { to { width: 100%; } }`}</style>
                      </div>
                    );
                  case 'shockwave':
                    return (
                      <div style={animStyle}>
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px',
                          borderRadius: '50%', transform: 'translate(-50%, -50%)',
                          border: `3px solid ${color}`,
                          boxShadow: `0 0 20px ${color}, 0 0 40px ${color}66`,
                          animation: 'shockwave-pulse 0.8s ease-out infinite',
                        }} />
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%', width: '10px', height: '10px',
                          borderRadius: '50%', transform: 'translate(-50%, -50%)',
                          border: `2px solid ${color}88`,
                          animation: 'shockwave-pulse 0.8s ease-out 0.3s infinite',
                        }} />
                        <style>{`@keyframes shockwave-pulse { from { width: 10px; height: 10px; opacity: 1; } to { width: ${cardWidth * 2}px; height: ${totalHeight * 2}px; opacity: 0; } }`}</style>
                      </div>
                    );
                  case 'glow_pulse':
                    return (
                      <div style={{ ...animStyle, clipPath: 'none', WebkitClipPath: 'none', overflow: 'visible' }}>
                        <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${cardWidth} ${totalHeight}`} preserveAspectRatio="none">
                          <polygon
                            points={points}
                            fill="none"
                            stroke={color}
                            strokeWidth="8"
                            style={{ filter: 'url(#neon-shadow)', animation: 'glow-intensity 0.6s ease-in-out infinite alternate' }}
                          />
                        </svg>
                        <style>{`@keyframes glow-intensity { from { opacity: 0.4; } to { opacity: 1; } }`}</style>
                      </div>
                    );
                  default:
                    return null;
                }
              })()}

              <div
                className="info-area absolute top-full left-0 mt-2 w-full pointer-events-none transition-all duration-400"
                style={{ opacity: 0 }}
              />
            </div>
          );
        })}
      </div>
    </div >
  );
});

export default GameTrack;
