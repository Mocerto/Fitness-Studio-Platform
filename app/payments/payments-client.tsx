"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PaymentStatus = "RECORDED" | "REFUNDED" | "VOID";
type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";

type Payment = {
  id: string;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string;
  note: string | null;
  member: { id: string; first_name: string; last_name: string };
  contract: { id: string; status: string } | null;
};

type StatusFilter = "ALL" | PaymentStatus;

function formatAmount(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatDatetime(value: string) {
  return new Date(value).toLocaleString();
}

export default function PaymentsClient() {
  const [studioId, setStudioId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [memberIdFilter, setMemberIdFilter] = useState("");
  const [contractIdFilter, setContractIdFilter] = useState("");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("studio_id");
    if (stored) setStudioId(stored);
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!studioId.trim()) {
      setPayments([]);
      setError("Provide studio id first.");
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (memberIdFilter.trim()) params.set("member_id", memberIdFilter.trim());
    if (contractIdFilter.trim()) params.set("contract_id", contractIdFilter.trim());
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    const query = params.size > 0 ? `?${params.toString()}` : "";

    try {
      const response = await fetch(`/api/payments${query}`, {
        headers: { "x-studio-id": studioId.trim() },
        cache: "no-store",
      });

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
  }, [studioId, statusFilter, memberIdFilter, contractIdFilter, fromFilter, toFilter]);

  useEffect(() => {
    if (studioId.trim()) {
      window.localStorage.setItem("studio_id", studioId.trim());
      void fetchPayments();
    } else {
      setPayments([]);
    }
  }, [studioId, statusFilter, fetchPayments]);

  return (
    <section className="stack">
      <h1>Payments</h1>

      <div className="row">
        <label>
          Studio ID
          <input
            value={studioId}
            onChange={(e) => setStudioId(e.target.value)}
            placeholder="UUID from studios table"
          />
        </label>

        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="ALL">ALL</option>
            <option value="RECORDED">RECORDED</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="VOID">VOID</option>
          </select>
        </label>

        <label>
          Member ID
          <input
            value={memberIdFilter}
            onChange={(e) => setMemberIdFilter(e.target.value)}
            placeholder="UUID (optional)"
          />
        </label>

        <label>
          Contract ID
          <input
            value={contractIdFilter}
            onChange={(e) => setContractIdFilter(e.target.value)}
            placeholder="UUID (optional)"
          />
        </label>

        <label>
          From
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
          />
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
            <th>Contract</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {payments.length === 0 ? (
            <tr>
              <td colSpan={7}>{loading ? "Loading..." : "No payments found."}</td>
            </tr>
          ) : (
            payments.map((payment) => (
              <tr key={payment.id}>
                <td>{formatDatetime(payment.paid_at)}</td>
                <td>
                  {payment.member.first_name} {payment.member.last_name}
                </td>
                <td>{payment.contract ? payment.contract.status : "-"}</td>
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
