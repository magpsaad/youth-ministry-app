import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

export type QrCodeForPrinting = {
  id: string;
  label: string;
  checkInUrl: string;
  svg: string;
  needsReprint: boolean;
};

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host");
  return `${proto}://${host}`;
}

/**
 * REQUIREMENTS.md §6.15 -- generates real, scannable QR codes on the fly
 * (the `qrcode` package, no external service/cost) pointing at each
 * group's (or the shared Servants QR's) check-in URL. Reprint tracking:
 * `needsReprint` is true whenever the row has never been marked printed,
 * or has changed (its label, from a future Group Transition rename) since
 * it last was.
 */
export async function getQrCodesForPrinting(): Promise<QrCodeForPrinting[]> {
  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data } = await supabase
    .from("qr_codes")
    .select("id, label, check_in_token, printed_at, updated_at, group:groups(ladder_position)")
    .order("label");

  const rows = (data ?? []) as unknown as {
    id: string;
    label: string;
    check_in_token: string;
    printed_at: string | null;
    updated_at: string;
    group: { ladder_position: number } | null;
  }[];

  return Promise.all(
    rows.map(async (r) => {
      const checkInUrl = `${origin}/checkin/${r.check_in_token}`;
      const svg = await QRCode.toString(checkInUrl, { type: "svg", margin: 1, width: 220 });
      const needsReprint = !r.printed_at || new Date(r.updated_at) > new Date(r.printed_at);
      return { id: r.id, label: r.label, checkInUrl, svg, needsReprint };
    }),
  );
}
