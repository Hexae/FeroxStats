import { NextResponse } from 'next/server';
import { GAME_MODES, type GameModeKey } from '@/lib/osrs';

// ── In-memory rate limiter (per-instance, resets on redeploy) ─────────────────
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): NextResponse | null {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  entry.count++;
  if (entry.count > limit) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  return null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_GAME_MODE_KEYS = new Set<string>(GAME_MODES.map((m) => m.key));

export function isValidGameMode(key: string): key is GameModeKey {
  return VALID_GAME_MODE_KEYS.has(key);
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// Standard skill name list (lowercase, matches SKILLS from osrs.ts)
export const SKILL_NAMES = [
  'overall','attack','defence','strength','hitpoints','ranged',
  'prayer','magic','cooking','woodcutting','fletching','fishing','firemaking',
  'crafting','smithing','mining','herblore','agility','thieving','slayer',
  'farming','runecraft','hunter','construction',
] as const;

export function isValidSkill(skill: string): boolean {
  return (SKILL_NAMES as readonly string[]).includes(skill.toLowerCase());
}
