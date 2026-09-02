import { headers } from "next/headers";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";

/** The shared "Servants" QR has no group row (group_id is null) to hang a
 * color on, so it gets a fixed color -- matches the old app's actual
 * QR image ("Photos/QR Codes/25-26 Servants.png"), sampled directly. */
const SERVANTS_COLOR = "#9B2EBF";

/** Embeds the app logo in the center of a QR SVG (matches the old app's
 * look). Error-correction level "H" (~30% redundancy) is required so
 * covering the center ~20% of the code with a logo doesn't break
 * scannability. */
function embedLogo(svg: string, logoUrl: string): string {
  const viewBoxMatch = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  if (!viewBoxMatch) return svg;
  const vbWidth = parseFloat(viewBoxMatch[1]);
  const vbHeight = parseFloat(viewBoxMatch[2]);
  const cx = vbWidth / 2;
  const cy = vbHeight / 2;
  const logoSize = vbWidth * 0.22;
  const backdropRadius = vbWidth * 0.15;

  const safeHref = logoUrl.replace(/&/g, "&amp;");
  const overlay = `<defs><clipPath id="qrLogoClip"><circle cx="${cx}" cy="${cy}" r="${logoSize / 2}" /></clipPath></defs>` +
    `<circle cx="${cx}" cy="${cy}" r="${backdropRadius}" fill="#ffffff" />` +
    `<image href="${safeHref}" x="${cx - logoSize / 2}" y="${cy - logoSize / 2}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#qrLogoClip)" />`;

  return svg.replace("</svg>", `${overlay}</svg>`);
}

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
 * Ordered Year 0 -> Year 5+, then Servants -- every code, for every app
 * user (owner's explicit call, migration 0040). Reads through
 * get_qr_codes_with_groups() rather than a plain embedded-join select:
 * groups_select's position-0 branch stays Admin-only for every OTHER
 * screen, so a plain select's embedded `groups` join for the Yr0 row
 * would silently resolve to null for anyone else -- indistinguishable,
 * if you keyed off that, from the true Servants QR (qr_codes.group_id
 * itself IS null), which is exactly the bug this replaced ("SAY Servants"
 * shown twice, Yr0 nowhere). group_id/label live on qr_codes itself
 * (label already synced from the group's real name whenever it's set, or
 * "SAY Servants" for the true group-less row -- REQUIREMENTS.md §6.15),
 * so no override/fallback logic is needed here at all -- just read it.
 */
export async function getQrCodesForPrinting(): Promise<QrCodeForPrinting[]> {
  const supabase = await createClient();
  const [origin, settings] = await Promise.all([siteOrigin(), getAppSettings()]);

  const { data } = await supabase.rpc("get_qr_codes_with_groups");

  const rows = (data ?? []) as {
    id: string;
    label: string;
    check_in_token: string;
    printed_at: string | null;
    updated_at: string;
    group_id: string | null;
    ladder_position: number | null;
    qr_color: string | null;
  }[];

  const sorted = [...rows].sort((a, b) => {
    const rank = (r: (typeof rows)[number]) => (r.group_id === null ? 999 : (r.ladder_position ?? 999));
    return rank(a) - rank(b);
  });

  return Promise.all(
    sorted.map(async (r) => {
      const checkInUrl = `${origin}/checkin/${r.check_in_token}`;
      const rawSvg = await QRCode.toString(checkInUrl, {
        type: "svg",
        margin: 1,
        width: 220,
        errorCorrectionLevel: "H",
      });
      const svg = settings.logo_url ? embedLogo(rawSvg, settings.logo_url) : rawSvg;
      const needsReprint = !r.printed_at || new Date(r.updated_at) > new Date(r.printed_at);
      const color = r.qr_color ?? SERVANTS_COLOR;

      return { id: r.id, label: r.label, checkInUrl, svg, color, needsReprint };
    }),
  );
}
