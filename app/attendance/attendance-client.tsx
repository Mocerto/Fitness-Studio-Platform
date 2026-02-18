"use client";

import { useCallback, useEffect, useState } from "react";

const STUDIO_ID = process.env.NEXT_PUBLIC_STUDIO_ID ?? "studio-1";

type AttendanceRecord = {
  id: string;
  status: string;
  checked_in_at: string | null;
  member: { id: string; first_name: string; last_name: string };
  session: {
    id: string;
    starts_at: string;
    class_type: { name: string };
  };
};

export default function AttendanceClient() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [sessionIdFilter, setSessionIdFilter] = useState("");
  const [memberIdFilter, setMemberIdFilter] = useState("");

  const fetchRecords = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (sessionIdFilter.trim()) params.set("session_id", sessionIdFilter.trim());
    if (memberIdFilter.trim()) params.set("member_id", memberIdFilter.trim());

    fetch(`/api/attendance?${params.toString()}`, {
      headers: { "x-studio-id": STUDIO_ID },
    })
      .then((r) => r.json())
      .then((json) => setRecords(json.data ?? []))
      .catch(() => setError("Failed to load attendance records"))
      .finally(() => setLoading(false));
  }, [statusFilter, sessionIdFilter, memberIdFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  async function handleCancel(id: string) {
    setCancelling((prev) => ({ ...prev, [id]: true }));
    setError("");
    try {
      const res = await fetch(`/api/attendance/${id}/cancel`, {
        method: "POST",
        headers: { "x-studio-id": STUDIO_ID },
      });
      const json = await res.json();
      if (res.ok) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r)),
        );
      } else {
        setError(json.message ?? "Failed to cancel");
      }
    } catch {
      setError("Network error");
    } finally {
      setCancelling((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div>
      <h1>Attendance</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="CHECKED_IN">Checked In</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="NO_SHOW">No Show</option>
        </select>

        <input
          type="text"
          placeholder="Session ID (UUID)"
          value={sessionIdFilter}
          onChange={(e) => setSessionIdFilter(e.target.value)}
          style={{ width: "22rem" }}
        />

        <input
          type="text"
          placeholder="Member ID (UUID)"
          value={memberIdFilter}
          onChange={(e) => setMemberIdFilter(e.target.value)}
          style={{ width: "22rem" }}
        />
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : records.length === 0 ? (
        <p>No attendance records found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Class</th>
              <th>Session Start</th>
              <th>Checked In At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.member.first_name} {r.member.last_name}
                </td>
                <td>{r.session.class_type.name}</td>
                <td>{new Date(r.session.starts_at).toLocaleString()}</td>
                <td>{r.checked_in_at ? new Date(r.checked_in_at).toLocaleString() : "—"}</td>
                <td>{r.status}</td>
                <td>
                  <button
                    onClick={() => handleCancel(r.id)}
                    disabled={r.status === "CANCELLED" || !!cancelling[r.id]}
                  >
                    {cancelling[r.id] ? "Cancelling..." : "Cancel"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
