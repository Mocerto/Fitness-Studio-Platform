"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type DashboardData = {
  from: string;
  to: string;
  // Financial
  revenue_cents: number;
  expense_cents: number;
  profit_cents: number;
  revenue_breakdown: Record<string, { amount_cents: number; count: number }>;
  payments_count: number;
  product_sales_cents: number;
  product_sales_count: number;
  // Attendance
  attendance_checkins: number;
  attendance_cancelled: number;
  attendance_no_shows: number;
  attendance_rate: string;
  // Members
  members_active: number;
  members_frozen: number;
  members_inactive: number;
  // Sessions
  sessions_scheduled: number;
  sessions_cancelled: number;
  // Leads
  leads_total: number;
  leads_converted: number;
  leads_conversion_rate: string;
  leads_pipeline: Record<string, number>;
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  DROP_IN: "Drop-in",
  PRODUCT_SALE: "Product Sale",
  OTHER: "Other",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TRIAL_SCHEDULED: "Trial Scheduled",
  TRIAL_COMPLETED: "Trial Completed",
  NEGOTIATING: "Negotiating",
  CONVERTED: "Converted",
  LOST: "Lost",
};

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function todayISODate() {
  return new Date().toISOString().split("T")[0];
}

const cardStyle: React.CSSProperties = {
  minWidth: "12rem",
  flex: "1 1 12rem",
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "1rem",
};

const bigNumber: React.CSSProperties = { fontSize: "1.5rem", fontWeight: 600, margin: "0.25rem 0" };

export default function DashboardClient() {
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const today = todayISODate();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    if (!studioId) {
      setData(null);
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.size > 0 ? `?${params.toString()}` : "";

    try {
      const response = await fetch(`/api/dashboard${query}`, { cache: "no-store" });
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
    if (studioId) {
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
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" onClick={() => void fetchDashboard()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {data ? (
        <div className="stack" style={{ gap: "1.5rem" }}>
          {/* Financial Overview */}
          <h2>Financial</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "stretch" }}>
            <div style={cardStyle}>
              <small>Revenue</small>
              <p style={{ ...bigNumber, color: "#16a34a" }}>{formatUSD(data.revenue_cents)}</p>
              <small>{data.payments_count} payment(s)</small>
            </div>
            <div style={cardStyle}>
              <small>Expenses</small>
              <p style={{ ...bigNumber, color: "#dc2626" }}>{formatUSD(data.expense_cents)}</p>
            </div>
            <div style={cardStyle}>
              <small>Profit</small>
              <p style={{ ...bigNumber, color: data.profit_cents >= 0 ? "#16a34a" : "#dc2626" }}>
                {formatUSD(data.profit_cents)}
              </p>
            </div>
            <div style={cardStyle}>
              <small>Product Sales</small>
              <p style={bigNumber}>{formatUSD(data.product_sales_cents)}</p>
              <small>{data.product_sales_count} sale(s)</small>
            </div>
          </div>

          {/* Revenue Breakdown */}
          {Object.keys(data.revenue_breakdown).length > 0 && (
            <>
              <h3>Revenue by Type</h3>
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.revenue_breakdown).map(([type, info]) => (
                    <tr key={type}>
                      <td>{PAYMENT_TYPE_LABELS[type] ?? type}</td>
                      <td>{formatUSD(info.amount_cents)}</td>
                      <td>{info.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Attendance */}
          <h2>Attendance</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "stretch" }}>
            <div style={cardStyle}>
              <small>Check-ins</small>
              <p style={bigNumber}>{data.attendance_checkins}</p>
            </div>
            <div style={cardStyle}>
              <small>No-shows</small>
              <p style={bigNumber}>{data.attendance_no_shows}</p>
            </div>
            <div style={cardStyle}>
              <small>Cancelled</small>
              <p style={bigNumber}>{data.attendance_cancelled}</p>
            </div>
            <div style={cardStyle}>
              <small>Attendance Rate</small>
              <p style={bigNumber}>{data.attendance_rate}%</p>
            </div>
          </div>

          {/* Members */}
          <h2>Members</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "stretch" }}>
            <div style={cardStyle}>
              <small>Active</small>
              <p style={{ ...bigNumber, color: "#16a34a" }}>{data.members_active}</p>
            </div>
            <div style={cardStyle}>
              <small>Frozen</small>
              <p style={{ ...bigNumber, color: "#2563eb" }}>{data.members_frozen}</p>
            </div>
            <div style={cardStyle}>
              <small>Inactive</small>
              <p style={{ ...bigNumber, color: "#6b7280" }}>{data.members_inactive}</p>
            </div>
          </div>

          {/* Sessions */}
          <h2>Sessions</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "stretch" }}>
            <div style={cardStyle}>
              <small>Scheduled</small>
              <p style={bigNumber}>{data.sessions_scheduled}</p>
            </div>
            <div style={cardStyle}>
              <small>Cancelled</small>
              <p style={bigNumber}>{data.sessions_cancelled}</p>
            </div>
          </div>

          {/* Leads */}
          <h2>Leads</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: "1rem", alignItems: "stretch" }}>
            <div style={cardStyle}>
              <small>Total Leads</small>
              <p style={bigNumber}>{data.leads_total}</p>
            </div>
            <div style={cardStyle}>
              <small>Converted</small>
              <p style={{ ...bigNumber, color: "#16a34a" }}>{data.leads_converted}</p>
            </div>
            <div style={cardStyle}>
              <small>Conversion Rate</small>
              <p style={bigNumber}>{data.leads_conversion_rate}%</p>
            </div>
          </div>

          {/* Leads Pipeline */}
          {Object.keys(data.leads_pipeline).length > 0 && (
            <>
              <h3>Pipeline</h3>
              <table>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.leads_pipeline).map(([status, count]) => (
                    <tr key={status}>
                      <td>{LEAD_STATUS_LABELS[status] ?? status}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : !loading ? (
        <p>No data yet.</p>
      ) : null}
    </section>
  );
}
