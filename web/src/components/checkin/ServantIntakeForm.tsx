"use client";

import { useState } from "react";
import { submitNewServantAction, type NewServantInput } from "@/app/checkin/actions";

const inputClass =
  "w-full rounded-md border border-[#ddd] px-3 py-2.5 text-base focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10";

const EMPTY_FORM: NewServantInput = {
  full_name: "",
  phone: null,
  email: null,
  father_of_confession: null,
  gender: null,
  comments: null,
};

/** New servant self-registration (0014_servant_self_registration.sql) --
 * deliberately captures info + attendance only, no app account. An Admin/
 * General Coordinator reviews and approves it later; the account is
 * created automatically the first time this person actually signs into
 * the app themselves. */
export function ServantIntakeForm({
  token,
  onBack,
  onSubmitted,
}: {
  token: string;
  onBack?: () => void;
  onSubmitted: (name: string) => void;
}) {
  const [form, setForm] = useState<NewServantInput>(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof NewServantInput>(key: K, value: NewServantInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.full_name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await submitNewServantAction(token, form);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSubmitted(form.full_name);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-4 space-y-3">
      <h2 className="text-base font-bold text-[#1e3a5f]">New Servant Registration</h2>
      <p className="text-xs text-[#666]">
        Your info and today&rsquo;s attendance will be recorded. A coordinator will follow up to give you app access.
      </p>
      {error && <p className="text-sm text-[#dc3545]">{error}</p>}
      <Field label="Full Name *">
        <input
          required
          value={form.full_name}
          onChange={(e) => field("full_name", e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Phone">
        <input
          type="tel"
          value={form.phone ?? ""}
          onChange={(e) => field("phone", e.target.value || null)}
          className={inputClass}
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          value={form.email ?? ""}
          onChange={(e) => field("email", e.target.value || null)}
          className={inputClass}
        />
      </Field>
      <Field label="Gender">
        <select value={form.gender ?? ""} onChange={(e) => field("gender", e.target.value || null)} className={inputClass}>
          <option value="">—</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </Field>
      <Field label="Father of Confession">
        <input
          value={form.father_of_confession ?? ""}
          onChange={(e) => field("father_of_confession", e.target.value || null)}
          className={inputClass}
        />
      </Field>
      <Field label="Comments">
        <textarea
          value={form.comments ?? ""}
          onChange={(e) => field("comments", e.target.value || null)}
          className={inputClass}
          rows={2}
        />
      </Field>
      <div className="flex gap-2 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md bg-[#f0f0f0] px-4 py-3 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0]"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#333] mb-1">{label}</label>
      {children}
    </div>
  );
}
