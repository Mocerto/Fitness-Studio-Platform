"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Category = { id: string; name: string };

type CreateProductPayload = {
  name: string;
  description: string;
  sku: string;
  category_id: string;
  price_cents: number;
  cost_cents: number | undefined;
  current_stock: number;
  low_stock_threshold: number | undefined;
};

export default function NewProductPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [form, setForm] = useState<CreateProductPayload>({
    name: "",
    description: "",
    sku: "",
    category_id: "",
    price_cents: 0,
    cost_cents: undefined,
    current_stock: 0,
    low_stock_threshold: undefined,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchCategories = useCallback(async () => {
    if (!studioId) return;
    try {
      const response = await fetch("/api/product-categories", { cache: "no-store" });
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
      const response = await fetch("/api/product-categories", {
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

    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        price_cents: form.price_cents,
        current_stock: form.current_stock,
      };

      if (form.description) payload.description = form.description;
      if (form.sku) payload.sku = form.sku;
      if (form.category_id) payload.category_id = form.category_id;
      if (form.cost_cents != null) payload.cost_cents = form.cost_cents;
      if (form.low_stock_threshold != null) payload.low_stock_threshold = form.low_stock_threshold;

      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(result.message ?? "Failed to create product.");
        return;
      }

      router.push("/products");
      router.refresh();
    } catch {
      setError("Failed to create product.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Product</h1>
      <p>
        <Link href="/products">Back to products</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => setForm((c) => ({ ...c, name: event.target.value }))}
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={form.description}
            onChange={(event) => setForm((c) => ({ ...c, description: event.target.value }))}
          />
        </label>

        <label>
          SKU
          <input
            value={form.sku}
            onChange={(event) => setForm((c) => ({ ...c, sku: event.target.value }))}
          />
        </label>

        <label>
          Category
          <select
            value={form.category_id}
            onChange={(event) => setForm((c) => ({ ...c, category_id: event.target.value }))}
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
            onChange={(event) => setNewCategory(event.target.value)}
          />
          <button type="button" onClick={handleAddCategory}>
            Add category
          </button>
        </div>

        <label>
          Sell price ($)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price_cents / 100}
            onChange={(event) =>
              setForm((c) => ({ ...c, price_cents: Math.round(parseFloat(event.target.value || "0") * 100) }))
            }
            required
          />
        </label>

        <label>
          Cost price ($)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.cost_cents != null ? form.cost_cents / 100 : ""}
            onChange={(event) =>
              setForm((c) => ({
                ...c,
                cost_cents: event.target.value
                  ? Math.round(parseFloat(event.target.value) * 100)
                  : undefined,
              }))
            }
          />
        </label>

        <label>
          Initial stock
          <input
            type="number"
            min="0"
            value={form.current_stock}
            onChange={(event) =>
              setForm((c) => ({ ...c, current_stock: parseInt(event.target.value || "0", 10) }))
            }
          />
        </label>

        <label>
          Low stock alert threshold
          <input
            type="number"
            min="0"
            value={form.low_stock_threshold ?? ""}
            onChange={(event) =>
              setForm((c) => ({
                ...c,
                low_stock_threshold: event.target.value
                  ? parseInt(event.target.value, 10)
                  : undefined,
              }))
            }
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Create product"}
        </button>
      </form>
    </section>
  );
}
