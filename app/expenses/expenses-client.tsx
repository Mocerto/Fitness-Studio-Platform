"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type ExpenseStatus = "RECORDED" | "VOID";
type Category = { id: string; name: string };

type Expense = {
  id: string;
  description: string;
  amount_cents: number;
  currency: string;
  method: string;
  status: ExpenseStatus;
  expense_date: string;
  vendor: string | null;
  note: string | null;
  category: Category | null;
  recorded_by_user: { id: string; full_name: string | null; email: string } | null;
  created_at: string;
};

type StatusFilter = "ALL" | ExpenseStatus;

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function ExpensesClient() {
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totals, setTotals] = useState({ total_cents: 0, count: 0 });
  const [loading, setLoading] = useState(false);
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

  const fetchExpenses = useCallback(async () => {
    if (!studioId) {
      setExpenses([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (categoryFilter) params.set("category_id", categoryFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const query = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(`/api/expenses${query}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        data?: Expense[];
        totals?: { total_cents: number; count: number };
        message?: string;
      };

      if (!response.ok) {
        setExpenses([]);
        setError(payload.message ?? "Failed to load expenses.");
        return;
      }

      setExpenses(payload.data ?? []);
      setTotals(payload.totals ?? { total_cents: 0, count: 0 });
    } catch {
      setExpenses([]);
      setError("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, dateFrom, dateTo, studioId]);

  useEffect(() => {
    if (studioId) {
      void fetchCategories();
    }
  }, [studioId, fetchCategories]);

  useEffect(() => {
    if (studioId) {
      void fetchExpenses();
    } else {
      setExpenses([]);
    }
  }, [studioId, statusFilter, categoryFilter, dateFrom, dateTo, fetchExpenses]);

  async function handleVoid(expenseId: string) {
    if (!confirm("Void this expense?")) return;

    try {
      const response = await fetch(`/api/expenses/${expenseId}/void`, { method: "PATCH" });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        alert(payload.message ?? "Failed to void expense.");
        return;
      }

      void fetchExpenses();
    } catch {
      alert("Failed to void expense.");
    }
  }

  return (
    <section className="stack">
      <h1>Expenses</h1>

      <div className="row">
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            <option value="ALL">All</option>
            <option value="RECORDED">Recorded</option>
            <option value="VOID">Void</option>
          </select>
        </label>

        <label>
          Category
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          From
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>

        <label>
          To
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>

        <button type="button" onClick={() => void fetchExpenses()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/expenses/new">New expense</Link>
      </div>

      <div className="row">
        <strong>
          Total: {formatCurrency(totals.total_cents)} ({totals.count} expense
          {totals.count !== 1 ? "s" : ""})
        </strong>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Vendor</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Recorded By</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {expenses.length === 0 ? (
            <tr>
              <td colSpan={9}>{loading ? "Loading..." : "No expenses found."}</td>
            </tr>
          ) : (
            expenses.map((expense) => (
              <tr
                key={expense.id}
                style={expense.status === "VOID" ? { opacity: 0.5 } : undefined}
              >
                <td>{formatDate(expense.expense_date)}</td>
                <td>{expense.description}</td>
                <td>{expense.category?.name ?? "-"}</td>
                <td>{expense.vendor ?? "-"}</td>
                <td>{formatCurrency(expense.amount_cents)}</td>
                <td>{expense.method}</td>
                <td>{expense.status}</td>
                <td>
                  {expense.recorded_by_user
                    ? expense.recorded_by_user.full_name ?? expense.recorded_by_user.email
                    : "-"}
                </td>
                <td>
                  <div className="row">
                    <Link href={`/expenses/${expense.id}/edit`}>Edit</Link>
                    {expense.status === "RECORDED" && (
                      <button type="button" onClick={() => handleVoid(expense.id)}>
                        Void
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
