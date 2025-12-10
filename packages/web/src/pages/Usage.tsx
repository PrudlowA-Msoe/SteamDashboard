import { useEffect, useMemo, useState } from "react";

interface Props {
  token: string;
  apiBase: string;
  roles: string[];
}

const UsagePage = ({ token, apiBase, roles }: Props) => {
  const [metrics, setMetrics] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [htmlWarning, setHtmlWarning] = useState(false);

  const isAdmin = roles.includes("admin");

  const load = async () => {
    setLoading(true);
    setError(null);
    setHtmlWarning(false);
    try {
      // Try stats-scoped path to ensure it goes through gateway proxy
      const url = new URL("/stats/admin/usage", apiBase).toString();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Failed (${res.status})`);
      if (text.toLowerCase().includes("<!doctype html")) {
        setHtmlWarning(true);
      }
      setMetrics(text);
    } catch (e: any) {
      setError(e?.message || "Failed to load metrics");
      setMetrics("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="page">
        <h1>Usage</h1>
        <p className="subhead">You need admin access to view usage metrics.</p>
      </div>
    );
  }

  const parsed = useMemo(() => parsePrometheus(metrics), [metrics]);

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Usage metrics</h2>
            <p className="subhead">Prometheus-format metrics for all services.</p>
          </div>
          <div className="inline gap">
            <a className="ghost" href="http://localhost:3000/d/usage-overview" target="_blank" rel="noreferrer">
              Open Grafana
            </a>
            <button onClick={load} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>
        {error ? <div className="callout warn">{error}</div> : null}
        {htmlWarning ? (
          <div className="callout warn">
            Metrics response looks like HTML (probably the SPA). Ensure Caddy is proxying /admin/* to the gateway and retry. Showing raw
            response below.
          </div>
        ) : null}
        {parsed.length ? (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {parsed.slice(0, 30).map((m: any, i: number) => (
              <div className="card" key={`${m.name}-${i}`}>
                <div className="card-body">
                  <div className="card-header">
                    <h3>{m.name}</h3>
                    <span className="status">{m.value}</span>
                  </div>
                  <p className="meta">{m.labels}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No parsed metrics yet. You can still view the raw output below.</div>
        )}
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 12 }}>
          {metrics || "No metrics loaded yet."}
        </pre>
      </div>
    </div>
  );
};

export default UsagePage;

function parsePrometheus(text: string): Array<{ name: string; value: string; labels: string }> {
  if (!text || text.trim().startsWith("<!doctype")) return [];
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const items: Array<{ name: string; value: string; labels: string }> = [];
  for (const line of lines) {
    const [metricPart, valuePart] = line.split(/ (?=[^ ]+$)/);
    if (!metricPart || valuePart === undefined) continue;
    const match = metricPart.match(/^([^{]+){?(.*)?}?$/);
    if (!match) continue;
    const name = match[1];
    const labels = match[2] || "";
    items.push({ name, value: valuePart, labels });
  }
  return items;
}
