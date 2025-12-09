export function decodeToken(token: string | null) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return payload as { steamId?: string; personaName?: string; roles?: string[] };
  } catch {
    return null;
  }
}
