"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeHolidaysForYear } from "@/lib/holidays";

/** Bulk-preloads the computed holiday set for a year, skipping any that
 * already exist (matched by title + date) so re-running is safe. */
export async function preloadHolidaysAction(year: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in", inserted: 0, skipped: 0 };

  const holidays = computeHolidaysForYear(year);

  const { data: existing } = await supabase
    .from("service_calendar_events")
    .select("title, start_date")
    .eq("event_type", "Holiday")
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);

  const existingKeys = new Set((existing ?? []).map((e) => `${e.title}|${e.start_date}`));
  const toInsert = holidays.filter((h) => !existingKeys.has(`${h.title}|${h.date}`));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("service_calendar_events").insert(
      toInsert.map((h) => ({
        title: h.title,
        event_type: "Holiday" as const,
        start_date: h.date,
        end_date: h.date,
        all_day: true,
        created_by: user.id,
      })),
    );
    if (error) return { error: error.message, inserted: 0, skipped: 0 };
  }

  revalidatePath("/");
  return { error: null, inserted: toInsert.length, skipped: holidays.length - toInsert.length };
}
