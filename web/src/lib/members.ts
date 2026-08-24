import { createClient } from "@/lib/supabase/server";

export type MemberListItem = {
  id: string;
  full_name: string;
  phone: string | null;
  photo_path: string | null;
  program_of_study: string | null;
  is_visitor: boolean;
  gender: string | null;
  date_of_birth: string | null;
  assigned_servant_id: string | null;
  university: { id: string; name: string; proximity: string } | null;
  assigned_servant: { full_name: string } | null;
};

export type MemberDetail = MemberListItem & {
  email: string | null;
  university_id: string | null;
  date_of_birth: string | null;
  father_of_confession: string | null;
  home_address: string | null;
  registration_comments: string | null;
  servant_comments: string | null;
};

export type MemberFilters = {
  q?: string;
  servantIds?: string[]; // may include the literal "unassigned"
  universityIds?: string[];
  excludeVisitors?: boolean;
  hasPhoto?: boolean;
  male?: boolean;
  female?: boolean;
  proximities?: string[]; // Local | Regional | Abroad | Unknown
};

const LIST_SELECT =
  "id, full_name, phone, photo_path, program_of_study, is_visitor, gender, date_of_birth, assigned_servant_id, university:universities(id, name, proximity), assigned_servant:profiles(full_name)";

/**
 * All active members of a group, matching client-side (REQUIREMENTS.md
 * §6.4's filter panel). Fetching the whole group and filtering in JS is
 * simpler and plenty fast at this app's scale (dozens of members per group,
 * not thousands) than building the equivalent as a dynamic Postgrest query.
 */
export async function getGroupMembers(
  groupId: string,
  filters: MemberFilters = {},
): Promise<MemberListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select(LIST_SELECT)
    .eq("group_id", groupId)
    .eq("status", "active")
    .order("full_name");

  let members = (data ?? []) as unknown as MemberListItem[];

  if (filters.q) {
    const q = filters.q.toLowerCase();
    members = members.filter((m) => m.full_name.toLowerCase().includes(q));
  }
  if (filters.excludeVisitors) {
    members = members.filter((m) => !m.is_visitor);
  }
  if (filters.hasPhoto) {
    members = members.filter((m) => !!m.photo_path);
  }
  if (filters.male || filters.female) {
    members = members.filter(
      (m) => (filters.male && m.gender === "Male") || (filters.female && m.gender === "Female"),
    );
  }
  if (filters.universityIds?.length) {
    members = members.filter((m) => m.university && filters.universityIds!.includes(m.university.id));
  }
  if (filters.proximities?.length) {
    members = members.filter((m) => {
      const proximity = m.university?.proximity ?? "Unknown";
      return filters.proximities!.includes(proximity);
    });
  }
  if (filters.servantIds?.length) {
    members = members.filter((m) => {
      if (filters.servantIds!.includes("unassigned") && !m.assigned_servant_id) return true;
      return m.assigned_servant_id && filters.servantIds!.includes(m.assigned_servant_id);
    });
  }

  return members;
}

export async function getMember(memberId: string): Promise<MemberDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select(
      `${LIST_SELECT}, email, university_id, father_of_confession, home_address, registration_comments, servant_comments`,
    )
    .eq("id", memberId)
    .maybeSingle();

  return data as unknown as MemberDetail | null;
}
