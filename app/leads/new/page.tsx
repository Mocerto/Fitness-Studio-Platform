"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LeadSource = "WALK_IN" | "REFERRAL" | "SOCIAL_MEDIA" | "WEBSITE" | "PHONE" | "OTHER";

export default function NewLeadPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    source: "WALK_IN" as LeadSource,
    interested_in: "",
    notes: "",
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
      const payload: Record<string, unknown> = {
        first_name: form.first_name,
        last_name: form.last_name,
        source: form.source,
      };

      if (form.email) payload.email = form.email;
      if (form.phone) payload.phone = form.phone;
      if (form.interested_in) payload.interested_in = form.interested_in;
      if (form.notes) payload.notes = form.notes;

      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(result.message ?? "Failed to create lead.");
        return;
      }

      router.push("/leads");
      router.refresh();
    } catch {
      setError("Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="stack">
      <h1>New Lead</h1>
      <p>
        <Link href="/leads">Back to leads</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          First name
          <input
            value={form.first_name}
            onChange={(e) => setForm((c) => ({ ...c, first_name: e.target.value }))}
            required
          />
        </label>

        <label>
          Last name
          <input
            value={form.last_name}
            onChange={(e) => setForm((c) => ({ ...c, last_name: e.target.value }))}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
          />
        </label>

        <label>
          Phone
          <input
            value={form.phone}
            onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
          />
        </label>

        <label>
          Source
          <select
            value={form.source}
            onChange={(e) => setForm((c) => ({ ...c, source: e.target.value as LeadSource }))}
          >
            <option value="WALK_IN">Walk-in</option>
            <option value="REFERRAL">Referral</option>
            <option value="SOCIAL_MEDIA">Social media</option>
            <option value="WEBSITE">Website</option>
            <option value="PHONE">Phone</option>
            <option value="OTHER">Other</option>
          </select>
        </label>

        <label>
          Interested in
          <input
            value={form.interested_in}
            onChange={(e) => setForm((c) => ({ ...c, interested_in: e.target.value }))}
            placeholder="e.g. Pilates, Barre, General fitness"
          />
        </label>

        <label>
          Notes
          <textarea
            value={form.notes}
            onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Create lead"}
        </button>
      </form>
    </section>
  );
}
