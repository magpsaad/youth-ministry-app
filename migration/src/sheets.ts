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

const auth = new google.auth.GoogleAuth({
  credentials: keyFile,
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheetsApi = google.sheets({ version: "v4", auth });

/** Returns rows as arrays of cell values, header row included at index 0.
 * Empty trailing rows/columns are trimmed by the Sheets API automatically. */
export async function readTab(spreadsheetId: string, tabName: string): Promise<string[][]> {
  const res = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!A:Z`,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  return (res.data.values as string[][]) ?? [];
}

/** Reads a tab and returns it as an array of objects keyed by header row. */
export async function readTabAsRows(spreadsheetId: string, tabName: string): Promise<Record<string, string>[]> {
  const rows = await readTab(spreadsheetId, tabName);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body
    .filter((r) => r.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h] = r[i] !== undefined && r[i] !== null ? String(r[i]) : "";
      });
      return obj;
    });
}
