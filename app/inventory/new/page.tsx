"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type TransactionType = "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  current_stock: number;
};

export default function NewInventoryTransactionPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState({
    product_id: "",
    type: "PURCHASE" as TransactionType,
    quantity: 1,
    unit_cost_cents: undefined as number | undefined,
    note: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchProducts = useCallback(async () => {
    if (!studioId) return;
    try {
      const response = await fetch("/api/products?active=true", { cache: "no-store" });
      const payload = (await response.json()) as { data?: Product[] };
      setProducts(payload.data ?? []);
    } catch {
      /* ignore */
    }
  }, [studioId]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  const selectedProduct = products.find((p) => p.id === form.product_id);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId) {
      setError("Not authenticated");
      return;
    }

    if (!form.product_id) {
      setError("Please select a product.");
      return;
    }

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        product_id: form.product_id,
        type: form.type,
        quantity: form.quantity,
      };

      if (form.unit_cost_cents != null) payload.unit_cost_cents = form.unit_cost_cents;
      if (form.note) payload.note = form.note;

      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(result.message ?? "Failed to create transaction.");
        return;
      }

      router.push("/inventory");
      router.refresh();
    } catch {
      setError("Failed to create transaction.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Inventory Transaction</h1>
      <p>
        <Link href="/inventory">Back to inventory</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Product
          <select
            value={form.product_id}
            onChange={(event) => setForm((c) => ({ ...c, product_id: event.target.value }))}
            required
          >
            <option value="">Select a product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.sku ? ` (${product.sku})` : ""} — Stock: {product.current_stock}
              </option>
            ))}
          </select>
        </label>

        {selectedProduct && (
          <p>
            Current stock: <strong>{selectedProduct.current_stock}</strong>
          </p>
        )}

        <label>
          Transaction type
          <select
            value={form.type}
            onChange={(event) =>
              setForm((c) => ({ ...c, type: event.target.value as TransactionType }))
            }
          >
            <option value="PURCHASE">Purchase (restock)</option>
            <option value="SALE">Sale</option>
            <option value="RETURN">Return</option>
            <option value="ADJUSTMENT">Adjustment (manual correction)</option>
          </select>
        </label>

        <label>
          Quantity
          <input
            type="number"
            min="1"
            value={form.quantity}
            onChange={(event) =>
              setForm((c) => ({ ...c, quantity: parseInt(event.target.value || "1", 10) }))
            }
            required
          />
        </label>

        {form.type === "PURCHASE" && (
          <label>
            Unit cost ($)
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.unit_cost_cents != null ? form.unit_cost_cents / 100 : ""}
              onChange={(event) =>
                setForm((c) => ({
                  ...c,
                  unit_cost_cents: event.target.value
                    ? Math.round(parseFloat(event.target.value) * 100)
                    : undefined,
                }))
              }
              required
            />
          </label>
        )}

        <label>
          Note
          <textarea
            value={form.note}
            onChange={(event) => setForm((c) => ({ ...c, note: event.target.value }))}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Record transaction"}
        </button>
      </form>
    </section>
  );
}
