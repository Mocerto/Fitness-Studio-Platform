"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
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
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [statusFilter, setStatusFilter] = useState<"ALL" | MemberStatus>("ALL");
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchMembers = useCallback(async () => {
    if (!studioId) {
      setMembers([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const response = await fetch(`/api/members${query}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as { data?: Member[]; message?: string };
      if (!response.ok) {
        const message = payload.message ?? "Failed to load members.";
        setMembers([]);
        setError(message);
        return;
      }

      setMembers(payload.data ?? []);
    } catch {
      setMembers([]);
      setError("Failed to load members.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, studioId]);

  useEffect(() => {
    if (studioId) {
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
