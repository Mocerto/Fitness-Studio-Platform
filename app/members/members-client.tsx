"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type MemberStatus = "ACTIVE" | "FROZEN" | "INACTIVE";
type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
  created_at: string;
};

const STATUS_FILTERS: Array<"ALL" | MemberStatus> = ["ALL", "ACTIVE", "FROZEN", "INACTIVE"];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function MembersClient() {
  const [studioId, setStudioId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedStudioId = window.localStorage.getItem("studio_id");
    if (storedStudioId) {
      setStudioId(storedStudioId);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    if (!studioId.trim()) {
      setMembers([]);
      setError("Provide studio id first.");
      return;
    }

    setLoading(true);
    setError("");

    const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
    const response = await fetch(`/api/members${query}`, {
      headers: {
        "x-studio-id": studioId.trim(),
      },
      cache: "no-store",
    });

    const payload = (await response.json()) as { data?: Member[]; message?: string };
    if (!response.ok) {
      setMembers([]);
      setError(payload.message ?? "Failed to load members.");
      setLoading(false);
      return;
    }

    setMembers(payload.data ?? []);
    setLoading(false);
  }, [statusFilter, studioId]);

  useEffect(() => {
    if (studioId.trim()) {
      window.localStorage.setItem("studio_id", studioId.trim());
      void fetchMembers();
    } else {
      setMembers([]);
    }
  }, [studioId, statusFilter, fetchMembers]);

  return (
    <section className="stack">
      <h1>Members</h1>

      <div className="row">
        <label>
          Studio ID
          <input
            value={studioId}
            onChange={(event) => setStudioId(event.target.value)}
            placeholder="UUID from studios table"
          />
        </label>

        <label>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | MemberStatus)}
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={() => void fetchMembers()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>

        <Link href="/members/new">New member</Link>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Status</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <tr>
              <td colSpan={6}>{loading ? "Loading..." : "No members found."}</td>
            </tr>
          ) : (
            members.map((member) => (
              <tr key={member.id}>
                <td>{`${member.first_name} ${member.last_name}`}</td>
                <td>{member.email ?? "-"}</td>
                <td>{member.phone ?? "-"}</td>
                <td>{member.status}</td>
                <td>{formatDate(member.created_at)}</td>
                <td>
                  <Link href={`/members/${member.id}/edit`}>Edit</Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
