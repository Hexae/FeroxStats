import { db, saveBotState, type Group, type BotState } from '../db.js';
import {
  sendWebhook, Colors, competitionUrl, groupUrl,
  capitalize, formatDuration, type Embed,
} from '../discord.js';

const STARTING_SOON_WINDOW_MS = 5 * 60 * 1000;   // notify if starting within 5 min
const ENDING_SOON_WINDOW_MS   = 60 * 60 * 1000;  // notify if ending within 60 min

type CompNotifKey = 'starting_soon' | 'started' | 'ending_soon' | 'ended';

function hasNotified(state: BotState, compId: string, key: CompNotifKey): boolean {
  return (state.comp_notifications?.[compId] ?? []).includes(key);
}

function markNotified(state: BotState, compId: string, key: CompNotifKey): void {
  if (!state.comp_notifications) state.comp_notifications = {};
  const existing = state.comp_notifications[compId] ?? [];
  if (!existing.includes(key)) {
    state.comp_notifications[compId] = [...existing, key];
  }
}

function pruneOldCompNotifications(state: BotState, activeIds: Set<string>): void {
  if (!state.comp_notifications) return;
  for (const id of Object.keys(state.comp_notifications)) {
    if (!activeIds.has(id)) {
      delete state.comp_notifications[id];
    }
  }
}

export async function handleCompetitions(group: Group): Promise<BotState> {
  const state = { ...group.bot_state };
  const webhookUrl = group.discord_webhook_url!;
  const now = new Date();
  const nowStr = now.toISOString();

  // Fetch all non-ended competitions for this group
  const { data: comps } = await db
    .from('group_competitions')
    .select('id, name, metric, starts_at, ends_at')
    .eq('group_id', group.id)
    .gte('ends_at', new Date(now.getTime() - 3_600_000).toISOString()); // ended up to 1h ago

  if (!comps || comps.length === 0) return state;

  const activeIds = new Set(comps.map((c) => c.id));
  pruneOldCompNotifications(state, activeIds);

  const embeds: Embed[] = [];

  for (const comp of comps) {
    const startsAt = new Date(comp.starts_at).getTime();
    const endsAt   = new Date(comp.ends_at).getTime();
    const nowMs    = now.getTime();
    const msToStart = startsAt - nowMs;
    const msToEnd   = endsAt   - nowMs;
    const hasStarted = startsAt <= nowMs;
    const hasEnded   = endsAt   <= nowMs;
    const durationMs = endsAt - startsAt;

    const metricLabel = capitalize(comp.metric);
    const compLink = `[${comp.name}](${competitionUrl(comp.id)})`;

    // ── Starting soon (5 min warning) ────────────────────────────────────────
    if (!hasStarted && msToStart <= STARTING_SOON_WINDOW_MS && msToStart > 0
        && !hasNotified(state, comp.id, 'starting_soon')) {
      embeds.push({
        title: `⏰  ${comp.name} is starting in 5 minutes`,
        color: Colors.blue,
        fields: [
          { name: 'Metric', value: metricLabel, inline: true },
          { name: 'Duration', value: formatDuration(durationMs), inline: true },
          { name: 'Group', value: `[${group.name}](${groupUrl(group.slug)})`, inline: true },
        ],
        url: competitionUrl(comp.id),
        footer: { text: 'FeroxStats · Competition' },
        timestamp: nowStr,
      });
      markNotified(state, comp.id, 'starting_soon');
    }

    // ── Competition started ────────────────────────────────────────────────
    if (hasStarted && !hasEnded && !hasNotified(state, comp.id, 'started')) {
      embeds.push({
        title: `🏁  ${comp.name} has started!`,
        description: `Track progress on the [competition page](${competitionUrl(comp.id)}).`,
        color: Colors.green,
        fields: [
          { name: 'Metric', value: metricLabel, inline: true },
          { name: 'Ends', value: `<t:${Math.floor(endsAt / 1000)}:R>`, inline: true },
          { name: 'Group', value: `[${group.name}](${groupUrl(group.slug)})`, inline: true },
        ],
        url: competitionUrl(comp.id),
        footer: { text: 'FeroxStats · Competition' },
        timestamp: nowStr,
      });
      markNotified(state, comp.id, 'started');
    }

    // ── Ending soon (1h warning) ──────────────────────────────────────────
    if (hasStarted && !hasEnded && msToEnd <= ENDING_SOON_WINDOW_MS && msToEnd > 0
        && !hasNotified(state, comp.id, 'ending_soon')) {
      embeds.push({
        title: `⌛  ${comp.name} ends in ${formatDuration(msToEnd)}`,
        color: Colors.yellow,
        fields: [
          { name: 'Metric', value: metricLabel, inline: true },
          { name: 'Group', value: `[${group.name}](${groupUrl(group.slug)})`, inline: true },
        ],
        url: competitionUrl(comp.id),
        footer: { text: 'FeroxStats · Competition' },
        timestamp: nowStr,
      });
      markNotified(state, comp.id, 'ending_soon');
    }

    // ── Competition ended + top 3 results ─────────────────────────────────
    if (hasEnded && !hasNotified(state, comp.id, 'ended')) {
      // Fetch standings to build a podium
      const { data: members } = await db
        .from('group_members')
        .select('username')
        .eq('group_id', group.id);

      const usernames = (members ?? []).map((m) => m.username);
      let podium = '';

      if (usernames.length > 0 && comp.metric !== 'overall') {
        const skillNames = [
          'overall','attack','defence','strength','hitpoints','ranged',
          'prayer','magic','cooking','woodcutting','fletching','fishing',
          'firemaking','crafting','smithing','mining','herblore','agility',
          'thieving','slayer','farming','runecraft','hunter','construction',
        ];
        const skillId = skillNames.indexOf(comp.metric.toLowerCase());

        if (skillId >= 0) {
          // Get snapshots at start and end of competition for all members
          type SnapRow = { player_username: string; created_at: string; snapshot_data: { skills?: Array<{ id: number; xp: string }> } };

          const [{ data: startSnaps }, { data: endSnaps }] = await Promise.all([
            db.from('player_snapshots')
              .select('player_username, created_at, snapshot_data')
              .in('player_username', usernames)
              .lte('created_at', comp.starts_at)
              .order('created_at', { ascending: false })
              .limit(usernames.length),
            db.from('player_snapshots')
              .select('player_username, created_at, snapshot_data')
              .in('player_username', usernames)
              .gte('created_at', comp.starts_at)
              .lte('created_at', comp.ends_at)
              .order('created_at', { ascending: false })
              .limit(usernames.length),
          ]);

          const startMap = new Map<string, number>();
          for (const s of (startSnaps as SnapRow[] | null) ?? []) {
            if (!startMap.has(s.player_username)) {
              const skill = s.snapshot_data?.skills?.find((sk) => sk.id === skillId);
              startMap.set(s.player_username, skill ? parseInt(skill.xp) : 0);
            }
          }

          const gains: Array<{ username: string; xp: number }> = [];
          const seen = new Set<string>();
          for (const s of (endSnaps as SnapRow[] | null) ?? []) {
            if (seen.has(s.player_username)) continue;
            seen.add(s.player_username);
            const skill = s.snapshot_data?.skills?.find((sk) => sk.id === skillId);
            const endXp   = skill ? parseInt(skill.xp) : 0;
            const startXp = startMap.get(s.player_username) ?? 0;
            if (endXp > startXp) gains.push({ username: s.player_username, xp: endXp - startXp });
          }

          gains.sort((a, b) => b.xp - a.xp);
          const medals = ['🥇', '🥈', '🥉'];
          podium = gains
            .slice(0, 3)
            .map((g, i) => `${medals[i]} **${g.username}** — +${fmtXp(g.xp)} xp`)
            .join('\n');
        }
      }

      embeds.push({
        title: `🏆  ${comp.name} has ended`,
        description: podium || 'No XP gains recorded.',
        color: Colors.purple,
        fields: [
          { name: 'Metric', value: metricLabel, inline: true },
          { name: 'Duration', value: formatDuration(durationMs), inline: true },
          { name: 'Group', value: `[${group.name}](${groupUrl(group.slug)})`, inline: true },
        ],
        url: competitionUrl(comp.id),
        footer: { text: 'FeroxStats · Competition' },
        timestamp: nowStr,
      });
      markNotified(state, comp.id, 'ended');
    }
  }

  if (embeds.length > 0) {
    // Discord allows max 10 embeds per message
    for (let i = 0; i < embeds.length; i += 10) {
      await sendWebhook(webhookUrl, embeds.slice(i, i + 10));
    }
  }

  return state;
}

function fmtXp(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)}M`;
  if (xp >= 1_000)     return `${(xp / 1_000).toFixed(1)}K`;
  return xp.toLocaleString();
}
