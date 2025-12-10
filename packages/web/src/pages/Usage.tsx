import { useEffect, useState } from "react";

interface Props {
  token: string;
  apiBase: string;
  roles: string[];
}

const UsagePage = ({ token, apiBase, roles }: Props) => {
  const [metrics, setMetrics] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = roles.includes("admin");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(new URL("/admin/usage", apiBase).toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Failed (${res.status})`);
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

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Usage metrics</h2>
            <p className="subhead">Prometheus-format metrics for all services.</p>
          </div>
          <button onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {error ? <div className="callout warn">{error}</div> : null}
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 12 }}>
          {metrics || "No metrics loaded yet."}
        </pre>
      </div>
    </div>
  );
};

export default UsagePage;
