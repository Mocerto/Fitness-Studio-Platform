"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type SessionStatus = "SCHEDULED" | "CANCELLED";

type Session = {
  id: string;
  status: SessionStatus;
  starts_at: string;
  ends_at: string | null;
  capacity: number;
  class_type: { id: string; name: string };
  coach: { id: string; name: string } | null;
  created_at: string;
};

type StatusFilter = "ALL" | SessionStatus;

function formatDatetime(value: string) {
  return new Date(value).toLocaleString();
}

export default function SessionsClient() {
  const [studioId, setStudioId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("studio_id");
    if (stored) setStudioId(stored);
  }, []);

  const fetchSessions = useCallback(async () => {
    if (!studioId.trim()) {
      setSessions([]);
      setError("Provide studio id first.");
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    const query = params.size > 0 ? `?${params.toString()}` : "";

    try {
      const response = await fetch(`/api/sessions${query}`, {
        headers: { "x-studio-id": studioId.trim() },
        cache: "no-store",
      });

      const payload = (await response.json()) as { data?: Session[]; message?: string };
      if (!response.ok) {
        setSessions([]);
        setError(payload.message ?? "Failed to load sessions.");
        return;
      }

      setSessions(payload.data ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [studioId, statusFilter, fromFilter, toFilter]);

  useEffect(() => {
    if (studioId.trim()) {
      window.localStorage.setItem("studio_id", studioId.trim());
      void fetchSessions();
    } else {
      setSessions([]);
    }
  }, [studioId, statusFilter, fromFilter, toFilter, fetchSessions]);

  async function handleCancel(sessionId: string) {
    if (!studioId.trim()) return;
    setError("");

    try {
      const response = await fetch(`/api/sessions/${sessionId}/cancel`, {
        method: "POST",
        headers: { "x-studio-id": studioId.trim() },
      });

      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        setError(result.message ?? "Failed to cancel session.");
        return;
      }

      void fetchSessions();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <section className="stack">
      <h1>Sessions</h1>

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
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ALL">ALL</option>
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </label>

        <label>
          From
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
          />
        </label>

        <button type="button" onClick={() => void fetchSessions()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/sessions/new">New session</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Class Type</th>
            <th>Coach</th>
            <th>Starts At</th>
            <th>Ends At</th>
            <th>Capacity</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 ? (
            <tr>
              <td colSpan={7}>{loading ? "Loading..." : "No sessions found."}</td>
            </tr>
          ) : (
            sessions.map((session) => (
              <tr key={session.id}>
                <td>{session.class_type.name}</td>
                <td>{session.coach ? session.coach.name : "-"}</td>
                <td>{formatDatetime(session.starts_at)}</td>
                <td>{session.ends_at ? formatDatetime(session.ends_at) : "-"}</td>
                <td>{session.capacity}</td>
                <td>{session.status}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => void handleCancel(session.id)}
                    disabled={session.status === "CANCELLED"}
                  >
                    Cancel
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
