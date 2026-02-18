"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
};

type UpdatePlanPayload = {
  name?: string;
  type?: PlanType;
  class_limit?: number;
  billing_period?: BillingPeriod;
  price_cents?: number;
  is_active?: boolean;
};

export default function EditPlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const planId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);

  const [studioId, setStudioId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<PlanType>("UNLIMITED");
  const [classLimit, setClassLimit] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("MONTHLY");
  const [priceCents, setPriceCents] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    const storedStudioId = window.localStorage.getItem("studio_id");
    if (storedStudioId) {
      setStudioId(storedStudioId);
    }
  }, []);

  useEffect(() => {
    async function loadPlan() {
      if (!studioId.trim() || !planId) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/plans", {
          headers: {
            "x-studio-id": studioId.trim(),
          },
          cache: "no-store",
        });

        const payload = (await response.json()) as { data?: Plan[]; message?: string };
        if (!response.ok) {
          setError(payload.message ?? "Failed to load plan.");
          return;
        }

        const foundPlan = payload.data?.find((entry) => entry.id === planId);
        if (!foundPlan) {
          setError("Plan not found in this studio.");
          return;
        }

        setName(foundPlan.name);
        setType(foundPlan.type);
        setClassLimit(foundPlan.class_limit != null ? String(foundPlan.class_limit) : "");
        setBillingPeriod(foundPlan.billing_period);
        setPriceCents(String(foundPlan.price_cents));
        setIsActive(foundPlan.is_active);
      } catch {
        const message = "Failed to load plan.";
        setError(message);
        alert(message);
      } finally {
        setLoading(false);
      }
    }

    void loadPlan();
  }, [planId, studioId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }

    const parsedPrice = Number(priceCents);
    if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      setError("price_cents must be a positive integer");
      return;
    }

    const payload: UpdatePlanPayload = {
      name,
      type,
      billing_period: billingPeriod,
      price_cents: parsedPrice,
      is_active: isActive,
    };

    if (type === "LIMITED") {
      const parsedClassLimit = Number(classLimit);
      if (!Number.isInteger(parsedClassLimit) || parsedClassLimit <= 0) {
        setError("class_limit must be > 0 when type is LIMITED");
        return;
      }
      payload.class_limit = parsedClassLimit;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-studio-id": studioId.trim(),
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to update plan.");
        return;
      }

      window.localStorage.setItem("studio_id", studioId.trim());
      router.push("/plans");
      router.refresh();
    } catch {
      const message = "Failed to update plan.";
      setError(message);
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    setError("");

    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/plans/${planId}/deactivate`, {
        method: "POST",
        headers: {
          "x-studio-id": studioId.trim(),
        },
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to deactivate plan.");
        return;
      }

      setIsActive(false);
    } catch {
      const message = "Failed to deactivate plan.";
      setError(message);
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>Edit Plan</h1>
      <p>
        <Link href="/plans">Back to plans</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Studio ID
          <input
            value={studioId}
            onChange={(event) => setStudioId(event.target.value)}
            placeholder="UUID from studios table"
          />
        </label>

        <label>
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label>
          Type
          <select
            value={type}
            onChange={(event) => {
              const nextType = event.target.value as PlanType;
              setType(nextType);
              if (nextType === "UNLIMITED") {
                setClassLimit("");
              }
            }}
            disabled={loading}
          >
            <option value="UNLIMITED">UNLIMITED</option>
            <option value="LIMITED">LIMITED</option>
          </select>
        </label>

        {type === "LIMITED" ? (
          <label>
            Class limit
            <input
              type="number"
              min={1}
              value={classLimit}
              onChange={(event) => setClassLimit(event.target.value)}
              required
              disabled={loading}
            />
          </label>
        ) : null}

        <label>
          Billing period
          <select
            value={billingPeriod}
            onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}
            disabled={loading}
          >
            <option value="MONTHLY">MONTHLY</option>
            <option value="ONE_TIME">ONE_TIME</option>
          </select>
        </label>

        <label>
          Price cents
          <input
            type="number"
            min={1}
            value={priceCents}
            onChange={(event) => setPriceCents(event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            disabled={loading}
          />
          Active
        </label>

        {error ? <p className="error">{error}</p> : null}

        <div className="row">
          <button type="submit" disabled={loading || submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </button>
          <button type="button" onClick={() => void handleDeactivate()} disabled={loading}>
            Deactivate
          </button>
        </div>
      </form>
    </section>
  );
}
