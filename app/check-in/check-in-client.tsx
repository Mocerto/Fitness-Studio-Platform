"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type Session = {
  id: string;
  starts_at: string;
  class_type: { name: string };
  coach: { id: string; name: string } | null;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
};

type AttendanceRecord = {
  status: string;
  member: { id: string };
};

type AttendanceMap = Record<string, boolean>; // member_id -> already checked in

export default function CheckInClient() {
  const { data: authSession } = useSession();
  const studioId = authSession?.user?.studio_id ?? "";
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

  const loadSessions = useCallback(async () => {
    if (!studioId) {
      setSessions([]);
      return;
    }

    setLoadingSessions(true);
    try {
      const response = await fetch("/api/sessions?status=SCHEDULED", {
        cache: "no-store",
      });
      const payload = (await response.json()) as { data?: Session[]; message?: string };
      if (!response.ok) {
        const message = payload.message ?? "Failed to load sessions";
        setSessions([]);
        setError(message);
        return;
      }
      setSessions(payload.data ?? []);
    } catch {
      setSessions([]);
      setError("Failed to load sessions");
    } finally {
      setLoadingSessions(false);
    }
  }, [studioId]);

  const loadMembers = useCallback(async () => {
    if (!studioId) {
      setMembers([]);
      return;
    }

    setLoadingMembers(true);
    try {
      const response = await fetch("/api/members?status=ACTIVE", {
        cache: "no-store",
      });
      const payload = (await response.json()) as { data?: Member[]; message?: string };
      if (!response.ok) {
        const message = payload.message ?? "Failed to load members";
        setMembers([]);
        setError(message);
        return;
      }
      setMembers(payload.data ?? []);
    } catch {
      setMembers([]);
      setError("Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  }, [studioId]);

  useEffect(() => {
    if (!studioId) {
      setSessions([]);
      setMembers([]);
      setSelectedSessionId("");
      setAttendanceMap({});
      return;
    }

    void loadSessions();
    void loadMembers();
  }, [studioId, loadSessions, loadMembers]);

  // Load existing attendance for selected session
  const loadAttendance = useCallback(
    async (sessionId: string) => {
      if (!sessionId || !studioId) return;

      setLoadingAttendance(true);
      try {
        const response = await fetch(`/api/attendance?session_id=${sessionId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          data?: AttendanceRecord[];
          message?: string;
        };

        if (!response.ok) {
          const message = payload.message ?? "Failed to load attendance";
          setAttendanceMap({});
          setError(message);
          return;
        }

        const map: AttendanceMap = {};
        for (const record of payload.data ?? []) {
          if (record.status !== "CANCELLED") {
            map[record.member.id] = true;
          }
        }
        setAttendanceMap(map);
      } catch {
        setAttendanceMap({});
        setError("Failed to load attendance");
      } finally {
        setLoadingAttendance(false);
      }
    },
    [studioId],
  );

  useEffect(() => {
    if (selectedSessionId) {
      void loadAttendance(selectedSessionId);
    } else {
      setAttendanceMap({});
    }
  }, [selectedSessionId, loadAttendance]);

  async function handleCheckIn(memberId: string) {
    if (!selectedSessionId || !studioId) {
      setError("No session selected");
      return;
    }

    setCheckingIn((prev) => ({ ...prev, [memberId]: true }));
    setError("");
    try {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session_id: selectedSessionId, member_id: memberId }),
      });
      const payload = (await response.json()) as {
        message?: string;
        already_checked_in?: boolean;
      };

      if (response.ok || payload.already_checked_in) {
        setAttendanceMap((prev) => ({ ...prev, [memberId]: true }));
      } else {
        setError(payload.message ?? "Check-in failed");
      }
    } catch {
      setError("Network error during check-in");
    } finally {
      setCheckingIn((prev) => ({ ...prev, [memberId]: false }));
    }
  }

  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase();
    return m.first_name.toLowerCase().includes(q) || m.last_name.toLowerCase().includes(q);
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
            <option value="">- select a session -</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.class_type.name} - {new Date(s.starts_at).toLocaleString()} ({s.coach ? s.coach.name : "TBD"})
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
                      <td>{checkedIn ? "Checked In" : "-"}</td>
                      <td>
                        <button onClick={() => void handleCheckIn(m.id)} disabled={checkedIn || inFlight}>
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
