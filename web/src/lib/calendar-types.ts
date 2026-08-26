export type CalendarEventType = "Trip" | "Outing" | "Group Discussion" | "Speaker Session" | "Event" | "Holiday";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  event_type: CalendarEventType;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  attachment_url: string | null;
  created_by: string;
};

/** REQUIREMENTS.md §6.8 -- exact colors pulled from the current app's own
 * source (JavaScript.html's CALENDAR_EVENT_TYPES), not guessed. */
export const EVENT_TYPE_COLORS: Record<CalendarEventType, { color: string; bg: string }> = {
  Trip: { color: "#FF6B6B", bg: "#FFE5E5" },
  Outing: { color: "#36F1CD", bg: "#E0F7F5" },
  "Group Discussion": { color: "#020887", bg: "#D6E3F0" },
  "Speaker Session": { color: "#39A0ED", bg: "#E0F2F8" },
  Event: { color: "#9C27B0", bg: "#F3E5F5" },
  Holiday: { color: "#98D8C8", bg: "#E8F8F5" },
};

export const EVENT_TYPES: CalendarEventType[] = [
  "Trip",
  "Outing",
  "Group Discussion",
  "Speaker Session",
  "Event",
  "Holiday",
];
