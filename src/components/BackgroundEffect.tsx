import React, { useMemo, useState, useEffect, useRef } from 'react';

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
  wallpaperAAEnabled?: boolean;
  highQualityBlobs?: boolean;
  isLowRes?: boolean;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
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
  wallpaperAAEnabled = false,
  highQualityBlobs = false,
  isLowRes = false,
  performanceMode = 'balanced'
}) => {
  const isHigh = performanceMode === 'high';
  const isLow = performanceMode === 'low';

  const resolveAsset = (path: string | undefined): string => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:') || path.startsWith('blob:')) return path;
    if (path.startsWith('./res') || path.startsWith('res/') || path.startsWith('/res/')) return path;
    const isLikelyPath = path.includes('.') || path.includes('/') || path.includes('\\') || path.match(/^[a-zA-Z]:/);
    if (!isLikelyPath) return path;

    const width = isLowRes ? 960 : 1920;
    return `/api/proxy-image?path=${encodeURIComponent(path)}&width=${width}`;
  };

  const finalWallpaperPath = gameWallpaper || categoryWallpaper || globalWallpaper;
  const resolvedUrl = useMemo(() => resolveAsset(finalWallpaperPath), [finalWallpaperPath, isLowRes]);

  // Double-buffering state
  const [activeLayer, setActiveLayer] = useState<'A' | 'B'>('A');
  const [layerA, setLayerA] = useState({ url: resolvedUrl, isReady: true });
  const [layerB, setLayerB] = useState({ url: '', isReady: false });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Buffer synchronization
  useEffect(() => {
    // If the top-level URL is actually new
    const currentActiveUrl = activeLayer === 'A' ? layerA.url : layerB.url;
    if (resolvedUrl === currentActiveUrl) return;

    // Handle empty URL case immediately (fade out nicely)
    if (!resolvedUrl) {
      if (activeLayer === 'A') {
        setLayerB({ url: '', isReady: true });
        setActiveLayer('B');
      } else {
        setLayerA({ url: '', isReady: true });
        setActiveLayer('A');
      }
      return;
    }

    // Start loading into the inactive buffer
    if (activeLayer === 'A') {
      setLayerB({ url: resolvedUrl, isReady: false });
    } else {
      setLayerA({ url: resolvedUrl, isReady: false });
    }
    setIsTransitioning(true);
  }, [resolvedUrl]);

  const handleLayerLoad = (layer: 'A' | 'B') => {
    if (layer === 'A' && activeLayer === 'B' && layerA.url) {
      setLayerA(p => ({ ...p, isReady: true }));
      setActiveLayer('A');
      setTimeout(() => setIsTransitioning(false), 500);
    } else if (layer === 'B' && activeLayer === 'A' && layerB.url) {
      setLayerB(p => ({ ...p, isReady: true }));
      setActiveLayer('B');
      setTimeout(() => setIsTransitioning(false), 500);
    } else {
      // Initial / same layer load
      if (layer === 'A') setLayerA(p => ({ ...p, isReady: true }));
      else setLayerB(p => ({ ...p, isReady: true }));
    }
  };

  // Fallback for broken images to prevent hanging transition
  const handleLayerError = (layer: 'A' | 'B') => {
    if (layer === 'A') {
      setLayerA({ url: '', isReady: true });
    } else {
      setLayerB({ url: '', isReady: true });
    }
    handleLayerLoad(layer); // Force the switch to the empty state so we don't hold the old image forever
  };

  const getObjectFitStyle = () => {
    switch (wallpaperMode) {
      case 'fill': return { objectFit: 'fill' as const };
      case 'contain': return { objectFit: 'contain' as const };
      case 'center': return { objectFit: 'none' as const, objectPosition: 'center' };
      default: return { objectFit: 'cover' as const };
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#050505]">
      {/* 1. Wallpaper Layer (Double Buffered) */}
      <div className="absolute inset-0 z-0 bg-black">
        {/* Layer A */}
        {layerA.url && (
          <img
            src={layerA.url}
            onLoad={() => handleLayerLoad('A')}
            onError={() => handleLayerError('A')}
            className={`absolute inset-0 w-full h-full block transition-opacity duration-700 ease-in-out ${activeLayer === 'A' ? 'opacity-100' : 'opacity-0'}`}
            style={{
              ...getObjectFitStyle(),
              ...(isHigh ? { filter: 'brightness(0.65) saturate(1.1)' } : {})
            }}
            alt=""
          />
        )}
        {/* Layer B */}
        {layerB.url && (
          <img
            src={layerB.url}
            onLoad={() => handleLayerLoad('B')}
            onError={() => handleLayerError('B')}
            className={`absolute inset-0 w-full h-full block transition-opacity duration-700 ease-in-out ${activeLayer === 'B' ? 'opacity-100' : 'opacity-0'}`}
            style={{
              ...getObjectFitStyle(),
              ...(isHigh ? { filter: 'brightness(0.65) saturate(1.1)' } : {})
            }}
            alt=""
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20 opacity-90" />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* 2. Grid Layer */}
      {gridEnabled && (
        <div className="absolute inset-0 z-10" style={{ opacity: gridOpacity, backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px)`, backgroundSize: '40px 40px' }} />
      )}

      {/* 3. Atmosphere — tiered by performance mode */}
      {bgAnimationsEnabled && !paused && !isLow && (
        <div className="absolute inset-0 overflow-hidden z-20" style={{ contain: 'strict' }}>
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
          className="absolute inset-0 z-30"
          style={{
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

export default BackgroundEffect;
