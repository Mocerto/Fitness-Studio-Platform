"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type CreateContractPayload = {
  member_id: string;
  plan_id: string;
  start_date: string;
  end_date?: string;
};

export default function NewContractPage() {
  const router = useRouter();
  const [studioId, setStudioId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("studio_id");
    if (stored) setStudioId(stored);

    const today = new Date().toISOString().split("T")[0] ?? "";
    setStartDate(today);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }
    if (!memberId.trim()) {
      setError("member_id is required");
      return;
    }
    if (!planId.trim()) {
      setError("plan_id is required");
      return;
    }
    if (!startDate) {
      setError("start_date is required");
      return;
    }
    if (endDate && endDate < startDate) {
      setError("end_date must be >= start_date");
      return;
    }

    const payload: CreateContractPayload = {
      member_id: memberId.trim(),
      plan_id: planId.trim(),
      start_date: startDate,
    };
    if (endDate) {
      payload.end_date = endDate;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/contracts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-studio-id": studioId.trim(),
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to create contract.");
        return;
      }

      window.localStorage.setItem("studio_id", studioId.trim());
      router.push("/contracts");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Contract</h1>
      <p>
        <Link href="/contracts">Back to contracts</Link>
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
          Member ID
          <input
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="UUID from members table"
            required
          />
        </label>

        <label>
          Plan ID
          <input
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            placeholder="UUID from plans table"
            required
          />
        </label>

        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </label>

        <label>
          End date (optional)
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Create contract"}
        </button>
      </form>
    </section>
  );
}
