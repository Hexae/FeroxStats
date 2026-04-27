import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const db = createClient(url, key, {
  auth: { persistSession: false },
});

// ─── Types mirroring the DB schema ────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  slug: string;
  discord_webhook_url: string | null;
  bot_state: BotState;
}

export interface BotState {
  last_event_at?: string;           // ISO – cursor for group_events
  last_achievement_check_at?: string; // ISO – cursor for snapshot-based 99 detection
  comp_notifications?: Record<string, string[]>; // compId -> ['started','starting_soon',...]
  last_update_slug?: string;
}

export interface GroupEvent {
  id: string;
  group_id: string;
  event_type: string;
  actor: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface Competition {
  id: string;
  group_id: string;
  name: string;
  metric: string;
  starts_at: string;
  ends_at: string;
}

export interface PlayerSnapshot {
  created_at: string;
  player_username: string;
  snapshot_data: {
    name?: string;
    skills?: Array<{ id: number; level: number; xp: string }>;
  };
}

export interface GroupMember {
  username: string;
  display_name?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Persist updated bot_state for a group. */
export async function saveBotState(groupId: string, state: BotState): Promise<void> {
  await db.from('groups').update({ bot_state: state }).eq('id', groupId);
}

/** Fetch all groups that have a Discord webhook configured. */
export async function getActiveGroups(): Promise<Group[]> {
  const { data, error } = await db
    .from('groups')
    .select('id, name, slug, discord_webhook_url, bot_state')
    .not('discord_webhook_url', 'is', null);

  if (error) {
    console.error('[db] getActiveGroups error:', error.message);
    return [];
  }
  return (data ?? []).map((g) => ({
    ...g,
    bot_state: (g.bot_state ?? {}) as BotState,
  }));
}

/** Fetch members of a group with their display names. */
export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data: members } = await db
    .from('group_members')
    .select('username')
    .eq('group_id', groupId);

  if (!members || members.length === 0) return [];

  const usernames = members.map((m) => m.username);
  const { data: players } = await db
    .from('players')
    .select('username, display_name')
    .in('username', usernames);

  const nameMap: Record<string, string> = {};
  for (const p of players ?? []) nameMap[p.username] = p.display_name ?? p.username;

  return members.map((m) => ({
    username: m.username,
    display_name: nameMap[m.username] ?? m.username,
  }));
}
