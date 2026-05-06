import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { subDays, subMonths, subYears } from 'date-fns';

type Period = 'day' | 'week' | 'month' | 'year' | 'all';

function getPeriodStart(period: Period): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  switch (period) {
    case 'day':   return subDays(now, 1);
    case 'week':  return subDays(now, 7);
    case 'month': return subMonths(now, 1);
    case 'year':  return subYears(now, 1);
  }
}

type SnapRow = { created_at: string | null; total_xp: number | null; snapshot_data?: unknown };

async function fetchSnapshots(
  db: ReturnType<typeof serviceClient>,
  username: string,
  since?: Date | null,
): Promise<SnapRow[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: SnapRow[] = [];

  while (true) {
    let query = db
      .from('player_snapshots')
      .select('created_at, total_xp, snapshot_data')
      .eq('player_username', username)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data ?? []) as SnapRow[];
    rows.push(...batch);

    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function extractTotalXp(row: SnapRow): number {
  if (row.total_xp != null && row.total_xp > 0) return row.total_xp;
  const overall = (row.snapshot_data as { skills?: Array<{ id: number; xp: string }> } | null)?.skills?.find((s) => s.id === 0);
  if (overall?.xp) {
    const n = parseInt(overall.xp);
    if (!isNaN(n) && n > 0) return n;
  }
  return 0;
}

function buildDailyXpGains(snaps: SnapRow[]): Array<{ date: string; xp: number }> {
  const byDay = new Map<string, { min: number; max: number }>();
  for (const s of snaps) {
    const day = (s.created_at ?? '').slice(0, 10);
    const xp = extractTotalXp(s);
    if (xp === 0) continue;
    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, { min: xp, max: xp });
    } else {
      byDay.set(day, { min: Math.min(existing.min, xp), max: Math.max(existing.max, xp) });
    }
  }
  const sorted = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  return sorted.map(([date, { min, max }], i) => ({
    date,
    xp: i === 0
      ? Math.max(0, max - min)
      : Math.max(0, max - sorted[i - 1][1].max),
  }));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).toLowerCase();
  const raw = request.nextUrl.searchParams.get('period') ?? 'week';
  const period = (['day', 'week', 'month', 'year', 'all'].includes(raw) ? raw : 'week') as Period;

  const db = serviceClient();

  const since = getPeriodStart(period);
  const oneYearAgo = subYears(new Date(), 1);

  const [snaps, yearSnaps] = await Promise.all([
    fetchSnapshots(db, decoded, since),
    fetchSnapshots(db, decoded, oneYearAgo),
  ]);

  const heatmap = buildDailyXpGains(yearSnaps ?? []);

  if (!snaps || snaps.length < 2) {
    return NextResponse.json({
      period,
      gains: null,
      heatmap,
      message:
        snaps?.length === 1
          ? 'Only one snapshot in this period — visit again later to compare.'
          : 'No snapshots in this period. Visit this page to start tracking.',
    });
  }

  const oldest = snaps[0];
  const latest = snaps[snaps.length - 1];
  const oldestXp = extractTotalXp(oldest);
  const latestXp = extractTotalXp(latest);

  type SkillRow = { id: number; rank: number; level: number; xp: string };
  const snapshotData = (data: unknown) => data as { skills?: SkillRow[] } | null;
  const parseXp = (xp: string) => {
    const n = parseInt(xp);
    return isNaN(n) || n < 0 ? 0 : n;
  };

  const oldMap = new Map<number, SkillRow>();
  const newMap = new Map<number, SkillRow>();
  for (const s of (snapshotData(oldest.snapshot_data)?.skills ?? []) as SkillRow[]) oldMap.set(s.id, s);
  for (const s of (snapshotData(latest.snapshot_data)?.skills ?? []) as SkillRow[]) newMap.set(s.id, s);

  const skillGains: Array<{
    id: number;
    xpGained: number;
    levelsGained: number;
    rankChange: number;
  }> = [];

  for (const [id, nv] of newMap) {
    const ov = oldMap.get(id);
    if (!ov) continue;
    skillGains.push({
      id,
      xpGained: parseXp(nv.xp) - parseXp(ov.xp),
      levelsGained: nv.level - ov.level,
      rankChange: ov.rank > 0 && nv.rank > 0 ? ov.rank - nv.rank : 0,
    });
  }

  return NextResponse.json({
    period,
    gains: true,
    start: oldest.created_at,
    end: latest.created_at,
    xpStart: oldestXp,
    xpEnd: latestXp,
    totalXpGained: latestXp - oldestXp,
    skillGains,
    dailyGains: buildDailyXpGains(snaps),
    heatmap,
  });
}
