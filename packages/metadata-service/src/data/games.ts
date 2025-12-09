export interface GameMetadata {
  appId: string;
  name: string;
  genres: string[];
  developer: string;
  publisher: string;
  icon: string;
  tags?: string[];
}

export const games: GameMetadata[] = [
  {
    appId: "570",
    name: "Dota 2",
    genres: ["MOBA", "Strategy"],
    developer: "Valve",
    publisher: "Valve",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg",
    tags: ["multiplayer", "competitive", "esports"],
  },
  {
    appId: "730",
    name: "Counter-Strike 2",
    genres: ["FPS", "Competitive"],
    developer: "Valve",
    publisher: "Valve",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
    tags: ["shooter", "tactical", "esports"],
  },
  {
    appId: "440",
    name: "Team Fortress 2",
    genres: ["FPS", "Class-Based"],
    developer: "Valve",
    publisher: "Valve",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/440/header.jpg",
    tags: ["multiplayer", "shooter", "casual"],
  },
  {
    appId: "578080",
    name: "PUBG: BATTLEGROUNDS",
    genres: ["Battle Royale", "Shooter"],
    developer: "KRAFTON, Inc.",
    publisher: "KRAFTON, Inc.",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/578080/header.jpg",
    tags: ["battle-royale", "survival", "multiplayer"],
  },
  {
    appId: "1172470",
    name: "Apex Legends",
    genres: ["Battle Royale", "FPS"],
    developer: "Respawn Entertainment",
    publisher: "Electronic Arts",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/1172470/header.jpg",
    tags: ["hero-shooter", "multiplayer", "team"],
  },
  {
    appId: "271590",
    name: "Grand Theft Auto V",
    genres: ["Action", "Open World"],
    developer: "Rockstar North",
    publisher: "Rockstar Games",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/271590/header.jpg",
    tags: ["sandbox", "crime", "multiplayer"],
  }
];
