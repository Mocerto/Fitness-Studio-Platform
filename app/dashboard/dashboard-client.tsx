"use client";

import { useCallback, useEffect, useState } from "react";

type DashboardData = {
  from: string;
  to: string;
  revenue_cents_total: number;
  payments_count: number;
  attendance_checkins_count: number;
  attendance_cancelled_count: number;
  active_members_count: number;
  sessions_scheduled_count: number;
  sessions_cancelled_count: number;
};

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function todayISODate() {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardClient() {
  const today = todayISODate();
  const [studioId, setStudioId] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("studio_id");
    if (stored) setStudioId(stored);
  }, []);

  const fetchDashboard = useCallback(async () => {
    if (!studioId.trim()) {
      setData(null);
      setError("Provide studio id first.");
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.size > 0 ? `?${params.toString()}` : "";

    try {
      const response = await fetch(`/api/dashboard${query}`, {
        headers: { "x-studio-id": studioId.trim() },
        cache: "no-store",
      });

      const payload = (await response.json()) as { data?: DashboardData; message?: string };
      if (!response.ok) {
        setData(null);
        setError(payload.message ?? "Failed to load dashboard.");
        return;
      }

      setData(payload.data ?? null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [studioId, from, to]);

  useEffect(() => {
    if (studioId.trim()) {
      window.localStorage.setItem("studio_id", studioId.trim());
      void fetchDashboard();
    } else {
      setData(null);
    }
  }, [studioId, fetchDashboard]);

  return (
    <section className="stack">
      <h1>Dashboard</h1>

      <div className="row">
        <label>
          Studio ID
          <input
            value={studioId}
            onChange={(e) => setStudioId(e.target.value)}
            placeholder="UUID from studios table"
          />
        </label>

        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={to}
            max={today}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>

        <button type="button" onClick={() => void fetchDashboard()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {data ? (
        <div className="row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "stretch" }}>
          <div className="card" style={{ minWidth: "10rem" }}>
            <h2>Revenue</h2>
            <p style={{ fontSize: "1.5rem" }}>{formatUSD(data.revenue_cents_total)}</p>
            <small>{data.payments_count} payment(s) in range</small>
          </div>

          <div className="card" style={{ minWidth: "10rem" }}>
            <h2>Check-ins</h2>
            <p style={{ fontSize: "1.5rem" }}>{data.attendance_checkins_count}</p>
            <small>{data.attendance_cancelled_count} cancelled</small>
          </div>

          <div className="card" style={{ minWidth: "10rem" }}>
            <h2>Active Members</h2>
            <p style={{ fontSize: "1.5rem" }}>{data.active_members_count}</p>
            <small>Current snapshot</small>
          </div>

          <div className="card" style={{ minWidth: "10rem" }}>
            <h2>Sessions Scheduled</h2>
            <p style={{ fontSize: "1.5rem" }}>{data.sessions_scheduled_count}</p>
            <small>{data.sessions_cancelled_count} cancelled in range</small>
          </div>
        </div>
      ) : !loading ? (
        <p>Enter a studio ID to see metrics.</p>
      ) : null}
    </section>
  );
}
