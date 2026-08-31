"use client";

import { useState, useTransition } from "react";
import type { CalendarEvent } from "@/lib/calendar-types";
import { getCalendarBootstrapAction, getCalendarEventsAction } from "@/app/calendar/actions";
import { ServiceCalendarModal } from "./ServiceCalendarModal";

/** Landing page trigger for the Service Calendar (§6.8) -- fetches on
 * first open rather than on every landing-page load, since the calendar
 * is ministry-wide, not scoped to whichever group happens to be loaded. */
export function ServiceCalendarButton() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [serviceWeekday, setServiceWeekday] = useState(5);
  const [serviceWeekdayLabel, setServiceWeekdayLabel] = useState("Fridays");
  const [branding, setBranding] = useState({ logoUrl: null as string | null, appTitleShort: "", appVersion: "" });
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      const result = await getCalendarBootstrapAction();
      setEvents(result.events);
      setServiceWeekday(result.serviceWeekday);
      setServiceWeekdayLabel(result.serviceWeekdayLabel);
      setBranding({ logoUrl: result.logoUrl, appTitleShort: result.appTitleShort, appVersion: result.appVersion });
      setOpen(true);
    });
  }

  function handleRefresh() {
    startTransition(async () => {
      setEvents(await getCalendarEventsAction());
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={pending}
        className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60 shadow-[0_2px_4px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_8px_rgba(0,0,0,0.2)] active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.15)]"
      >
        {pending && !open ? "Loading…" : "Service Calendar"}
      </button>
      {open && (
        <ServiceCalendarModal
          events={events}
          serviceWeekday={serviceWeekday}
          serviceWeekdayLabel={serviceWeekdayLabel}
          logoUrl={branding.logoUrl}
          appTitleShort={branding.appTitleShort}
          appVersion={branding.appVersion}
          onClose={() => setOpen(false)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
}
