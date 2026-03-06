"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type LeadStatus = "NEW" | "CONTACTED" | "TRIAL_SCHEDULED" | "TRIAL_COMPLETED" | "NEGOTIATING" | "CONVERTED" | "LOST";
type LeadSource = "WALK_IN" | "REFERRAL" | "SOCIAL_MEDIA" | "WEBSITE" | "PHONE" | "OTHER";

type Lead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  interested_in: string | null;
  notes: string | null;
  converted_member_id: string | null;
  last_contacted_at: string | null;
  created_at: string;
};

type Summary = {
  total: number;
  converted: number;
  conversion_rate: string;
  pipeline: Record<string, number>;
};

const STATUS_OPTIONS: LeadStatus[] = [
  "NEW", "CONTACTED", "TRIAL_SCHEDULED", "TRIAL_COMPLETED", "NEGOTIATING", "CONVERTED", "LOST",
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  TRIAL_SCHEDULED: "Trial Scheduled",
  TRIAL_COMPLETED: "Trial Completed",
  NEGOTIATING: "Negotiating",
  CONVERTED: "Converted",
  LOST: "Lost",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function LeadsClient() {
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchLeads = useCallback(async () => {
    if (!studioId) {
      setLeads([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const response = await fetch(`/api/leads${query}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        data?: Lead[];
        summary?: Summary;
        message?: string;
      };

      if (!response.ok) {
        setLeads([]);
        setError(payload.message ?? "Failed to load leads.");
        return;
      }

      setLeads(payload.data ?? []);
      setSummary(payload.summary ?? null);
    } catch {
      setLeads([]);
      setError("Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, studioId]);

  useEffect(() => {
    if (studioId) {
      void fetchLeads();
    } else {
      setLeads([]);
    }
  }, [studioId, statusFilter, fetchLeads]);

  async function handleConvert(leadId: string) {
    if (!confirm("Convert this lead to a member?")) return;

    try {
      const response = await fetch(`/api/leads/${leadId}/convert`, { method: "POST" });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        alert(payload.message ?? "Failed to convert lead.");
        return;
      }

      void fetchLeads();
    } catch {
      alert("Failed to convert lead.");
    }
  }

  return (
    <section className="stack">
      <h1>Leads</h1>

      {summary && (
        <div className="row">
          <strong>Total: {summary.total}</strong>
          <strong>Converted: {summary.converted}</strong>
          <strong>Conversion Rate: {summary.conversion_rate}%</strong>
          {Object.entries(summary.pipeline).map(([status, count]) => (
            <span key={status}>
              {STATUS_LABELS[status as LeadStatus] ?? status}: {count}
            </span>
          ))}
        </div>
      )}

      <div className="row">
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | LeadStatus)}
          >
            <option value="ALL">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={() => void fetchLeads()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/leads/new">New lead</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Source</th>
            <th>Status</th>
            <th>Interested In</th>
            <th>Last Contact</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr>
              <td colSpan={9}>{loading ? "Loading..." : "No leads found."}</td>
            </tr>
          ) : (
            leads.map((lead) => (
              <tr key={lead.id}>
                <td>{`${lead.first_name} ${lead.last_name}`}</td>
                <td>{lead.email ?? "-"}</td>
                <td>{lead.phone ?? "-"}</td>
                <td>{lead.source.replace("_", " ")}</td>
                <td>{STATUS_LABELS[lead.status]}</td>
                <td>{lead.interested_in ?? "-"}</td>
                <td>{lead.last_contacted_at ? formatDate(lead.last_contacted_at) : "-"}</td>
                <td>{formatDate(lead.created_at)}</td>
                <td>
                  <div className="row">
                    <Link href={`/leads/${lead.id}/edit`}>Edit</Link>
                    {lead.status !== "CONVERTED" && lead.status !== "LOST" && (
                      <button type="button" onClick={() => handleConvert(lead.id)}>
                        Convert
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
