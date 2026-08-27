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
 * Ordered Year 1 -> Year 5+, then Servants (position 0's pre-entry QR is
 * excluded entirely unless the caller is Admin/General Coordinator -- it's
 * only needed once a year, for the July/August welcoming party, and
 * showing it to everyone would be confusing for a code nobody else should
 * be handing out).
 */
export async function getQrCodesForPrinting(includePreEntry: boolean): Promise<QrCodeForPrinting[]> {
  const supabase = await createClient();
  const [origin, settings] = await Promise.all([siteOrigin(), getAppSettings()]);

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
      const rawSvg = await QRCode.toString(checkInUrl, {
        type: "svg",
        margin: 1,
        width: 220,
        errorCorrectionLevel: "H",
      });
      const svg = settings.logo_url ? embedLogo(rawSvg, settings.logo_url) : rawSvg;
      const needsReprint = !r.printed_at || new Date(r.updated_at) > new Date(r.printed_at);
      const color = r.group?.qr_color ?? SERVANTS_COLOR;

      // The terminal (5+) group is now a single, permanent merged bucket
      // (REQUIREMENTS.md §2.2/§5, revised during Phase G) -- its name is a
      // fixed, admin-set value like any other group's, not regenerated
      // from a shifting cohort_year, so its stored label is used as-is.
      // Only the shared Servants QR (no group row) still needs an override.
      const label = r.group ? r.label : "SAY Servants";

      return { id: r.id, label, checkInUrl, svg, color, needsReprint };
    }),
  );
}
