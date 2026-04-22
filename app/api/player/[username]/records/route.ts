import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';

// Period windows in milliseconds
const PERIODS = {
  fiveMin: 5 * 60 * 1000,
  day:     24 * 60 * 60 * 1000,
  week:    7  * 24 * 60 * 60 * 1000,
  month:   30 * 24 * 60 * 60 * 1000,
  year:    365 * 24 * 60 * 60 * 1000,
} as const;

export type PeriodKey = keyof typeof PERIODS;

export interface SkillRecord {
  xp: number;
  date: string; // ISO string of the end snapshot
}

export interface RecordsResponse {
  records: Record<string, Record<PeriodKey, SkillRecord | null>>;
}

type SnapSkill = { id: number; xp: string };
type Snap = { created_at: string; skills: SnapSkill[] };

/**
 * For a sorted array of snapshots and a period window, uses a two-pointer
 * sliding window to find the maximum XP gained per skill within that window.
 */
function computePeriodRecords(
  snaps: Snap[],
  windowMs: number,
): Map<number, SkillRecord> {
  const best = new Map<number, SkillRecord>();
  let lo = 0;

  for (let hi = 1; hi < snaps.length; hi++) {
    const hiTime = new Date(snaps[hi].created_at).getTime();

    // Advance lo so the window [lo, hi] fits within windowMs
    while (lo < hi) {
      const loTime = new Date(snaps[lo].created_at).getTime();
      if (hiTime - loTime <= windowMs) break;
      lo++;
    }

    const loTime = new Date(snaps[lo].created_at).getTime();
    if (hiTime - loTime > windowMs) continue;

    // Build fast lookup for lo snapshot
    const loMap = new Map<number, number>();
    for (const s of snaps[lo].skills) {
      const n = parseInt(s.xp);
      if (!isNaN(n)) loMap.set(s.id, n);
    }

    // Compute gains for hi vs lo
    for (const s of snaps[hi].skills) {
      const hiXp = parseInt(s.xp);
      if (isNaN(hiXp)) continue;
      const loXp = loMap.get(s.id) ?? 0;
      const gained = hiXp - loXp;
      if (gained <= 0) continue;

      const prev = best.get(s.id);
      if (!prev || gained > prev.xp) {
        best.set(s.id, { xp: gained, date: snaps[hi].created_at });
      }
    }
  }

  return best;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).toLowerCase();
  const db = serviceClient();

  const { data: rows } = await db
    .from('player_snapshots')
    .select('created_at, snapshot_data')
    .eq('player_username', decoded)
    .order('created_at', { ascending: true });

  if (!rows || rows.length < 2) {
    return NextResponse.json({ records: {} });
  }

  const snaps: Snap[] = rows
    .map((r) => ({
      created_at: r.created_at ?? '',
      skills: ((r.snapshot_data as { skills?: SnapSkill[] } | null)?.skills ?? []) as SnapSkill[],
    }))
    .filter((s) => s.skills.length > 0);

  const results: Record<PeriodKey, Map<number, SkillRecord>> = {
    fiveMin: computePeriodRecords(snaps, PERIODS.fiveMin),
    day:     computePeriodRecords(snaps, PERIODS.day),
    week:    computePeriodRecords(snaps, PERIODS.week),
    month:   computePeriodRecords(snaps, PERIODS.month),
    year:    computePeriodRecords(snaps, PERIODS.year),
  };

  // Collect all skill ids present across all records
  const allIds = new Set<number>();
  for (const map of Object.values(results)) {
    for (const id of map.keys()) allIds.add(id);
  }

  // Build response keyed by skill id
  const records: RecordsResponse['records'] = {};
  for (const id of allIds) {
    records[id] = {
      fiveMin: results.fiveMin.get(id) ?? null,
      day:     results.day.get(id)     ?? null,
      week:    results.week.get(id)    ?? null,
      month:   results.month.get(id)   ?? null,
      year:    results.year.get(id)    ?? null,
    };
  }

  return NextResponse.json({ records });
}
