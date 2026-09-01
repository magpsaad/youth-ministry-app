/** REQUIREMENTS.md §6.11 item 6 / §10.1 -- every phone number gets
 * reformatted to "1 (416) 930-1659" regardless of source format. */
export function normalizePhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw.trim() || null; // can't confidently reformat -- keep as-is, don't drop data
  return `1 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

/** Source uses M/F, Male/Female, and mixed case across different sheets --
 * see MIGRATION_PLAN.md §5. */
export function normalizeGender(raw: string | undefined | null): "Male" | "Female" | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "m" || v === "male") return "Male";
  if (v === "f" || v === "female") return "Female";
  return null;
}

/** MIGRATION_PLAN.md §3.6 -- confirmed blank -> false, any "Yes" value -> true. */
export function isTruthyYes(raw: string | undefined | null): boolean {
  return (raw ?? "").trim().toLowerCase() === "yes";
}

/** MIGRATION_PLAN.md §3.7 -- "Whattsapp" is a real source typo. */
export function normalizeOutreachType(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (v.toLowerCase() === "whattsapp") return "WhatsApp";
  return v;
}

const CALENDAR_EVENT_TYPES = new Set(["Trip", "Outing", "Group Discussion", "Speaker Session", "Event", "Holiday"]);
export function isKnownCalendarEventType(raw: string): boolean {
  return CALENDAR_EVENT_TYPES.has(raw.trim());
}

/** Old audit_action_type -> new audit_action_type, MIGRATION_PLAN.md §3.10.
 * The original 14-entry map came from the Admin sheet's "Action Types"
 * registry tab -- turned out to only reflect the CURRENT/latest togglable
 * set, not every string that actually appears in real historical Audit Log
 * rows. A real dry run surfaced 6 more (ATTENDANCE_ADDED, OUTREACH_UPDATED,
 * OUTREACH_DELETED, CALENDAR_EVENT_CREATED/UPDATED/DELETED) that the old app
 * was already logging under the exact same names the new app uses, so
 * they're identity-mapped below rather than needing a rename. Old values
 * with no mapping here have no historical equivalent and are flagged as
 * unmatched rather than dropped silently. */
export const AUDIT_ACTION_TYPE_MAP: Record<string, string> = {
  APP_ACCESS: "APP_ACCESS",
  YEAR_SELECTED: "GROUP_SELECTED",
  YOUTH_EDITED: "MEMBER_EDITED",
  SERVANT_ASSIGNED: "SERVANT_ASSIGNED",
  OUTREACH_ADDED: "OUTREACH_ADDED",
  YOUTH_PHOTO_UPLOADED: "MEMBER_PHOTO_UPLOADED",
  SERVANT_PROFILES_VIEWED: "SERVANT_PROFILES_VIEWED",
  SERVANT_ATTENDANCE_VIEWED: "SERVANT_ATTENDANCE_VIEWED",
  SERVANT_EDITED: "SERVANT_EDITED",
  SERVANT_YEAR_UPDATED: "SERVANT_GROUP_UPDATED",
  SERVANT_PHOTO_UPLOADED: "SERVANT_PHOTO_UPLOADED",
  SERVANT_DELETED: "SERVANT_DELETED",
  ADMIN_ACCESS_MAINTENANCE: "ADMIN_ACCESS_MAINTENANCE",
  ADMIN_UNIVERSITIES_MAINTENANCE: "ADMIN_UNIVERSITIES_MAINTENANCE",
  // Confirmed present in real historical data, already using the new
  // app's exact names:
  ATTENDANCE_ADDED: "ATTENDANCE_ADDED",
  ATTENDANCE_REMOVED: "ATTENDANCE_REMOVED", // not confirmed in real data, added defensively -- harmless if unused
  OUTREACH_UPDATED: "OUTREACH_UPDATED",
  OUTREACH_DELETED: "OUTREACH_DELETED",
  CALENDAR_EVENT_CREATED: "CALENDAR_EVENT_CREATED",
  CALENDAR_EVENT_UPDATED: "CALENDAR_EVENT_UPDATED",
  CALENDAR_EVENT_DELETED: "CALENDAR_EVENT_DELETED",
};

/** MIGRATION_PLAN.md §3.5 -- the 3 named General Coordinators, by email
 * (lowercased for comparison), regardless of what the sheet's Role column or
 * Access Year columns say for them. */
export const GENERAL_COORDINATOR_EMAILS = new Set([
  "mina.awad@gmail.com", // Fr Karas Awad
  "frsamuel@cccnet.ca", // Fr Samuel Zaki
  "jwahba@live.com", // John Wahba
]);

export function serviceDateFromTimestamp(timestamp: string): string | null {
  // FORMATTED_STRING date-time render reflects whatever number format is
  // applied to that specific cell/column -- different tabs use different
  // formats. Confirmed against a real dry run: most are US "M/D/YYYY ..."
  // but some (a whole tab's worth) are "YYYY-MM-DD ..." instead. Try both
  // rather than assuming one.
  const v = timestamp.trim();

  const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, mo, d] = iso;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    const [, mo, d, y] = us;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  return null;
}
