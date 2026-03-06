"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
type ExpenseStatus = "RECORDED" | "VOID";
type Category = { id: string; name: string };

type ExpenseData = {
  id: string;
  description: string;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: ExpenseStatus;
  expense_date: string;
  vendor: string | null;
  note: string | null;
  category_id: string | null;
};

export default function EditExpensePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ExpenseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchExpense = useCallback(async () => {
    if (!studioId || !id) return;

    try {
      const [expenseRes, catRes] = await Promise.all([
        fetch(`/api/expenses/${id}`, { cache: "no-store" }),
        fetch("/api/expense-categories", { cache: "no-store" }),
      ]);

      const expensePayload = (await expenseRes.json()) as { data?: ExpenseData; message?: string };
      const catPayload = (await catRes.json()) as { data?: Category[] };

      if (!expenseRes.ok) {
        setError(expensePayload.message ?? "Expense not found.");
        return;
      }

      setForm(expensePayload.data ?? null);
      setCategories(catPayload.data ?? []);
    } catch {
      setError("Failed to load expense.");
    } finally {
      setLoading(false);
    }
  }, [studioId, id]);

  useEffect(() => {
    void fetchExpense();
  }, [fetchExpense]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId || !form) {
      setError("Not authenticated");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: form.description,
          amount_cents: form.amount_cents,
          currency: form.currency,
          method: form.method,
          status: form.status,
          expense_date: form.expense_date.split("T")[0],
          category_id: form.category_id || undefined,
          vendor: form.vendor || undefined,
          note: form.note || undefined,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Failed to update expense.");
        return;
      }

      router.push("/expenses");
      router.refresh();
    } catch {
      setError("Failed to update expense.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!form) return <p className="error">{error || "Expense not found."}</p>;

  return (
    <section className="stack">
      <h1>Edit Expense</h1>
      <p>
        <Link href="/expenses">Back to expenses</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Description
          <input
            value={form.description}
            onChange={(e) => setForm((c) => c && ({ ...c, description: e.target.value }))}
            required
          />
        </label>

        <label>
          Amount ($)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount_cents / 100}
            onChange={(e) =>
              setForm((c) =>
                c && ({ ...c, amount_cents: Math.round(parseFloat(e.target.value || "0") * 100) }),
              )
            }
            required
          />
        </label>

        <label>
          Date
          <input
            type="date"
            value={form.expense_date.split("T")[0]}
            onChange={(e) => setForm((c) => c && ({ ...c, expense_date: e.target.value }))}
            required
          />
        </label>

        <label>
          Payment method
          <select
            value={form.method}
            onChange={(e) =>
              setForm((c) => c && ({ ...c, method: e.target.value as PaymentMethod }))
            }
          >
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          Category
          <select
            value={form.category_id ?? ""}
            onChange={(e) =>
              setForm((c) => c && ({ ...c, category_id: e.target.value || null }))
            }
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Vendor
          <input
            value={form.vendor ?? ""}
            onChange={(e) => setForm((c) => c && ({ ...c, vendor: e.target.value }))}
          />
        </label>

        <label>
          Note
          <textarea
            value={form.note ?? ""}
            onChange={(e) => setForm((c) => c && ({ ...c, note: e.target.value }))}
          />
        </label>

        <label>
          Status
          <select
            value={form.status}
            onChange={(e) =>
              setForm((c) => c && ({ ...c, status: e.target.value as ExpenseStatus }))
            }
          >
            <option value="RECORDED">Recorded</option>
            <option value="VOID">Void</option>
          </select>
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Update expense"}
        </button>
      </form>
    </section>
  );
}
