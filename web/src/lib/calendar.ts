import { createClient } from "@/lib/supabase/server";
import type { CalendarEvent } from "@/lib/calendar-types";

export type { CalendarEvent, CalendarEventType } from "@/lib/calendar-types";
export { EVENT_TYPE_COLORS, EVENT_TYPES } from "@/lib/calendar-types";

/** The Service Calendar is a single ministry-wide calendar (no group_id on
 * the table) -- reachable from the landing page's Servant Corner, not
 * scoped to any one cohort. */
export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("service_calendar_events").select("*").order("start_date");
  return (data ?? []) as CalendarEvent[];
}
