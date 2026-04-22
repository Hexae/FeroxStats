import { db, type Group, type BotState, type GroupEvent } from '../db.js';
import {
  sendWebhook, Colors, playerLink, playerUrl, groupUrl, type Embed,
} from '../discord.js';

export async function handleMembers(group: Group): Promise<BotState> {
  const state = { ...group.bot_state };
  const webhookUrl = group.discord_webhook_url!;
  const since = state.last_event_at ?? new Date(0).toISOString();
  const nowStr = new Date().toISOString();

  const { data: events } = await db
    .from('group_events')
    .select('id, event_type, actor, target, metadata, created_at')
    .eq('group_id', group.id)
    .in('event_type', ['member_joined', 'member_left', 'member_kicked', 'member_request_accepted'])
    .gt('created_at', since)
    .order('created_at', { ascending: true });

  if (!events || events.length === 0) {
    state.last_event_at = nowStr;
    return state;
  }

  // Resolve display names for all actors + targets involved
  const usernamesNeeded = new Set<string>();
  for (const e of events as GroupEvent[]) {
    usernamesNeeded.add(e.actor);
    if (e.target) usernamesNeeded.add(e.target);
  }

  const { data: players } = await db
    .from('players')
    .select('username, display_name')
    .in('username', [...usernamesNeeded]);

  const nameMap: Record<string, string> = {};
  for (const p of players ?? []) nameMap[p.username] = p.display_name ?? p.username;
  const dn = (u: string) => nameMap[u] ?? u;

  const embeds: Embed[] = [];

  for (const event of events as GroupEvent[]) {
    const actorLink = playerLink(dn(event.actor), event.actor);

    switch (event.event_type) {
      case 'member_joined':
      case 'member_request_accepted':
        embeds.push({
          title: '👋  New member joined',
          description: `${actorLink} joined **[${group.name}](${groupUrl(group.slug)})**`,
          color: Colors.green,
          url: playerUrl(event.actor),
          footer: { text: 'FeroxStats · Group' },
          timestamp: event.created_at,
        });
        break;

      case 'member_left':
        embeds.push({
          title: '🚪  Member left',
          description: `${actorLink} left **[${group.name}](${groupUrl(group.slug)})**`,
          color: Colors.grey,
          url: playerUrl(event.actor),
          footer: { text: 'FeroxStats · Group' },
          timestamp: event.created_at,
        });
        break;

      case 'member_kicked': {
        const targetLink = event.target
          ? playerLink(dn(event.target), event.target)
          : '*(unknown)*';
        embeds.push({
          title: '🦵  Member removed',
          description: `${targetLink} was removed from **[${group.name}](${groupUrl(group.slug)})** by ${actorLink}`,
          color: Colors.red,
          url: event.target ? playerUrl(event.target) : undefined,
          footer: { text: 'FeroxStats · Group' },
          timestamp: event.created_at,
        });
        break;
      }
    }
  }

  if (embeds.length > 0) {
    for (let i = 0; i < embeds.length; i += 10) {
      await sendWebhook(webhookUrl, embeds.slice(i, i + 10));
    }
  }

  // Advance cursor to the latest event processed
  const lastEvent = events[events.length - 1] as GroupEvent;
  state.last_event_at = lastEvent.created_at;

  return state;
}
