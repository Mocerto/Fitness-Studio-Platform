"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type MemberStatus = "ACTIVE" | "FROZEN" | "INACTIVE";

type CreateMemberPayload = {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  status: MemberStatus;
};

export default function NewMemberPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [form, setForm] = useState<CreateMemberPayload>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    status: "ACTIVE",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId) {
      setError("Not authenticated");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        const message = payload.message ?? "Failed to create member.";
        setError(message);
        return;
      }

      router.push("/members");
      router.refresh();
    } catch {
      setError("Failed to create member.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Member</h1>
      <p>
        <Link href="/members">Back to members</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          First name
          <input
            value={form.first_name}
            onChange={(event) =>
              setForm((current) => ({ ...current, first_name: event.target.value }))
            }
            required
          />
        </label>

        <label>
          Last name
          <input
            value={form.last_name}
            onChange={(event) =>
              setForm((current) => ({ ...current, last_name: event.target.value }))
            }
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </label>

        <label>
          Phone
          <input
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
        </label>

        <label>
          Status
          <select
            value={form.status}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                status: event.target.value as MemberStatus,
              }))
            }
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="FROZEN">FROZEN</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Create member"}
        </button>
      </form>
    </section>
  );
}
