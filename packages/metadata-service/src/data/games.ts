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
  },
  {
    appId: "381210",
    name: "Dead by Daylight",
    genres: ["Horror", "Multiplayer"],
    developer: "Behaviour Interactive Inc.",
    publisher: "Behaviour Interactive Inc.",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/381210/header.jpg",
    tags: ["asymmetrical", "survival", "co-op"],
  },
  {
    appId: "252490",
    name: "Rust",
    genres: ["Survival", "Open World"],
    developer: "Facepunch Studios",
    publisher: "Facepunch Studios",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/252490/header.jpg",
    tags: ["survival", "pvp", "crafting"],
  },
  {
    appId: "1426210",
    name: "EA SPORTS FC 24",
    genres: ["Sports", "Simulation"],
    developer: "EA Canada & EA Romania",
    publisher: "Electronic Arts",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/1426210/header.jpg",
    tags: ["football", "multiplayer", "sports"],
  },
  {
    appId: "1172620",
    name: "ELDEN RING",
    genres: ["RPG", "Action"],
    developer: "FromSoftware Inc.",
    publisher: "Bandai Namco Entertainment",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/header.jpg",
    tags: ["soulslike", "open-world", "hardcore"],
  },
  {
    appId: "1174180",
    name: "Red Dead Redemption 2",
    genres: ["Action", "Open World"],
    developer: "Rockstar Games",
    publisher: "Rockstar Games",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/header.jpg",
    tags: ["western", "story-rich", "adventure"],
  },
  {
    appId: "892970",
    name: "Valheim",
    genres: ["Survival", "Co-op"],
    developer: "Iron Gate AB",
    publisher: "Coffee Stain Publishing",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/892970/header.jpg",
    tags: ["viking", "building", "exploration"],
  },
  {
    appId: "1281930",
    name: "Halo Infinite",
    genres: ["FPS", "Shooter"],
    developer: "343 Industries",
    publisher: "Xbox Game Studios",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/1240440/header.jpg",
    tags: ["shooter", "multiplayer", "arena"],
  },
  {
    appId: "440900",
    name: "Conan Exiles",
    genres: ["Survival", "Open World"],
    developer: "Funcom",
    publisher: "Funcom",
    icon: "https://cdn.cloudflare.steamstatic.com/steam/apps/440900/header.jpg",
    tags: ["survival", "crafting", "multiplayer"],
  }
];
