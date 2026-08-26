"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/** Toggles a member's Present/Absent status for one date -- no status
 * column, so "Present" is a row existing, "Absent" is deleting it. */
export async function setAttendanceAction(memberId: string, groupId: string, date: string, present: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (present) {
    const { error } = await supabase
      .from("attendance_records")
      .insert({ attendee_type: "member", member_id: memberId, service_date: date });
    if (error) return { error: error.message };
    if (user) await logAudit(user.id, "ATTENDANCE_ADDED", { groupId, details: { memberId, date } });
  } else {
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("member_id", memberId)
      .eq("service_date", date);
    if (error) return { error: error.message };
    if (user) await logAudit(user.id, "ATTENDANCE_REMOVED", { groupId, details: { memberId, date } });
  }

  revalidatePath(`/g/${groupId}/attendance`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}
