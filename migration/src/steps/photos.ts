import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { listFilesInFolder, downloadFile } from "../drive.js";
import { COHORT_FILES, PHOTO_FOLDERS, SERVANTS_PHOTOS_FOLDER_ID } from "../sheetIds.js";
import { resolveByName, resolveServantByName, type ServantLookup } from "../lookups.js";
import { count, flagUnmatched } from "../report.js";

// One constant per run (not per file) -- just needs to be unique per run,
// matching the live app's own `{id}-{timestamp}.{ext}` naming convention
// (web/src/lib/storage.ts / actions.ts) closely enough that a human
// browsing the bucket sees the same shape of path either way.
const RUN_TS = Date.now();

function extOf(filename: string): string {
  return filename.match(/\.[^.]+$/)?.[0] ?? ".png";
}
function baseNameOf(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim();
}

/** MIGRATION_PLAN.md photo-migration addendum -- Picture columns in the
 * roster sheets are empty (confirmed by direct inspection); real photos
 * live in a separate Drive "Photos" folder tree the owner shared with the
 * service account, one subfolder per cohort plus one for servants, files
 * named after the person's exact full name. Matched against the same
 * collision-aware name lookups members.ts/servants.ts already built --
 * real data currently has zero unmatched/ambiguous photo filenames, but the
 * safety net (resolveByName) stays regardless. */
export async function migratePhotos(memberIdsByFile: Map<string, Map<string, string[]>>, servants: ServantLookup): Promise<void> {
  const bucket = `${config.schema}-photos`;
  let memberTotal = 0;
  let servantTotal = 0;

  for (const file of COHORT_FILES) {
    const folder = PHOTO_FOLDERS.find((p) => p.ladderPosition === file.ladderPosition);
    if (!folder) continue; // Yr0 has no photos folder -- nothing to do

    const memberIds = memberIdsByFile.get(file.fileId)!;
    const photos = await listFilesInFolder(folder.folderId);
    console.log(`${file.label} Photos: ${photos.length} files found.`);

    for (const photo of photos) {
      const resolved = resolveByName(memberIds, baseNameOf(photo.name), "member");
      if (!resolved.id) {
        flagUnmatched("members", `${photo.name} (${file.label} photo)`, resolved.reason ?? "photo filename didn't match a member");
        continue;
      }
      if (config.dryRun) {
        memberTotal++;
        continue;
      }

      const bytes = await downloadFile(photo.id);
      const path = `${resolved.id}-${RUN_TS}${extOf(photo.name)}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: photo.mimeType, upsert: true });
      if (upErr) throw new Error(`Failed to upload photo "${photo.name}": ${upErr.message}`);

      const { error: updErr } = await supabase.from("members").update({ photo_path: path }).eq("id", resolved.id);
      if (updErr) throw new Error(`Failed to set photo_path for "${photo.name}": ${updErr.message}`);
      memberTotal++;
    }
  }

  const servantPhotos = await listFilesInFolder(SERVANTS_PHOTOS_FOLDER_ID);
  console.log(`Servants Photos: ${servantPhotos.length} files found.`);

  for (const photo of servantPhotos) {
    const resolved = resolveServantByName(servants, baseNameOf(photo.name));
    if (!resolved.id) {
      flagUnmatched("profiles", `${photo.name} (Servants photo)`, resolved.reason ?? "photo filename didn't match a servant");
      continue;
    }
    if (config.dryRun) {
      servantTotal++;
      continue;
    }

    const bytes = await downloadFile(photo.id);
    const path = `servant-${resolved.id}-${RUN_TS}${extOf(photo.name)}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: photo.mimeType, upsert: true });
    if (upErr) throw new Error(`Failed to upload photo "${photo.name}": ${upErr.message}`);

    const { error: updErr } = await supabase.from("profiles").update({ photo_path: path }).eq("id", resolved.id);
    if (updErr) throw new Error(`Failed to set photo_path for "${photo.name}": ${updErr.message}`);
    servantTotal++;
  }

  count("member_photos", memberTotal);
  count("servant_photos", servantTotal);
}
