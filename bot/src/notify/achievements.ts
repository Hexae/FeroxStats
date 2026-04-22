import { db, getGroupMembers, type Group, type BotState } from '../db.js';
import {
  sendWebhook, Colors, playerLink, playerUrl, type Embed,
} from '../discord.js';

const SKILLS = [
  { id: 0,  name: 'Overall' },
  { id: 1,  name: 'Attack' },
  { id: 2,  name: 'Defence' },
  { id: 3,  name: 'Strength' },
  { id: 4,  name: 'Hitpoints' },
  { id: 5,  name: 'Ranged' },
  { id: 6,  name: 'Prayer' },
  { id: 7,  name: 'Magic' },
  { id: 8,  name: 'Cooking' },
  { id: 9,  name: 'Woodcutting' },
  { id: 10, name: 'Fletching' },
  { id: 11, name: 'Fishing' },
  { id: 12, name: 'Firemaking' },
  { id: 13, name: 'Crafting' },
  { id: 14, name: 'Smithing' },
  { id: 15, name: 'Mining' },
  { id: 16, name: 'Herblore' },
  { id: 17, name: 'Agility' },
  { id: 18, name: 'Thieving' },
  { id: 19, name: 'Slayer' },
  { id: 20, name: 'Farming' },
  { id: 21, name: 'Runecraft' },
  { id: 22, name: 'Hunter' },
  { id: 23, name: 'Construction' },
];

type SnapSkill = { id: number; level: number; xp: string };

export async function handleAchievements(group: Group): Promise<BotState> {
  const state = { ...group.bot_state };
  const webhookUrl = group.discord_webhook_url!;
  const since = state.last_achievement_check_at ?? new Date(0).toISOString();
  const nowStr = new Date().toISOString();

  const members = await getGroupMembers(group.id);
  if (members.length === 0) {
    state.last_achievement_check_at = nowStr;
    return state;
  }

  const usernames = members.map((m) => m.username);
  const displayMap: Record<string, string> = {};
  for (const m of members) displayMap[m.username] = m.display_name ?? m.username;

  // Get all snapshots newer than the cursor for these members, ordered oldest→newest
  const { data: newSnaps } = await db
    .from('player_snapshots')
    .select('player_username, created_at, snapshot_data')
    .in('player_username', usernames)
    .gt('created_at', since)
    .order('created_at', { ascending: true });

  if (!newSnaps || newSnaps.length === 0) {
    state.last_achievement_check_at = nowStr;
    return state;
  }

  // Get one snapshot before `since` per member — the baseline
  const baselineSnaps = await Promise.all(
    usernames.map((u) =>
      db
        .from('player_snapshots')
        .select('player_username, snapshot_data')
        .eq('player_username', u)
        .lte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ),
  );

  // Build baseline: the last known levels per player before the window
  const baselineMap = new Map<string, Map<number, number>>(); // username -> skillId -> level
  for (const res of baselineSnaps) {
    const row = res.data;
    if (!row) continue;
    const skills = (row.snapshot_data?.skills ?? []) as SnapSkill[];
    const skillMap = new Map<number, number>();
    for (const s of skills) skillMap.set(s.id, s.level);
    baselineMap.set(row.player_username, skillMap);
  }

  // Walk through new snapshots in order, updating a running level state per player
  // and emitting 99 notifications when a skill crosses 99.
  const runningState = new Map<string, Map<number, number>>(
    [...baselineMap.entries()].map(([u, m]) => [u, new Map(m)]),
  );
  const embeds: Embed[] = [];

  for (const snap of newSnaps) {
    const u = snap.player_username;
    const prevLevels = runningState.get(u) ?? new Map<number, number>();
    const newSkills  = (snap.snapshot_data?.skills ?? []) as SnapSkill[];

    for (const skill of newSkills) {
      if (skill.id === 0) continue; // skip Overall
      const prev = prevLevels.get(skill.id) ?? 0;
      if (prev < 99 && skill.level >= 99) {
        const skillName = SKILLS.find((s) => s.id === skill.id)?.name ?? `Skill ${skill.id}`;
        const display = displayMap[u] ?? u;
        embeds.push({
          title: '🎉  New member achievement!',
          description: `${playerLink(display, u)} — ✅ 99 ${skillName}`,
          color: Colors.gold,
          url: playerUrl(u),
          footer: { text: 'FeroxStats · Achievement' },
          timestamp: snap.created_at,
        });
      }
      prevLevels.set(skill.id, skill.level);
    }

    // Update running state
    runningState.set(u, prevLevels);
  }

  if (embeds.length > 0) {
    for (let i = 0; i < embeds.length; i += 10) {
      await sendWebhook(webhookUrl, embeds.slice(i, i + 10));
    }
  }

  state.last_achievement_check_at = nowStr;
  return state;
}
