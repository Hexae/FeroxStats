import { db, getGroupMembers, type Group, type BotState } from '../db.js';
import {
  sendWebhook, Colors, playerLink, playerUrl, type Embed,
} from '../discord.js';

/**
 * Detects Hardcore Ironman deaths.
 *
 * Detection method: for players with game_mode = 'hardcore_ironman' we look at
 * their two most recent snapshots. If the overall rank was positive in the older
 * snapshot and becomes -1 (unranked) in the newer one, it's likely they died and
 * were removed from the HCIM hiscores on Ferox.ps.
 *
 * This is a heuristic — a disappearance from hiscores doesn't guarantee death
 * (the API can be temporarily unavailable). To reduce false positives we require
 * the rank to have been positive for at least two consecutive snapshots before
 * treating the disappearance as a death.
 */
export async function handleDeaths(group: Group): Promise<BotState> {
  const state = { ...group.bot_state };
  const webhookUrl = group.discord_webhook_url!;

  const members = await getGroupMembers(group.id);
  if (members.length === 0) return state;

  const usernames = members.map((m) => m.username);

  // Only process hardcore ironmen in this group
  const { data: hcPlayers } = await db
    .from('players')
    .select('username, display_name')
    .in('username', usernames)
    .eq('game_mode', 'hardcore_ironman');

  if (!hcPlayers || hcPlayers.length === 0) return state;

  const embeds: Embed[] = [];

  for (const player of hcPlayers) {
    // Get the 3 most recent snapshots to check rank trajectory
    const { data: snaps } = await db
      .from('player_snapshots')
      .select('created_at, snapshot_data')
      .eq('player_username', player.username)
      .order('created_at', { ascending: false })
      .limit(3);

    if (!snaps || snaps.length < 2) continue;

    type SnapSkill = { id: number; rank: number };
    const getRank = (snap: (typeof snaps)[number]) => {
      const overall = (snap.snapshot_data?.skills as SnapSkill[] | undefined)
        ?.find((s) => s.id === 0);
      return overall?.rank ?? -1;
    };

    const latestRank   = getRank(snaps[0]);
    const previousRank = getRank(snaps[1]);
    // Only fire if player was ranked before and is now unranked
    if (previousRank > 0 && latestRank <= 0) {
      // Extra safety: confirm the snapshot before that was also ranked (rule out transient API gaps)
      if (snaps.length >= 3 && getRank(snaps[2]) <= 0) continue;

      const display = player.display_name ?? player.username;
      embeds.push({
        title: '💀  Hardcore Ironman Died',
        description: `${playerLink(display, player.username)} has died and lost their Hardcore status.`,
        color: Colors.red,
        url: playerUrl(player.username),
        footer: { text: 'FeroxStats · HCIM' },
        timestamp: snaps[0].created_at,
      });
    }
  }

  if (embeds.length > 0) {
    for (let i = 0; i < embeds.length; i += 10) {
      await sendWebhook(webhookUrl, embeds.slice(i, i + 10));
    }
  }

  return state;
}
