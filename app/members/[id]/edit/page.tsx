"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MemberStatus = "ACTIVE" | "FROZEN" | "INACTIVE";
type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
};

export default function EditMemberPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const memberId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);

  const [member, setMember] = useState<Member | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<MemberStatus>("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMember() {
      if (!studioId || !memberId) {
        return;
      }

      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/members", {
          cache: "no-store",
        });

        const payload = (await response.json()) as { data?: Member[]; message?: string };
        if (!response.ok) {
          setError(payload.message ?? "Failed to load member.");
          return;
        }

        const foundMember = payload.data?.find((entry) => entry.id === memberId);
        if (!foundMember) {
          setError("Member not found in this studio.");
          return;
        }

        setMember(foundMember);
        setFirstName(foundMember.first_name);
        setLastName(foundMember.last_name);
        setEmail(foundMember.email ?? "");
        setPhone(foundMember.phone ?? "");
        setStatus(foundMember.status);
      } catch {
        setError("Failed to load member.");
      } finally {
        setLoading(false);
      }
    }

    void loadMember();
  }, [memberId, studioId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studioId) {
      setError("Not authenticated");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          status,
        }),
      });

      const payload = (await response.json()) as { data?: Member; message?: string };
      if (!response.ok || !payload.data) {
        setError(payload.message ?? "Failed to update member.");
        return;
      }

      setMember(payload.data);
    } catch {
      setError("Failed to update member.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!studioId) {
      setError("Not authenticated");
      return;
    }
    setSubmitting(true);

    try {
      const response = await fetch(`/api/members/${memberId}/deactivate`, {
        method: "POST",
      });

      const payload = (await response.json()) as { data?: Member; message?: string };
      if (!response.ok || !payload.data) {
        setError(payload.message ?? "Failed to deactivate member.");
        return;
      }

      setMember(payload.data);
      setStatus(payload.data.status);
      router.refresh();
    } catch {
      setError("Failed to deactivate member.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>Edit Member</h1>
      <p>
        <Link href="/members">Back to members</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          First name
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label>
          Last name
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
            disabled={loading}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />
        </label>

        <label>
          Phone
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={loading}
          />
        </label>

        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as MemberStatus)}
            disabled={loading}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="FROZEN">FROZEN</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>

        {member ? <p>Member ID: {member.id}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="row">
          <button type="submit" disabled={submitting || loading}>
            {submitting ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => void handleDeactivate()}
            disabled={loading || submitting}
          >
            Deactivate
          </button>
        </div>
      </form>
    </section>
  );
}
