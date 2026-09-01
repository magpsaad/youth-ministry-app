// Real spreadsheet IDs, found by inspecting the owner's Drive directly (not
// guessed). See MIGRATION_PLAN.md §2 for how each was identified. If a sheet
// gets renamed or recreated, update its ID here -- the tool doesn't search
// Drive by name at run time, it reads these exact IDs.

export const COHORT_FILES: { ladderPosition: number; fileId: string; label: string }[] = [
  { ladderPosition: 0, fileId: "1KwSE5_NhpUDsM8IyrciYMEsPKlG_Bn-JR5RS3SvF7vk", label: "25-26 SAY Yr0 Ministry" },
  { ladderPosition: 1, fileId: "1MrFASYu0fT2DgGcPNWnKVvA37euTyIhmBmFsEvxLbWs", label: "25-26 SAY Yr1 Ministry" },
  { ladderPosition: 2, fileId: "1mkjywky_E8VlTfBxJU_OC_MFNaj42s3zlsaGl_9VVtI", label: "25-26 SAY Yr2 Ministry" },
  { ladderPosition: 3, fileId: "1QkgnEOIes9yPyMTn7iG2VjOQU0pDP2aQ5uzSg7-vcc4", label: "25-26 SAY Yr3 Ministry" },
  { ladderPosition: 4, fileId: "1yh5H4Zw3Zp2c92jNimLG3VeX7DrFc1v3EZbgu-M_HSo", label: "25-26 SAY Yr4 Ministry" },
  { ladderPosition: 5, fileId: "1uWkXwXRpNqE-o67LIYlMpAbcHF-Bf04vPiMkA-zBa9M", label: "25-26 SAY Yr5+ Ministry" },
];

export const SERVANTS_FILE_ID = "1CYy9iyMP6mTiU2jELImFNIsiPituAB7JaPLcrlJk6Jk"; // 25-26 SAY Servants Ministry
export const ADMIN_FILE_ID = "1lOu6FsIwrqmQpXOoSmJsELqhhYWkaMJTtC3X7oZUJsk"; // SAY Ministry Admin
export const CALENDAR_FILE_ID = "1iyKChvoW0Mgc8vhKI1uUTWsjnKJiK7cJFjseqUI1rH8"; // SAY Ministry Audit - Calendar

// Tab names. The ADMIN_FILE_ID names below are confirmed via a direct xlsx
// export (real sheet names, not guessed). The cohort/servants/calendar file
// tab names are the subagent's best read of natural-language content
// inspection, NOT independently confirmed the same way -- read_file_content
// doesn't surface real tab names (see MIGRATION_PLAN.md §2, tool limitation
// note). If a step below throws "Unable to parse range" or similar from the
// Sheets API, open that file's tab bar and fix the name here first.
export const TABS = {
  roster: "Roster",
  outreach: "Outreach",
  checkins: "Check-in responses",
  servantsRoster: "Roster",
  servantsCheckins: "Check-in responses",
  permissions: "Permissions",
  universities: "Universities",
  verses: "Verses",
  calendar: "Calendar",
  auditLog: "Audit Log",
} as const;
