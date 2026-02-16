
import React, { useEffect, useRef, useState } from 'react';
import anime from 'animejs';

interface BackgroundEffectProps {
  color: string;
  wallpaper?: string;
  wallpaperMode?: 'fill' | 'contain' | 'cover' | 'center';
  gridOpacity?: number;
  animationsEnabled?: boolean;
  gridEnabled?: boolean;
  vignetteEnabled?: boolean;
  paused?: boolean;
}

const BackgroundEffect: React.FC<BackgroundEffectProps> = ({
  color,
  wallpaper,
  wallpaperMode = 'cover',
  gridOpacity = 0.15,
  animationsEnabled = true,
  gridEnabled = true,
  vignetteEnabled = true,
  paused = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayWallpaper, setDisplayWallpaper] = useState<{ current: string | undefined, prev: string | undefined }>({
    current: wallpaper,
    prev: undefined
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Handle smooth cross-fade when wallpaper changes
  useEffect(() => {
    if (wallpaper !== displayWallpaper.current) {
      setIsTransitioning(true);
      setDisplayWallpaper(prev => ({
        prev: prev.current,
        current: wallpaper
      }));

      // Cleanup previous wallpaper after transition completes
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setDisplayWallpaper(prev => ({
          ...prev,
          prev: undefined
        }));
      }, 700); // Slightly longer than transition for safety

      return () => clearTimeout(timer);
    }
  }, [wallpaper]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const blobContainer = container.querySelector('.blob-container');
    if (!blobContainer) return;

    // Cleanup function to remove shapes and stop animations
    const cleanup = () => {
      anime.remove('.blob-shape'); // Remove anime instances for these targets
      blobContainer.innerHTML = '';
    };

    cleanup();

    if (!animationsEnabled || paused) return;

    const numShapes = 6;
    for (let i = 0; i < numShapes; i++) {
      const shape = document.createElement('div');
      shape.className = 'blob-shape absolute opacity-[0.08] pointer-events-none transition-colors duration-1000';
      const size = Math.random() * 500 + 300;
      shape.style.width = `${size}px`;
      shape.style.height = `${size}px`;
      shape.style.borderRadius = '30% 70% 70% 30% / 30% 30% 70% 70%';
      shape.style.backgroundColor = color;
      shape.style.left = `${Math.random() * 100}%`;
      shape.style.top = `${Math.random() * 100}%`;
      shape.style.filter = 'blur(120px)';
      blobContainer.appendChild(shape);

      (anime as any)({
        targets: shape,
        translateX: () => (anime as any).random(-200, 200),
        translateY: () => (anime as any).random(-200, 200),
        rotate: '360deg',
        duration: () => (anime as any).random(15000, 30000),
        direction: 'alternate',
        loop: true,
        easing: 'linear'
      });
    }

    return cleanup;
  }, [color, animationsEnabled, paused]);

  const getObjectFitStyle = () => {
    switch (wallpaperMode) {
      case 'fill': return { objectFit: 'fill' as const };
      case 'contain': return { objectFit: 'contain' as const };
      case 'center': return { objectFit: 'none' as const, objectPosition: 'center' };
      case 'cover':
      default: return { objectFit: 'cover' as const };
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-[#050505]"
    >
      {/* 1. Wallpaper Layers (Stacked for Cross-fade) */}
      <div className="absolute inset-0 z-0 overflow-hidden">

        {/* Previous Wallpaper (Stays visible behind new one for smooth cross-fade) */}
        {displayWallpaper.prev && (
          <div className="absolute inset-0">
            <img
              src={displayWallpaper.prev}
              alt=""
              className="w-full h-full block"
              style={{
                ...getObjectFitStyle(),
                filter: 'grayscale(0.1) contrast(1.1) brightness(0.55)',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Current Wallpaper (Fades In over previous) */}
        {displayWallpaper.current && (
          <div className="absolute inset-0">
            <img
              key={displayWallpaper.current}
              src={displayWallpaper.current}
              alt="Background"
              className={`w-full h-full block ${isTransitioning ? 'animate-wallpaper-in' : ''}`}
              style={{
                ...getObjectFitStyle(),
                filter: 'grayscale(0.1) contrast(1.1) brightness(0.55)',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Consistent Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 opacity-90" />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* 2. Persistent Grid Overlay */}
      {gridEnabled && (
        <div
          className="absolute inset-0 z-10 transition-opacity duration-1000"
          style={{
            opacity: gridOpacity,
            backgroundImage: `
              linear-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255, 255, 255, 0.12) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />
      )}

      {/* 3. Dynamic Blobs */}
      <div className="blob-container absolute inset-0 mix-blend-screen z-20" />

      {/* 4. Edge Glow Vignette */}
      {vignetteEnabled && (
        <div
          className="absolute inset-0 transition-colors duration-1000 z-30"
          style={{
            boxShadow: `inset 0 0 450px ${color}1a`,
            background: `radial-gradient(circle at center, transparent 30%, #000000aa 100%)`
          }}
        />
      )}
    </div>
  );
};

export default BackgroundEffect;
