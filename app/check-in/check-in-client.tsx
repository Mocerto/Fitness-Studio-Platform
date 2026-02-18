"use client";

import { useCallback, useEffect, useState } from "react";

const STUDIO_ID = process.env.NEXT_PUBLIC_STUDIO_ID ?? "studio-1";

type Session = {
  id: string;
  starts_at: string;
  class_type: { name: string };
  coach: { first_name: string; last_name: string };
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
};

type AttendanceMap = Record<string, boolean>; // member_id -> already checked in

export default function CheckInClient() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [attendanceMap, setAttendanceMap] = useState<AttendanceMap>({});
  const [search, setSearch] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [checkingIn, setCheckingIn] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");

  // Load SCHEDULED sessions
  useEffect(() => {
    setLoadingSessions(true);
    fetch("/api/sessions?status=SCHEDULED", {
      headers: { "x-studio-id": STUDIO_ID },
    })
      .then((r) => r.json())
      .then((json) => setSessions(json.data ?? []))
      .catch(() => setError("Failed to load sessions"))
      .finally(() => setLoadingSessions(false));
  }, []);

  // Load ACTIVE members
  useEffect(() => {
    setLoadingMembers(true);
    fetch("/api/members?status=ACTIVE", {
      headers: { "x-studio-id": STUDIO_ID },
    })
      .then((r) => r.json())
      .then((json) => setMembers(json.data ?? []))
      .catch(() => setError("Failed to load members"))
      .finally(() => setLoadingMembers(false));
  }, []);

  // Load existing attendance for selected session
  const loadAttendance = useCallback((sessionId: string) => {
    if (!sessionId) return;
    setLoadingAttendance(true);
    fetch(`/api/attendance?session_id=${sessionId}`, {
      headers: { "x-studio-id": STUDIO_ID },
    })
      .then((r) => r.json())
      .then((json) => {
        const map: AttendanceMap = {};
        for (const record of json.data ?? []) {
          if (record.status !== "CANCELLED") {
            map[record.member.id] = true;
          }
        }
        setAttendanceMap(map);
      })
      .catch(() => setError("Failed to load attendance"))
      .finally(() => setLoadingAttendance(false));
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      loadAttendance(selectedSessionId);
    } else {
      setAttendanceMap({});
    }
  }, [selectedSessionId, loadAttendance]);

  async function handleCheckIn(memberId: string) {
    if (!selectedSessionId) return;
    setCheckingIn((prev) => ({ ...prev, [memberId]: true }));
    setError("");
    try {
      const res = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-studio-id": STUDIO_ID,
        },
        body: JSON.stringify({ session_id: selectedSessionId, member_id: memberId }),
      });
      const json = await res.json();
      if (res.ok || json.already_checked_in) {
        setAttendanceMap((prev) => ({ ...prev, [memberId]: true }));
      } else {
        setError(json.message ?? "Check-in failed");
      }
    } catch {
      setError("Network error during check-in");
    } finally {
      setCheckingIn((prev) => ({ ...prev, [memberId]: false }));
    }
  }

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.first_name.toLowerCase().includes(q) ||
      m.last_name.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <h1>Check-In</h1>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <section>
        <label htmlFor="session-select">
          <strong>Session</strong>
        </label>
        {loadingSessions ? (
          <p>Loading sessions...</p>
        ) : (
          <select
            id="session-select"
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
          >
            <option value="">— select a session —</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.class_type.name} — {new Date(s.starts_at).toLocaleString()} (
                {s.coach.first_name} {s.coach.last_name})
              </option>
            ))}
          </select>
        )}
      </section>

      {selectedSessionId && (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Active Members</h2>
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ marginBottom: "1rem", display: "block" }}
          />

          {loadingMembers || loadingAttendance ? (
            <p>Loading...</p>
          ) : filteredMembers.length === 0 ? (
            <p>No active members found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const checkedIn = !!attendanceMap[m.id];
                  const inFlight = !!checkingIn[m.id];
                  return (
                    <tr key={m.id}>
                      <td>
                        {m.first_name} {m.last_name}
                      </td>
                      <td>{checkedIn ? "✓ Checked In" : "—"}</td>
                      <td>
                        <button
                          onClick={() => handleCheckIn(m.id)}
                          disabled={checkedIn || inFlight}
                        >
                          {inFlight ? "Checking in..." : checkedIn ? "Already In" : "Check In"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
