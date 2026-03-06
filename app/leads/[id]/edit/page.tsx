"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type LeadStatus = "NEW" | "CONTACTED" | "TRIAL_SCHEDULED" | "TRIAL_COMPLETED" | "NEGOTIATING" | "CONVERTED" | "LOST";
type LeadSource = "WALK_IN" | "REFERRAL" | "SOCIAL_MEDIA" | "WEBSITE" | "PHONE" | "OTHER";

type LeadData = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  interested_in: string | null;
  notes: string | null;
  last_contacted_at: string | null;
};

export default function EditLeadPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const studioId = session?.user?.studio_id ?? "";
  const [form, setForm] = useState<LeadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchLead = useCallback(async () => {
    if (!studioId || !id) return;
    try {
      const response = await fetch(`/api/leads/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as { data?: LeadData; message?: string };
      if (!response.ok) {
        setError(payload.message ?? "Lead not found.");
        return;
      }
      setForm(payload.data ?? null);
    } catch {
      setError("Failed to load lead.");
    } finally {
      setLoading(false);
    }
  }, [studioId, id]);

  useEffect(() => {
    void fetchLead();
  }, [fetchLead]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!studioId || !form) {
      setError("Not authenticated");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/leads/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          source: form.source,
          status: form.status,
          interested_in: form.interested_in || undefined,
          notes: form.notes || undefined,
          last_contacted_at: form.last_contacted_at || undefined,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(payload.message ?? "Failed to update lead.");
        return;
      }

      router.push("/leads");
      router.refresh();
    } catch {
      setError("Failed to update lead.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!form) return <p className="error">{error || "Lead not found."}</p>;

  return (
    <section className="stack">
      <h1>Edit Lead</h1>
      <p>
        <Link href="/leads">Back to leads</Link>
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          First name
          <input
            value={form.first_name}
            onChange={(e) => setForm((c) => c && ({ ...c, first_name: e.target.value }))}
            required
          />
        </label>

        <label>
          Last name
          <input
            value={form.last_name}
            onChange={(e) => setForm((c) => c && ({ ...c, last_name: e.target.value }))}
            required
          />
        </label>

        <label>
          Email
          <input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => setForm((c) => c && ({ ...c, email: e.target.value }))}
          />
        </label>

        <label>
          Phone
          <input
            value={form.phone ?? ""}
            onChange={(e) => setForm((c) => c && ({ ...c, phone: e.target.value }))}
          />
        </label>

        <label>
          Source
          <select
            value={form.source}
            onChange={(e) => setForm((c) => c && ({ ...c, source: e.target.value as LeadSource }))}
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
          Status
          <select
            value={form.status}
            onChange={(e) => setForm((c) => c && ({ ...c, status: e.target.value as LeadStatus }))}
          >
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="TRIAL_SCHEDULED">Trial Scheduled</option>
            <option value="TRIAL_COMPLETED">Trial Completed</option>
            <option value="NEGOTIATING">Negotiating</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>
        </label>

        <label>
          Interested in
          <input
            value={form.interested_in ?? ""}
            onChange={(e) => setForm((c) => c && ({ ...c, interested_in: e.target.value }))}
          />
        </label>

        <label>
          Last contacted
          <input
            type="date"
            value={form.last_contacted_at?.split("T")[0] ?? ""}
            onChange={(e) =>
              setForm((c) => c && ({ ...c, last_contacted_at: e.target.value || null }))
            }
          />
        </label>

        <label>
          Notes
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm((c) => c && ({ ...c, notes: e.target.value }))}
          />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Update lead"}
        </button>
      </form>
    </section>
  );
}
