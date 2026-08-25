const PHOTOS_BUCKET = `${process.env.NEXT_PUBLIC_APP_ENV}-photos`;

/** Public URL for a stored photo path -- predictable for public buckets, no
 * API round-trip needed. Works in both server and client code since
 * NEXT_PUBLIC_* vars are inlined at build time either way. */
export function memberPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;
}

export function photosBucket(): string {
  return PHOTOS_BUCKET;
}
