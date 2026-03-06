"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
type PaymentStatus = "RECORDED" | "REFUNDED" | "VOID";
type PaymentType = "CONTRACT" | "PRODUCT_SALE" | "OTHER";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
};

type ContractOption = {
  id: string;
  status: string;
  start_date: string;
  plan: { name: string; type: string };
};

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  price_cents: number;
  current_stock: number;
};

// Converts a dollar string to integer cents without floating-point arithmetic.
function dollarsToCents(dollars: string): number | null {
  const parts = dollars.trim().split(".");
  if (parts.length > 2) return null;
  const wholePart = parts[0] ?? "0";
  const fracPart = parts[1] ?? "";
  if (fracPart.length > 2) return null;
  if (!/^\d+$/.test(wholePart) || (fracPart !== "" && !/^\d+$/.test(fracPart))) return null;
  return parseInt(wholePart, 10) * 100 + parseInt(fracPart.padEnd(2, "0"), 10);
}

export default function NewPaymentPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [paymentType, setPaymentType] = useState<PaymentType>("CONTRACT");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedContractId, setSelectedContractId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productQty, setProductQty] = useState(1);
  const [amountDollars, setAmountDollars] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [status, setStatus] = useState<PaymentStatus>("RECORDED");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Default paid_at to today
  useEffect(() => {
    setPaidAt(new Date().toISOString().split("T")[0] ?? "");
  }, []);

  // Fetch members
  useEffect(() => {
    if (!studioId) {
      setMembers([]);
      return;
    }

    setMembersLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/members", { cache: "no-store" });
        const payload = (await response.json()) as { data?: Member[] };
        setMembers(response.ok ? payload.data ?? [] : []);
      } catch {
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    })();
  }, [studioId]);

  // Fetch contracts for selected member
  useEffect(() => {
    setContracts([]);
    setSelectedContractId("");

    if (!studioId || !selectedMemberId || paymentType !== "CONTRACT") return;

    setContractsLoading(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/contracts?member_id=${encodeURIComponent(selectedMemberId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as { data?: ContractOption[] };
        setContracts(response.ok ? payload.data ?? [] : []);
      } catch {
        setContracts([]);
      } finally {
        setContractsLoading(false);
      }
    })();
  }, [studioId, selectedMemberId, paymentType]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!studioId || paymentType !== "PRODUCT_SALE") {
      setProducts([]);
      return;
    }

    setProductsLoading(true);

    try {
      const response = await fetch("/api/products?active=true", { cache: "no-store" });
      const payload = (await response.json()) as { data?: ProductOption[] };
      setProducts(response.ok ? payload.data ?? [] : []);
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [studioId, paymentType]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  // Auto-fill amount when product is selected
  useEffect(() => {
    if (paymentType === "PRODUCT_SALE" && selectedProductId) {
      const product = products.find((p) => p.id === selectedProductId);
      if (product) {
        const total = (product.price_cents * productQty) / 100;
        setAmountDollars(total.toFixed(2));
      }
    }
  }, [selectedProductId, productQty, products, paymentType]);

  // Reset type-specific fields when payment type changes
  useEffect(() => {
    setSelectedContractId("");
    setSelectedProductId("");
    setProductQty(1);
    setAmountDollars("");
  }, [paymentType]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId) {
      setError("Not authenticated");
      return;
    }
    if (!selectedMemberId) {
      setError("Member is required");
      return;
    }

    const amount_cents = dollarsToCents(amountDollars);
    if (amount_cents === null || amount_cents <= 0) {
      setError("Amount must be a positive number with up to 2 decimal places.");
      return;
    }

    const payload: Record<string, unknown> = {
      member_id: selectedMemberId,
      payment_type: paymentType,
      amount_cents,
      currency: "USD",
      method,
      status,
    };

    if (paymentType === "CONTRACT" && selectedContractId) {
      payload.contract_id = selectedContractId;
    }
    if (paymentType === "PRODUCT_SALE") {
      payload.product_id = selectedProductId;
      payload.product_qty = productQty;
    }
    if (paidAt) payload.paid_at = paidAt;
    if (note.trim()) payload.note = note.trim();

    setSubmitting(true);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to create payment.");
        return;
      }

      router.push("/payments");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Payment</h1>
      <p>
        <Link href="/payments">Back to payments</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Payment type
          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
          >
            <option value="CONTRACT">Contract payment</option>
            <option value="PRODUCT_SALE">Product sale</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          Member
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            required
            disabled={membersLoading}
          >
            <option value="">
              {membersLoading ? "Loading members..." : "— select member —"}
            </option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
        </label>

        {paymentType === "CONTRACT" && (
          <label>
            Contract (optional)
            <select
              value={selectedContractId}
              onChange={(e) => setSelectedContractId(e.target.value)}
              disabled={contractsLoading || !selectedMemberId}
            >
              <option value="">
                {contractsLoading ? "Loading contracts..." : "— none —"}
              </option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.plan.name} · starts {new Date(c.start_date).toLocaleDateString()} · {c.status}
                </option>
              ))}
            </select>
          </label>
        )}

        {paymentType === "PRODUCT_SALE" && (
          <>
            <label>
              Product
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                required
                disabled={productsLoading}
              >
                <option value="">
                  {productsLoading ? "Loading products..." : "— select product —"}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.sku ? ` (${p.sku})` : ""} — ${(p.price_cents / 100).toFixed(2)} — Stock:{" "}
                    {p.current_stock}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="1"
                max={selectedProduct?.current_stock ?? 999}
                value={productQty}
                onChange={(e) => setProductQty(parseInt(e.target.value || "1", 10))}
                required
              />
            </label>

            {selectedProduct && (
              <p>
                Available stock: <strong>{selectedProduct.current_stock}</strong>
              </p>
            )}
          </>
        )}

        <label>
          Amount ($)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
            placeholder="e.g. 49.99"
            required
          />
        </label>

        <label>
          Method
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option value="RECORDED">Recorded</option>
            <option value="REFUNDED">Refunded</option>
            <option value="VOID">Void</option>
          </select>
        </label>

        <label>
          Paid at
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </label>

        <label>
          Note (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Internal note"
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Record payment"}
        </button>
      </form>
    </section>
  );
}
