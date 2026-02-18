"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PlanType = "UNLIMITED" | "LIMITED";
type BillingPeriod = "MONTHLY" | "ONE_TIME";

type CreatePlanPayload = {
  name: string;
  type: PlanType;
  class_limit?: number;
  billing_period: BillingPeriod;
  price_cents: number;
  is_active: boolean;
};

export default function NewPlanPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [name, setName] = useState("");
  const [type, setType] = useState<PlanType>("UNLIMITED");
  const [classLimit, setClassLimit] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("MONTHLY");
  const [priceCents, setPriceCents] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId) {
      setError("Not authenticated");
      return;
    }

    const parsedPrice = Number(priceCents);
    if (!Number.isInteger(parsedPrice) || parsedPrice <= 0) {
      setError("price_cents must be a positive integer");
      return;
    }

    const payload: CreatePlanPayload = {
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
      const response = await fetch("/api/plans", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to create plan.");
        return;
      }

      router.push("/plans");
      router.refresh();
    } catch {
      setError("Failed to create plan.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Plan</h1>
      <p>
        <Link href="/plans">Back to plans</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required />
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
            />
          </label>
        ) : null}

        <label>
          Billing period
          <select
            value={billingPeriod}
            onChange={(event) => setBillingPeriod(event.target.value as BillingPeriod)}
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
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
          Active
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Create plan"}
        </button>
      </form>
    </section>
  );
}
