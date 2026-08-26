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
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    startTransition(async () => {
      const result = await getCalendarBootstrapAction();
      setEvents(result.events);
      setServiceWeekday(result.serviceWeekday);
      setServiceWeekdayLabel(result.serviceWeekdayLabel);
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
        className="rounded-md bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#152a45] disabled:opacity-60"
      >
        {pending && !open ? "Loading…" : "Service Calendar"}
      </button>
      {open && (
        <ServiceCalendarModal
          events={events}
          serviceWeekday={serviceWeekday}
          serviceWeekdayLabel={serviceWeekdayLabel}
          onClose={() => setOpen(false)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  );
}
