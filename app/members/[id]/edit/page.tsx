"use client";

import Link from "next/link";
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
  const memberId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);

  const [studioId, setStudioId] = useState("");
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
    const storedStudioId = window.localStorage.getItem("studio_id");
    if (storedStudioId) {
      setStudioId(storedStudioId);
    }
  }, []);

  useEffect(() => {
    async function loadMember() {
      if (!studioId.trim() || !memberId) {
        return;
      }

      setLoading(true);
      setError("");

      const response = await fetch("/api/members", {
        headers: {
          "x-studio-id": studioId.trim(),
        },
        cache: "no-store",
      });

      const payload = (await response.json()) as { data?: Member[]; message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Failed to load member.");
        setLoading(false);
        return;
      }

      const foundMember = payload.data?.find((entry) => entry.id === memberId);
      if (!foundMember) {
        setError("Member not found in this studio.");
        setLoading(false);
        return;
      }

      setMember(foundMember);
      setFirstName(foundMember.first_name);
      setLastName(foundMember.last_name);
      setEmail(foundMember.email ?? "");
      setPhone(foundMember.phone ?? "");
      setStatus(foundMember.status);
      setLoading(false);
    }

    void loadMember();
  }, [memberId, studioId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }

    setSubmitting(true);
    setError("");

    const response = await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-studio-id": studioId.trim(),
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
      setSubmitting(false);
      return;
    }

    setMember(payload.data);
    window.localStorage.setItem("studio_id", studioId.trim());
    setSubmitting(false);
  }

  async function handleDeactivate() {
    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }

    const response = await fetch(`/api/members/${memberId}/deactivate`, {
      method: "POST",
      headers: {
        "x-studio-id": studioId.trim(),
      },
    });

    const payload = (await response.json()) as { data?: Member; message?: string };
    if (!response.ok || !payload.data) {
      setError(payload.message ?? "Failed to deactivate member.");
      return;
    }

    setMember(payload.data);
    setStatus(payload.data.status);
    window.localStorage.setItem("studio_id", studioId.trim());
    router.refresh();
  }

  return (
    <section className="stack">
      <h1>Edit Member</h1>
      <p>
        <Link href="/members">Back to members</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          Studio ID
          <input
            value={studioId}
            onChange={(event) => setStudioId(event.target.value)}
            placeholder="UUID from studios table"
          />
        </label>

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
          <button type="button" onClick={() => void handleDeactivate()} disabled={loading}>
            Deactivate
          </button>
        </div>
      </form>
    </section>
  );
}
