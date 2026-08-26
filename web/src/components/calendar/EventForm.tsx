"use client";

import { useRef, useState, useTransition } from "react";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar-types";
import { EVENT_TYPES } from "@/lib/calendar-types";
import { calendarAttachmentUrl } from "@/lib/storage";
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
  uploadEventAttachmentAction,
  removeEventAttachmentAction,
  type EventInput,
} from "@/app/calendar/actions";

const inputClass =
  "w-full rounded-md border border-[#ddd] px-3 py-2 text-sm focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/10";

/** REQUIREMENTS.md §6.8 -- auto-template suggestions for Speaker Session /
 * Group Discussion, only applied when the description is still empty (a
 * suggestion, not an overwrite). */
const DESCRIPTION_TEMPLATES: Partial<Record<CalendarEventType, string>> = {
  "Speaker Session": "Speaker: \nTopic: \n",
  "Group Discussion": "Discussion Topic: \nLeader: \n",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Create/edit modal for a Service Calendar event (§6.8) -- open to all
 * Servants (RLS enforces this regardless of the UI). Attachment upload only
 * appears once the event exists (same pattern as member photo upload). */
export function EventForm({
  event,
  defaultDate,
  onClose,
  onSaved,
}: {
  event: CalendarEvent | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EventInput>({
    title: event?.title ?? "",
    description: event?.description ?? "",
    event_type: event?.event_type ?? "Event",
    start_date: event?.start_date ?? defaultDate ?? todayISO(),
    end_date: event?.end_date ?? defaultDate ?? todayISO(),
    all_day: event?.all_day ?? true,
    start_time: event?.start_time ?? null,
    end_time: event?.end_time ?? null,
    location: event?.location ?? null,
  });
  const [attachmentPath, setAttachmentPath] = useState(event?.attachment_url ?? null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function field<K extends keyof EventInput>(key: K, value: EventInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleTypeChange(type: CalendarEventType) {
    setForm((f) => {
      const template = DESCRIPTION_TEMPLATES[type];
      const shouldApplyTemplate = template && !f.description?.trim();
      return { ...f, event_type: type, description: shouldApplyTemplate ? template : f.description };
    });
  }

  function handleSave() {
    if (!form.title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("End date can't be before the start date.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = event ? await updateEventAction(event.id, form) : await createEventAction(form);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  function handleDelete() {
    if (!event) return;
    if (!confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteEventAction(event.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!event) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("attachment", file);
    startTransition(async () => {
      const result = await uploadEventAttachmentAction(event.id, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAttachmentPath(result.path);
      onSaved();
    });
  }

  function handleRemoveAttachment() {
    if (!event || !attachmentPath) return;
    startTransition(async () => {
      const result = await removeEventAttachmentAction(event.id, attachmentPath);
      if (result.error) {
        setError(result.error);
        return;
      }
      setAttachmentPath(null);
      onSaved();
    });
  }

  const attachmentUrl = calendarAttachmentUrl(attachmentPath);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-[0_10px_40px_rgba(0,0,0,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-[#f0f0f0] pb-3 mb-4">
          <h2 className="text-lg font-bold text-[#1e3a5f]">{event ? "Edit Event" : "New Event"}</h2>
          <button onClick={onClose} className="text-[#999] hover:text-[#333] text-xl leading-none">
            ×
          </button>
        </div>

        {error && <div className="mb-3 rounded-md bg-[#f8d7da] text-[#721c24] text-sm px-3 py-2">{error}</div>}

        <div className="space-y-3 text-sm">
          <div>
            <label className="block font-semibold mb-1">Type *</label>
            <select value={form.event_type} onChange={(e) => handleTypeChange(e.target.value as CalendarEventType)} className={inputClass}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Title *</label>
            <input required value={form.title} onChange={(e) => field("title", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block font-semibold mb-1">Description</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => field("description", e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => field("start_date", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">End Date *</label>
              <input
                type="date"
                required
                value={form.end_date}
                onChange={(e) => field("end_date", e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => field("all_day", e.target.checked)}
              className="accent-[#1e3a5f]"
            />
            All Day
          </label>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.start_time ?? ""}
                  onChange={(e) => field("start_time", e.target.value || null)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">End Time</label>
                <input
                  type="time"
                  value={form.end_time ?? ""}
                  onChange={(e) => field("end_time", e.target.value || null)}
                  className={inputClass}
                />
              </div>
            </div>
          )}
          <div>
            <label className="block font-semibold mb-1">Location</label>
            <input
              value={form.location ?? ""}
              onChange={(e) => field("location", e.target.value || null)}
              className={inputClass}
            />
          </div>

          {event && (
            <div>
              <label className="block font-semibold mb-1">Attachment</label>
              {attachmentUrl ? (
                <div className="flex items-center gap-2">
                  <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="text-[#1e3a5f] hover:underline truncate">
                    View attachment
                  </a>
                  <button type="button" onClick={handleRemoveAttachment} disabled={pending} className="text-xs font-semibold text-[#dc3545] hover:underline">
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pending}
                  className="rounded-md bg-[#f0f0f0] px-3 py-1.5 text-xs font-semibold text-[#333] hover:bg-[#e0e0e0]"
                >
                  Add Attachment
                </button>
              )}
              <input ref={fileInputRef} type="file" onChange={handleAttachmentChange} className="hidden" />
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2 justify-between items-center border-t border-[#f0f0f0] pt-4">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={pending}
              className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} className="rounded-md bg-[#f0f0f0] px-4 py-2 text-sm font-semibold text-[#333] hover:bg-[#e0e0e0]">
              Cancel
            </button>
          </div>
          {event && (
            <button
              onClick={handleDelete}
              disabled={pending}
              className="rounded-md bg-[#dc3545] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c82333] disabled:opacity-60"
            >
              Delete Event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
