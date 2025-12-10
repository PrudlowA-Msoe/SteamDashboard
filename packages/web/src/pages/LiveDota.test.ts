// @ts-nocheck
import assert from "assert";
import { normalizeLiveGames } from "./LiveDota";

// Lightweight sanity checks for normalization and sorting key
(() => {
  const vm = normalizeLiveGames([
    {
      matchId: 1,
      spectators: 10,
      averageMmr: 4000,
      radiant: { name: "A", score: 5, towers: 6, barracks: 6 },
      dire: { name: "B", score: 4, towers: 5, barracks: 4 },
      durationSeconds: 800,
      roshanRespawnTimer: 0,
      league: 123,
      players: [],
    },
    {
      matchId: 2,
      spectators: 20,
      averageMmr: 5000,
      radiant: { name: "C", score: 8, towers: 6, barracks: 6 },
      dire: { name: "D", score: 9, towers: 5, barracks: 4 },
      durationSeconds: 900,
      roshanRespawnTimer: 20,
      league: 456,
      players: [],
    },
  ]);

  assert.equal(vm[0].scoreLine, "5 - 4");
  assert.equal(vm[1].roshan, "20s");
  // Higher spectators -> higher sort key
  assert.ok(vm[1].listSortKey > vm[0].listSortKey);
})();
