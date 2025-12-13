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

  const grafanaUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/grafana/d/usage-overview`
      : "http://localhost:3000/d/usage-overview";

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
  const serviceStatus = useMemo(() => summarizeServices(parsed), [parsed]);
  const endpointUsage = useMemo(() => summarizeEndpoints(parsed), [parsed]);

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
            <a className="ghost" href={grafanaUrl} target="_blank" rel="noreferrer">
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
        <div className="stack gap">
          {serviceStatus.length ? (
            <div className="card">
              <div className="card-body">
                <div className="card-header">
                  <h3>Service status</h3>
                  <p className="meta">Prometheus `up` metrics</p>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceStatus.map((s) => (
                      <tr key={s.name}>
                        <td>{s.name}</td>
                        <td>
                          <span className={`pill ${s.up ? "pill-success" : "pill-warn"}`}>
                            {s.up ? "Online" : "Offline"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {endpointUsage.length ? (
            <div className="card">
              <div className="card-body">
                <div className="card-header">
                  <h3>Endpoint usage</h3>
                  <p className="meta">Grouped by route and status (counts from request metrics)</p>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>Status</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpointUsage.slice(0, 40).map((e) => (
                      <tr key={`${e.route}-${e.status}`}>
                        <td>{e.route}</td>
                        <td>{e.status}</td>
                        <td>{e.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="empty">No parsed metrics yet. You can still view the raw output below.</div>
          )}
        </div>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 12 }}>
          {metrics || "No metrics loaded yet."}
        </pre>
      </div>
    </div>
  );
};

export default UsagePage;

type Sample = { name: string; value: number; labels: Record<string, string>; rawLabels: string };

function parsePrometheus(text: string): Sample[] {
  if (!text || text.trim().toLowerCase().startsWith("<!doctype")) return [];
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const items: Sample[] = [];
  for (const line of lines) {
    const [metricPart, valuePart] = line.split(/ (?=[^ ]+$)/);
    if (!metricPart || valuePart === undefined) continue;
    const match = metricPart.match(/^([^{]+){?(.*)?}?$/);
    if (!match) continue;
    const name = match[1];
    const rawLabels = match[2] || "";
    const valueNum = Number(valuePart);
    const labels: Record<string, string> = {};
    const labelRegex = /([\w.]+)="([^"]*)"/g;
    let m;
    while ((m = labelRegex.exec(rawLabels)) !== null) {
      labels[m[1]] = m[2];
    }
    items.push({ name, value: valueNum, labels, rawLabels });
  }
  return items;
}

function summarizeServices(samples: Sample[]): Array<{ name: string; up: boolean }> {
  const filtered = samples
    .filter((s) => s.name === "up" && Number.isFinite(s.value))
    .map((s) => {
      const svc = s.labels.job || s.labels.service || s.labels.instance || "unknown";
      return { name: svc, up: s.value === 1 };
    });

  const dedup = filtered.reduce((acc: Record<string, { name: string; up: boolean }>, cur) => {
    acc[cur.name] = cur; // last wins
    return acc;
  }, {});

  return Object.values(dedup);
}

function summarizeEndpoints(samples: Sample[]): Array<{ route: string; status: string; count: number }> {
  const endpointLike = samples.filter((s) => {
    const route = pickRoute(s.labels);
    return route && /request/i.test(s.name) && Number.isFinite(s.value);
  });
  const buckets: Record<string, { route: string; status: string; count: number }> = {};
  for (const s of endpointLike) {
    const route = pickRoute(s.labels) || "unknown";
    const status = s.labels.status || s.labels.code || "all";
    const key = `${route}|${status}`;
    if (!buckets[key]) buckets[key] = { route, status, count: 0 };
    buckets[key].count += s.value;
  }
  return Object.values(buckets).sort((a, b) => b.count - a.count);
}

function pickRoute(labels: Record<string, string>): string | undefined {
  return labels.route || labels.path || labels.endpoint || labels.handler;
}
