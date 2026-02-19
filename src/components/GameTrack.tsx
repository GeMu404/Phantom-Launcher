
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Game, AppState } from '../types';
import { ASSETS } from '../constants';
import anime from 'animejs';

/** Returns '#000' or '#fff' for best contrast against the given hex color */
function getContrastColor(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5 ? '#000' : '#fff';
}

interface GameTrackProps {
  games: Game[];
  activeIdx: number;
  color: string;
  appState: AppState;
  cardOpacity?: number;
  cardBlurEnabled?: boolean;
  cardTransparencyEnabled?: boolean;
  onSelect: (index: number) => void;
  onLaunch: () => void;
  onResolveAsset: (path: string | undefined) => string;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
}

const GameTrack: React.FC<GameTrackProps> = React.memo(({ games, activeIdx, color, appState, cardOpacity = 0.7, cardBlurEnabled = true, cardTransparencyEnabled = true, onSelect, onLaunch, onResolveAsset, performanceMode = 'balanced' }) => {
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

    // Throttle: skip if called too rapidly (anime.js calls this every tick)
    const now = performance.now();
    if (now - lastVisibilityRun.current < 16) return; // Cap at ~60fps
    lastVisibilityRun.current = now;

    const items = Array.from(trackRef.current.children) as HTMLElement[];
    const screenWidth = window.innerWidth;
    const blurStart = screenWidth - 100;
    const fadeEnd = screenWidth + 200;

    // PHASE 1: BATCH ALL READS (no style writes here!)
    const readings = items.map((item, loopIdx) => {
      const rect = item.getBoundingClientRect();
      const realIdx = loopIdx + startIndex;
      const isActive = realIdx === activeIdx;
      return { item, rect, isActive, cardRight: rect.right, cardLeft: rect.left };
    });

    // PHASE 2: BATCH ALL WRITES (no layout reads here!)
    readings.forEach(({ item, isActive, cardRight, cardLeft }) => {
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
      item.style.visibility = cardLeft > screenWidth + 400 ? 'hidden' : 'visible';
    });
  }, [activeIdx, cardOpacity, startIndex]);

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
  }, [activeIdx, dimensions, calculateVisibility, appState, widthInactive, gap, startIndex]); // Added startIndex dep to ensure padding update syncs

  useEffect(() => {
    if (appState === 'priming') {
      (anime as any)({
        targets: '#active-border',
        strokeDashoffset: [(anime as any).setDashoffset, 0],
        duration: 1500,
        easing: 'linear'
      });
    } else {
      (anime as any).remove('#active-border');
      // Reset to SOLID border (offset 0) on cancel/idle
      const path = document.getElementById('active-border');
      if (path) {
        (path as any).style.strokeDashoffset = '0';
      }
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
              className={`game-card relative overflow-visible flex-shrink-0 cursor-pointer transition-all duration-500 will-change-transform ${isActive ? 'active' : ''}`}
              style={{
                width: `${cardWidth}px`,
                height: `${totalHeight}px`,
                zIndex: isActive ? 30 : 10,
              }}
            >
              {/* INTEGRATED DESIGN CONTAINER */}
              <div
                className="card-body w-full h-full relative overflow-hidden"
                style={{
                  clipPath: extClip,
                  WebkitClipPath: extClip,
                  backgroundColor: '#050505'
                }}
              >
                {/* Image area */}
                <div
                  className="absolute top-0 left-0 right-0 bg-black"
                  style={{ height: isActive ? `${height}px` : '100%' }}
                >
                  <img
                    src={imgSrc}
                    alt={game.title}
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
                </div>

                {/* Title bar (Nests the patch triangle for sync) */}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 flex items-center px-4"
                    style={{
                      height: `${BAR_H_VAL}px`,
                      backgroundColor: color || '#fff'
                    }}
                  >
                    {/* PATCH TRIANGLE - Synced with bar animation */}
                    <div
                      className="absolute right-0 pointer-events-none"
                      style={{
                        top: `-${CUT_SIZE}px`,
                        width: `${CUT_SIZE + 2}px`,
                        height: `${CUT_SIZE + 2}px`,
                        backgroundColor: color || '#fff',
                        transform: 'translate(1.5px, 1.5px)',
                        clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
                        WebkitClipPath: 'polygon(100% 0, 100% 100%, 0 100%)'
                      }}
                    />

                    <span
                      className="uppercase font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full"
                      style={{
                        fontFamily: "'Space Mono', Consolas, monospace",
                        fontSize: `${Math.min(14, Math.max(10, height * 0.065))}px`,
                        letterSpacing: '0.15em',
                        color: getContrastColor(color || '#fff'),
                      }}
                    >
                      {game.title}
                    </span>
                  </div>
                )}
              </div>

              {isActive && (
                <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible" viewBox={`0 0 ${cardWidth} ${totalHeight}`} preserveAspectRatio="none">
                  <polygon
                    id="active-border"
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth={isPriming ? "4" : "2.5"}
                    style={{
                      filter: performanceMode !== 'low' ? 'url(#neon-shadow)' : 'none'
                    }}
                  />
                </svg>
              )}

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
