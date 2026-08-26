"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Uses Postgres's own now() (via a small RPC) for printed_at, so it lines
 * up exactly with the same transaction timestamp the updated_at trigger
 * uses -- see 0018_mark_qr_code_printed.sql for why a plain JS-computed
 * timestamp would never actually clear "needs reprint". */
export async function markPrintedAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_qr_code_printed", { p_id: id });
  if (error) return { error: error.message };

  revalidatePath("/qr-codes");
  return { error: null };
}
