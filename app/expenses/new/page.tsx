"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
type Category = { id: string; name: string };

export default function NewExpensePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [form, setForm] = useState({
    description: "",
    amount_dollars: "",
    currency: "USD",
    method: "CASH" as PaymentMethod,
    category_id: "",
    expense_date: new Date().toISOString().split("T")[0],
    vendor: "",
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchCategories = useCallback(async () => {
    if (!studioId) return;
    try {
      const response = await fetch("/api/expense-categories", { cache: "no-store" });
      const payload = (await response.json()) as { data?: Category[] };
      setCategories(payload.data ?? []);
    } catch {
      /* ignore */
    }
  }, [studioId]);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  async function handleAddCategory() {
    if (!newCategory.trim()) return;

    try {
      const response = await fetch("/api/expense-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCategory.trim() }),
      });

      const payload = (await response.json()) as { data?: Category; message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Failed to create category.");
        return;
      }

      if (payload.data) {
        setCategories((current) => [...current, payload.data!]);
        setForm((current) => ({ ...current, category_id: payload.data!.id }));
        setNewCategory("");
      }
    } catch {
      setError("Failed to create category.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId) {
      setError("Not authenticated");
      return;
    }

    const amountCents = Math.round(parseFloat(form.amount_dollars || "0") * 100);
    if (amountCents <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        description: form.description,
        amount_cents: amountCents,
        currency: form.currency,
        method: form.method,
        expense_date: form.expense_date,
      };

      if (form.category_id) payload.category_id = form.category_id;
      if (form.vendor) payload.vendor = form.vendor;
      if (form.note) payload.note = form.note;

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(result.message ?? "Failed to create expense.");
        return;
      }

      router.push("/expenses");
      router.refresh();
    } catch {
      setError("Failed to create expense.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Expense</h1>
      <p>
        <Link href="/expenses">Back to expenses</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Description
          <input
            value={form.description}
            onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
            required
          />
        </label>

        <label>
          Amount ($)
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.amount_dollars}
            onChange={(e) => setForm((c) => ({ ...c, amount_dollars: e.target.value }))}
            required
          />
        </label>

        <label>
          Date
          <input
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm((c) => ({ ...c, expense_date: e.target.value }))}
            required
          />
        </label>

        <label>
          Payment method
          <select
            value={form.method}
            onChange={(e) => setForm((c) => ({ ...c, method: e.target.value as PaymentMethod }))}
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
            value={form.category_id}
            onChange={(e) => setForm((c) => ({ ...c, category_id: e.target.value }))}
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <div className="row">
          <input
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <button type="button" onClick={handleAddCategory}>
            Add category
          </button>
        </div>

        <label>
          Vendor
          <input
            value={form.vendor}
            onChange={(e) => setForm((c) => ({ ...c, vendor: e.target.value }))}
          />
        </label>

        <label>
          Note
          <textarea
            value={form.note}
            onChange={(e) => setForm((c) => ({ ...c, note: e.target.value }))}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Record expense"}
        </button>
      </form>
    </section>
  );
}
