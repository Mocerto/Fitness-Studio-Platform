"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionStatus = "SCHEDULED" | "CANCELLED";

type ClassType = {
  id: string;
  name: string;
  default_capacity: number | null;
};

type Coach = {
  id: string;
  name: string;
};

type CreateSessionPayload = {
  class_type_id: string;
  coach_id?: string;
  starts_at: string;
  ends_at?: string;
  capacity: number;
  status: SessionStatus;
};

export default function NewSessionPage() {
  const router = useRouter();

  const [studioId, setStudioId] = useState("");
  const [classTypes, setClassTypes] = useState<ClassType[]>([]);
  const [classTypesLoading, setClassTypesLoading] = useState(false);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);

  const [selectedClassTypeId, setSelectedClassTypeId] = useState("");
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState("10");
  const [status, setStatus] = useState<SessionStatus>("SCHEDULED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // On mount: restore studio_id
  useEffect(() => {
    const stored = window.localStorage.getItem("studio_id");
    if (stored) setStudioId(stored);
  }, []);

  // Fetch class types and coaches whenever studioId changes
  useEffect(() => {
    setClassTypes([]);
    setCoaches([]);
    setSelectedClassTypeId("");
    setSelectedCoachId("");

    if (!studioId.trim()) return;

    setClassTypesLoading(true);
    setCoachesLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/class-types", {
          headers: { "x-studio-id": studioId.trim() },
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: ClassType[]; message?: string };
        if (!response.ok) {
          const message = payload.message ?? "Failed to load class types.";
          setError(message);
          alert(message);
          setClassTypes([]);
          return;
        }
        setClassTypes(payload.data ?? []);
      } catch {
        const message = "Failed to load class types.";
        setError(message);
        alert(message);
        setClassTypes([]);
      } finally {
        setClassTypesLoading(false);
      }
    })();

    void (async () => {
      try {
        const response = await fetch("/api/coaches", {
          headers: { "x-studio-id": studioId.trim() },
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: Coach[]; message?: string };
        if (!response.ok) {
          const message = payload.message ?? "Failed to load coaches.";
          setError(message);
          alert(message);
          setCoaches([]);
          return;
        }
        setCoaches(payload.data ?? []);
      } catch {
        const message = "Failed to load coaches.";
        setError(message);
        alert(message);
        setCoaches([]);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }
    if (!selectedClassTypeId) {
      setError("class type is required");
      return;
    }
    if (!startsAt) {
      setError("starts_at is required");
      return;
    }

    const parsedCapacity = parseInt(capacity, 10);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity <= 0) {
      setError("capacity must be a positive integer");
      return;
    }

    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      setError("ends_at must be after starts_at");
      return;
    }

    const payload: CreateSessionPayload = {
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
        headers: {
          "content-type": "application/json",
          "x-studio-id": studioId.trim(),
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to create session.");
        return;
      }

      window.localStorage.setItem("studio_id", studioId.trim());
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
          Studio ID
          <input
            value={studioId}
            onChange={(e) => setStudioId(e.target.value)}
            placeholder="UUID from studios table"
          />
        </label>

        <label>
          Class Type
          <select
            value={selectedClassTypeId}
            onChange={(e) => setSelectedClassTypeId(e.target.value)}
            required
            disabled={classTypesLoading}
          >
            <option value="">{classTypesLoading ? "Loading class types..." : "- select class type -"}</option>
            {classTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Coach (optional)
          <select
            value={selectedCoachId}
            onChange={(e) => setSelectedCoachId(e.target.value)}
            disabled={coachesLoading}
          >
            <option value="">{coachesLoading ? "Loading coaches..." : "- none -"}</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Starts at
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </label>

        <label>
          Ends at (optional)
          <input type="datetime-local" value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} />
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
            <option value="SCHEDULED">SCHEDULED</option>
            <option value="CANCELLED">CANCELLED</option>
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
