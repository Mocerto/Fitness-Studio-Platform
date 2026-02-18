"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type PlanType = "UNLIMITED" | "LIMITED";
type ContractStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";

type Contract = {
  id: string;
  status: ContractStatus;
  plan_type_snapshot: PlanType;
  class_limit_snapshot: number | null;
  remaining_classes: number | null;
  start_date: string;
  end_date: string | null;
  paused_from: string | null;
  paused_until: string | null;
  member: { id: string; first_name: string; last_name: string };
  plan: { id: string; name: string; type: PlanType };
  created_at: string;
};

type StatusFilter = "ALL" | ContractStatus;

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function ContractsClient() {
  const [studioId, setStudioId] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [memberIdFilter, setMemberIdFilter] = useState("");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("studio_id");
    if (stored) setStudioId(stored);
  }, []);

  const fetchContracts = useCallback(async () => {
    if (!studioId.trim()) {
      setContracts([]);
      setError("Provide studio id first.");
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (memberIdFilter.trim()) params.set("member_id", memberIdFilter.trim());
    const query = params.size > 0 ? `?${params.toString()}` : "";

    try {
      const response = await fetch(`/api/contracts${query}`, {
        headers: { "x-studio-id": studioId.trim() },
        cache: "no-store",
      });

      const payload = (await response.json()) as { data?: Contract[]; message?: string };
      if (!response.ok) {
        setContracts([]);
        setError(payload.message ?? "Failed to load contracts.");
        return;
      }

      setContracts(payload.data ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [studioId, statusFilter, memberIdFilter]);

  useEffect(() => {
    if (studioId.trim()) {
      window.localStorage.setItem("studio_id", studioId.trim());
      void fetchContracts();
    } else {
      setContracts([]);
    }
  }, [studioId, statusFilter, fetchContracts]);

  async function handlePause(contractId: string) {
    if (!studioId.trim()) return;
    setError("");
    try {
      const response = await fetch(`/api/contracts/${contractId}/pause`, {
        method: "POST",
        headers: { "x-studio-id": studioId.trim() },
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        setError(result.message ?? "Failed to pause contract.");
        return;
      }
      void fetchContracts();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  async function handleCancel(contractId: string) {
    if (!studioId.trim()) return;
    setError("");
    try {
      const response = await fetch(`/api/contracts/${contractId}/cancel`, {
        method: "POST",
        headers: { "x-studio-id": studioId.trim() },
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string };
        setError(result.message ?? "Failed to cancel contract.");
        return;
      }
      void fetchContracts();
    } catch {
      setError("Network error. Please try again.");
    }
  }

  return (
    <section className="stack">
      <h1>Contracts</h1>

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
            <option value="ACTIVE">ACTIVE</option>
            <option value="PAUSED">PAUSED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="EXPIRED">EXPIRED</option>
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

        <button type="button" onClick={() => void fetchContracts()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/contracts/new">New contract</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Plan</th>
            <th>Status</th>
            <th>Type</th>
            <th>Class Limit</th>
            <th>Remaining</th>
            <th>Start</th>
            <th>End</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contracts.length === 0 ? (
            <tr>
              <td colSpan={9}>{loading ? "Loading..." : "No contracts found."}</td>
            </tr>
          ) : (
            contracts.map((contract) => (
              <tr key={contract.id}>
                <td>
                  {contract.member.first_name} {contract.member.last_name}
                </td>
                <td>{contract.plan.name}</td>
                <td>{contract.status}</td>
                <td>{contract.plan_type_snapshot}</td>
                <td>{contract.class_limit_snapshot ?? "-"}</td>
                <td>{contract.remaining_classes ?? "-"}</td>
                <td>{formatDate(contract.start_date)}</td>
                <td>{formatDate(contract.end_date)}</td>
                <td className="row">
                  {contract.status === "ACTIVE" ? (
                    <button type="button" onClick={() => void handlePause(contract.id)}>
                      Pause
                    </button>
                  ) : null}
                  {contract.status !== "CANCELLED" ? (
                    <button type="button" onClick={() => void handleCancel(contract.id)}>
                      Cancel
                    </button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
