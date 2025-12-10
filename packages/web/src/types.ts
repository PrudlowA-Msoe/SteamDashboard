export interface GameMetadata {
  appId: string;
  name: string;
  genres: string[];
  developer: string;
  publisher: string;
  icon: string;
  tags?: string[];
}

export interface SpotlightAchievement {
  apiName: string;
  displayName: string;
  description?: string;
  icon?: string;
  icongray?: string;
  achieved: boolean;
  unlockTime?: number;
}

export interface SpotlightPayload {
  appId: string;
  gameName: string;
  iconUrl?: string;
  headerImage?: string;
  playtimeForeverMinutes?: number;
  playtime2WeeksMinutes?: number;
  lastPlayedTimestamp?: number;
  achievements?: {
    total: number;
    unlocked: number;
    completionPct: number;
    list: SpotlightAchievement[];
    error?: string | null;
  };
  currentPlayers?: number | null;
  currentPlayersError?: string | null;
  news?: { gid: string; title: string; url: string; author?: string; date?: number; contents?: string }[];
  newsError?: string | null;
  trend?: { timestamp: number; playerCount: number | null }[];
}

export interface PlayerStats {
  profile: {
    steamid: string;
    personaname: string;
    avatarfull?: string;
    profileurl?: string;
  };
  totals: {
    ownedGames: number;
    recentGames: number;
    totalPlaytimeHours: number;
  };
  topGames: Array<{
    appId: number;
    name: string;
    playtimeHours: number;
    icon?: string;
  }>;
  recentGames: Array<{
    appId: number;
    name: string;
    playtime2WeeksHours: number;
    playtimeForeverHours: number;
  }>;
}

export interface GameSummary {
  appId: string;
  name: string;
  type: string;
  isFree: boolean;
  headerImage: string;
  shortDescription: string;
  genres: string[];
  platforms: any;
  price: any;
  publishers: string[];
  developers: string[];
  categories: string[];
  currentPlayers?: number | null;
}

export interface Friend {
  steamId: string;
  personaName: string;
  avatar?: string;
  profileUrl?: string;
  status: string;
  lastLogoff?: number;
  game?: string;
}

export interface NewsItem {
  gid: string;
  title: string;
  url: string;
  author?: string;
  date?: number;
  contents?: string;
}

export interface InventoryItem {
  assetId: string;
  classId: string;
  name: string;
  type?: string;
  icon?: string;
  tradable?: boolean;
}
