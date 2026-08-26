"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/** Toggles a servant's Present/Absent status for one date -- same
 * presence-row model as member attendance (§6.5): "Present" is a row
 * existing, "Absent" is deleting it. */
export async function setServantAttendanceAction(servantId: string, date: string, present: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (present) {
    const { error } = await supabase
      .from("attendance_records")
      .insert({ attendee_type: "servant", servant_id: servantId, service_date: date });
    if (error) return { error: error.message };
    await logAudit(user.id, "ATTENDANCE_ADDED", { details: { servantId, date } });
  } else {
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("servant_id", servantId)
      .eq("service_date", date);
    if (error) return { error: error.message };
    await logAudit(user.id, "ATTENDANCE_REMOVED", { details: { servantId, date } });
  }

  revalidatePath("/servants-attendance");
  return { error: null };
}
