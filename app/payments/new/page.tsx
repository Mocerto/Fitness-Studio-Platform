"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER" | "OTHER";
type PaymentStatus = "RECORDED" | "REFUNDED" | "VOID";

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

type CreatePaymentPayload = {
  member_id: string;
  contract_id?: string;
  amount_cents: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at?: string;
  note?: string;
};

// Converts a dollar string to integer cents without floating-point arithmetic.
// Accepts "49.99" → 4999, "10" → 1000, "1.5" → 150.
// Returns null if more than 2 decimal places or non-numeric.
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

  const [studioId, setStudioId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [status, setStatus] = useState<PaymentStatus>("RECORDED");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // On mount: restore studio_id and default paid_at to today
  useEffect(() => {
    const stored = window.localStorage.getItem("studio_id");
    if (stored) setStudioId(stored);
    setPaidAt(new Date().toISOString().split("T")[0] ?? "");
  }, []);

  // Fetch members whenever studioId changes
  useEffect(() => {
    if (!studioId.trim()) {
      setMembers([]);
      setSelectedMemberId("");
      return;
    }

    setMembersLoading(true);

    void (async () => {
      try {
        const response = await fetch("/api/members", {
          headers: { "x-studio-id": studioId.trim() },
          cache: "no-store",
        });
        const payload = (await response.json()) as { data?: Member[]; message?: string };
        if (response.ok) {
          setMembers(payload.data ?? []);
        } else {
          setMembers([]);
        }
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

    if (!studioId.trim() || !selectedMemberId) {
      return;
    }

    setContractsLoading(true);

    void (async () => {
      try {
        const response = await fetch(
          `/api/contracts?member_id=${encodeURIComponent(selectedMemberId)}`,
          {
            headers: { "x-studio-id": studioId.trim() },
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as {
          data?: ContractOption[];
          message?: string;
        };
        if (response.ok) {
          setContracts(payload.data ?? []);
        } else {
          setContracts([]);
        }
      } catch {
        setContracts([]);
      } finally {
        setContractsLoading(false);
      }
    })();
  }, [studioId, selectedMemberId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }
    if (!selectedMemberId) {
      setError("member is required");
      return;
    }

    const amount_cents = dollarsToCents(amountDollars);
    if (amount_cents === null) {
      setError("amount must be a number with up to 2 decimal places (e.g. 49.99)");
      return;
    }
    if (amount_cents <= 0) {
      setError("amount must be greater than zero");
      return;
    }

    const payload: CreatePaymentPayload = {
      member_id: selectedMemberId,
      amount_cents,
      currency: "USD",
      method,
      status,
    };

    if (selectedContractId) {
      payload.contract_id = selectedContractId;
    }
    if (paidAt) {
      payload.paid_at = paidAt;
    }
    if (note.trim()) {
      payload.note = note.trim();
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-studio-id": studioId.trim(),
        },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "Failed to create payment.");
        return;
      }

      window.localStorage.setItem("studio_id", studioId.trim());
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
          Studio ID
          <input
            value={studioId}
            onChange={(e) => setStudioId(e.target.value)}
            placeholder="UUID from studios table"
          />
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
            <option value="CASH">CASH</option>
            <option value="CARD">CARD</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="OTHER">OTHER</option>
          </select>
        </label>

        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)}>
            <option value="RECORDED">RECORDED</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="VOID">VOID</option>
          </select>
        </label>

        <label>
          Paid at
          <input
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
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
