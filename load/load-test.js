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

const BASE = (__ENV.BASE || "https://steamviewdashboard.online").replace(/\/$/, "");
const RAW_TOKEN = __ENV.JWT || "";
const AUTH_HEADER = RAW_TOKEN
  ? RAW_TOKEN.startsWith("Bearer ")
    ? RAW_TOKEN
    : `Bearer ${RAW_TOKEN}`
  : "";

const params = AUTH_HEADER ? { headers: { Authorization: AUTH_HEADER } } : {};

export default function () {
  // Spotlight owned library (requires JWT)
  http.get(`${BASE}/stats/spotlight/owned`, params);

  // Spotlight for a specific app (uses a common title for caching benefits)
  http.get(`${BASE}/stats/spotlight/632360`, params); // Risk of Rain 2 (example)

  // Live Dota featured match (public)
  http.get(`${BASE}/stats/live/dota/featured`, params);

  // Metadata/games for search cache (public)
  http.get(`${BASE}/metadata/games`, params);

  sleep(1);
}
