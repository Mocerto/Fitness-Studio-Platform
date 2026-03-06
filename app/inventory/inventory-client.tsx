"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type TransactionType = "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN";

type InventoryTransaction = {
  id: string;
  product: { id: string; name: string; sku: string | null };
  type: TransactionType;
  quantity: number;
  unit_cost_cents: number | null;
  note: string | null;
  recorded_by_user: { id: string; full_name: string | null; email: string } | null;
  created_at: string;
};

const TYPE_FILTERS: Array<"ALL" | TransactionType> = [
  "ALL",
  "PURCHASE",
  "SALE",
  "ADJUSTMENT",
  "RETURN",
];

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function InventoryClient() {
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [typeFilter, setTypeFilter] = useState<"ALL" | TransactionType>("ALL");
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTransactions = useCallback(async () => {
    if (!studioId) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = typeFilter === "ALL" ? "" : `?type=${typeFilter}`;
      const response = await fetch(`/api/inventory${query}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        data?: InventoryTransaction[];
        message?: string;
      };

      if (!response.ok) {
        setTransactions([]);
        setError(payload.message ?? "Failed to load inventory.");
        return;
      }

      setTransactions(payload.data ?? []);
    } catch {
      setTransactions([]);
      setError("Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, studioId]);

  useEffect(() => {
    if (studioId) {
      void fetchTransactions();
    } else {
      setTransactions([]);
    }
  }, [studioId, typeFilter, fetchTransactions]);

  return (
    <section className="stack">
      <h1>Inventory Transactions</h1>

      <div className="row">
        <label>
          Type
          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value as "ALL" | TransactionType)
            }
          >
            {TYPE_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={() => void fetchTransactions()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/inventory/new">New transaction</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Unit Cost</th>
            <th>Note</th>
            <th>Recorded By</th>
          </tr>
        </thead>
        <tbody>
          {transactions.length === 0 ? (
            <tr>
              <td colSpan={8}>{loading ? "Loading..." : "No transactions found."}</td>
            </tr>
          ) : (
            transactions.map((tx) => (
              <tr key={tx.id}>
                <td>{formatDate(tx.created_at)}</td>
                <td>{tx.product.name}</td>
                <td>{tx.product.sku ?? "-"}</td>
                <td>{tx.type}</td>
                <td>{tx.quantity}</td>
                <td>
                  {tx.unit_cost_cents != null ? formatCurrency(tx.unit_cost_cents) : "-"}
                </td>
                <td>{tx.note ?? "-"}</td>
                <td>
                  {tx.recorded_by_user
                    ? tx.recorded_by_user.full_name ?? tx.recorded_by_user.email
                    : "-"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
