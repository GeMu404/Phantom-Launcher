
import React, { useEffect, useRef, useState } from 'react';
import { Game } from '../types';
import { ASSETS } from '../constants';
import anime from 'animejs';

interface GameInfoProps {
  game: Game;
  color: string;
  isLaunching: boolean;
  onLaunch: () => void;
  taskbarMargin?: number;
  onResolveAsset: (path: string | undefined) => string;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
}

const GameInfo: React.FC<GameInfoProps> = React.memo(({ game, color: rawColor, isLaunching, onLaunch, taskbarMargin = 0, onResolveAsset, performanceMode = 'balanced' }) => {
  const color = rawColor;
  const logoRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    setImgStatus('loading');
    if (game?.logo) {
      const img = new Image();
      const resolved = onResolveAsset(game.logo);
      img.src = resolved;
      img.onload = () => setImgStatus('loaded');
      img.onerror = () => setImgStatus('error');
      // Cleanup: release reference on unmount/change
      return () => { img.onload = null; img.onerror = null; img.src = ''; };
    } else {
      setImgStatus('error');
    }
  }, [game?.id, game?.logo]);

  // Container entrance animation
  useEffect(() => {
    if (containerRef.current) {
      (anime as any).remove(containerRef.current);
      (anime as any)({
        targets: containerRef.current,
        opacity: [0, 1],
        translateX: [20, 0],
        duration: 800,
        easing: 'easeOutExpo'
      });
    }
  }, [game?.id]);

  useEffect(() => {
    if (logoRef.current && (imgStatus === 'loaded' || imgStatus === 'error')) { // Animate for fallback too
      (anime as any).remove(logoRef.current);
      (anime as any)({
        targets: logoRef.current,
        opacity: [0, 1],
        scale: [1.1, 1],
        rotateZ: [0.2, 0],
        duration: 1200,
        easing: 'easeOutElastic(1, .8)'
      });
    }
  }, [game?.id, imgStatus]);

  if (!game) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed right-[2.5vw] z-[70] flex flex-col items-end pointer-events-none transition-all duration-700 ${isLaunching ? 'opacity-0 scale-110 translate-x-10' : 'opacity-100 translate-x-0'}`}
      style={{
        width: 'calc(160px + 12vw)',
        bottom: `${taskbarMargin + (window.innerHeight * 0.025)}px`
      }}
    >
      <div className="relative w-full flex items-end justify-end" style={{ height: 'calc(70px + 14vh)' }}>
        {imgStatus === 'loaded' ? (
          <img
            ref={logoRef}
            src={onResolveAsset(game.logo)}
            alt={game.title}
            className="max-h-full w-auto max-w-full object-contain object-right-bottom"
            style={performanceMode === 'high'
              ? { filter: `drop-shadow(0 0 2px #fff) drop-shadow(0 0 12px ${color}) drop-shadow(0 0 30px ${color})` }
              : performanceMode === 'balanced'
                ? { filter: `drop-shadow(0 0 10px ${color})` }
                : {}
            }
          />
        ) : (
          /* Fallback: Template Logo + Text Overlay or just Template Logo if it's generic */
          <div className="relative flex flex-col items-end">
            <img
              ref={logoRef}
              src={ASSETS.templates.logo}
              alt="Logo"
              onError={(e) => e.currentTarget.style.display = 'none'}
              className="max-h-[80px] w-auto object-contain mb-2 opacity-80"
              style={{ opacity: 0.8 }}
            />
            <h3 className="text-white font-['Press_Start_2P'] uppercase text-right leading-tight" style={{ fontSize: 'calc(10px + 0.8vh)', textShadow: `0 0 15px ${color}` }}>
              {game.title}
            </h3>
          </div>
        )}
      </div>
    </div>
  );
});

export default GameInfo;
