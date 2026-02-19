
export interface Game {
  id: string;
  title: string;
  cover: string;
  banner: string;
  logo: string;
  execPath?: string; // Path to .exe or a URL
  execArgs?: string; // Command line arguments
  source?: 'manual' | 'steam' | 'imported';
  lastPlayed?: string;
  playtime?: string;
  wallpaper?: string;
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
  cardBlurEnabled?: boolean;
  cardTransparencyEnabled?: boolean;
  lowResWallpaper?: boolean;
  wallpaperAAEnabled?: boolean;
  highQualityBlobs?: boolean;
  configIcon?: string;
  games: Game[];
  enabled?: boolean;
  // Ambience Toggles
  bgAnimationsEnabled?: boolean;
  gridEnabled?: boolean;
  scanlineEnabled?: boolean;
  vignetteEnabled?: boolean;
  performanceMode?: 'high' | 'balanced' | 'low' | 'custom';
  // Chroma_Protocol Palette
  assetColor?: string;
  nodeColor?: string;
  syncColor?: string;
  coreColor?: string;
}

export type AppState = 'idle' | 'transitioning' | 'launching' | 'priming';
