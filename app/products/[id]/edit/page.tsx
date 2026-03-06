"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Category = { id: string; name: string };

type ProductData = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category_id: string | null;
  price_cents: number;
  cost_cents: number | null;
  current_stock: number;
  low_stock_threshold: number | null;
  is_active: boolean;
};

export default function EditProductPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchProduct = useCallback(async () => {
    if (!studioId || !id) return;

    try {
      const [productRes, catRes] = await Promise.all([
        fetch(`/api/products/${id}`, { cache: "no-store" }),
        fetch("/api/product-categories", { cache: "no-store" }),
      ]);

      const productPayload = (await productRes.json()) as { data?: ProductData; message?: string };
      const catPayload = (await catRes.json()) as { data?: Category[] };

      if (!productRes.ok) {
        setError(productPayload.message ?? "Product not found.");
        return;
      }

      setForm(productPayload.data ?? null);
      setCategories(catPayload.data ?? []);
    } catch {
      setError("Failed to load product.");
    } finally {
      setLoading(false);
    }
  }, [studioId, id]);

  useEffect(() => {
    void fetchProduct();
  }, [fetchProduct]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId || !form) {
      setError("Not authenticated");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          sku: form.sku || undefined,
          category_id: form.category_id || undefined,
          price_cents: form.price_cents,
          cost_cents: form.cost_cents ?? undefined,
          low_stock_threshold: form.low_stock_threshold ?? undefined,
          is_active: form.is_active,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Failed to update product.");
        return;
      }

      router.push("/products");
      router.refresh();
    } catch {
      setError("Failed to update product.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!form) return <p className="error">{error || "Product not found."}</p>;

  return (
    <section className="stack">
      <h1>Edit Product</h1>
      <p>
        <Link href="/products">Back to products</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Name
          <input
            value={form.name}
            onChange={(event) => setForm((c) => c && ({ ...c, name: event.target.value }))}
            required
          />
        </label>

        <label>
          Description
          <textarea
            value={form.description ?? ""}
            onChange={(event) => setForm((c) => c && ({ ...c, description: event.target.value }))}
          />
        </label>

        <label>
          SKU
          <input
            value={form.sku ?? ""}
            onChange={(event) => setForm((c) => c && ({ ...c, sku: event.target.value }))}
          />
        </label>

        <label>
          Category
          <select
            value={form.category_id ?? ""}
            onChange={(event) =>
              setForm((c) => c && ({ ...c, category_id: event.target.value || null }))
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
          Sell price ($)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.price_cents / 100}
            onChange={(event) =>
              setForm((c) => c && ({ ...c, price_cents: Math.round(parseFloat(event.target.value || "0") * 100) }))
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
              setForm((c) =>
                c && ({
                  ...c,
                  cost_cents: event.target.value
                    ? Math.round(parseFloat(event.target.value) * 100)
                    : null,
                }),
              )
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
              setForm((c) =>
                c && ({
                  ...c,
                  low_stock_threshold: event.target.value
                    ? parseInt(event.target.value, 10)
                    : null,
                }),
              )
            }
          />
        </label>

        <label>
          Active
          <select
            value={form.is_active ? "true" : "false"}
            onChange={(event) =>
              setForm((c) => c && ({ ...c, is_active: event.target.value === "true" }))
            }
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Update product"}
        </button>
      </form>
    </section>
  );
}
