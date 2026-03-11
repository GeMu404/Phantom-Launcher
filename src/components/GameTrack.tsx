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
  progress?: number;
  isExecuting?: boolean;
  isReady?: boolean;
  scrollProgress?: number | (() => void) | null;
  showScrollMarker?: boolean | (() => void) | null;
  closeLabel?: string;
  t?: any;
  cardOpacity?: number;
  cardBlurEnabled?: boolean;
  cardTransparencyEnabled?: boolean;
  onResolveAsset: (path: string | undefined) => string;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
  innerGlowEnabled?: boolean;
  outerGlowEnabled?: boolean;
  slimModeEnabled?: boolean;
  outlineEnabled?: boolean;
  primingAnimation?: 'waterfill' | 'scanline' | 'ignition' | 'charge' | 'shockwave' | 'glow_pulse';
  onSelect: (index: number) => void;
  onLaunch: () => void;
}

const GameTrack: React.FC<GameTrackProps> = React.memo(({
  games, activeIdx, color: rawColor, appState, cardOpacity = 0.7, cardBlurEnabled = true, cardTransparencyEnabled = true,
  onSelect, onLaunch, onResolveAsset, performanceMode = 'balanced', innerGlowEnabled = true, outerGlowEnabled = true,
  slimModeEnabled = false, outlineEnabled = true, primingAnimation = 'waterfill',
  progress,
  isExecuting,
  isReady,
  scrollProgress,
  showScrollMarker,
  closeLabel,
  t
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

    // PREVIOUSLY ACTIVE CARD — shrink from banner size to cover dimensions
    const oldCard = trackRef.current.querySelector(`[data-game-idx="${oldIdx}"]`) as HTMLElement;
    if (oldCard) {
      (anime as any).remove(oldCard);
      // Set starting dimensions (banner size) BEFORE paint
      oldCard.style.width = `${widthActive}px`;
      oldCard.style.height = `${height}px`;

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


        {visibleGames.map((game, i) => {
          const realIdx = startIndex + i;
          const isActive = realIdx === activeIdx;
          const cardWidth = isActive ? widthActive : widthInactive;
          const isPriming = isActive && appState === 'priming';

          const getImg = (path: string, w: number) => {
            const res = onResolveAsset(path);
            return res.includes('/api/proxy-image') ? `${res}&width=${w}` : res;
          };
          const bPoints = [
            `${CUT_SIZE},0`,
            `${cardWidth},0`,
            `${cardWidth},${height - CUT_SIZE}`,
            `${cardWidth - CUT_SIZE},${height}`,
            `0,${height}`,
            `0,${CUT_SIZE}`
          ].join(' ');

          const nPoints = [
            `${CUT_SIZE / 2},0`,
            `${cardWidth},0`,
            `${cardWidth},${BAR_H_VAL - CUT_SIZE / 2}`,
            `${cardWidth - CUT_SIZE / 2},${BAR_H_VAL}`,
            `0,${BAR_H_VAL}`,
            `0,${CUT_SIZE / 2}`
          ].join(' ');

          const bClip = `polygon(${CUT_SIZE}px 0, 100% 0, 100% calc(100% - ${CUT_SIZE}px), calc(100% - ${CUT_SIZE}px) 100%, 0 100%, 0 ${CUT_SIZE}px)`;
          const nClip = `polygon(${CUT_SIZE / 2}px 0, 100% 0, 100% calc(100% - ${CUT_SIZE / 2}px), calc(100% - ${CUT_SIZE / 2}px) 100%, 0 100%, 0 ${CUT_SIZE / 2}px)`;

          const bSrc = getImg(game.banner || ASSETS.templates.banner, 800);
          const cSrc = getImg(game.cover || ASSETS.templates.cover, isActive ? 400 : 300);
          const lSrc = game.logo ? onResolveAsset(game.logo) : null;

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
                height: `${height}px`,
                zIndex: isActive ? 30 : 10,
              }}
            >
              {/* BACK GLOW (EXPLICIT SVG BLUR) */}
              {isActive && outerGlowEnabled && !slimModeEnabled && (
                <svg
                  className={`glow-svg absolute z-0 pointer-events-none overflow-visible ${isPriming && primingAnimation === 'glow_pulse' ? 'animate-prime-glow-pulse' : ''}`}
                  style={{ top: 0, left: 0, width: '100%', height: '100%' }}
                >
                  <polygon points={bPoints} fill="none" stroke={color} strokeWidth="6" style={{ filter: 'blur(6px)', opacity: 1 }} />
                  <polygon points={bPoints} fill="none" stroke={color} strokeWidth="16" style={{ filter: 'blur(16px)', opacity: 0.6 }} />
                  <polygon points={bPoints} fill="none" stroke={color} strokeWidth="30" style={{ filter: 'blur(30px)', opacity: 0.3 }} />

                  <g style={{ transform: `translateY(calc(100% + 8px))` }}>
                    <polygon points={nPoints} fill="none" stroke={color} strokeWidth="6" style={{ filter: 'blur(6px)', opacity: 1 }} />
                    <polygon points={nPoints} fill="none" stroke={color} strokeWidth="16" style={{ filter: 'blur(16px)', opacity: 0.6 }} />
                    <polygon points={nPoints} fill="none" stroke={color} strokeWidth="30" style={{ filter: 'blur(30px)', opacity: 0.3 }} />
                  </g>
                </svg>
              )}

              {/* Box 1: Banner / Image Container */}
              <div style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                zIndex: 10
              }}>
                <div
                  className="card-body w-full h-full relative bg-[#050505]"
                  style={{
                    clipPath: bClip,
                    WebkitClipPath: bClip,
                    opacity: cardTransparencyEnabled ? (isActive ? 1 : cardOpacity) : 1
                  }}
                >
                  <img
                    src={isActive ? bSrc : cSrc}
                    alt={game.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      transform: isPriming ? 'scale(1.05)' : 'scale(1)',
                      transition: 'transform 0.5s ease-out',
                      opacity: isActive ? 1 : cardOpacity,
                    }}
                  />

                  {isActive && innerGlowEnabled && (
                    <div className="absolute inset-0 z-10 pointer-events-none transition-opacity duration-500"
                      style={{
                        boxShadow: `inset 0 0 40px ${color}66, inset 0 0 10px ${color}aa`,
                        mixBlendMode: 'screen',
                        opacity: isPriming ? 0 : 0.6
                      }} />
                  )}

                  {isActive && isPriming && (
                    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden" style={{ clipPath: bClip }}>
                      {primingAnimation === 'waterfill' && (
                        <div className="absolute bottom-0 left-0 w-full h-[100%] bg-gradient-to-t from-white/60 to-transparent"
                          style={{ transformOrigin: 'bottom', animation: 'prime-waterfill 1.5s cubic-bezier(0.1, 0.9, 0.2, 1) forwards' }} />
                      )}

                      {primingAnimation === 'scanline' && (
                        <div className="absolute top-0 left-0 w-full h-[15%] bg-gradient-to-b from-transparent via-white/80 to-transparent"
                          style={{ animation: 'prime-scanline 1.5s cubic-bezier(0.4, 0, 1, 1) forwards' }} />
                      )}

                      {primingAnimation === 'ignition' && (
                        <div className="absolute inset-0 bg-white mix-blend-overlay"
                          style={{ animation: 'prime-ignition 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }} />
                      )}

                      {primingAnimation === 'charge' && (
                        <div className="absolute inset-0 ring-inset"
                          style={{ animation: 'prime-charge 1.5s ease-in forwards' }} />
                      )}

                      {primingAnimation === 'shockwave' && (
                        <div className="absolute inset-0 border-white/80"
                          style={{ animation: 'prime-shockwave 1.5s ease-out forwards' }} />
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* PERFECT SVG OUTLINE (Top Layer for sharp edges) */}
              <svg
                className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible"
                viewBox={`0 0 ${cardWidth} ${height}`}
                preserveAspectRatio="none"
              >
                <polygon
                  points={bPoints}
                  fill="none"
                  stroke={isActive ? color : color}
                  strokeWidth={outlineEnabled ? (isActive ? (isPriming ? "5" : "3") : "1.5") : "0"}
                  style={{
                    opacity: isActive ? 1 : 0.4
                  }}
                />
              </svg>

              {/* Box 2: Name Block (Under Box 1) - ONLY FOR ACTIVE */}
              {isActive && (
                <div className="title-bar absolute top-[calc(100%+8px)] left-0 w-full z-10">
                  <div
                    style={{
                      width: '100%',
                      height: BAR_H_VAL,
                      backgroundColor: color || '#fff',
                      clipPath: nClip,
                      WebkitClipPath: nClip,
                      boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                      opacity: cardTransparencyEnabled ? cardOpacity : 1
                    }}
                  >
                    <div className="h-full flex items-center px-4">
                      <span
                        className="uppercase font-black whitespace-nowrap overflow-hidden text-ellipsis w-full"
                        style={{
                          fontFamily: "'Space Mono', monospace",
                          fontSize: `${Math.min(14, Math.max(10, height * 0.05))}px`,
                          letterSpacing: '0.3em',
                          color: getContrastColor(color || '#fff'),
                        }}
                      >
                        {game.title}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div >
    </div >
  );
});

export default GameTrack;
