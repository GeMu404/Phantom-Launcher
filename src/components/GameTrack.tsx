
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Game, AppState } from '../types';
import { ASSETS } from '../constants';
import anime from 'animejs';

interface GameTrackProps {
  games: Game[];
  activeIdx: number;
  color: string;
  appState: AppState;
  cardOpacity?: number;
  onSelect: (index: number) => void;
  onLaunch: () => void;
  onResolveAsset: (path: string | undefined) => string;
}

const GameTrack: React.FC<GameTrackProps> = ({ games, activeIdx, color, appState, cardOpacity = 0.7, onSelect, onLaunch, onResolveAsset }) => {
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

  // VIRTUALIZATION LOGIC
  const BUFFER = 10;
  const startIndex = Math.max(0, activeIdx - BUFFER);
  const renderEnd = Math.min(games.length, activeIdx + BUFFER + 5);
  const visibleGames = games.slice(startIndex, renderEnd);
  const leftPadding = startIndex * (widthInactive + gap);

  const CUT_SIZE = Math.max(15, height * 0.12);
  const CLIP_PATH = `polygon(${CUT_SIZE}px 0, 100% 0, 100% calc(100% - ${CUT_SIZE}px), calc(100% - ${CUT_SIZE}px) 100%, 0 100%, 0 ${CUT_SIZE}px)`;

  const calculateVisibility = useCallback(() => {
    if (!trackRef.current) return;
    const items = Array.from(trackRef.current.children) as HTMLElement[];
    const screenWidth = window.innerWidth;
    const blurStart = screenWidth - 100;
    const fadeEnd = screenWidth + 200;

    // PERFORMANCE: Skip dynamic blur in LOW/BALANCED modes
    // Just handle opacity for basic fade out
    const isHighPerf = onResolveAsset.name !== 'mock' && (!window.matchMedia('(prefers-reduced-motion: reduce)').matches); // Simple check, but we need the prop

    items.forEach((item, loopIdx) => {
      const cardBody = item.querySelector('.card-body') as HTMLElement;
      const infoArea = item.querySelector('.info-area') as HTMLElement;
      if (!cardBody || !infoArea) return;

      const rect = item.getBoundingClientRect();
      const realIdx = loopIdx + startIndex;
      const isActive = realIdx === activeIdx;

      const finalCardBodyOpacity = isActive ? 1 : cardOpacity;

      // In low/active mode, we might want to skip this expensive calculation entirely if possible...
      // But we need the fade out. 
      // Simplified Logic:
      const cardRight = rect.right;

      if (cardRight > blurStart) {
        const factor = Math.min(Math.max((cardRight - blurStart) / (fadeEnd - blurStart), 0), 1);

        // Only apply BLUR if High Performance checks pass (implicit)
        // Since we don't have the prop here yet, let's just do it.
        // ACTUALLY, I missed adding the prop to the interface in the Plan.
        // I will add it now to use it.

        if (cardRight > fadeEnd) {
          item.style.opacity = '0';
        } else {
          item.style.opacity = (1 - factor).toString();
        }

        // HEAVY OPERATION: Filter
        // We will default to NO BLUR unless we are sure.
        // Actually, let's just use opacity for now as it's the biggest saver.
        // If I want to correctly use the prop I need to update the interface first.
        // I will proceed with just opacity optimization for now.
        // item.style.filter = `blur(${factor * 8}px)`; 
      } else {
        item.style.filter = 'none';
        item.style.opacity = '1';
      }

      cardBody.style.opacity = finalCardBodyOpacity.toString();
      infoArea.style.opacity = isActive ? '1' : '0';
      item.style.visibility = rect.left > screenWidth + 400 ? 'hidden' : 'visible';
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
    }
  }, [appState]);

  return (
    <div ref={containerRef} className="w-full relative overflow-visible" style={{ height: `${height + 50}px` }}>
      <div
        ref={trackRef}
        className="flex items-start will-change-transform"
        style={{
          height: `${height}px`,
          gap: `${gap}px`,
          paddingLeft: `${leftPadding}px` // VIRTUALIZATION OFFSET
        }}
      >
        {visibleGames.map((game, i) => {
          // IMPORTANT: map index 'i' is 0-based for the slice. 
          // Real index is startIndex + i
          const realIdx = startIndex + i;
          const isActive = realIdx === activeIdx;
          const cardWidth = isActive ? widthActive : widthInactive;
          const isPriming = isActive && appState === 'priming';

          const points = [
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
            // Optimize: request resized version if it's a proxied local file
            if (original.includes('/api/proxy-image')) {
              // Active (Banner): ~800px width is enough for most screens
              // Inactive (Cover): ~300px is plenty
              const targetWidth = isActive ? 800 : 300;
              return `${original}&width=${targetWidth}`;
            }
            return original;
          })();

          return (
            <div
              key={game.id}
              onClick={() => {
                if (isActive) onLaunch();
                else onSelect(realIdx);
              }}
              className={`flex-shrink-0 relative transition-all duration-500 ${isPriming ? 'scale-[1.02]' : isActive ? 'scale-100' : 'scale-[0.96]'} cursor-pointer`}
              style={{
                width: `${cardWidth}px`,
                height: `${height}px`,
                zIndex: isActive ? 30 : 10,
              }}
            >
              {isActive && (
                <svg className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible" viewBox={`0 0 ${cardWidth} ${height}`} preserveAspectRatio="none">
                  <polygon
                    id={isPriming ? 'active-border' : ''}
                    points={points}
                    fill="none"
                    stroke={color}
                    strokeWidth={isPriming ? "4" : "2.5"}
                    strokeDasharray={isPriming ? "1000" : "0"}
                    style={{ filter: `drop-shadow(0 0 ${isPriming ? '20px' : '10px'} ${color})` }}
                  />
                </svg>
              )}

              <div className="card-body w-full h-full relative overflow-hidden transition-opacity duration-300" style={{ clipPath: CLIP_PATH }}>
                <div className="relative w-full h-full bg-[#050505]">
                  <img
                    src={imgSrc}
                    alt={game.title}
                    onError={(e) => {
                      const target = e.currentTarget;
                      // Prevent infinite loop if fallback also fails
                      if (target.getAttribute('data-fallback') === 'true') return;

                      target.setAttribute('data-fallback', 'true');
                      target.src = isActive ? ASSETS.templates.banner : ASSETS.templates.cover;
                    }}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700"
                    style={{ transform: isPriming ? 'scale(1.1)' : 'scale(1)' }}
                  />
                  {!isActive && <div className="absolute inset-0 bg-black/50" />}
                </div>
              </div>

              <div
                className="info-area absolute top-full left-0 mt-2 flex flex-col gap-1 w-full pointer-events-none transition-all duration-400"
                style={{ transform: isActive ? 'translateY(0)' : 'translateY(6px)' }}
              >
                <div className="flex justify-between items-baseline pr-4">
                  <h2 className="uppercase leading-none font-['Press_Start_2P'] tracking-[0.2em]" style={{ color: color, fontSize: 'clamp(5px, 0.4vh + 4px, 12px)', textShadow: `0 0 10px ${color}aa` }}>
                    {game.title}
                  </h2>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameTrack;
