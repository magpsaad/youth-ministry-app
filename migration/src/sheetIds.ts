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

// Photo Drive folders -- one per cohort ladder position, plus servants.
// Found by listing the real "Photos" Drive folder the owner shared with the
// service account. Yr0 has no folder at all (that cohort has no photos yet)
// -- deliberately absent from this list, not an oversight.
export const PHOTO_FOLDERS: { ladderPosition: number; folderId: string }[] = [
  { ladderPosition: 1, folderId: "1PYfz-DikavoQYIhoSE5VyGdrAqNbSSu-" }, // Yr1 Youth Photos
  { ladderPosition: 2, folderId: "1DRwyASuCe3HGT_QrJBXC0fpeQ0J8pw74" }, // Yr2 Youth Photos
  { ladderPosition: 3, folderId: "1ykstXO31mP3upz6sgJVYTtRSZVkKCbyE" }, // Yr3 Youth Photos
  { ladderPosition: 4, folderId: "1qowujc_ZgFPiGdRooOn19YY1BKir4aPn" }, // Yr4 Youth Photos
  { ladderPosition: 5, folderId: "1e5OLLdmRA1-zTaIRDT3kkr90zO3iQ7jK" }, // Yr5 Youth Photos
];
export const SERVANTS_PHOTOS_FOLDER_ID = "1_xSruI_bVZc6ZVPU1AG21OVPqZTeqReN"; // Servants Photos

// Tab names -- all confirmed for real via the Sheets API's own
// spreadsheets.get metadata call (fields: sheets.properties.title), once
// real service-account credentials existed to do that with. Several of
// these differ from the earlier natural-language-inspection guesses (that
// inspection couldn't surface real tab names at all -- see MIGRATION_PLAN.md
// §2's tool-limitation note): "Roster" was actually "Master List",
// "Check-in responses" was actually "Attendance Responses", "Calendar" was
// actually "Service Calendar". "Outreach", "Permissions", "Universities",
// "Verses", and "Audit Log" were already correct.
export const TABS = {
  roster: "Master List",
  outreach: "Outreach",
  checkins: "Attendance Responses",
  servantsRoster: "Master List",
  servantsCheckins: "Attendance Responses",
  permissions: "Permissions",
  universities: "Universities",
  verses: "Verses",
  calendar: "Service Calendar",
  auditLog: "Audit Log",
} as const;
