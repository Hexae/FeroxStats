export const REAUTH_WINDOW_MINUTES = 15;
export const UNCLAIM_COOLDOWN_HOURS = 12;

export function isRecentReauth(lastReauthAt: string | null | undefined): boolean {
  if (!lastReauthAt) return false;
  const ts = new Date(lastReauthAt).getTime();
  if (!Number.isFinite(ts)) return false;
  const windowMs = REAUTH_WINDOW_MINUTES * 60 * 1000;
  return Date.now() - ts <= windowMs;
}

export function reauthValidUntil(lastReauthAt: string | null | undefined): string | null {
  if (!lastReauthAt) return null;
  const ts = new Date(lastReauthAt).getTime();
  if (!Number.isFinite(ts)) return null;
  return new Date(ts + REAUTH_WINDOW_MINUTES * 60 * 1000).toISOString();
}

export function claimCooldownEndsAt(lastUnclaimAt: string | null | undefined): string | null {
  if (!lastUnclaimAt) return null;
  const ts = new Date(lastUnclaimAt).getTime();
  if (!Number.isFinite(ts)) return null;
  return new Date(ts + UNCLAIM_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
}

export function getClaimCooldownRemainingMs(lastUnclaimAt: string | null | undefined): number {
  const endsAt = claimCooldownEndsAt(lastUnclaimAt);
  if (!endsAt) return 0;
  const remaining = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, remaining);
}
