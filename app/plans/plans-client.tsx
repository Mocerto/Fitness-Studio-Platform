"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PlanType = "UNLIMITED" | "LIMITED";
type BillingPeriod = "MONTHLY" | "ONE_TIME";
type Plan = {
  id: string;
  name: string;
  type: PlanType;
  class_limit: number | null;
  billing_period: BillingPeriod;
  price_cents: number;
  is_active: boolean;
  created_at: string;
};

type Filter = "ALL" | "ACTIVE" | "INACTIVE";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function PlansClient() {
  const [studioId, setStudioId] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedStudioId = window.localStorage.getItem("studio_id");
    if (storedStudioId) {
      setStudioId(storedStudioId);
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    if (!studioId.trim()) {
      setPlans([]);
      setError("Provide studio id first.");
      return;
    }

    setLoading(true);
    setError("");

    let query = "";
    if (filter === "ACTIVE") {
      query = "?is_active=true";
    }
    if (filter === "INACTIVE") {
      query = "?is_active=false";
    }

    try {
      const response = await fetch(`/api/plans${query}`, {
        headers: {
          "x-studio-id": studioId.trim(),
        },
        cache: "no-store",
      });

      const payload = (await response.json()) as { data?: Plan[]; message?: string };
      if (!response.ok) {
        setPlans([]);
        setError(payload.message ?? "Failed to load plans.");
        return;
      }

      setPlans(payload.data ?? []);
    } catch {
      setPlans([]);
      const message = "Failed to load plans.";
      setError(message);
      alert(message);
    } finally {
      setLoading(false);
    }
  }, [filter, studioId]);

  useEffect(() => {
    if (studioId.trim()) {
      window.localStorage.setItem("studio_id", studioId.trim());
      void fetchPlans();
    } else {
      setPlans([]);
    }
  }, [studioId, filter, fetchPlans]);

  return (
    <section className="stack">
      <h1>Plans</h1>

      <div className="row">
        <label>
          Studio ID
          <input
            value={studioId}
            onChange={(event) => setStudioId(event.target.value)}
            placeholder="UUID from studios table"
          />
        </label>

        <label>
          Filter
          <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
            <option value="ALL">ALL</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>

        <button type="button" onClick={() => void fetchPlans()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/plans/new">New plan</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Class Limit</th>
            <th>Billing Period</th>
            <th>Price (cents)</th>
            <th>Active</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {plans.length === 0 ? (
            <tr>
              <td colSpan={8}>{loading ? "Loading..." : "No plans found."}</td>
            </tr>
          ) : (
            plans.map((plan) => (
              <tr key={plan.id}>
                <td>{plan.name}</td>
                <td>{plan.type}</td>
                <td>{plan.class_limit ?? "-"}</td>
                <td>{plan.billing_period}</td>
                <td>{plan.price_cents}</td>
                <td>{plan.is_active ? "true" : "false"}</td>
                <td>{formatDate(plan.created_at)}</td>
                <td>
                  <Link href={`/plans/${plan.id}/edit`}>Edit</Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
