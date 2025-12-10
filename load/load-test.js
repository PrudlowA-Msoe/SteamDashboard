import http from "k6/http";
import { sleep } from "k6";

// Configure VUs and duration. Override via env: VUS, DURATION (e.g., VUS=50 DURATION=3m).
export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || "2m",
  thresholds: {
    http_req_duration: ["p(95)<600", "p(99)<900"], // ms targets
    http_req_failed: ["rate<0.01"],
  },
};

const BASE = __ENV.BASE || "https://steamviewdashboard.online";
const TOKEN = __ENV.JWT || "";

export default function () {
  const params = TOKEN ? { headers: { Authorization: `Bearer ${TOKEN}` } } : {};

  http.get(`${BASE}/stats/spotlight/owned`, params);
  http.get(`${BASE}/metadata/games`, params);
  http.get(`${BASE}/stats/games/570/summary`, params); // example appId (Dota 2)

  sleep(1);
}
