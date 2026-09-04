/** Owner-requested: lets a servant search for their own name once, then be
 * pre-highlighted on future visits to the Servants check-in QR from the
 * same device/browser -- opt-out via a "Remember me on this device"
 * checkbox (default checked) rather than an upfront consent prompt, per
 * the owner's explicit design (matches the existing "Not you? Undo"
 * philosophy: no extra friction on the common case). Only ever stores an
 * opaque profile/pending-servant id -- never a name -- and only applies to
 * the Servants flow, not member self-check-in. */
export const SERVANT_CHECKIN_COOKIE = "say_servant_checkin";
export const SERVANT_CHECKIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type RememberedServant = { id: string; kind: "servant" | "pending" };

export function parseRememberedServant(raw: string | null | undefined): RememberedServant | null {
  if (!raw) return null;
  const [id, kind] = raw.split(":");
  if (!id || (kind !== "servant" && kind !== "pending")) return null;
  return { id, kind };
}

export function serializeRememberedServant(person: RememberedServant): string {
  return `${person.id}:${person.kind}`;
}
