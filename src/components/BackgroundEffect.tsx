import React, { useMemo, useState, useEffect, useCallback } from 'react';

const AmbientNebula: React.FC<{ color: string, size?: string, opacity?: number, duration?: string }> = React.memo(({
  color,
  size = '800px',
  opacity = 0.04,
  duration = '120s'
}) => {
  const style = useMemo(() => ({
    left: Math.random() * 70 + 5 + '%',
    top: Math.random() * 70 + 5 + '%',
    animationDelay: -(Math.random() * 100) + 's',
    duration
  }), []);

  return (
    <div
      className="absolute pointer-events-none animate-nebula"
      style={{
        width: size,
        height: size,
        left: style.left,
        top: style.top,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        opacity: opacity,
        animationDuration: style.duration,
        animationDelay: style.animationDelay
      }}
    />
  );
});

const AtmosphericDust: React.FC<{ color: string }> = React.memo(({ color }) => {
  const particles = useMemo(() =>
    Array.from({ length: 6 }).map(() => ({
      left: Math.random() * 100 + '%',
      top: Math.random() * 100 + '%',
      animationDelay: -(Math.random() * 20) + 's',
      animationDuration: (Math.random() * 10 + 15) + 's'
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden opacity-40">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full animate-particle"
          style={{
            left: p.left,
            top: p.top,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`,
            animationDelay: p.animationDelay,
            animationDuration: p.animationDuration
          }}
        />
      ))}
    </div>
  );
});

interface BackgroundEffectProps {
  color: string;
  gameWallpaper?: string;
  categoryWallpaper?: string;
  globalWallpaper?: string;
  wallpaperMode?: 'fill' | 'contain' | 'cover' | 'center';
  gridOpacity?: number;
  bgAnimationsEnabled?: boolean;
  gridEnabled?: boolean;
  vignetteEnabled?: boolean;
  paused?: boolean;
  cardTransparencyEnabled?: boolean;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
  sidebarWidth?: string;
  assetVersion?: number;
}

const BackgroundEffect: React.FC<BackgroundEffectProps> = ({
  color,
  gameWallpaper,
  categoryWallpaper,
  globalWallpaper,
  wallpaperMode = 'cover',
  gridOpacity = 0.15,
  bgAnimationsEnabled = true,
  gridEnabled = true,
  vignetteEnabled = true,
  paused = false,
  cardTransparencyEnabled = false,
  performanceMode = 'balanced',
  sidebarWidth = '0px',
  assetVersion = 0
}) => {
  const isHigh = performanceMode === 'high';
  const isLow = performanceMode === 'low';

  const resolveAsset = useCallback((path: string | undefined): string => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
    if (path.startsWith('./res') || path.startsWith('res/') || path.startsWith('/res/')) return path;
    const isLikelyPath = path.includes('.') || path.includes('/') || path.includes('\\') || path.match(/^[a-zA-Z]:/);
    if (!isLikelyPath) return path;

    const width = 1920; 
    let url = `/api/proxy-image?path=${encodeURIComponent(path)}&width=${width}`;
    if (assetVersion > 0) url += `&v=${assetVersion}`;
    return url;
  }, [assetVersion]);

  // Triple Layer State (Game, Category, Global)
  const [urls, setUrls] = useState({
    game: resolveAsset(gameWallpaper),
    category: resolveAsset(categoryWallpaper),
    global: resolveAsset(globalWallpaper)
  });

  const [opacities, setOpacities] = useState({
    game: gameWallpaper ? 1 : 0,
    category: categoryWallpaper ? 1 : 0,
    global: 1
  });

  // Sync logic for 3-layer system
  useEffect(() => {
     const gUrl = resolveAsset(gameWallpaper);
     const cUrl = resolveAsset(categoryWallpaper);
     const glUrl = resolveAsset(globalWallpaper);

     setUrls({ game: gUrl, category: cUrl, global: glUrl });
     
     // Hierarchical logic: 
     // 1. If game has wallpaper, show game (O:1) and hide category/global (or keep under)
     // 2. If game is empty, hide game (O:0) and show category if exists
     // 3. etc.
     setOpacities({
       game: gUrl ? 1 : 0,
       category: cUrl ? 1 : 0,
       global: 1
     });
  }, [gameWallpaper, categoryWallpaper, globalWallpaper, resolveAsset]);

  const getObjectFitStyle = () => {
    switch (wallpaperMode) {
      case 'fill': return { objectFit: 'fill' as const };
      case 'contain': return { objectFit: 'contain' as const };
      case 'center': return { objectFit: 'none' as const, objectPosition: 'center' };
      default: return { objectFit: 'cover' as const };
    }
  };

  const layerStyle = {
    ...getObjectFitStyle(),
    willChange: 'opacity',
    ...(isHigh ? { filter: 'brightness(0.65) saturate(1.1)' } : {})
  };

  return (
    <div className={`fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#050505]`}>
      {/* 1. Triple Wallpaper Engine (Global [A] -> Category [B] -> Game [C]) */}
      <div className={`absolute inset-0 z-0 bg-black`}>
        {/* LAYER A: Global */}
        {urls.global && (
          <img
            src={urls.global}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
            style={{ ...layerStyle, opacity: opacities.global }}
          />
        )}

        {/* LAYER B: Category */}
        {urls.category && (
          <img
            src={urls.category}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
            style={{ ...layerStyle, opacity: opacities.category }}
          />
        )}

        {/* LAYER C: Game */}
        {urls.game && (
          <img
            src={urls.game}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
            style={{ ...layerStyle, opacity: opacities.game }}
          />
        )}

        {/* Visual Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20 opacity-90" />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* 2. Grid Layer */}
      {gridEnabled && (
        <div className="absolute inset-y-0 right-0 z-10" style={{ left: sidebarWidth, opacity: gridOpacity, backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      )}

      {/* 3. Atmosphere — tiered by performance mode */}
      {bgAnimationsEnabled && !paused && !isLow && (
        <div className="absolute inset-y-0 right-0 overflow-hidden z-20" style={{ left: sidebarWidth, contain: 'strict' }}>
          {isHigh && <AtmosphericDust color={color} />}
          <AmbientNebula
            color={color}
            size={isHigh ? '900px' : '600px'}
            opacity={isHigh ? 0.035 : 0.015}
            duration={'150s'}
          />
        </div>
      )}

      {/* 4. Cinematic Vignette — tiered */}
      {vignetteEnabled && (
        <div
          className="absolute inset-y-0 right-0 z-30"
          style={{
            left: sidebarWidth,
            // High intensity neon glow vignette (Stronger Light Bleed)
            boxShadow: isLow
              ? 'inset 0 0 120px rgba(0,0,0,0.85)'
              : `inset 0 0 250px rgba(0,0,0,0.9), inset 0 0 120px ${color}44`
          }}
        />
      )}
    </div>
  );
};

export default React.memo(BackgroundEffect);
