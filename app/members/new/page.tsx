"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [studioId, setStudioId] = useState("");
  const [form, setForm] = useState<CreateMemberPayload>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    status: "ACTIVE",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedStudioId = window.localStorage.getItem("studio_id");
    if (storedStudioId) {
      setStudioId(storedStudioId);
    }
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId.trim()) {
      setError("x-studio-id required");
      return;
    }

    setSubmitting(true);

    const response = await fetch("/api/members", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-studio-id": studioId.trim(),
      },
      body: JSON.stringify(form),
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(payload.message ?? "Failed to create member.");
      setSubmitting(false);
      return;
    }

    window.localStorage.setItem("studio_id", studioId.trim());
    router.push("/members");
    router.refresh();
  }

  return (
    <section className="stack">
      <h1>New Member</h1>
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
