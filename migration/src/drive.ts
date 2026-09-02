import { google } from "googleapis";
import { existsSync, readFileSync } from "node:fs";
import { config } from "./config.js";

if (!existsSync(config.googleServiceAccountKeyFile)) {
  console.error(
    `Google service account key file not found at ${config.googleServiceAccountKeyFile}\n` +
      "See migration/README.md \"Google service account\" for how to create one.",
  );
  process.exit(1);
}
const keyFile = JSON.parse(readFileSync(config.googleServiceAccountKeyFile, "utf-8"));

// Separate client/scope from sheets.ts's spreadsheets.readonly -- Drive
// access needs its own scope, and the service account needs the Photos
// folder actually shared with it (view access), which is a separate grant
// from the 9 spreadsheet files. See MIGRATION_PLAN.md's photo-migration
// section for how this was confirmed against the real folder.
const auth = new google.auth.GoogleAuth({
  credentials: keyFile,
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const driveApi = google.drive({ version: "v3", auth });

export type DriveFile = { id: string; name: string; mimeType: string };

/** Lists the direct (non-recursive) children of a Drive folder. The real
 * Photos folders are flat (confirmed by direct inspection -- no
 * sub-subfolders), and under 250 files total across all of them, so a
 * single page (up to 1000) is always enough -- no pagination needed. */
export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const res = await driveApi.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    pageSize: 1000,
  });
  return (res.data.files ?? []) as DriveFile[];
}

/** Downloads a Drive file's raw bytes (the photo image itself). */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const res = await driveApi.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(res.data as ArrayBuffer);
}
