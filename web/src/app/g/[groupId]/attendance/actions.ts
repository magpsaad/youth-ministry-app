"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAttendanceForDate, type AttendanceMember } from "@/lib/attendance";

/** Toggles a member's Present/Absent status for one date -- no status
 * column, so "Present" is a row existing, "Absent" is deleting it. */
export async function setAttendanceAction(memberId: string, groupId: string, date: string, present: boolean) {
  const supabase = await createClient();

  if (present) {
    const { error } = await supabase
      .from("attendance_records")
      .insert({ attendee_type: "member", member_id: memberId, service_date: date });
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("member_id", memberId)
      .eq("service_date", date);
    if (error) return { error: error.message };
  }

  revalidatePath(`/g/${groupId}/attendance`);
  revalidatePath(`/g/${groupId}/dashboard`);
  return { error: null };
}

/** Re-fetches the table when the date picker changes. */
export async function getAttendanceForDateAction(groupId: string, date: string): Promise<AttendanceMember[]> {
  return getAttendanceForDate(groupId, date);
}
