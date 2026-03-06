"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type Category = { id: string; name: string };

type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: Category | null;
  price_cents: number;
  cost_cents: number | null;
  current_stock: number;
  low_stock_threshold: number | null;
  is_active: boolean;
  created_at: string;
};

type FilterMode = "ALL" | "ACTIVE" | "LOW_STOCK";

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function ProductsClient() {
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [filter, setFilter] = useState<FilterMode>("ALL");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchProducts = useCallback(async () => {
    if (!studioId) {
      setProducts([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (filter === "ACTIVE") params.set("active", "true");
      if (filter === "LOW_STOCK") params.set("low_stock", "true");
      const query = params.toString() ? `?${params.toString()}` : "";

      const response = await fetch(`/api/products${query}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: Product[]; message?: string };

      if (!response.ok) {
        setProducts([]);
        setError(payload.message ?? "Failed to load products.");
        return;
      }

      setProducts(payload.data ?? []);
    } catch {
      setProducts([]);
      setError("Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [filter, studioId]);

  useEffect(() => {
    if (studioId) {
      void fetchProducts();
    } else {
      setProducts([]);
    }
  }, [studioId, filter, fetchProducts]);

  async function handleDeactivate(productId: string) {
    if (!confirm("Deactivate this product?")) return;

    try {
      const response = await fetch(`/api/products/${productId}/deactivate`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string };
        alert(payload.message ?? "Failed to deactivate product.");
        return;
      }

      void fetchProducts();
    } catch {
      alert("Failed to deactivate product.");
    }
  }

  return (
    <section className="stack">
      <h1>Products</h1>

      <div className="row">
        <label>
          Filter
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterMode)}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active only</option>
            <option value="LOW_STOCK">Low stock</option>
          </select>
        </label>

        <button type="button" onClick={() => void fetchProducts()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/products/new">New product</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>SKU</th>
            <th>Category</th>
            <th>Price</th>
            <th>Cost</th>
            <th>Stock</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.length === 0 ? (
            <tr>
              <td colSpan={9}>{loading ? "Loading..." : "No products found."}</td>
            </tr>
          ) : (
            products.map((product) => (
              <tr
                key={product.id}
                style={
                  product.low_stock_threshold != null &&
                  product.current_stock <= product.low_stock_threshold
                    ? { backgroundColor: "#fef2f2" }
                    : undefined
                }
              >
                <td>{product.name}</td>
                <td>{product.sku ?? "-"}</td>
                <td>{product.category?.name ?? "-"}</td>
                <td>{formatCurrency(product.price_cents)}</td>
                <td>{product.cost_cents != null ? formatCurrency(product.cost_cents) : "-"}</td>
                <td>
                  {product.current_stock}
                  {product.low_stock_threshold != null &&
                    product.current_stock <= product.low_stock_threshold && " ⚠"}
                </td>
                <td>{product.is_active ? "Active" : "Inactive"}</td>
                <td>{formatDate(product.created_at)}</td>
                <td>
                  <div className="row">
                    <Link href={`/products/${product.id}/edit`}>Edit</Link>
                    {product.is_active && (
                      <button type="button" onClick={() => handleDeactivate(product.id)}>
                        Deactivate
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
