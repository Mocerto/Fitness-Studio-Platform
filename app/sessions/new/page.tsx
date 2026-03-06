"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type SessionStatus = "SCHEDULED" | "CANCELLED";

type Discipline = { id: string; name: string };

type ClassType = {
  id: string;
  name: string;
  default_capacity: number | null;
  duration_minutes: number | null;
  discipline_id: string | null;
  discipline: Discipline | null;
};

type Coach = {
  id: string;
  name: string;
  disciplines: Discipline[];
};

export default function NewSessionPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";

  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [classTypesLoading, setClassTypesLoading] = useState(false);
  const [allCoaches, setAllCoaches] = useState<Coach[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);

  const [selectedClassTypeId, setSelectedClassTypeId] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [status, setStatus] = useState<SessionStatus>("SCHEDULED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch class types and coaches
  useEffect(() => {
    setClassTypes([]);
    setAllCoaches([]);
    setSelectedClassTypeId("");
    setSelectedCoachId("");

    if (!studioId) return;

    setClassTypesLoading(true);
    setCoachesLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/class-types", { cache: "no-store" });
        const payload = (await response.json()) as { data?: ClassType[] };
        setClassTypes(response.ok ? payload.data ?? [] : []);
      } catch {
        setClassTypes([]);
      } finally {
        setClassTypesLoading(false);
      }
    })();

    void (async () => {
      try {
        const response = await fetch("/api/coaches", { cache: "no-store" });
        const payload = (await response.json()) as { data?: Coach[] };
        setAllCoaches(response.ok ? payload.data ?? [] : []);
      } catch {
        setAllCoaches([]);
      } finally {
        setCoachesLoading(false);
      }
    })();
  }, [studioId]);

  // Auto-fill capacity from selected class type default
  useEffect(() => {
    const ct = classTypes.find((c) => c.id === selectedClassTypeId);
    if (ct?.default_capacity) {
      setCapacity(String(ct.default_capacity));
    }
  }, [selectedClassTypeId, classTypes]);

  // Auto-fill ends_at from duration_minutes
  const autoFillEndsAt = useCallback(() => {
    const ct = classTypes.find((c) => c.id === selectedClassTypeId);
    if (ct?.duration_minutes && startsAt) {
      const start = new Date(startsAt);
      start.setMinutes(start.getMinutes() + ct.duration_minutes);
      // Format as datetime-local value
      const pad = (n: number) => String(n).padStart(2, "0");
      const end = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
      setEndsAt(end);
    }
  }, [selectedClassTypeId, startsAt, classTypes]);

  useEffect(() => {
    autoFillEndsAt();
  }, [autoFillEndsAt]);

  // Split coaches into preferred (matching discipline) and other
  const selectedClassType = classTypes.find((c) => c.id === selectedClassTypeId);
  const disciplineId = selectedClassType?.discipline_id;

  const preferredCoaches = disciplineId
    ? allCoaches.filter((c) => c.disciplines.some((d) => d.id === disciplineId))
    : [];
  const otherCoaches = disciplineId
    ? allCoaches.filter((c) => !c.disciplines.some((d) => d.id === disciplineId))
    : allCoaches;

  // Reset coach selection when class type changes
  useEffect(() => {
    setSelectedCoachId("");
  }, [selectedClassTypeId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId) {
      setError("Not authenticated");
      return;
    }
    if (!selectedClassTypeId) {
      setError("Class type is required");
      return;
    }
    if (!startsAt) {
      setError("Start time is required");
      return;
    }

    const parsedCapacity = parseInt(capacity, 10);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      setError("Capacity must be a positive integer");
      return;
    }

    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("End time must be after start time");
      return;
    }

    const payload: Record<string, unknown> = {
      class_type_id: selectedClassTypeId,
      starts_at: startsAt,
      capacity: parsedCapacity,
      status,
    };

    if (selectedCoachId) payload.coach_id = selectedCoachId;
    if (endsAt) payload.ends_at = endsAt;

    setSubmitting(true);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to create session.");
        return;
      }

      router.push("/sessions");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Session</h1>
      <p>
        <Link href="/sessions">Back to sessions</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Class Type
          <select
            value={selectedClassTypeId}
            onChange={(e) => setSelectedClassTypeId(e.target.value)}
            required
            disabled={classTypesLoading}
          >
            <option value="">
              {classTypesLoading ? "Loading class types..." : "— select class type —"}
            </option>
            {classTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
                {ct.discipline ? ` (${ct.discipline.name})` : ""}
              </option>
            ))}
          </select>
        </label>

        {selectedClassType?.discipline && (
          <p>
            Discipline: <strong>{selectedClassType.discipline.name}</strong>
          </p>
        )}

        <label>
          Coach
          <select
            value={selectedCoachId}
            onChange={(e) => setSelectedCoachId(e.target.value)}
            disabled={coachesLoading}
          >
            <option value="">{coachesLoading ? "Loading coaches..." : "— none —"}</option>
            {preferredCoaches.length > 0 && (
              <optgroup label="Preferred (matching discipline)">
                {preferredCoaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={preferredCoaches.length > 0 ? "Other coaches" : "All coaches"}>
              {otherCoaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.disciplines.length > 0
                    ? ` (${c.disciplines.map((d) => d.name).join(", ")})`
                    : ""}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label>
          Starts at
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
          />
        </label>

        <label>
          Ends at (optional)
          <input
            type="datetime-local"
            value={endsAt}
            min={startsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>

        <label>
          Capacity
          <input
            type="number"
            min={1}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
          />
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as SessionStatus)}>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Create session"}
        </button>
      </form>
    </section>
  );
}
