"use server";

import { getMember, type MemberDetail } from "@/lib/members";

/** Fetches one member's full detail on demand, when a card is clicked --
 * avoids pulling every field for every member in the list view. */
export async function getMemberAction(memberId: string): Promise<MemberDetail | null> {
  return getMember(memberId);
}
