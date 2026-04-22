import { NextRequest, NextResponse } from 'next/server';
import { serviceClient } from '@/lib/supabase-service';
import { SKILLS } from '@/lib/osrs';

// Non-overall skill count after Sailing was added to Ferox.
// Snapshots with fewer non-overall skills than this threshold are considered
// "pre-Sailing" and their achievements will be marked as legacy.
const POST_SAILING_SKILL_COUNT = 24;

const BASE_TARGETS = [60, 70, 80, 90, 99] as const;

type SnapSkill = { id: number; level: number; xp?: string };

export interface SkillAchievement {
  key: string;
  label: string;
  skillId?: number;
  completedAt: string;
  isLegacy: boolean;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const decoded = decodeURIComponent(username).toLowerCase();
  const db = serviceClient();

  const { data: snaps } = await db
    .from('player_snapshots')
    .select('created_at, snapshot_data')
    .eq('player_username', decoded)
    .order('created_at', { ascending: true });

  if (!snaps || snaps.length === 0) {
    return NextResponse.json({ achievements: [] });
  }

  // Determine if Sailing exists in the latest snapshot
  const latestSkills = (
    ((snaps[snaps.length - 1].snapshot_data as { skills?: SnapSkill[] } | null)?.skills ?? []) as SnapSkill[]
  ).filter((s) => s.id !== 0);
  const hasSailing = latestSkills.length >= POST_SAILING_SKILL_COUNT;

  const achieved = new Map<string, SkillAchievement>();

  for (const snap of snaps) {
    const skills = ((snap.snapshot_data as { skills?: SnapSkill[] } | null)?.skills ?? []) as SnapSkill[];
    const nonOverall = skills.filter((s) => s.id !== 0);
    if (nonOverall.length === 0) continue;

    const isLegacy = hasSailing && nonOverall.length < POST_SAILING_SKILL_COUNT;
    const era = isLegacy ? 'legacy' : 'current';

    // Individual skill 99s
    for (const skill of nonOverall) {
      const key = `skill99_${skill.id}`;
      if (!achieved.has(key) && skill.level >= 99) {
        const skillName = SKILLS.find((s) => s.id === skill.id)?.name ?? `Skill ${skill.id}`;
        achieved.set(key, {
          key,
          label: `99 ${skillName}`,
          skillId: skill.id,
          completedAt: snap.created_at ?? '',
          isLegacy,
        });
      }
    }

    // Base N Stats milestones
    for (const target of BASE_TARGETS) {
      const key = `base${target}_${era}`;
      if (!achieved.has(key) && nonOverall.every((s) => s.level >= target)) {
        const baseLabel = target === 99 ? 'Max Cape' : `Base ${target} Stats`;
        achieved.set(key, {
          key,
          label: isLegacy ? `${baseLabel} (Pre-Sailing)` : baseLabel,
          completedAt: snap.created_at ?? '',
          isLegacy,
        });
      }
    }
  }

  return NextResponse.json({ achievements: Array.from(achieved.values()) });
}
