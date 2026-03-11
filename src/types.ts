
export interface Game {
  id: string;
  title: string;
  cover: string;
  banner: string;
  logo: string;
  execPath?: string; // Path to .exe or a URL
  execArgs?: string; // Command line arguments
  source?: 'manual' | 'steam' | 'imported' | 'xbox' | 'emu';
  sourceId?: string;
  platform?: string;
  category?: string;
  lastPlayed?: string;
  lastUpdated?: number;
  playtime?: string;
  wallpaper?: string;
  romPath?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  wallpaper?: string;
  wallpaperMode?: 'fill' | 'contain' | 'cover' | 'center';
  gridOpacity?: number;
  cardOpacity?: number; // Global transparency of cards
  cardTransparencyEnabled?: boolean;
  cardBlurEnabled?: boolean;
  innerGlowEnabled?: boolean;
  outerGlowEnabled?: boolean;
  lowResWallpaper?: boolean;
  configIcon?: string;
  games: Game[];
  enabled?: boolean;
  // Ambience Toggles
  bgAnimationsEnabled?: boolean;
  gridEnabled?: boolean;
  scanlineEnabled?: boolean;
  vignetteEnabled?: boolean;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
  outlineEnabled?: boolean;
  // Chroma_Protocol Palette
  assetColor?: string;
  nodeColor?: string;
  syncColor?: string;
  coreColor?: string;
  configColor?: string; // Missing from earlier but used
  secretColor?: string; // Missing from earlier but used
  slimModeEnabled?: boolean;
  monochromeModeEnabled?: boolean;
  primingAnimation?: 'waterfill' | 'scanline' | 'ignition' | 'charge' | 'shockwave' | 'glow_pulse';
}

export type AppState = 'idle' | 'transitioning' | 'launching' | 'priming';
