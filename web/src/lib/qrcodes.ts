import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";

/** The shared "Servants" QR has no group row (group_id is null) to hang a
 * color on, so it gets a fixed color -- matches the old app's actual
 * QR image ("Photos/QR Codes/25-26 Servants.png"), sampled directly. */
const SERVANTS_COLOR = "#9B2EBF";

export type QrCodeForPrinting = {
  id: string;
  label: string;
  checkInUrl: string;
  svg: string;
  color: string;
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
 *
 * Ordered Year 1 -> Year 5+, then Servants (position 0's pre-entry QR is
 * excluded entirely unless the caller is Admin/General Coordinator -- it's
 * only needed once a year, for the July/August welcoming party, and
 * showing it to everyone would be confusing for a code nobody else should
 * be handing out).
 */
export async function getQrCodesForPrinting(includePreEntry: boolean): Promise<QrCodeForPrinting[]> {
  const supabase = await createClient();
  const origin = await siteOrigin();

  const { data } = await supabase
    .from("qr_codes")
    .select("id, label, check_in_token, printed_at, updated_at, group:groups(ladder_position, qr_color)");

  const rows = (data ?? []) as unknown as {
    id: string;
    label: string;
    check_in_token: string;
    printed_at: string | null;
    updated_at: string;
    group: { ladder_position: number; qr_color: string | null } | null;
  }[];

  const filtered = rows.filter((r) => includePreEntry || r.group?.ladder_position !== 0);

  const sorted = filtered.sort((a, b) => {
    const rank = (r: (typeof rows)[number]) => (r.group === null ? 999 : r.group.ladder_position);
    return rank(a) - rank(b);
  });

  return Promise.all(
    sorted.map(async (r) => {
      const checkInUrl = `${origin}/checkin/${r.check_in_token}`;
      const svg = await QRCode.toString(checkInUrl, { type: "svg", margin: 1, width: 220 });
      const needsReprint = !r.printed_at || new Date(r.updated_at) > new Date(r.printed_at);
      const color = r.group?.qr_color ?? SERVANTS_COLOR;
      return { id: r.id, label: r.label, checkInUrl, svg, color, needsReprint };
    }),
  );
}
