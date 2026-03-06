"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type PaymentStatus = "RECORDED" | "REFUNDED" | "VOID";
type PaymentType = "CONTRACT" | "PRODUCT_SALE" | "OTHER";

type Payment = {
  id: string;
  payment_type: PaymentType;
  amount_cents: number;
  currency: string;
  method: string;
  status: PaymentStatus;
  paid_at: string;
  product_qty: number | null;
  note: string | null;
  member: { id: string; first_name: string; last_name: string };
  contract: { id: string; status: string } | null;
  product: { id: string; name: string; sku: string | null } | null;
};

type StatusFilter = "ALL" | PaymentStatus;
type TypeFilter = "ALL" | PaymentType;

function formatAmount(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatDatetime(value: string) {
  return new Date(value).toLocaleString();
}

const TYPE_LABELS: Record<PaymentType, string> = {
  CONTRACT: "Contract",
  PRODUCT_SALE: "Product Sale",
  OTHER: "Other",
};

export default function PaymentsClient() {
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPayments = useCallback(async () => {
    if (!studioId) {
      setPayments([]);
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (typeFilter !== "ALL") params.set("payment_type", typeFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    const query = params.size > 0 ? `?${params.toString()}` : "";

    try {
      const response = await fetch(`/api/payments${query}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: Payment[]; message?: string };

      if (!response.ok) {
        setPayments([]);
        setError(payload.message ?? "Failed to load payments.");
        return;
      }

      setPayments(payload.data ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [studioId, statusFilter, typeFilter, fromFilter, toFilter]);

  useEffect(() => {
    if (studioId) {
      void fetchPayments();
    } else {
      setPayments([]);
    }
  }, [studioId, statusFilter, typeFilter, fetchPayments]);

  function referenceLabel(payment: Payment) {
    if (payment.payment_type === "CONTRACT" && payment.contract) {
      return `Contract (${payment.contract.status})`;
    }
    if (payment.payment_type === "PRODUCT_SALE" && payment.product) {
      return `${payment.product.name}${payment.product_qty ? ` x${payment.product_qty}` : ""}`;
    }
    return "-";
  }

  return (
    <section className="stack">
      <h1>Payments</h1>

      <div className="row">
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ALL">All</option>
            <option value="RECORDED">Recorded</option>
            <option value="REFUNDED">Refunded</option>
            <option value="VOID">Void</option>
          </select>
        </label>

        <label>
          Type
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="ALL">All</option>
            <option value="CONTRACT">Contract</option>
            <option value="PRODUCT_SALE">Product Sale</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          From
          <input type="date" value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} />
        </label>

        <label>
          To
          <input
            type="date"
            value={toFilter}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setToFilter(e.target.value)}
          />
        </label>

        <button type="button" onClick={() => void fetchPayments()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/payments/new">New payment</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Paid At</th>
            <th>Member</th>
            <th>Type</th>
            <th>Reference</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={8}>{loading ? "Loading..." : "No payments found."}</td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr
                key={payment.id}
                style={payment.status === "VOID" ? { opacity: 0.5 } : undefined}
              >
                <td>{formatDatetime(payment.paid_at)}</td>
                <td>
                  {payment.member.first_name} {payment.member.last_name}
                </td>
                <td>{TYPE_LABELS[payment.payment_type]}</td>
                <td>{referenceLabel(payment)}</td>
                <td>{formatAmount(payment.amount_cents, payment.currency)}</td>
                <td>{payment.method}</td>
                <td>{payment.status}</td>
                <td>{payment.note ?? "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
